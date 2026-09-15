# TradeCoin Exchange

TradeCoin Exchange is a full-stack virtual marketplace where users trade simulated products with an internal currency called **TradeCoin (TC)**. It is deliberately a practice environment: it has no real-money payments, no cash-out flow, and all prices are simulated market prices.

## What is built

The application includes authenticated accounts, a TradeCoin wallet, a normalized product catalog, one-year price history, product discovery, live order books, limit buy and sell orders, partial fills, portfolio holdings, transaction history, order cancellation, and a server-side price-time priority matching engine. The UI polls market data every 15 seconds so a second browser session can see changes without putting financial logic in the client.

The managed WebDev database runtime provides MySQL/TiDB rather than PostgreSQL. The schema is written with Drizzle ORM and uses `DECIMAL(18,2)` for all monetary columns; no financial calculation uses JavaScript floating-point arithmetic. If a standalone PostgreSQL deployment is required, the same normalized model can be ported by replacing the Drizzle dialect and connector.

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS, Recharts, tRPC React |
| Backend | Express, tRPC 11, TypeScript |
| Persistence | Drizzle ORM, managed MySQL/TiDB, additive SQL migration |
| Authentication | Manus OAuth session integration |
| Tests | Vitest and TypeScript type checking |

## Run locally in this project

```bash
pnpm install
pnpm db:push
pnpm seed
pnpm dev
```

The managed project preview is available from the project environment. For a local browser, open the port printed by the development server. The seed command is idempotent for its `seed-*` demo records: it removes and recreates the demo dataset without touching real authenticated users.

## Environment variables

Use the configured project environment. A local `.env.example` is included as a reference:

```bash
DATABASE_URL=
JWT_SECRET=
INITIAL_BALANCE=100000.00
CORS_ORIGINS=
```

Do not commit real secrets or credentials.

## Database model

The core tables are `users`, `wallets`, `products`, `holdings`, `orders`, `trades`, `transactions`, and `priceHistory`. Users own one wallet and many holdings and transactions. Products have many historical prices, orders, and trades. Orders reference a user and product; trades reference both the buy and sell orders and create two transaction records, one for the buyer and one for the seller.

Indexes cover product/category search, active order-book lookups by product/side/status/price/time, user order history, product price history, and transaction/trade timelines. The migration is generated at `drizzle/0001_clammy_ulik.sql` and was applied to the managed database during implementation.

## Authentication and wallet lifecycle

Manus OAuth creates or updates the authenticated user record. The first user upsert creates a wallet with the configured `INITIAL_BALANCE` (default `100000.00`) and a matching `DEPOSIT` transaction. The account procedure exposes the wallet, available/locked balances, holdings, active orders, and recent transactions to the authenticated UI.

## Order lifecycle

```text
OPEN → PARTIALLY_FILLED → FILLED
  └──────────────────────→ CANCELLED
```

A buy order reserves `price × quantity` TC in `wallets.lockedBalance`. A sell order reserves inventory in `holdings.lockedQuantity`. Cancellation releases only the remaining reservation. Filled orders retain their original quantity, filled quantity, remaining quantity, price, and timestamps for auditability.

## Price-time priority engine

The engine is implemented in `server/trading.ts` and runs inside one database transaction:

1. Validate positive integer quantity and a positive, two-decimal price.
2. Lock the buyer's TradeCoin reservation or the seller's inventory reservation.
3. Create the incoming order.
4. Query the opposite side directly from the database, ordered by price then creation time. Buy orders consume the lowest compatible sell first; sell orders consume the highest compatible buy first. Equal prices use the oldest order first.
5. Continue until the incoming order is filled or the best remaining order no longer crosses.
6. Execute at the resting order's price. Therefore a buy at 500 TC against an existing sell at 490 TC settles at 490 TC.
7. Update wallets, holdings, both order states, trade records, transaction records, product statistics, and price history atomically.
8. Commit every fill together. Any settlement failure rolls back the entire request.

For a seller offering 20 units at 490 TC and a buyer bidding 10 units at 500 TC, the trade quantity is 10, the execution price is 490 TC, the buyer pays 4,900 TC, the seller receives 4,900 TC, the sell order retains 10 units, and the buy order becomes `FILLED`.

## API surface

All feature calls are typed tRPC procedures under `/api/trpc`:

- `markets.products` — paginated product discovery with category and text filters.
- `markets.detail` — product statistics, price history, order book, best bid/ask, and recent trades.
- `account.overview` — authenticated wallet, holdings, active orders, and transaction history.
- `orders.create` — authenticated limit order creation and server-side matching.
- `orders.cancel` — authenticated cancellation with reservation release.
- `auth.me` and `auth.logout` — session state and logout.

## Seed data and demo activity

`pnpm seed` creates the curated catalog, historical price points, two seed identities (`seed-alpha` and `seed-beta`), welcome wallet allocations, a partially-filled demo trade, a live sell order, a live buy order, holdings, and transaction records. The catalog contains approximately 100 products across electronics, lifestyle, sports, books, accessories, and home categories.

Seed identities are database fixtures for inspection and do not bypass the configured authentication flow. In a local environment, use the project's configured sign-in route, then inspect the seed records directly or promote a local test account as needed.

## Tests

```bash
pnpm check
pnpm test
pnpm build
```

The test suite verifies exact decimal conversion, deterministic totals, invalid price rejection, crossing conditions, and the resting-price execution rule. The production build compiles both the React client and the Express/tRPC server.

## Important files

- `drizzle/schema.ts` — normalized database schema and indexes.
- `server/trading.ts` — matching engine, atomic settlement, and cancellation.
- `server/db.ts` — reusable market and account queries.
- `server/routers.ts` — typed API procedures.
- `server/seed.ts` — reproducible demo data.
- `server/trading.test.ts` — financial and matching-rule tests.
- `client/src/pages/Home.tsx` — exchange dashboard and interaction layer.
- `client/src/index.css` — dark exchange visual system.
- `drizzle/0001_clammy_ulik.sql` — generated schema migration.

## Safety boundary

This is a simulated market. The app must not be used as a financial service, brokerage, payment processor, or source of real-world price information. The frontend only submits requests; it never directly mutates balances, holdings, orders, trades, or transactions.
