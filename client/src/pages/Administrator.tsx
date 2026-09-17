import { useState } from "react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, LockKeyhole, PackagePlus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Link } from "wouter";

function money(value: string | number | null | undefined) {
  return `${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TC`;
}

export default function Administrator() {
  const { user, loading, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin" || user?.email?.toLowerCase() === "pranavvarmaonline@gmail.com";
  const products = trpc.admin.products.useQuery(undefined, { enabled: isAuthenticated && isAdmin });
  const createProduct = trpc.admin.createProduct.useMutation();
  const updatePrice = trpc.admin.updatePrice.useMutation();
  const deleteProduct = trpc.admin.deleteProduct.useMutation();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Technology");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingPrice, setEditingPrice] = useState("");

  async function addProduct(event: React.FormEvent) {
    event.preventDefault();
    try {
      await createProduct.mutateAsync({ name, category, description, price });
      setName(""); setDescription(""); setPrice("");
      await utils.admin.products.invalidate();
      await utils.markets.products.invalidate();
      toast.success("Product added to the marketplace");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add product"); }
  }

  async function savePrice(productId: number) {
    try {
      await updatePrice.mutateAsync({ productId, price: editingPrice });
      setEditingId(null); setEditingPrice("");
      await Promise.all([utils.admin.products.invalidate(), utils.markets.products.invalidate()]);
      toast.success("Product price updated");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update price"); }
  }

  async function dropProduct(productId: number) {
    if (!window.confirm("Drop this product? Its market records and open orders will also be removed.")) return;
    try {
      await deleteProduct.mutateAsync({ productId });
      await Promise.all([utils.admin.products.invalidate(), utils.markets.products.invalidate()]);
      toast.success("Product dropped");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not drop product"); }
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#071019] text-sm text-slate-400">Loading administrator access…</div>;
  if (!isAuthenticated) return <div className="grid min-h-screen place-items-center bg-[#071019] p-6 text-center text-slate-100"><div><LockKeyhole className="mx-auto mb-4 text-rose-300" size={36} /><h1 className="text-2xl font-bold">Administrator sign-in required</h1><p className="mt-2 text-sm text-slate-400">Sign in with the authorized administrator account.</p><button onClick={() => startLogin()} className="mt-5 rounded-xl bg-[#69ddbd] px-5 py-3 text-sm font-bold text-[#062a2b]">Sign in</button></div></div>;
  if (!isAdmin) return <div className="grid min-h-screen place-items-center bg-[#071019] p-6 text-center text-slate-100"><div><LockKeyhole className="mx-auto mb-4 text-rose-300" size={36} /><h1 className="text-2xl font-bold">You don’t have access</h1><p className="mt-2 max-w-md text-sm text-slate-400">The Administrator page is restricted to authorized administrators.</p><Link href="/" className="mt-5 inline-flex rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200">Back to exchange</Link></div></div>;

  return <div className="min-h-screen bg-[#071019] text-slate-100"><header className="border-b border-white/[0.07] bg-[#071019]/90"><div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-4 sm:px-6"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#69ddbd]/15 text-[#69ddbd]"><ShieldCheck size={20} /></span><div><div className="text-lg font-bold">Administrator</div><div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">TradeCoin controls</div></div></div><Link href="/" className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300"><ArrowLeft size={14} /> Back to exchange</Link></div></header><main className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><div className="mb-8"><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#69ddbd]">Authorized administrator</div><h1 className="mt-2 text-4xl font-bold tracking-tight">Manage marketplace</h1><p className="mt-2 text-sm text-slate-400">Add products, adjust simulated prices, or drop products from the catalog.</p></div><form onSubmit={addProduct} className="mb-6 rounded-2xl border border-white/[0.08] bg-[#0b1823] p-5"><div className="mb-4 flex items-center gap-2"><PackagePlus size={17} className="text-[#69ddbd]" /><h2 className="text-sm font-bold">Add product</h2></div><div className="grid gap-3 md:grid-cols-4"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" required className="field-input" /><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" required className="field-input" /><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" required className="field-input md:col-span-1" /><input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price TC" inputMode="decimal" required className="field-input" /></div><button disabled={createProduct.isPending} className="mt-4 rounded-xl bg-[#69ddbd] px-4 py-3 text-xs font-bold text-[#062a2b] disabled:opacity-60">{createProduct.isPending ? "Adding…" : "Add product"}</button></form><section className="rounded-2xl border border-white/[0.08] bg-[#0b1823] p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold">Product catalog</h2><p className="mt-1 text-xs text-slate-500">{products.data?.length ?? 0} products available</p></div><button onClick={() => products.refetch()} className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white" title="Refresh"><RefreshCw size={15} /></button></div>{products.isLoading ? <p className="py-10 text-center text-sm text-slate-500">Loading products…</p> : <div className="space-y-2">{products.data?.map((product) => <div key={product.id} className="flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{product.name}</div><div className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{product.category} · Current {money(product.currentPrice)}</div></div>{editingId === product.id ? <div className="flex gap-2"><input value={editingPrice} onChange={(e) => setEditingPrice(e.target.value)} className="field-input w-28" inputMode="decimal" autoFocus /><button onClick={() => void savePrice(product.id)} className="rounded-lg bg-[#69ddbd] px-3 text-[11px] font-bold text-[#062a2b]">Save</button><button onClick={() => setEditingId(null)} className="rounded-lg border border-white/10 px-3 text-[11px]">Cancel</button></div> : <div className="flex items-center gap-2"><button onClick={() => { setEditingId(product.id); setEditingPrice(product.currentPrice); }} className="rounded-lg border border-[#69ddbd]/30 px-3 py-2 text-[11px] font-semibold text-[#8ceacd]">Adjust price</button><button onClick={() => void dropProduct(product.id)} className="rounded-lg border border-rose-400/25 p-2 text-rose-300" title="Drop product"><Trash2 size={15} /></button></div>}</div>)}</div>}</section></main></div>;
}
