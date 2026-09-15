import { and, asc, desc, eq, inArray, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  holdings,
  InsertUser,
  orders,
  priceHistory,
  products,
  trades,
  transactions,
  users,
  wallets,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  const savedUser = await getUserByOpenId(user.openId);
  if (!savedUser) return;
  const initialBalance = process.env.INITIAL_BALANCE ?? "100000.00";
  await db.insert(wallets).values({ userId: savedUser.id, balance: initialBalance, lockedBalance: "0.00" }).onDuplicateKeyUpdate({ set: { userId: savedUser.id } });
  const existingDeposit = await db.select({ id: transactions.id }).from(transactions).where(and(eq(transactions.userId, savedUser.id), eq(transactions.type, "DEPOSIT"))).limit(1);
  if (existingDeposit.length === 0) {
    await db.insert(transactions).values({ userId: savedUser.id, type: "DEPOSIT", amount: initialBalance, description: "Welcome allocation of TradeCoin" });
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listProducts(input: { query?: string; category?: string; limit: number }) {
  const db = await getDb();
  if (!db) return [];
  const filters = [];
  if (input.category && input.category !== "All") filters.push(eq(products.category, input.category));
  if (input.query?.trim()) {
    const term = `%${input.query.trim()}%`;
    filters.push(or(like(products.name, term), like(products.category, term)));
  }
  return db
    .select()
    .from(products)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(products.volume), asc(products.name))
    .limit(input.limit);
}

export async function getMarket(productId: number) {
  const db = await getDb();
  if (!db) return null;
  const product = (await db.select().from(products).where(eq(products.id, productId)).limit(1))[0];
  if (!product) return null;
  const activeStatuses = ["OPEN", "PARTIALLY_FILLED"] as const;
  const [buyOrders, sellOrders, recentTrades, history] = await Promise.all([
    db.select().from(orders).where(and(eq(orders.productId, productId), eq(orders.orderType, "BUY"), inArray(orders.status, activeStatuses))).orderBy(desc(orders.price), asc(orders.createdAt), asc(orders.id)).limit(12),
    db.select().from(orders).where(and(eq(orders.productId, productId), eq(orders.orderType, "SELL"), inArray(orders.status, activeStatuses))).orderBy(asc(orders.price), asc(orders.createdAt), asc(orders.id)).limit(12),
    db.select().from(trades).where(eq(trades.productId, productId)).orderBy(desc(trades.executedAt), desc(trades.id)).limit(12),
    db.select().from(priceHistory).where(eq(priceHistory.productId, productId)).orderBy(asc(priceHistory.recordedAt)).limit(180),
  ]);
  return {
    product,
    buyOrders,
    sellOrders,
    recentTrades,
    history,
    bestBid: buyOrders[0]?.price ?? null,
    bestAsk: sellOrders[0]?.price ?? null,
  };
}

export async function getAccountOverview(userId: number) {
  const db = await getDb();
  if (!db) return null;
  let wallet = (await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1))[0] ?? null;
  if (!wallet) {
    const initialBalance = process.env.INITIAL_BALANCE ?? "100000.00";
    await db.insert(wallets).values({ userId, balance: initialBalance, lockedBalance: "0.00" });
    wallet = (await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1))[0] ?? null;
  }
  const userHoldings = await db.select({ holding: holdings, product: products }).from(holdings).innerJoin(products, eq(holdings.productId, products.id)).where(eq(holdings.userId, userId)).orderBy(desc(holdings.quantity));
  const activeOrders = await db.select({ order: orders, product: products }).from(orders).innerJoin(products, eq(orders.productId, products.id)).where(and(eq(orders.userId, userId), inArray(orders.status, ["OPEN", "PARTIALLY_FILLED"]))).orderBy(desc(orders.createdAt)).limit(30);
  const userTransactions = await db.select({ transaction: transactions, product: products }).from(transactions).leftJoin(products, eq(transactions.productId, products.id)).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt), desc(transactions.id)).limit(30);
  return { wallet, holdings: userHoldings, activeOrders, transactions: userTransactions };
}
