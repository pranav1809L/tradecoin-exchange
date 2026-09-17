import { useEffect, useState } from "react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { Link, useLocation } from "wouter";

export const ADMIN_SESSION_KEY = "tradecoin-admin-unlocked";
export const isAuthorizedAdmin = (user: { role?: string | null; email?: string | null } | null | undefined) => user?.role === "admin" || user?.email?.toLowerCase() === "pranavvarmaonline@gmail.com";

export function AdminNav() {
  const [location] = useLocation();
  return <div className="mb-8 flex flex-wrap gap-2 rounded-2xl border border-white/[0.08] bg-[#0b1823] p-2"><Link href="/administrator" className={`rounded-xl px-4 py-2.5 text-xs font-bold ${location === "/administrator" ? "bg-[#69ddbd] text-[#062a2b]" : "text-slate-400 hover:bg-white/[0.05] hover:text-white"}`}>Overview</Link><Link href="/administrator/add" className={`rounded-xl px-4 py-2.5 text-xs font-bold ${location === "/administrator/add" ? "bg-[#69ddbd] text-[#062a2b]" : "text-slate-400 hover:bg-white/[0.05] hover:text-white"}`}>Add product</Link><Link href="/administrator/edit" className={`rounded-xl px-4 py-2.5 text-xs font-bold ${location === "/administrator/edit" ? "bg-[#69ddbd] text-[#062a2b]" : "text-slate-400 hover:bg-white/[0.05] hover:text-white"}`}>Edit product</Link></div>;
}

export function AdminFrame({ children, title, description }: { children: React.ReactNode; title: string; description: string }) {
  return <div className="min-h-screen bg-[#071019] text-slate-100"><header className="border-b border-white/[0.07] bg-[#071019]/90"><div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-4 sm:px-6"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#69ddbd]/15 text-[#69ddbd]"><ShieldCheck size={20} /></span><div><div className="text-lg font-bold">Administrator</div><div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">TradeCoin controls</div></div></div><Link href="/" className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300"><ArrowLeft size={14} /> Back to exchange</Link></div></header><main className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><div className="mb-5"><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#69ddbd]">Authorized administrator</div><h1 className="mt-2 text-4xl font-bold tracking-tight">{title}</h1><p className="mt-2 text-sm text-slate-400">{description}</p></div><AdminNav />{children}</main></div>;
}

export function PinConfirm({ open, title, onConfirm, onCancel, pending = false }: { open: boolean; title: string; onConfirm: (pin: string) => void; onCancel: () => void; pending?: boolean }) {
  const [pin, setPin] = useState("");
  useEffect(() => { if (!open) setPin(""); }, [open]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b1823] p-6 shadow-2xl"><div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-300/10 text-amber-200"><KeyRound size={19} /></span><div><h2 className="font-bold">Confirm changes</h2><p className="text-xs text-slate-500">{title}</p></div></div><label className="text-xs font-semibold text-slate-300">Administrator PIN</label><input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} type="password" inputMode="numeric" autoFocus placeholder="••••" className="field-input mt-2 tracking-[0.5em]" /><div className="mt-5 flex justify-end gap-2"><button onClick={onCancel} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300">Cancel</button><button disabled={pin.length !== 4 || pending} onClick={() => onConfirm(pin)} className="rounded-xl bg-[#69ddbd] px-4 py-2.5 text-xs font-bold text-[#062a2b] disabled:opacity-50">{pending ? "Confirming…" : "Confirm changes"}</button></div></div></div>;
}

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth();
  const verify = trpc.admin.verifyCredentials.useMutation();
  const [unlocked, setUnlocked] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  useEffect(() => setUnlocked(sessionStorage.getItem(ADMIN_SESSION_KEY) === "true"), []);
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#071019] text-sm text-slate-400">Loading administrator access…</div>;
  if (!isAuthenticated) return <div className="grid min-h-screen place-items-center bg-[#071019] p-6 text-center text-slate-100"><div><LockKeyhole className="mx-auto mb-4 text-rose-300" size={36} /><h1 className="text-2xl font-bold">Administrator sign-in required</h1><p className="mt-2 text-sm text-slate-400">Sign in with the authorized administrator account.</p><button onClick={() => startLogin()} className="mt-5 rounded-xl bg-[#69ddbd] px-5 py-3 text-sm font-bold text-[#062a2b]">Sign in</button></div></div>;
  if (!isAuthorizedAdmin(user)) return <div className="grid min-h-screen place-items-center bg-[#071019] p-6 text-center text-slate-100"><div><LockKeyhole className="mx-auto mb-4 text-rose-300" size={36} /><h1 className="text-2xl font-bold">You don’t have access</h1><p className="mt-2 max-w-md text-sm text-slate-400">The Administrator page is restricted to authorized administrators.</p><Link href="/" className="mt-5 inline-flex rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200">Back to exchange</Link></div></div>;
  if (!unlocked) return <div className="grid min-h-screen place-items-center bg-[#071019] p-6 text-slate-100"><form onSubmit={async (event) => { event.preventDefault(); setError(""); try { const result = await verify.mutateAsync({ username, password }); if (!result.success) { setError("Invalid administrator username or password."); return; } sessionStorage.setItem(ADMIN_SESSION_KEY, "true"); setUnlocked(true); } catch (err) { setError(err instanceof Error ? err.message : "Unable to verify administrator credentials."); } }} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1823] p-7 shadow-2xl"><div className="mb-6 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#69ddbd]/10 text-[#69ddbd]"><KeyRound size={22} /></span><h1 className="mt-4 text-2xl font-bold">Administrator credentials</h1><p className="mt-2 text-sm text-slate-400">Verify your administrator account to continue.</p></div><label className="text-xs font-semibold text-slate-300">Username</label><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" className="field-input mt-2" placeholder="Admin username" required /><label className="mt-4 block text-xs font-semibold text-slate-300">Password</label><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" className="field-input mt-2" placeholder="Password" required />{error && <p className="mt-3 text-xs text-rose-300">{error}</p>}<button disabled={verify.isPending} className="mt-5 w-full rounded-xl bg-[#69ddbd] px-4 py-3 text-sm font-bold text-[#062a2b] disabled:opacity-60">{verify.isPending ? "Verifying…" : "Continue"}</button></form></div>;
  return <>{children}</>;
}
