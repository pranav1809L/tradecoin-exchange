import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ChevronDown, Eye, PencilLine, Trash2 } from "lucide-react";
import { AdminFrame, AdminGate, PinConfirm } from "./AdminShared";

type Mode = "edit" | "view" | null;

function EditForm() {
  const products = trpc.admin.products.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.admin.updateProduct.useMutation();
  const remove = trpc.admin.deleteProduct.useMutation();
  const [openId, setOpenId] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const selected = products.data?.find((product) => product.id === openId);

  useEffect(() => {
    if (!selected) return;
    setName(selected.name); setCategory(selected.category); setDescription(selected.description); setPrice(selected.currentPrice);
  }, [selected]);

  function choose(productId: number) {
    setOpenId((current) => current === productId ? null : productId);
    setMode(null);
  }
  function cancelEdit() {
    if (selected) { setName(selected.name); setCategory(selected.category); setDescription(selected.description); setPrice(selected.currentPrice); }
    setMode(null); setConfirmOpen(false); setDropOpen(false);
  }
  async function save(pin: string) {
    if (!selected) return;
    try {
      await update.mutateAsync({ productId: selected.id, name, category, description, price, pin });
      await Promise.all([utils.admin.products.invalidate(), utils.markets.products.invalidate()]);
      toast.success("Product changes saved"); cancelEdit();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save product"); }
  }
  async function drop(pin: string) {
    if (!selected) return;
    try {
      await remove.mutateAsync({ productId: selected.id, pin });
      await Promise.all([utils.admin.products.invalidate(), utils.markets.products.invalidate()]);
      setOpenId(null); setMode(null); setDropOpen(false); toast.success("Product dropped");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not drop product"); }
  }

  return <AdminFrame title="Edit product" description="Click a product to open Edit and View. The selected panel expands directly beneath it and pushes the products below down temporarily.">
    <section className="rounded-2xl border border-white/[0.08] bg-[#0b1823] p-3">
      <div className="mb-3 px-2 text-xs font-bold uppercase tracking-wider text-slate-500">Existing products</div>
      <div className="space-y-2">
        {products.data?.map((product) => <div key={product.id} className={`rounded-xl border bg-white/[0.02] ${openId === product.id ? "border-[#69ddbd]/30" : "border-white/[0.07]"}`}>
          <button onClick={() => choose(product.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${openId === product.id ? "bg-[#69ddbd]/10 text-[#8ceacd]" : "text-slate-300 hover:bg-white/[0.04]"}`}>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{product.name}</div><div className="mt-1 text-[10px] text-slate-600">{product.category} · {Number(product.currentPrice).toFixed(2)} TC</div></div><ChevronDown size={16} className={`shrink-0 transition ${openId === product.id ? "rotate-180" : ""}`} />
          </button>
          {openId === product.id && <>
            <div className="flex gap-2 border-t border-white/[0.07] p-2"><button onClick={() => setMode("edit")} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold ${mode === "edit" ? "bg-[#69ddbd] text-[#062a2b]" : "bg-[#69ddbd]/10 text-[#8ceacd]"}`}><PencilLine size={13} /> Edit</button><button onClick={() => setMode("view")} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold ${mode === "view" ? "bg-white/15 text-white" : "border border-white/10 text-slate-300"}`}><Eye size={13} /> View</button></div>
            {mode === "view" && <div className="border-t border-white/[0.07] bg-[#08141e] p-4"><div className="mb-4 flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">All product details</div><h2 className="mt-1 text-xl font-bold text-slate-100">{product.name}</h2></div><button onClick={() => setMode(null)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300">Close</button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="detail-cell"><span>Category</span><strong>{product.category}</strong></div><div className="detail-cell"><span>Current price</span><strong>{Number(product.currentPrice).toFixed(2)} TC</strong></div><div className="detail-cell"><span>Opening price</span><strong>{Number(product.openingPrice).toFixed(2)} TC</strong></div><div className="detail-cell"><span>Previous price</span><strong>{Number(product.previousPrice).toFixed(2)} TC</strong></div><div className="detail-cell"><span>High price</span><strong>{Number(product.highPrice).toFixed(2)} TC</strong></div><div className="detail-cell"><span>Low price</span><strong>{Number(product.lowPrice).toFixed(2)} TC</strong></div><div className="detail-cell"><span>Volume</span><strong>{product.volume} units</strong></div><div className="detail-cell sm:col-span-2 lg:col-span-4"><span>Description</span><strong className="leading-6">{product.description || "No description provided."}</strong></div></div></div>}
            {mode === "edit" && <div className="border-t border-white/[0.07] bg-[#08141e] p-4"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><PencilLine size={18} className="text-violet-300" /><h2 className="text-sm font-bold">Edit details</h2></div><button onClick={cancelEdit} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300">Cancel</button></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="text-xs font-semibold text-slate-300">Product name</label><input value={name} onChange={(event) => setName(event.target.value)} className="field-input mt-2" /></div><div><label className="text-xs font-semibold text-slate-300">Category</label><input value={category} onChange={(event) => setCategory(event.target.value)} className="field-input mt-2" /></div><div><label className="text-xs font-semibold text-slate-300">Current price (TC)</label><input value={price} onChange={(event) => setPrice(event.target.value)} className="field-input mt-2" inputMode="decimal" /></div><div className="sm:col-span-2"><label className="text-xs font-semibold text-slate-300">Description <span className="font-normal text-slate-500">(optional)</span></label><textarea value={description} onChange={(event) => setDescription(event.target.value)} className="field-input mt-2 h-24 py-3" /></div></div><div className="mt-5 flex flex-wrap gap-2"><button onClick={() => setConfirmOpen(true)} className="rounded-xl bg-[#69ddbd] px-5 py-3 text-xs font-bold text-[#062a2b]">Confirm changes</button><button onClick={() => setDropOpen(true)} className="flex items-center gap-2 rounded-xl border border-rose-400/25 px-4 py-3 text-xs font-semibold text-rose-300"><Trash2 size={14} /> Drop product</button></div></div>}
          </>}
        </div>)}
      </div>
    </section>
    <PinConfirm open={confirmOpen || dropOpen} title={dropOpen ? "Enter passkey 1809 to permanently drop this product." : "Enter passkey 1809 to save these product changes."} onConfirm={(pin) => void (dropOpen ? drop(pin) : save(pin))} onCancel={cancelEdit} pending={update.isPending || remove.isPending} />
  </AdminFrame>;
}

export default function AdminEditProduct() { return <AdminGate><EditForm /></AdminGate>; }
