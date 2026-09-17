import { and, asc, desc, eq, inArray, like, not, or } from "drizzle-orm";
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
let builtInCatalogPromise: Promise<void> | null = null;

const BUILT_IN_STOCKS = [
  ["Atlas Mobility", "Automotive", "Electric mobility and charging infrastructure", "125.00"],
  ["Nova Compute", "Technology", "Cloud compute, chips, and developer infrastructure", "210.00"],
  ["BrightGrid Energy", "Energy", "Renewable power generation and storage", "84.50"],
  ["Harbor Health", "Healthcare", "Digital health tools and preventive care", "156.75"],
  ["Pioneer Foods", "Consumer", "Everyday food and sustainable agriculture", "72.25"],
  ["Orbit Communications", "Technology", "Satellite connectivity and communications", "98.00"],
  ["Cedar Financial", "Finance", "Modern payments and financial services", "132.40"],
  ["Vista Retail", "Consumer", "Omnichannel commerce and fulfillment", "64.80"],
] as const;
const ADMIN_EMAIL = "pranavvarmaonline@gmail.com";

async function ensureBuiltInCatalog() {
  if (builtInCatalogPromise) return builtInCatalogPromise;
  const db = await getDb();
  if (!db) return;
  builtInCatalogPromise = (async () => {
    for (const [name, category, description, price] of BUILT_IN_STOCKS) {
      const existing = await db.select({ id: products.id }).from(products).where(eq(products.name, name)).limit(1);
      if (existing.length === 0) {
        await db.insert(products).values({ name, category, description, imageUrl: "builtin://tradecoin-stock", currentPrice: price, previousPrice: price, openingPrice: price, highPrice: price, lowPrice: price, volume: 0 });
      }
    }

    const makerOpenId = "builtin-market-maker";
    await db.insert(users).values({ openId: makerOpenId, name: "TradeCoin Market Maker", username: "market-maker", email: "market-maker@tradecoin.local", loginMethod: "system", role: "admin", isPublic: 1 }).onDuplicateKeyUpdate({ set: { name: "TradeCoin Market Maker", username: "market-maker", isPublic: 1 } });
    const maker = await getUserByOpenId(makerOpenId);
    if (!maker) throw new Error("Built-in market maker could not be initialized");
    await db.insert(wallets).values({ userId: maker.id, balance: "100000000.00", lockedBalance: "0.00" }).onDuplicateKeyUpdate({ set: { userId: maker.id } });

    const builtInProducts = await db.select().from(products);
    for (const product of builtInProducts) {
      const existingHolding = await db.select({ id: holdings.id }).from(holdings).where(and(eq(holdings.userId, maker.id), eq(holdings.productId, product.id))).limit(1);
      if (existingHolding.length === 0) {
        await db.insert(holdings).values({ userId: maker.id, productId: product.id, quantity: 10000, lockedQuantity: 1000, averageCost: product.currentPrice });
      } else {
        await db.update(holdings).set({ quantity: 10000, lockedQuantity: 1000, averageCost: product.currentPrice }).where(eq(holdings.id, existingHolding[0].id));
      }
      const existingSell = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.userId, maker.id), eq(orders.productId, product.id), eq(orders.orderType, "SELL"), inArray(orders.status, ["OPEN", "PARTIALLY_FILLED"]))).limit(1);
      if (existingSell.length === 0) {
        await db.insert(orders).values({ userId: maker.id, productId: product.id, orderType: "SELL", price: product.currentPrice, quantity: 1000, filledQuantity: 0, remainingQuantity: 1000, status: "OPEN" });
      }
    }
  })().catch((error) => {
    builtInCatalogPromise = null;
    console.error("[Catalog] Failed to initialize built-in stocks:", error);
    throw error;
  });
  return builtInCatalogPromise;
}

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
  await ensureBuiltInCatalog();

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
  } else if (user.openId === ENV.ownerOpenId || user.email?.toLowerCase() === ADMIN_EMAIL) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  const savedUser = await getUserByOpenId(user.openId);
  if (!savedUser) return;
  if (!savedUser.username) {
    await db.update(users).set({ username: `trader${savedUser.id}` }).where(eq(users.id, savedUser.id));
  }
  const initialBalance = process.env.INITIAL_BALANCE ?? "100000.00";
  await db.insert(wallets).values({ userId: savedUser.id, balance: initialBalance, lockedBalance: "0.00" }).onDuplicateKeyUpdate({ set: { userId: savedUser.id } });
  const existingDeposit = await db.select({ id: transactions.id }).from(transactions).where(and(eq(transactions.userId, savedUser.id), eq(transactions.type, "DEPOSIT"))).limit(1);
  if (existingDeposit.length === 0) {
    await db.insert(transactions).values({ userId: savedUser.id, type: "DEPOSIT", amount: initialBalance, description: "Welcome allocation of TradeCoin" });
  }
  await ensureStarterInventory(savedUser.id);
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

async function ensureStarterInventory(userId: number) {
  const db = await getDb();
  if (!db) return;
  await ensureBuiltInCatalog();
  const alreadyGranted = await db.select({ id: transactions.id }).from(transactions).where(and(eq(transactions.userId, userId), eq(transactions.description, "Starter stock bundle grant"))).limit(1);
  if (alreadyGranted.length > 0) return;

  const starterProducts = await db.select().from(products).where(inArray(products.name, BUILT_IN_STOCKS.map(([name]) => name)));
  const starterQuantity = 5;
  for (const product of starterProducts) {
    const existingHolding = (await db.select().from(holdings).where(and(eq(holdings.userId, userId), eq(holdings.productId, product.id))).limit(1))[0];
    if (existingHolding) {
      await db.update(holdings).set({ quantity: existingHolding.quantity + starterQuantity }).where(eq(holdings.id, existingHolding.id));
    } else {
      await db.insert(holdings).values({ userId, productId: product.id, quantity: starterQuantity, lockedQuantity: 0, averageCost: product.currentPrice });
    }
    await db.insert(transactions).values({ userId, productId: product.id, type: "DEPOSIT", amount: "0.00", quantity: starterQuantity, description: "Starter stock bundle grant" });
  }
}

export async function listProducts(input: { query?: string; category?: string; limit: number }) {
  const db = await getDb();
  if (!db) return [];
  await ensureBuiltInCatalog();
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
  const [buyRows, sellRows, recentTrades, history] = await Promise.all([
    db.select({ order: orders, userName: users.name }).from(orders).innerJoin(users, eq(orders.userId, users.id)).where(and(eq(orders.productId, productId), eq(orders.orderType, "BUY"), inArray(orders.status, activeStatuses))).orderBy(desc(orders.price), asc(orders.createdAt), asc(orders.id)).limit(12),
    db.select({ order: orders, userName: users.name }).from(orders).innerJoin(users, eq(orders.userId, users.id)).where(and(eq(orders.productId, productId), eq(orders.orderType, "SELL"), inArray(orders.status, activeStatuses))).orderBy(asc(orders.price), asc(orders.createdAt), asc(orders.id)).limit(12),
    db.select().from(trades).where(eq(trades.productId, productId)).orderBy(desc(trades.executedAt), desc(trades.id)).limit(12),
    db.select().from(priceHistory).where(eq(priceHistory.productId, productId)).orderBy(asc(priceHistory.recordedAt)).limit(180),
  ]);
  return {
    product,
    buyOrders: buyRows.map(({ order, userName }) => ({ ...order, userName: userName ?? "Trader" })),
    sellOrders: sellRows.map(({ order, userName }) => ({ ...order, userName: userName ?? "Trader" })),
    recentTrades,
    history,
    bestBid: buyRows[0]?.order.price ?? null,
    bestAsk: sellRows[0]?.order.price ?? null,
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
  await ensureStarterInventory(userId);
  const userHoldings = await db.select({ holding: holdings, product: products }).from(holdings).innerJoin(products, eq(holdings.productId, products.id)).where(eq(holdings.userId, userId)).orderBy(desc(holdings.quantity));
  const activeOrders = await db.select({ order: orders, product: products }).from(orders).innerJoin(products, eq(orders.productId, products.id)).where(and(eq(orders.userId, userId), inArray(orders.status, ["OPEN", "PARTIALLY_FILLED"]))).orderBy(desc(orders.createdAt)).limit(30);
  const userTransactions = await db.select({ transaction: transactions, product: products }).from(transactions).leftJoin(products, eq(transactions.productId, products.id)).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt), desc(transactions.id)).limit(30);
  const boughtTrades = await db.select({ trade: trades, product: products }).from(trades).innerJoin(products, eq(trades.productId, products.id)).where(eq(trades.buyerId, userId)).orderBy(desc(trades.executedAt), desc(trades.id)).limit(50);
  const soldTrades = await db.select({ trade: trades, product: products }).from(trades).innerJoin(products, eq(trades.productId, products.id)).where(eq(trades.sellerId, userId)).orderBy(desc(trades.executedAt), desc(trades.id)).limit(50);
  const tradeHistory = [
    ...boughtTrades.map(({ trade, product }) => ({ trade, product, side: "BUY" as const })),
    ...soldTrades.map(({ trade, product }) => ({ trade, product, side: "SELL" as const })),
  ].sort((a, b) => new Date(b.trade.executedAt).getTime() - new Date(a.trade.executedAt).getTime()).slice(0, 50);
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const calculateProfit = (since: Date) => tradeHistory.reduce((total, entry) => {
    if (new Date(entry.trade.executedAt) < since) return total;
    const referenceProfit = entry.side === "SELL"
      ? (Number(entry.trade.price) - Number(entry.product.openingPrice)) * entry.trade.quantity
      : (Number(entry.product.currentPrice) - Number(entry.trade.price)) * entry.trade.quantity;
    return total + referenceProfit;
  }, 0);
  return {
    wallet,
    holdings: userHoldings,
    activeOrders,
    transactions: userTransactions,
    tradeHistory,
    profitSummary: { today: calculateProfit(startOfDay), week: calculateProfit(startOfWeek) },
  };
}

export async function updateUserName(userId: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ name }).where(eq(users.id, userId));
  return db.select().from(users).where(eq(users.id, userId)).limit(1).then((rows) => rows[0]);
}

export async function listAllTrades(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ trade: trades, product: products }).from(trades).innerJoin(products, eq(trades.productId, products.id)).orderBy(desc(trades.executedAt), desc(trades.id)).limit(limit);
  return Promise.all(rows.map(async ({ trade, product }) => {
    const [buyer, seller] = await Promise.all([
      db.select({ name: users.name }).from(users).where(eq(users.id, trade.buyerId)).limit(1),
      db.select({ name: users.name }).from(users).where(eq(users.id, trade.sellerId)).limit(1),
    ]);
    return {
      trade,
      product,
      buyerName: buyer[0]?.name ?? "Trader",
      sellerName: seller[0]?.name ?? "Trader",
    };
  }));
}

export async function getTrendingOverview() {
  const db = await getDb();
  if (!db) return { growingItems: [], bestTrades: [] };
  const productRows = await db.select().from(products);
  const growingItems = productRows
    .map((product) => ({ product, growthPercent: Number(product.openingPrice) > 0 ? ((Number(product.currentPrice) - Number(product.openingPrice)) / Number(product.openingPrice)) * 100 : 0 }))
    .sort((a, b) => b.growthPercent - a.growthPercent)
    .slice(0, 10);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayTrades = (await listAllTrades(250)).filter(({ trade }) => new Date(trade.executedAt) >= startOfDay).sort((a, b) => Number(b.trade.totalValue) - Number(a.trade.totalValue)).slice(0, 10);
  return { growingItems, bestTrades: todayTrades };
}

export async function updateUserProfile(userId: number, input: { username: string; isPublic: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const username = input.username.trim().toLowerCase();
  const duplicate = await db.select({ id: users.id }).from(users).where(and(eq(users.username, username), not(eq(users.id, userId)))).limit(1);
  if (duplicate.length > 0) throw new Error("That username is already taken. Try another name or generate a random username.");
  await db.update(users).set({ username, isPublic: input.isPublic ? 1 : 0 }).where(eq(users.id, userId));
  return db.select().from(users).where(eq(users.id, userId)).limit(1).then((rows) => rows[0]);
}

export async function searchProfiles(query: string, exact = false) {
  const db = await getDb();
  if (!db) return [];
  const normalized = query.trim().toLowerCase();
  const condition = exact ? eq(users.username, normalized) : or(like(users.username, `%${normalized}%`), like(users.name, `%${query.trim()}%`));
  return db.select({ id: users.id, username: users.username, name: users.name, isPublic: users.isPublic }).from(users).where(condition).orderBy(asc(users.username)).limit(exact ? 1 : 20);
}

export async function getPublicProfile(username: string) {
  const db = await getDb();
  if (!db) return null;
  const user = (await db.select({ id: users.id, username: users.username, name: users.name, isPublic: users.isPublic }).from(users).where(eq(users.username, username.trim().toLowerCase())).limit(1))[0];
  if (!user) return null;
  if (!user.isPublic) return { user, isPrivate: true, tradeHistory: [], profitSummary: { today: 0, week: 0 } };
  const bought = await db.select({ trade: trades, product: products }).from(trades).innerJoin(products, eq(trades.productId, products.id)).where(eq(trades.buyerId, user.id)).orderBy(desc(trades.executedAt)).limit(100);
  const sold = await db.select({ trade: trades, product: products }).from(trades).innerJoin(products, eq(trades.productId, products.id)).where(eq(trades.sellerId, user.id)).orderBy(desc(trades.executedAt)).limit(100);
  const tradeHistory = [...bought.map(({ trade, product }) => ({ trade, product, side: "BUY" as const })), ...sold.map(({ trade, product }) => ({ trade, product, side: "SELL" as const }))].sort((a, b) => new Date(b.trade.executedAt).getTime() - new Date(a.trade.executedAt).getTime()).slice(0, 100);
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const profitSince = (since: Date) => tradeHistory.reduce((sum, entry) => new Date(entry.trade.executedAt) >= since ? sum + (entry.side === "SELL" ? (Number(entry.trade.price) - Number(entry.product.openingPrice)) * entry.trade.quantity : (Number(entry.product.currentPrice) - Number(entry.trade.price)) * entry.trade.quantity) : sum, 0);
  return { user, isPrivate: false, tradeHistory, profitSummary: { today: profitSince(startOfDay), week: profitSince(startOfWeek) } };
}


export function isAdministrator(user: { role?: string | null; email?: string | null }) {
  return user.role === "admin" || user.email?.toLowerCase() === ADMIN_EMAIL;
}

export async function listAdminProducts() {
  const db = await getDb();
  if (!db) return [];
  await ensureBuiltInCatalog();
  return db.select().from(products).orderBy(asc(products.name));
}

export async function createAdminProduct(input: { name: string; category: string; description: string; price: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const price = Number(input.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Price must be greater than zero");
  const normalizedPrice = price.toFixed(2);
  const result = await db.insert(products).values({ name: input.name.trim(), category: input.category.trim(), description: input.description.trim(), imageUrl: "builtin://admin-stock", currentPrice: normalizedPrice, previousPrice: normalizedPrice, openingPrice: normalizedPrice, highPrice: normalizedPrice, lowPrice: normalizedPrice, volume: 0 });
  return db.select().from(products).where(eq(products.id, result[0].insertId)).limit(1).then((rows) => rows[0]);
}

export async function updateAdminProductPrice(productId: number, priceInput: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const price = Number(priceInput);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Price must be greater than zero");
  const product = (await db.select().from(products).where(eq(products.id, productId)).limit(1))[0];
  if (!product) throw new Error("Product not found");
  const normalizedPrice = price.toFixed(2);
  await db.update(products).set({ previousPrice: product.currentPrice, currentPrice: normalizedPrice, highPrice: Number(product.highPrice) > price ? product.highPrice : normalizedPrice, lowPrice: Number(product.lowPrice) < price ? product.lowPrice : normalizedPrice }).where(eq(products.id, productId));
  return db.select().from(products).where(eq(products.id, productId)).limit(1).then((rows) => rows[0]);
}

export async function deleteAdminProduct(productId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const product = (await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1))[0];
  if (!product) throw new Error("Product not found");
  await db.delete(products).where(eq(products.id, productId));
  return { success: true as const };
}
