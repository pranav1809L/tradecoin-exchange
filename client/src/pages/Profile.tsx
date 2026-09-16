import { useEffect, useState } from "react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Check, Mail, Palette, Save, ShieldCheck, UserRound } from "lucide-react";
import { Link } from "wouter";


type ThemeKey = "dark" | "glass" | "light" | "fintech" | "cyberpunk";
const THEMES: Array<{ key: ThemeKey; label: string; description: string; swatch: string }> = [
  { key: "dark", label: "Dark / Modern", description: "Focused exchange workspace", swatch: "#071019" },
  { key: "glass", label: "Glassmorphism", description: "Layered translucent surfaces", swatch: "#233a58" },
  { key: "light", label: "Light / Minimal", description: "Bright and distraction-free", swatch: "#f4f7f8" },
  { key: "fintech", label: "Fintech", description: "Crisp banking-inspired UI", swatch: "#063b43" },
  { key: "cyberpunk", label: "Cyberpunk", description: "Neon purple and electric pink", swatch: "#210b38" },
];

const THEME_STYLES: Record<ThemeKey, { page: string; header: string; card: string; accent: string; button: string; muted: string }> = {
  dark: { page: "bg-[#071019] text-slate-100", header: "border-white/[0.07] bg-[#071019]/90", card: "border-white/[0.08] bg-[#0b1823]", accent: "text-[#68e0c0]", button: "bg-[#69ddbd] text-[#062a2b]", muted: "text-slate-400" },
  glass: { page: "bg-[radial-gradient(circle_at_top,#26496b,#0c1524_55%,#070b14)] text-slate-100", header: "border-white/20 bg-white/[0.08] backdrop-blur-xl", card: "border-white/20 bg-white/[0.10] backdrop-blur-xl shadow-2xl", accent: "text-cyan-200", button: "bg-cyan-200 text-slate-900", muted: "text-slate-300" },
  light: { page: "bg-[#f4f7f8] text-slate-900", header: "border-slate-200 bg-white/90", card: "border-slate-200 bg-white shadow-sm", accent: "text-teal-700", button: "bg-teal-600 text-white", muted: "text-slate-500" },
  fintech: { page: "bg-[#06151b] text-slate-100", header: "border-cyan-900/60 bg-[#06151b]/95", card: "border-cyan-900/60 bg-[#0a222b]", accent: "text-cyan-300", button: "bg-cyan-300 text-[#062a2b]", muted: "text-slate-400" },
  cyberpunk: { page: "bg-[radial-gradient(circle_at_top_right,#42136c,#15071f_50%,#090510)] text-fuchsia-50", header: "border-fuchsia-500/30 bg-[#10051c]/90", card: "border-fuchsia-500/25 bg-[#1a0d2a] shadow-[0_0_30px_rgba(217,70,239,.08)]", accent: "text-fuchsia-300", button: "bg-fuchsia-300 text-[#21052e]", muted: "text-fuchsia-100/60" },
};

function money(value: string | number | null | undefined) {
  return `${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TC`;
}

export default function Profile() {
  const { user, loading, isAuthenticated } = useAuth();
  const accountQuery = trpc.account.overview.useQuery(undefined, { enabled: isAuthenticated });
  const updateName = trpc.account.updateName.useMutation();
  const [name, setName] = useState("");
  const { theme, setTheme } = useTheme();
  const [pendingTheme, setPendingTheme] = useState<ThemeKey>(theme as ThemeKey);
  const themeStyle = THEME_STYLES[theme];

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  function chooseTheme(next: ThemeKey) { setPendingTheme(next); }

  function confirmTheme() {
    setTheme(pendingTheme);
    toast.success("Website theme changed");
  }

  async function saveName() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Name must be at least 2 characters.");
      return;
    }
    try {
      await updateName.mutateAsync({ name: trimmed });
      toast.success("Profile name updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update profile");
    }
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#071019] text-sm text-slate-400">Loading profile…</div>;
  if (!isAuthenticated) return <div className="grid min-h-screen place-items-center bg-[#071019] p-6 text-center text-slate-100"><div><UserRound className="mx-auto mb-4 text-[#69ddbd]" size={32} /><h1 className="text-2xl font-bold">Sign in to view your profile</h1><button onClick={() => startLogin()} className="mt-5 rounded-xl bg-[#69ddbd] px-5 py-3 text-sm font-bold text-[#062a2b]">Sign in</button></div></div>;

  const trades = accountQuery.data?.tradeHistory ?? [];
  return <div className={`site-shell profile-page min-h-screen ${themeStyle.page}`}><header className={`border-b ${themeStyle.header}`}><div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-4 sm:px-6"><Link href="/" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#66e0bd] to-[#1ca4a7] text-[#062a2b]"><UserRound size={19} /></span><span className="text-lg font-bold">trade<span className="text-[#68e0c0]">coin</span></span></Link><Link href="/" className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white"><ArrowLeft size={14} /> Back to exchange</Link></div></header><main className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><div className="mb-8"><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#68e0c0]">Account center</div><h1 className="mt-2 text-4xl font-bold tracking-tight text-white">Your profile</h1><p className={`mt-2 text-sm ${themeStyle.muted}`}>Manage your identity and understand your trading performance.</p></div><section className={`mb-6 rounded-2xl border p-4 ${themeStyle.card}`}><div className="flex items-center gap-2"><Palette size={16} className={themeStyle.accent} /><div><h2 className="text-sm font-bold">Profile theme</h2><p className={`mt-1 text-xs ${themeStyle.muted}`}>Choose how your account center looks on this device.</p></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{THEMES.map((option) => <button key={option.key} onClick={() => chooseTheme(option.key)} className={`rounded-xl border p-3 text-left transition ${pendingTheme === option.key ? "border-[#69ddbd] ring-1 ring-[#69ddbd]/40" : "border-white/10 hover:border-white/25"}`}><span className="mb-2 block h-8 rounded-lg" style={{ background: option.swatch }}></span><span className="flex items-center justify-between text-xs font-bold">{option.label}{pendingTheme === option.key && <Check size={14} className={themeStyle.accent} />}</span><span className={`mt-1 block text-[10px] ${themeStyle.muted}`}>{option.description}</span></button>)}</div><div className="mt-4 flex justify-end"><button onClick={confirmTheme} disabled={pendingTheme === theme} className={`rounded-xl px-4 py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${themeStyle.button}`}>Confirm change</button></div></section><div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]"><section className={`rounded-2xl border p-5 ${themeStyle.card}`}><div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#69ddbd]/15 text-2xl font-bold text-[#8ceacd]">{(user?.name ?? "T").charAt(0).toUpperCase()}</div><h2 className="mt-4 text-xl font-bold text-white">{user?.name ?? "Trader"}</h2><div className="mt-2 flex items-center gap-2 text-xs text-slate-400"><Mail size={14} /> {user?.email ?? "Connected account"}</div><div className="mt-6 border-t border-white/[0.07] pt-5"><label className="text-xs font-semibold text-slate-400">Display name</label><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} className="field-input mt-2" /><button onClick={() => void saveName()} disabled={updateName.isPending} className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold disabled:opacity-60 ${themeStyle.button}`}><Save size={14} /> {updateName.isPending ? "Saving…" : "Save changes"}</button></div><div className="mt-6 flex items-start gap-2 rounded-xl border border-[#2b5c5c]/40 bg-[#102c31]/60 p-3 text-xs leading-5 text-slate-400"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#69ddbd]" /> Your profile is private to your account. Your order name is visible in public market books.</div></section><section className={`rounded-2xl border p-5 ${themeStyle.card}`}><div className="flex items-center justify-between border-b border-white/[0.07] pb-4"><div><h2 className="text-lg font-bold text-white">Completed trades</h2><p className="mt-1 text-xs text-slate-500">Your matched trades and performance indicators.</p></div><span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">{trades.length} trades</span></div>{trades.length === 0 ? <div className="grid min-h-56 place-items-center text-center text-sm text-slate-500">No completed trades yet.<br /><span className="mt-1 text-xs">Matched buys and sells will appear here.</span></div> : <div className="mt-4 space-y-2">{trades.map(({ trade, product, side }) => { const referencePnl = side === "SELL" ? (Number(trade.price) - Number(product.openingPrice)) * trade.quantity : (Number(product.currentPrice) - Number(trade.price)) * trade.quantity; const profitable = referencePnl >= 0; return <div key={`${trade.id}-${side}`} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><div className={`grid h-9 w-9 place-items-center rounded-lg ${side === "BUY" ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>{side === "BUY" ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-200">{product.name.replace("Seed • ", "")}</div><div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-slate-600">{side} · {trade.quantity} units · {new Date(trade.executedAt).toLocaleString()}</div></div><div className="text-right"><div className="font-mono text-xs text-slate-200">{money(trade.totalValue)}</div><div className={`mt-1 text-[10px] font-semibold ${profitable ? "text-emerald-300" : "text-rose-300"}`}>{profitable ? "+" : "-"}{money(Math.abs(referencePnl))} {profitable ? "profitable" : "loss"}</div></div></div>; })}</div>}</section></div></main></div>;
}
