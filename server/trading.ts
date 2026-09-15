import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { holdings, orders, priceHistory, products, trades, transactions, wallets } from "../drizzle/schema";

export type OrderSide = "BUY" | "SELL";

export function amountToCents(input: string): bigint {
  const value = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new TRPCError({ code: "BAD_REQUEST", message: "Price must be a positive amount with up to 2 decimals." });
  const [whole, fraction = ""] = value.split(".");
  const cents = `${fraction}00`.slice(0, 2);
  const amount = BigInt(whole) * BigInt(100) + BigInt(cents);
  return amount;
}

export function moneyToCents(input: string): bigint {
  const amount = amountToCents(input);
  if (amount <= BigInt(0)) throw new TRPCError({ code: "BAD_REQUEST", message: "Price must be greater than zero." });
  return amount;
}

export function centsToMoney(cents: bigint): string {
  const sign = cents < BigInt(0) ? "-" : "";
  const absolute = cents < BigInt(0) ? -cents : cents;
  return `${sign}${absolute / BigInt(100)}.${(absolute % BigInt(100)).toString().padStart(2, "0")}`;
}

export function normalizeOrderPrice(input: string | undefined, marketPrice: string): string {
  return input?.trim() ? input : marketPrice;
}

function amountFor(price: string, quantity: number) {
  return centsToMoney(moneyToCents(price) * BigInt(quantity));
}

function min(a: number, b: number) {
  return a < b ? a : b;
}

export async function placeLimitOrder(input: { userId: number; productId: number; side: OrderSide; price?: string; quantity: number }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." });
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Quantity must be greater than zero." });

  return db.transaction(async (tx) => {
    const product = (await tx.select().from(products).where(eq(products.id, input.productId)).limit(1))[0];
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
    // An omitted/blank price means “use the current simulated market price”.
    // Explicit zero, negative, or malformed values still fail closed in moneyToCents.
    const priceCents = moneyToCents(normalizeOrderPrice(input.price, product.currentPrice));

    const wallet = (await tx.select().from(wallets).where(eq(wallets.userId, input.userId)).limit(1))[0];
    if (!wallet) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Wallet is not initialized for this account." });

    let holding = (await tx.select().from(holdings).where(and(eq(holdings.userId, input.userId), eq(holdings.productId, input.productId))).limit(1))[0];
    if (input.side === "BUY") {
      const available = amountToCents(wallet.balance) - amountToCents(wallet.lockedBalance);
      const required = priceCents * BigInt(input.quantity);
      if (available < required) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Insufficient available TradeCoin for this order." });
      await tx.update(wallets).set({ lockedBalance: centsToMoney(amountToCents(wallet.lockedBalance) + required) }).where(eq(wallets.id, wallet.id));
    } else {
      if (!holding || holding.quantity - holding.lockedQuantity < input.quantity) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Insufficient available inventory for this sell order." });
      await tx.update(holdings).set({ lockedQuantity: holding.lockedQuantity + input.quantity }).where(eq(holdings.id, holding.id));
    }

    const inserted = await tx.insert(orders).values({
      userId: input.userId,
      productId: input.productId,
      orderType: input.side,
      price: centsToMoney(priceCents),
      quantity: input.quantity,
      filledQuantity: 0,
      remainingQuantity: input.quantity,
      status: "OPEN",
    }).$returningId();
    const incomingId = inserted[0]?.id;
    if (!incomingId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Order could not be created." });

    let incoming = (await tx.select().from(orders).where(eq(orders.id, incomingId)).limit(1))[0]!;
    const tradesCreated: number[] = [];
    const oppositeSide = input.side === "BUY" ? "SELL" : "BUY";

    while (incoming.remainingQuantity > 0) {
      const candidates = await tx.select().from(orders)
        .where(and(eq(orders.productId, input.productId), eq(orders.orderType, oppositeSide), inArray(orders.status, ["OPEN", "PARTIALLY_FILLED"]), input.side === "BUY" ? undefined : undefined))
        .orderBy(input.side === "BUY" ? asc(orders.price) : desc(orders.price), asc(orders.createdAt), asc(orders.id))
        .limit(50);
      const candidate = candidates.find((order) => input.side === "BUY" ? moneyToCents(incoming.price) >= moneyToCents(order.price) : moneyToCents(incoming.price) <= moneyToCents(order.price));
      if (!candidate) break;

      const fillQuantity = min(incoming.remainingQuantity, candidate.remainingQuantity);
      const executionPrice = moneyToCents(candidate.price);
      const total = executionPrice * BigInt(fillQuantity);
      const buyerOrder = input.side === "BUY" ? incoming : candidate;
      const sellerOrder = input.side === "SELL" ? incoming : candidate;
      const buyerWallet = (await tx.select().from(wallets).where(eq(wallets.userId, buyerOrder.userId)).limit(1))[0];
      const sellerWallet = (await tx.select().from(wallets).where(eq(wallets.userId, sellerOrder.userId)).limit(1))[0];
      const buyerHolding = (await tx.select().from(holdings).where(and(eq(holdings.userId, buyerOrder.userId), eq(holdings.productId, input.productId))).limit(1))[0];
      const sellerHolding = (await tx.select().from(holdings).where(and(eq(holdings.userId, sellerOrder.userId), eq(holdings.productId, input.productId))).limit(1))[0];
      if (!buyerWallet || !sellerWallet || !sellerHolding) throw new TRPCError({ code: "CONFLICT", message: "Settlement prerequisites are no longer valid." });

      const buyerReservedForFill = moneyToCents(buyerOrder.price) * BigInt(fillQuantity);
      await tx.update(wallets).set({
        lockedBalance: centsToMoney(amountToCents(buyerWallet.lockedBalance) - buyerReservedForFill),
        balance: centsToMoney(amountToCents(buyerWallet.balance) - total),
      }).where(eq(wallets.id, buyerWallet.id));
      await tx.update(wallets).set({ balance: centsToMoney(amountToCents(sellerWallet.balance) + total) }).where(eq(wallets.id, sellerWallet.id));

      if (buyerHolding) {
        const newQuantity = buyerHolding.quantity + fillQuantity;
        const priorCost = amountToCents(buyerHolding.averageCost) * BigInt(buyerHolding.quantity);
        const averageCost = newQuantity === 0 ? "0.00" : centsToMoney((priorCost + total) / BigInt(newQuantity));
        await tx.update(holdings).set({ quantity: newQuantity, averageCost }).where(eq(holdings.id, buyerHolding.id));
      } else {
        await tx.insert(holdings).values({ userId: buyerOrder.userId, productId: input.productId, quantity: fillQuantity, lockedQuantity: 0, averageCost: centsToMoney(total / BigInt(fillQuantity)) });
      }
      await tx.update(holdings).set({ quantity: sellerHolding.quantity - fillQuantity, lockedQuantity: sellerHolding.lockedQuantity - fillQuantity }).where(eq(holdings.id, sellerHolding.id));

      const buyerRemaining = buyerOrder.remainingQuantity - fillQuantity;
      const sellerRemaining = sellerOrder.remainingQuantity - fillQuantity;
      await tx.update(orders).set({ filledQuantity: buyerOrder.filledQuantity + fillQuantity, remainingQuantity: buyerRemaining, status: buyerRemaining === 0 ? "FILLED" : "PARTIALLY_FILLED" }).where(eq(orders.id, buyerOrder.id));
      await tx.update(orders).set({ filledQuantity: sellerOrder.filledQuantity + fillQuantity, remainingQuantity: sellerRemaining, status: sellerRemaining === 0 ? "FILLED" : "PARTIALLY_FILLED" }).where(eq(orders.id, sellerOrder.id));

      const created = await tx.insert(trades).values({ productId: input.productId, buyOrderId: buyerOrder.id, sellOrderId: sellerOrder.id, buyerId: buyerOrder.userId, sellerId: sellerOrder.userId, price: centsToMoney(executionPrice), quantity: fillQuantity, totalValue: centsToMoney(total) }).$returningId();
      const tradeId = created[0]?.id;
      if (tradeId) tradesCreated.push(tradeId);
      await tx.insert(transactions).values([
        { userId: buyerOrder.userId, productId: input.productId, tradeId, type: "BUY", amount: centsToMoney(-total), quantity: fillQuantity, description: `Bought ${fillQuantity} units at ${centsToMoney(executionPrice)} TC` },
        { userId: sellerOrder.userId, productId: input.productId, tradeId, type: "SELL", amount: centsToMoney(total), quantity: fillQuantity, description: `Sold ${fillQuantity} units at ${centsToMoney(executionPrice)} TC` },
      ]);
      const nextHigh = moneyToCents(product.highPrice) > executionPrice ? product.highPrice : centsToMoney(executionPrice);
      const nextLow = moneyToCents(product.lowPrice) < executionPrice ? product.lowPrice : centsToMoney(executionPrice);
      await tx.update(products).set({ previousPrice: product.currentPrice, currentPrice: centsToMoney(executionPrice), highPrice: nextHigh, lowPrice: nextLow, volume: product.volume + fillQuantity }).where(eq(products.id, product.id));
      await tx.insert(priceHistory).values({ productId: input.productId, price: centsToMoney(executionPrice), volume: fillQuantity });

      incoming = (await tx.select().from(orders).where(eq(orders.id, incomingId)).limit(1))[0]!;
    }

    const finalOrder = (await tx.select().from(orders).where(eq(orders.id, incomingId)).limit(1))[0]!;
    return { order: finalOrder, tradesCreated };
  });
}

export async function cancelOrder(userId: number, orderId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." });
  return db.transaction(async (tx) => {
    const order = (await tx.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1))[0];
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
    if (order.status === "FILLED" || order.status === "CANCELLED") throw new TRPCError({ code: "BAD_REQUEST", message: "Only open orders can be cancelled." });
    const remaining = order.remainingQuantity;
    const wallet = (await tx.select().from(wallets).where(eq(wallets.userId, userId)).limit(1))[0];
    if (order.orderType === "BUY" && wallet) {
      const release = moneyToCents(order.price) * BigInt(remaining);
      await tx.update(wallets).set({ lockedBalance: centsToMoney(amountToCents(wallet.lockedBalance) - release) }).where(eq(wallets.id, wallet.id));
      await tx.insert(transactions).values({ userId, productId: order.productId, type: "CANCEL_RELEASE", amount: centsToMoney(release), quantity: remaining, description: `Released reservation from cancelled order #${order.id}` });
    } else {
      const holding = (await tx.select().from(holdings).where(and(eq(holdings.userId, userId), eq(holdings.productId, order.productId))).limit(1))[0];
      if (holding) await tx.update(holdings).set({ lockedQuantity: Math.max(0, holding.lockedQuantity - remaining) }).where(eq(holdings.id, holding.id));
    }
    await tx.update(orders).set({ status: "CANCELLED", remainingQuantity: 0 }).where(eq(orders.id, order.id));
    return { success: true as const };
  });
}
