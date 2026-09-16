import { useEffect, useMemo, useState } from "react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Compass,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeft,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
  X,
  UserRound,
  Zap,
} from "lucide-react";

const CATEGORIES = ["All", "Smartphones", "Laptops", "Gaming", "Audio", "Cameras", "Wearables", "Smart Home", "Home Appliances", "Furniture", "Sports", "Monitors", "Storage"];
const NAV_ITEMS = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Discover", icon: Compass },
  { label: "My portfolio", icon: BriefcaseBusiness },
  { label: "Orders", icon: BookOpen },
  { label: "Profile", icon: UserRound },
];

type Product = {
  id: number;
  name: string;
  category: string;
  description: string;
  imageUrl: string;
  currentPrice: string;
  previousPrice: string;
  openingPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: number;
};

type MarketDetail = {
  product: Product;
  buyOrders: Array<{ id: number; price: string; remainingQuantity: number; createdAt: string; userName: string }>;
  sellOrders: Array<{ id: number; price: string; remainingQuantity: number; createdAt: string; userName: string }>;
  recentTrades: Array<{ id: number; price: string; quantity: number; totalValue: string; executedAt: string }>;
  history: Array<{ price: string; volume: number; recordedAt: string }>;
  bestBid: string | null;
  bestAsk: string | null;
};

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TC`;
}

function pnl(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${money(Math.abs(value))}`;
}

function shortMoney(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function pct(current: string, previous: string) {
  const currentValue = Number(current);
  const previousValue = Number(previous);
  if (!previousValue) return "0.00%";
  return `${(((currentValue - previousValue) / previousValue) * 100).toFixed(2)}%`;
}

function timeAgo(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "green" | "red" | "slate" | "amber" }) {
  const colors = {
    green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    red: "border-rose-400/20 bg-rose-400/10 text-rose-300",
    slate: "border-white/10 bg-white/[0.04] text-slate-300",
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ${colors[tone]}`}>{children}</span>;
}

function Sparkline({ positive }: { positive: boolean }) {
  const points = positive ? "0,33 18,32 36,25 52,29 70,18 88,22 106,9 126,13 142,2" : "0,6 18,10 36,5 52,19 70,15 88,28 106,23 126,34 142,31";
  return <svg viewBox="0 0 142 36" className="h-9 w-32" preserveAspectRatio="none"><polyline points={points} fill="none" stroke={positive ? "#72e4b4" : "#fb7185"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center"><div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-white/[0.05] text-slate-400"><Package size={17} /></div><p className="text-sm font-semibold text-slate-200">{title}</p><p className="mt-1 text-xs text-slate-500">{message}</p></div>;
}

export default function Home() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const { theme } = useTheme();
  const [activeNav, setActiveNav] = useState("Overview");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedProductId, setSelectedProductId] = useState<number | undefined>(undefined);
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [profileName, setProfileName] = useState("");

  const productInput = useMemo(() => ({ query: search || undefined, category: category === "All" ? undefined : category, limit: 100 }), [search, category]);
  const productsQuery = trpc.markets.products.useQuery(productInput);
  const products = (productsQuery.data ?? []) as Product[];
  const visibleProducts = showAllProducts ? products : products.slice(0, 10);
  const selected = products.find((item) => item.id === selectedProductId) ?? products[0];
  const selectedId = selected?.id;
  const marketQuery = trpc.markets.detail.useQuery({ productId: selectedId ?? 0 }, { enabled: Boolean(selectedId), refetchInterval: 15_000 });
  const market = marketQuery.data as MarketDetail | null | undefined;
  const accountQuery = trpc.account.overview.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 15_000 });
  const createOrder = trpc.orders.create.useMutation();
  const cancelOrder = trpc.orders.cancel.useMutation();
  const updateName = trpc.account.updateName.useMutation();
  const utils = trpc.useUtils();

  const chartData = (market?.history ?? []).map((point) => ({ date: new Date(point.recordedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }), price: Number(point.price), volume: point.volume }));
  const change = selected ? pct(selected.currentPrice, selected.previousPrice) : "0.00%";
  const positive = Number(change.replace("%", "")) >= 0;
  const activeOrders = accountQuery.data?.activeOrders ?? [];
  const holdings = accountQuery.data?.holdings ?? [];
  const wallet = accountQuery.data?.wallet;
  const selectedHolding = holdings.find((row) => row.product.id === selected?.id);
  const availableToSell = selectedHolding ? selectedHolding.holding.quantity - selectedHolding.holding.lockedQuantity : 0;
  const displayName = user?.name?.split(" ")[0] ?? "Trader";
  const portfolioPnl = holdings.reduce((sum, row) => sum + (Number(row.product.currentPrice) - Number(row.holding.averageCost)) * row.holding.quantity, 0);
  const tradeHistory = accountQuery.data?.tradeHistory ?? [];

  useEffect(() => {
    if (user?.name && !profileName) setProfileName(user.name);
  }, [user?.name, profileName]);

  useEffect(() => {
    if (selected?.currentPrice && (!price || Number(price) <= 0)) {
      setPrice(String(selected.currentPrice));
    }
  }, [selected?.id, selected?.currentPrice, price]);

  function selectProduct(product: Product) {
    setSelectedProductId(product.id);
    setPrice(product.currentPrice);
    setSide("BUY");
  }

  function selectHoldingForSell(product: Product) {
    setSelectedProductId(product.id);
    setPrice(product.currentPrice);
    setSide("SELL");
    setQuantity("1");
  }

  async function submitOrder() {
    if (!selected) return;
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    const normalizedPrice = price.trim().replace(/,/g, "");
    const numericPrice = Number(normalizedPrice);
    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      toast.error("Enter a limit price greater than zero.");
      return;
    }
    if (!Number.isInteger(numericQuantity) || numericQuantity <= 0) {
      toast.error("Enter a quantity greater than zero.");
      return;
    }
    if (side === "SELL" && numericQuantity > availableToSell) {
      toast.error(`You can sell only ${availableToSell} available units of this product.`, { description: "Choose a product from Your positions or reduce the quantity." });
      return;
    }
    try {
      await createOrder.mutateAsync({ productId: selected.id, side, price: numericPrice.toFixed(2), quantity: numericQuantity });
      toast.success(`${side === "BUY" ? "Buy" : "Sell"} order submitted`, { description: "The server matched the order using price-time priority." });
      await Promise.all([utils.markets.detail.invalidate({ productId: selected.id }), utils.account.overview.invalidate(), utils.markets.products.invalidate()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Order could not be submitted");
    }
  }

  async function saveProfileName() {
    const name = profileName.trim();
    if (name.length < 2) { toast.error("Name must be at least 2 characters."); return; }
    try {
      await updateName.mutateAsync({ name });
      await utils.auth.me.invalidate();
      toast.success("Profile name updated");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update profile"); }
  }

  async function handleCancel(orderId: number) {
    try {
      await cancelOrder.mutateAsync({ orderId });
      toast.success("Order cancelled", { description: "Any unused reservation was released." });
      await Promise.all([utils.account.overview.invalidate(), selected ? utils.markets.detail.invalidate({ productId: selected.id }) : Promise.resolve()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Order could not be cancelled");
    }
  }

  return (
    <div className={`site-shell exchange-shell theme-${theme} min-h-screen bg-[#071019] text-slate-100`}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden"><div className="absolute -left-40 -top-40 h-[540px] w-[540px] rounded-full bg-[#0d6e73]/15 blur-[130px]" /><div className="absolute right-[-180px] top-[30%] h-[480px] w-[480px] rounded-full bg-[#4c2e89]/12 blur-[140px]" /></div>
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#071019]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1480px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <button onClick={() => setMobileNavOpen((open) => !open)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-slate-300 lg:hidden"><Menu size={18} /></button>
          <div className="flex items-center gap-3 pr-4 lg:border-r lg:border-white/10"><div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#66e0bd] to-[#1ca4a7] text-[#062a2b] shadow-[0_0_32px_rgba(85,219,184,.18)]"><Zap size={20} fill="currentColor" /></div><div><div className="text-[17px] font-bold tracking-tight">trade<span className="text-[#68e0c0]">coin</span></div><div className="hidden text-[9px] font-bold uppercase tracking-[0.24em] text-slate-500 sm:block">simulated exchange</div></div></div>
          <nav className="hidden items-center gap-1 lg:flex">{NAV_ITEMS.map((item) => <button key={item.label} onClick={() => { if (item.label === "Profile") { window.location.href = "/profile"; return; } setActiveNav(item.label); document.getElementById(item.label === "Discover" ? "market-discovery" : item.label === "My portfolio" ? "portfolio" : item.label === "Orders" ? "open-orders" : "top-overview")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${activeNav === item.label ? "bg-white/[0.08] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"}`}>{item.label}</button>)}</nav>
          <div className="ml-auto flex items-center gap-3"><div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-slate-400 md:flex"><CircleDollarSign size={14} className="text-[#68e0c0]" /> <span className="font-mono">{money(wallet?.balance ?? "100000")}</span></div>{authLoading ? <div className="h-9 w-24 animate-pulse rounded-xl bg-white/[0.06]" /> : isAuthenticated ? <div className="flex items-center gap-2"><button onClick={async () => { await logout(); startLogin(); }} className="rounded-xl border border-[#69ddbd]/30 px-3 py-2 text-xs font-semibold text-[#8ceacd] transition hover:bg-[#69ddbd]/10">Switch account</button><button onClick={() => logout()} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#d2a26f] text-[9px] font-black text-[#2c1b12]">{displayName.charAt(0).toUpperCase()}</span><span className="hidden sm:block">{displayName}</span><LogOut size={13} /></button></div> : <button onClick={() => startLogin()} className="rounded-xl bg-[#69ddbd] px-4 py-2.5 text-xs font-bold text-[#062a2b] transition hover:bg-[#8ceacd]">Sign in</button>}</div>
        </div>
      </header>

      <div className="relative mx-auto flex max-w-[1480px]">
        <aside className={`${mobileNavOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-[77px] left-0 z-30 w-64 border-r border-white/[0.07] bg-[#08131d] p-4 transition-transform lg:sticky lg:top-[77px] lg:block lg:h-[calc(100vh-77px)] lg:w-60 lg:translate-x-0 lg:bg-transparent`}>
          <div className="flex h-full flex-col"><div className="mb-6 flex items-center justify-between lg:hidden"><span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Navigation</span><button onClick={() => setMobileNavOpen(false)}><X size={18} /></button></div><div className="space-y-1">{NAV_ITEMS.map((item) => { const Icon = item.icon; return <button key={item.label} onClick={() => { if (item.label === "Profile") { window.location.href = "/profile"; return; } setActiveNav(item.label); setMobileNavOpen(false); document.getElementById(item.label === "Discover" ? "market-discovery" : item.label === "My portfolio" ? "portfolio" : item.label === "Orders" ? "open-orders" : "top-overview")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${activeNav === item.label ? "bg-[#143235] text-[#76e4c4]" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"}`}><Icon size={17} /><span>{item.label}</span>{item.label === "Orders" && activeOrders.length > 0 && <span className="ml-auto rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">{activeOrders.length}</span>}</button>; })}</div><div className="mt-auto hidden rounded-2xl border border-[#2b5c5c]/40 bg-gradient-to-br from-[#102c31] to-[#101e2b] p-4 lg:block"><div className="mb-3 flex items-center justify-between"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#69ddbd]/15 text-[#69ddbd]"><ShieldCheck size={16} /></span><Badge tone="green">Virtual only</Badge></div><p className="text-sm font-semibold text-slate-100">Trade without the noise.</p><p className="mt-1 text-xs leading-5 text-slate-400">Practice with simulated prices and zero real-money payments.</p><div className="mt-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#69ddbd]"><Sparkles size={12} /> Learn the market</div></div></div>
        </aside>

        <main id="top-overview" className="min-w-0 flex-1 px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
          <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#68e0c0]"><span className="h-1.5 w-1.5 rounded-full bg-[#68e0c0] shadow-[0_0_10px_#68e0c0]" /> Market open <span className="text-slate-600">·</span> Simulated environment</div><h1 className="text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl">Good morning, {displayName}.</h1><p className="mt-2 max-w-xl text-sm text-slate-400">Find your edge across a living marketplace of virtual products.</p></div><div className="flex items-center gap-2 text-xs text-slate-500"><Clock3 size={14} /> Data refreshes every 15 seconds</div></div>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="stat-card"><div className="flex items-start justify-between"><span className="stat-label">Available balance</span><WalletCards size={16} className="text-[#68e0c0]" /></div><div className="mt-4 text-2xl font-bold tracking-tight text-white">{money(wallet?.balance ?? "100000")}</div><div className="mt-2 text-xs text-slate-500">{money(wallet?.lockedBalance ?? "0")} reserved in orders</div></div><div className="stat-card"><div className="flex items-start justify-between"><span className="stat-label">Portfolio value</span><TrendingUp size={16} className="text-[#68e0c0]" /></div><div className="mt-4 text-2xl font-bold tracking-tight text-white">{money(holdings.reduce((sum, row) => sum + Number(row.holding.quantity) * Number(row.product.currentPrice), 0))}</div><div className={`mt-2 text-xs ${portfolioPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{pnl(portfolioPnl)} unrealized P/L</div></div><div className="stat-card"><div className="flex items-start justify-between"><span className="stat-label">Open orders</span><BookOpen size={16} className="text-[#e3b77d]" /></div><div className="mt-4 text-2xl font-bold tracking-tight text-white">{activeOrders.length.toString().padStart(2, "0")}</div><div className="mt-2 text-xs text-slate-500">Live in the market book</div></div><div className="stat-card"><div className="flex items-start justify-between"><span className="stat-label">Markets tracked</span><BarChart3 size={16} className="text-[#a794e8]" /></div><div className="mt-4 text-2xl font-bold tracking-tight text-white">{productsQuery.data?.length ?? 0}<span className="text-sm text-slate-500"> / 100</span></div><div className="mt-2 text-xs text-slate-500">Curated virtual products</div></div></section>

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(370px,.8fr)]">
            <section className="panel min-w-0"><div className="flex flex-col justify-between gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><h2 className="section-title">Market discovery</h2><Badge tone="green"><span className="h-1.5 w-1.5 rounded-full bg-current" /> Live</Badge></div><p className="mt-1 text-xs text-slate-500">Browse products and choose a market to trade.</p></div><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.035] pl-9 pr-3 text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-[#5dd8b8]/50 sm:w-52" /></div></div><div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">{CATEGORIES.map((item) => <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition ${category === item ? "border-[#5dd8b8]/30 bg-[#5dd8b8]/10 text-[#73e4c4]" : "border-white/[0.08] bg-white/[0.02] text-slate-500 hover:text-slate-200"}`}>{item}</button>)}</div><div className="mt-5 grid gap-3 sm:grid-cols-2">{productsQuery.isLoading ? [1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl bg-white/[0.04]" />) : visibleProducts.map((product) => { const productChange = pct(product.currentPrice, product.previousPrice); const productPositive = Number(productChange.replace("%", "")) >= 0; return <button key={product.id} onClick={() => selectProduct(product)} className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition ${selected?.id === product.id ? "border-[#5dd8b8]/40 bg-[#5dd8b8]/[0.07]" : "border-white/[0.07] bg-white/[0.02] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.045]"}`}><div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg text-xs font-black text-[#bcecdf]" style={{ background: `linear-gradient(135deg, hsl(${(product.id * 43) % 360} 48% 30%), #102b38)` }}>{product.name.replace("Seed • ", "").slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="mb-1 flex items-center gap-2"><span className="truncate text-sm font-semibold text-slate-100">{product.name.replace("Seed • ", "")}</span>{selected?.id === product.id && <Check size={14} className="shrink-0 text-[#69ddbd]" />}</div><div className="text-[10px] uppercase tracking-[0.15em] text-slate-600">{product.category}</div><div className={`mt-2 flex items-center gap-1 text-xs font-semibold ${productPositive ? "text-emerald-300" : "text-rose-300"}`}>{productPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{productChange}</div></div><div className="flex flex-col items-end gap-2"><span className="font-mono text-sm font-semibold text-slate-100">{shortMoney(product.currentPrice)}</span><Sparkline positive={productPositive} /></div></button>; })}</div>{!productsQuery.isLoading && products.length > 10 && <button onClick={() => setShowAllProducts((value) => !value)} className="mt-4 rounded-lg border border-[#69ddbd]/25 px-3 py-2 text-xs font-semibold text-[#8ceacd] transition hover:bg-[#69ddbd]/10">{showAllProducts ? "Show fewer" : `See more (${products.length - 10} more)`}</button>}{!productsQuery.isLoading && products.length === 0 && <div className="mt-5"><EmptyState title="No markets found" message="Try another search or category." /></div>}<div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4 text-[11px] text-slate-500"><span>Prices are simulated market prices</span><span className="flex items-center gap-1 text-[#69ddbd]"><span className="h-1.5 w-1.5 rounded-full bg-current" /> Backend connected</span></div></section>

            <section id="portfolio" className="panel scroll-mt-24"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="section-title">Your positions</h2><Badge tone="slate">Portfolio</Badge></div><p className="mt-1 text-xs text-slate-500">Click a holding to prepare a sell order.</p></div><BriefcaseBusiness size={17} className="text-slate-500" /></div><div className="mt-5 space-y-3">{holdings.length === 0 ? <EmptyState title="Your portfolio is empty" message="Explore the markets to make your first trade." /> : holdings.slice(0, 5).map((row) => <div key={row.holding.id} onClick={() => selectHoldingForSell(row.product)} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 transition hover:border-[#e9899b]/40 hover:bg-[#e9899b]/[0.05]"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#164147] text-xs font-bold text-[#76e4c4]">{row.product.name.replace("Seed • ", "").slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold text-slate-200">{row.product.name.replace("Seed • ", "")}</div><div className="mt-1 text-[11px] text-slate-500">{row.holding.quantity} units · avg {money(row.holding.averageCost)}</div></div><div className="text-right"><div className="font-mono text-xs font-semibold text-slate-200">{money(Number(row.holding.quantity) * Number(row.product.currentPrice))}</div><div className={`mt-1 text-[10px] font-semibold ${Number(row.product.currentPrice) >= Number(row.holding.averageCost) ? "text-emerald-300" : "text-rose-300"}`}>{pnl((Number(row.product.currentPrice) - Number(row.holding.averageCost)) * row.holding.quantity)} P/L</div></div></div>)}</div>{holdings.length > 5 && <button onClick={() => setActiveNav("My portfolio")} className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#69ddbd] hover:text-white">View all positions <ChevronDown size={13} className="-rotate-90" /></button>}</section>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(370px,.8fr)]">
            <section className="panel min-w-0"><div className="flex flex-col justify-between gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><h2 className="section-title">{selected?.name.replace("Seed • ", "") ?? "Select a market"}</h2><Badge tone="amber">Simulated market price</Badge></div><p className="mt-1 text-xs text-slate-500">{selected?.category ?? "Choose a product above to view its market."}</p></div>{selected && <div className="text-right"><div className="font-mono text-xl font-bold text-white">{money(selected.currentPrice)}</div><div className={`mt-1 flex items-center justify-end gap-1 text-xs font-semibold ${positive ? "text-emerald-300" : "text-rose-300"}`}>{positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{change} today</div></div>}</div>{selected ? <><div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 border-b border-white/[0.07] pb-5 text-xs sm:grid-cols-4"><div><div className="stat-label">Open</div><div className="mt-1 font-mono text-slate-200">{money(selected.openingPrice)}</div></div><div><div className="stat-label">High</div><div className="mt-1 font-mono text-emerald-300">{money(selected.highPrice)}</div></div><div><div className="stat-label">Low</div><div className="mt-1 font-mono text-rose-300">{money(selected.lowPrice)}</div></div><div><div className="stat-label">Volume</div><div className="mt-1 font-mono text-slate-200">{selected.volume.toLocaleString()} units</div></div></div><div className="mt-5 h-60 w-full">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 3, left: -20, bottom: 0 }}><defs><linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#68e0c0" stopOpacity={0.28} /><stop offset="100%" stopColor="#68e0c0" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#ffffff0a" vertical={false} /><XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={30} /><YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}`} /><Tooltip contentStyle={{ background: "#111d27", border: "1px solid #ffffff18", borderRadius: 10, fontSize: 11 }} labelStyle={{ color: "#94a3b8" }} formatter={(value: number) => [`${value.toFixed(2)} TC`, "Price"]} /><Area type="monotone" dataKey="price" stroke="#68e0c0" strokeWidth={2} fill="url(#priceFill)" /></AreaChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-xs text-slate-500">Price history will appear after the market is seeded.</div>}</div><div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-600"><span>1 year</span><span>Price history · Volume aware</span></div></> : <EmptyState title="Choose a market" message="Select a product above to see price history and live orders." />}</section>

            <section className="panel"><div className="flex items-center justify-between"><div><h2 className="section-title">Place limit order</h2><p className="mt-1 text-xs text-slate-500">Server matched · price-time priority</p></div><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#69ddbd]/10 text-[#69ddbd]"><Plus size={16} /></div></div><div className="mt-5 grid grid-cols-2 rounded-xl bg-white/[0.04] p-1"><button onClick={() => setSide("BUY")} className={`rounded-lg py-2 text-xs font-bold transition ${side === "BUY" ? "bg-[#69ddbd] text-[#062a2b] shadow-lg shadow-[#69ddbd]/10" : "text-slate-500 hover:text-slate-200"}`}>Buy</button><button onClick={() => setSide("SELL")} className={`rounded-lg py-2 text-xs font-bold transition ${side === "SELL" ? "bg-[#e9899b] text-[#3a101b] shadow-lg shadow-[#e9899b]/10" : "text-slate-500 hover:text-slate-200"}`}>Sell</button></div>{selected ? <div className="mt-5 space-y-4"><div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><div className="flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-slate-500"><span>Market</span><span className="font-mono text-[#69ddbd]">{money(selected.currentPrice)}</span></div><div className="mt-2 text-sm font-semibold text-white">{selected.name.replace("Seed • ", "")}</div></div>{side === "SELL" && <div className="rounded-lg border border-rose-300/15 bg-rose-300/[0.06] px-3 py-2 text-[11px] text-rose-200">Available to sell: <span className="font-mono font-bold">{availableToSell}</span> units. Select a holding from Your positions to sell it.</div>}<label className="block"><span className="field-label">Limit price <span className="normal-case tracking-normal text-slate-600">(TC)</span></span><div className="relative mt-2"><input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder={selected.currentPrice} className="field-input pr-12" /><span className="field-suffix">TC</span></div></label><label className="block"><span className="field-label">Quantity <span className="normal-case tracking-normal text-slate-600">(units)</span></span><input inputMode="numeric" min="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="field-input mt-2" /></label><div className="flex items-center justify-between border-t border-white/[0.07] pt-4 text-xs"><span className="text-slate-500">Estimated total</span><span className="font-mono font-semibold text-slate-200">{money(Number(price || selected.currentPrice) * Number(quantity || 0))}</span></div><button disabled={createOrder.isPending} onClick={() => void submitOrder()} className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${side === "BUY" ? "bg-[#69ddbd] text-[#062a2b] hover:bg-[#8ceacd]" : "bg-[#e9899b] text-[#3a101b] hover:bg-[#f0a8b6]"}`}>{createOrder.isPending ? "Submitting…" : !isAuthenticated ? "Sign in to trade" : `${side === "BUY" ? "Place buy" : "Place sell"} order`}<ArrowUpRight size={14} /></button><p className="text-center text-[10px] leading-4 text-slate-600">Your order is reserved and settled atomically by the backend.</p></div> : <EmptyState title="Select a market first" message="Your order form will appear here." />}</section>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <section className="panel"><div className="flex items-center justify-between border-b border-white/[0.07] pb-4"><div><h2 className="section-title">Order book</h2><p className="mt-1 text-xs text-slate-500">{market ? `${market.buyOrders.length + market.sellOrders.length} public levels · visible to all users` : "Select a market to view"}</p></div><Badge tone="slate">Live</Badge></div>{market ? <div className="mt-4 grid gap-5 md:grid-cols-2"><div><div className="mb-2 flex justify-between px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600"><span>Buy orders · public</span><span>Price · Qty</span></div><div className="space-y-1.5">{market.buyOrders.length ? market.buyOrders.slice(0, 7).map((order) => <button key={order.id} onClick={() => { setSide("SELL"); setPrice(order.price); setQuantity(String(Math.min(1, order.remainingQuantity))); }} className="book-row buy w-full text-left transition hover:border-emerald-300/30 hover:bg-emerald-300/[0.06]" title="Sell into this public buy order"><span className="font-mono text-emerald-300">{shortMoney(order.price)}</span><span className="max-w-[90px] truncate text-[10px] text-slate-500">{order.userName}</span><span className="font-mono text-slate-300">{order.remainingQuantity}</span></button>) : <div className="py-6 text-center text-xs text-slate-600">No matching buy orders.</div>}</div></div><div><div className="mb-2 flex justify-between px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600"><span>Sell orders</span><span>Price · Qty</span></div><div className="space-y-1.5">{market.sellOrders.length ? market.sellOrders.slice(0, 7).map((order) => <div key={order.id} className="book-row sell"><span className="font-mono text-rose-300">{shortMoney(order.price)}</span><span className="max-w-[90px] truncate text-[10px] text-slate-500">{order.userName}</span><span className="font-mono text-slate-300">{order.remainingQuantity}</span></div>) : <div className="py-6 text-center text-xs text-slate-600">No matching sell orders.</div>}</div></div></div> : <EmptyState title="No market selected" message="Select a product to view the backend order book." />}{market && <div className="mt-5 grid grid-cols-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-center"><div><div className="stat-label">Best bid</div><div className="mt-1 font-mono text-xs text-emerald-300">{market.bestBid ? money(market.bestBid) : "—"}</div></div><div className="border-x border-white/[0.07]"><div className="stat-label">Spread</div><div className="mt-1 font-mono text-xs text-slate-300">{market.bestBid && market.bestAsk ? money(Number(market.bestAsk) - Number(market.bestBid)) : "—"}</div></div><div><div className="stat-label">Best ask</div><div className="mt-1 font-mono text-xs text-rose-300">{market.bestAsk ? money(market.bestAsk) : "—"}</div></div></div>}</section>

            <section id="open-orders" className="panel scroll-mt-24"><div className="flex items-center justify-between border-b border-white/[0.07] pb-4"><div><h2 className="section-title">Open orders</h2><p className="mt-1 text-xs text-slate-500">Cancel anytime · reservations release automatically</p></div><Badge tone="slate">{activeOrders.length} active</Badge></div><div className="mt-4 space-y-2">{!isAuthenticated ? <EmptyState title="Sign in to manage orders" message="Your open orders and transaction history will appear here." /> : activeOrders.length === 0 ? <EmptyState title="You don't have any active orders" message="Place a limit order to start participating in the market." /> : activeOrders.slice(0, 6).map((row) => <div key={row.order.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><div className={`grid h-8 w-8 place-items-center rounded-lg ${row.order.orderType === "BUY" ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>{row.order.orderType === "BUY" ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold text-slate-200">{row.product.name.replace("Seed • ", "")}</div><div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-slate-600">{row.order.orderType} · {row.order.status}</div></div><div className="text-right"><div className="font-mono text-xs text-slate-200">{shortMoney(row.order.price)} TC</div><div className="mt-1 text-[10px] text-slate-500">{row.order.remainingQuantity} remaining</div></div><button disabled={cancelOrder.isPending} onClick={() => void handleCancel(row.order.id)} className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-slate-500 transition hover:border-rose-400/30 hover:text-rose-300"><X size={13} /></button></div>)}</div></section>
          </div>



          <footer className="mt-10 flex flex-col justify-between gap-3 border-t border-white/[0.07] py-6 text-[10px] uppercase tracking-[0.14em] text-slate-600 sm:flex-row"><span>TradeCoin Exchange · Virtual economy only</span><span className="flex items-center gap-2"><ShieldCheck size={12} /> No real-money payments · Backend source of truth</span></footer>
        </main>
      </div>
    </div>
  );
}
