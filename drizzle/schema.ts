import {
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    username: varchar("username", { length: 40 }).unique(),
    isPublic: int("isPublic").default(0).notNull(),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    usernameIdx: uniqueIndex("users_username_idx").on(table.username),
  }),
);

export const wallets = mysqlTable(
  "wallets",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    balance: decimal("balance", { precision: 18, scale: 2 }).default("0.00").notNull(),
    lockedBalance: decimal("lockedBalance", { precision: 18, scale: 2 }).default("0.00").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdx: uniqueIndex("wallets_user_idx").on(table.userId),
  }),
);

export const products = mysqlTable(
  "products",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    description: text("description").notNull(),
    imageUrl: varchar("imageUrl", { length: 500 }).notNull(),
    currentPrice: decimal("currentPrice", { precision: 18, scale: 2 }).notNull(),
    previousPrice: decimal("previousPrice", { precision: 18, scale: 2 }).notNull(),
    openingPrice: decimal("openingPrice", { precision: 18, scale: 2 }).notNull(),
    highPrice: decimal("highPrice", { precision: 18, scale: 2 }).notNull(),
    lowPrice: decimal("lowPrice", { precision: 18, scale: 2 }).notNull(),
    volume: int("volume").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    categoryIdx: index("products_category_idx").on(table.category),
    nameIdx: index("products_name_idx").on(table.name),
  }),
);

export const holdings = mysqlTable(
  "holdings",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
    quantity: int("quantity").default(0).notNull(),
    lockedQuantity: int("lockedQuantity").default(0).notNull(),
    averageCost: decimal("averageCost", { precision: 18, scale: 2 }).default("0.00").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userProductIdx: uniqueIndex("holdings_user_product_idx").on(table.userId, table.productId),
    productIdx: index("holdings_product_idx").on(table.productId),
  }),
);

export const orders = mysqlTable(
  "orders",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
    orderType: mysqlEnum("orderType", ["BUY", "SELL"]).notNull(),
    price: decimal("price", { precision: 18, scale: 2 }).notNull(),
    quantity: int("quantity").notNull(),
    filledQuantity: int("filledQuantity").default(0).notNull(),
    remainingQuantity: int("remainingQuantity").notNull(),
    status: mysqlEnum("status", ["OPEN", "PARTIALLY_FILLED", "FILLED", "CANCELLED"]).default("OPEN").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    bookIdx: index("orders_book_idx").on(table.productId, table.orderType, table.status, table.price, table.createdAt),
    userIdx: index("orders_user_idx").on(table.userId, table.status, table.createdAt),
  }),
);

export const trades = mysqlTable(
  "trades",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
    buyOrderId: int("buyOrderId").notNull().references(() => orders.id),
    sellOrderId: int("sellOrderId").notNull().references(() => orders.id),
    buyerId: int("buyerId").notNull().references(() => users.id),
    sellerId: int("sellerId").notNull().references(() => users.id),
    price: decimal("price", { precision: 18, scale: 2 }).notNull(),
    quantity: int("quantity").notNull(),
    totalValue: decimal("totalValue", { precision: 18, scale: 2 }).notNull(),
    executedAt: timestamp("executedAt").defaultNow().notNull(),
  },
  (table) => ({
    productTimeIdx: index("trades_product_time_idx").on(table.productId, table.executedAt),
    buyerTimeIdx: index("trades_buyer_time_idx").on(table.buyerId, table.executedAt),
  }),
);

export const transactions = mysqlTable(
  "transactions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    productId: int("productId").references(() => products.id, { onDelete: "set null" }),
    tradeId: int("tradeId").references(() => trades.id, { onDelete: "set null" }),
    type: mysqlEnum("type", ["DEPOSIT", "BUY", "SELL", "RELEASE", "CANCEL_RELEASE"]).notNull(),
    amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
    quantity: int("quantity"),
    description: varchar("description", { length: 255 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userTimeIdx: index("transactions_user_time_idx").on(table.userId, table.createdAt),
    tradeIdx: index("transactions_trade_idx").on(table.tradeId),
  }),
);

export const priceHistory = mysqlTable(
  "priceHistory",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
    price: decimal("price", { precision: 18, scale: 2 }).notNull(),
    volume: int("volume").default(0).notNull(),
    recordedAt: timestamp("recordedAt").defaultNow().notNull(),
  },
  (table) => ({
    productTimeIdx: index("price_history_product_time_idx").on(table.productId, table.recordedAt),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Trade = typeof trades.$inferSelect;
export type Holding = typeof holdings.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type PriceHistory = typeof priceHistory.$inferSelect;
