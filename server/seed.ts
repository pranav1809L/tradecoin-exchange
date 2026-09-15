import "dotenv/config";
import { and, eq, inArray, like, or } from "drizzle-orm";
import { getDb } from "./db";
import { holdings, orders, priceHistory, products, trades, transactions, users, wallets } from "../drizzle/schema";

const INITIAL_BALANCE = process.env.INITIAL_BALANCE ?? "100000.00";
const PREFIX = "Seed • ";

const catalog: Array<{ category: string; names: string[] }> = [
  { category: "Smartphones", names: ["Aster Nova X", "Pixel Harbor Pro", "Lumen Fold 2", "Orbit One Ultra", "Cedar Mobile 9", "Vanta Edge Max"] },
  { category: "Laptops", names: ["Northstar Air 14", "ForgeBook Studio", "Mosaic Pro 16", "Atlas Carbon", "CedarBook Flex", "Vector Workstation 15"] },
  { category: "Tablets", names: ["Canvas Tab 11", "Orbit Slate Pro", "Lumen Tab Mini", "Northstar Reader Max"] },
  { category: "Gaming", names: ["DriftBox X", "Arcade Core S", "Nebula Handheld", "RiftStation Pro", "Pulse Controller Elite", "QuestDock VR"] },
  { category: "Computer Components", names: ["Titan 7800 Graphics", "ForgeCore i7 Board", "Aster DDR5 32GB", "Vector Liquid Cooler", "Northstar Power 850", "Mosaic Mesh Case"] },
  { category: "Headphones", names: ["QuietField Studio", "Lumen Air ANC", "Orbit Buds Pro", "Cedar Monitor One", "Vanta Sport Pods"] },
  { category: "Audio", names: ["Harbor Soundbar 2", "Mosaic Stream Deck", "Northstar Turntable", "Aster Room Speaker"] },
  { category: "Cameras", names: ["Lumen Mirrorless 6K", "Atlas Pocket Cam", "Vanta Frame X", "Cedar Action 4", "Orbit Lens 35"] },
  { category: "Wearables", names: ["Pulse Watch 4", "Orbit Band Pro", "Aster Ring Health", "Northstar Sport GPS"] },
  { category: "Smart Home", names: ["Harbor Hub Max", "Lumen Doorbell View", "Cedar Air Sensor", "Aster Home Shield", "Orbit Light Grid"] },
  { category: "Home Appliances", names: ["Northstar Brew Station", "Mosaic Air Purifier", "Cedar Kitchen Pro", "Aster Robot Vacuum", "Harbor Counter Oven"] },
  { category: "Furniture", names: ["Forge Standing Desk", "Northstar Lounge Chair", "Mosaic Oak Shelf", "Harbor Task Table"] },
  { category: "Fashion", names: ["Orbit Field Jacket", "Cedar Knit Runner", "Lumen Travel Pack", "Vanta Everyday Sneaker"] },
  { category: "Sports", names: ["Aster Trail Bike", "Northstar Yoga Kit", "Forge Training Rower", "Harbor Climb Pack"] },
  { category: "Books", names: ["The Systems Atlas", "Market Makers Field Guide", "Designing Better Days", "Signals and Stories"] },
  { category: "Accessories", names: ["Lumen Multiport Dock", "Orbit Travel Charger", "Cedar Cable Kit", "Aster MagSafe Stand", "Northstar Desk Mat"] },
  { category: "Monitors", names: ["Vector View 34", "Mosaic Color 27", "Forge FastPanel 32", "Lumen Studio Display"] },
  { category: "Keyboards", names: ["Aster KeyLab 75", "Northstar Type Pro", "Cedar Compact Keys", "Forge Silent Board"] },
  { category: "Mice", names: ["Orbit Glide X", "Lumen Track Pro", "Aster Vertical One"] },
  { category: "Storage", names: ["Forge SSD 2TB", "Northstar Vault 4TB", "Cedar Pocket Drive", "Aster Flash Pro"] },
  { category: "Networking", names: ["Harbor Mesh 6E", "Orbit Fiber Router", "Lumen Switch 24"] },
  { category: "Other Electronics", names: ["Aster Pocket Projector", "Cedar E-Ink Note", "Northstar Label Maker", "Orbit Power Station"] },
];

function money(value: number) {
  return value.toFixed(2);
}

function imageFor(category: string, index: number) {
  const encoded = encodeURIComponent(`${category} technology product ${index}`);
  return `https://images.unsplash.com/photo-1517336714739-489689fd1ca8?auto=format&fit=crop&w=900&q=80&sig=${encoded}`;
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured.");

  const seedUsers = await db.select().from(users).where(like(users.openId, "seed-%"));
  const seedProducts = await db.select().from(products).where(like(products.name, `${PREFIX}%`));
  const seedUserIds = seedUsers.map((row) => row.id);
  const seedProductIds = seedProducts.map((row) => row.id);

  if (seedUserIds.length || seedProductIds.length) {
    const tradeIds = seedProductIds.length ? (await db.select({ id: trades.id }).from(trades).where(inArray(trades.productId, seedProductIds))).map((row) => row.id) : [];
    const orderIds = seedProductIds.length ? (await db.select({ id: orders.id }).from(orders).where(inArray(orders.productId, seedProductIds))).map((row) => row.id) : [];
    const transactionFilters = [];
    if (seedUserIds.length) transactionFilters.push(inArray(transactions.userId, seedUserIds));
    if (seedProductIds.length) transactionFilters.push(inArray(transactions.productId, seedProductIds));
    if (tradeIds.length) transactionFilters.push(inArray(transactions.tradeId, tradeIds));
    if (transactionFilters.length) await db.delete(transactions).where(or(...transactionFilters));
    if (tradeIds.length) await db.delete(trades).where(inArray(trades.id, tradeIds));
    if (orderIds.length) await db.delete(orders).where(inArray(orders.id, orderIds));
    if (seedUserIds.length && seedProductIds.length) await db.delete(holdings).where(and(inArray(holdings.userId, seedUserIds), inArray(holdings.productId, seedProductIds)));
    if (seedUserIds.length) {
      await db.delete(wallets).where(inArray(wallets.userId, seedUserIds));
      await db.delete(users).where(inArray(users.id, seedUserIds));
    }
    if (seedProductIds.length) {
      await db.delete(priceHistory).where(inArray(priceHistory.productId, seedProductIds));
      await db.delete(products).where(inArray(products.id, seedProductIds));
    }
  }

  const now = new Date();
  const alpha = (await db.insert(users).values({ openId: "seed-alpha", name: "Demo Alpha", email: "alpha@tradecoin.local", loginMethod: "seed", role: "user" }).$returningId())[0];
  const beta = (await db.insert(users).values({ openId: "seed-beta", name: "Demo Beta", email: "beta@tradecoin.local", loginMethod: "seed", role: "user" }).$returningId())[0];
  if (!alpha?.id || !beta?.id) throw new Error("Demo users could not be created.");

  await db.insert(wallets).values([
    { userId: alpha.id, balance: INITIAL_BALANCE, lockedBalance: "0.00" },
    { userId: beta.id, balance: INITIAL_BALANCE, lockedBalance: "0.00" },
  ]);
  await db.insert(transactions).values([
    { userId: alpha.id, type: "DEPOSIT", amount: INITIAL_BALANCE, description: "Welcome allocation of TradeCoin" },
    { userId: beta.id, type: "DEPOSIT", amount: INITIAL_BALANCE, description: "Welcome allocation of TradeCoin" },
  ]);

  const productRows: Array<typeof products.$inferInsert> = [];
  for (const group of catalog) {
    for (const name of group.names) {
      const base = 18 + ((name.length * 17 + group.category.length * 11) % 420) + productRows.length * 2.35;
      const current = Math.max(12, base);
      productRows.push({
        name: `${PREFIX}${name}`,
        category: group.category,
        description: `A simulated marketplace listing for the ${name}. Trade it with virtual TradeCoin, watch price movement, and explore the live order book.`,
        imageUrl: imageFor(group.category, productRows.length),
        currentPrice: money(current),
        previousPrice: money(current * 0.985),
        openingPrice: money(current * 0.96),
        highPrice: money(current * 1.08),
        lowPrice: money(current * 0.9),
        volume: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  const productIds: number[] = [];
  for (let offset = 0; offset < productRows.length; offset += 50) {
    const inserted = await db.insert(products).values(productRows.slice(offset, offset + 50)).$returningId();
    productIds.push(...inserted.map((row) => row.id));
  }

  const historyRows: Array<typeof priceHistory.$inferInsert> = [];
  for (let index = 0; index < productIds.length; index += 1) {
    const product = productRows[index]!;
    const base = Number(product.currentPrice);
    for (let day = 365; day >= 0; day -= 1) {
      const trend = 1 + 0.00025 * (365 - day) + 0.045 * Math.sin((day + index * 3) / 16) + 0.018 * Math.cos((day + index) / 7);
      const price = Math.max(5, base * trend);
      const recordedAt = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);
      historyRows.push({ productId: productIds[index]!, price: money(price), volume: Math.max(0, Math.round(40 + 35 * Math.abs(Math.sin(day / 9 + index)))), recordedAt });
    }
  }
  for (let offset = 0; offset < historyRows.length; offset += 500) {
    await db.insert(priceHistory).values(historyRows.slice(offset, offset + 500));
  }

  const first = productRows[0]!;
  const firstId = productIds[0]!;
  const second = productRows[1]!;
  const secondId = productIds[1]!;
  const third = productRows[2]!;
  const thirdId = productIds[2]!;
  const tradePrice = money(Number(first.currentPrice) * 0.98);
  const tradeTotal = money(Number(tradePrice) * 10);
  const sellOrder = (await db.insert(orders).values({ userId: beta.id, productId: firstId, orderType: "SELL", price: tradePrice, quantity: 20, filledQuantity: 10, remainingQuantity: 10, status: "PARTIALLY_FILLED" }).$returningId())[0];
  const buyOrder = (await db.insert(orders).values({ userId: alpha.id, productId: firstId, orderType: "BUY", price: money(Number(first.currentPrice)), quantity: 10, filledQuantity: 10, remainingQuantity: 0, status: "FILLED" }).$returningId())[0];
  if (!sellOrder?.id || !buyOrder?.id) throw new Error("Demo trade orders could not be created.");
  const trade = (await db.insert(trades).values({ productId: firstId, buyOrderId: buyOrder.id, sellOrderId: sellOrder.id, buyerId: alpha.id, sellerId: beta.id, price: tradePrice, quantity: 10, totalValue: tradeTotal }).$returningId())[0];
  await db.insert(holdings).values([
    { userId: alpha.id, productId: firstId, quantity: 10, lockedQuantity: 0, averageCost: tradePrice },
    { userId: beta.id, productId: firstId, quantity: 10, lockedQuantity: 10, averageCost: tradePrice },
  ]);
  await db.insert(transactions).values([
    { userId: alpha.id, productId: firstId, tradeId: trade.id, type: "BUY", amount: `-${tradeTotal}`, quantity: 10, description: `Bought 10 units at ${tradePrice} TC` },
    { userId: beta.id, productId: firstId, tradeId: trade.id, type: "SELL", amount: tradeTotal, quantity: 10, description: `Sold 10 units at ${tradePrice} TC` },
  ]);

  const sellTwo = (await db.insert(orders).values({ userId: beta.id, productId: secondId, orderType: "SELL", price: money(Number(second.currentPrice) * 0.99), quantity: 18, filledQuantity: 0, remainingQuantity: 18, status: "OPEN" }).$returningId())[0];
  const buyThree = (await db.insert(orders).values({ userId: alpha.id, productId: thirdId, orderType: "BUY", price: money(Number(third.currentPrice) * 0.97), quantity: 12, filledQuantity: 0, remainingQuantity: 12, status: "OPEN" }).$returningId())[0];
  await db.insert(holdings).values({ userId: beta.id, productId: secondId, quantity: 30, lockedQuantity: 18, averageCost: second.currentPrice });
  const buyReservation = Number(third.currentPrice) * 0.97 * 12;
  await db.update(wallets).set({ balance: money(100000 - Number(tradeTotal)), lockedBalance: money(buyReservation) }).where(eq(wallets.userId, alpha.id));
  await db.update(wallets).set({ balance: money(100000 + Number(tradeTotal)), lockedBalance: "0.00" }).where(eq(wallets.userId, beta.id));

  await db.update(products).set({ currentPrice: tradePrice, previousPrice: first.currentPrice, volume: 10 }).where(eq(products.id, firstId));
  console.log(`Seeded ${productIds.length} products, ${historyRows.length} price points, demo users alpha/beta, a partial fill, and live orders.`);
  console.log("Demo users: seed-alpha / seed-beta (use the app's configured authentication flow; these are seeded identities for local data inspection).");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
