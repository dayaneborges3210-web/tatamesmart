import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { Badge, Button, Field, Input } from "@/components/ui";
import { useDojo } from "@/lib/dojo-store";
import type { StockItem } from "@/lib/dojo-types";
import { brl, parseBRL } from "@/lib/money";

export const Route = createFileRoute("/estoque")({ component: EstoquePage });

const CATS = ["Faixa", "Kimono", "Luva", "Outro"];

function centsField(cents: number) {
  if (!cents) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function EstoquePage() {
  return (
    <Shell>
      <EstoqueBody />
    </Shell>
  );
}

function EstoqueBody() {
  const { stock, addStock, saveStock, deleteStock, adjustStock } = useDojo();
  const [editing, setEditing] = useState<StockItem | null | "new">(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Faixa");
  const [qty, setQty] = useState("1");
  const [minQty, setMinQty] = useState("2");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const low = stock.filter((s) => s.qty <= s.minQty);
  const value = stock.reduce((n, s) => n + s.qty * s.unitCost, 0);

  function openNew() {
    setEditing("new");
    setName("");
    setCategory("Faixa");
    setQty("1");
    setMinQty("2");
    setCost("");
    setPrice("");
  }

  function openEdit(item: StockItem) {
    setEditing(item);
    setName(item.name);
    setCategory(item.category);
    setQty(String(item.qty));
    setMinQty(String(item.minQty));
    setCost(centsField(item.unitCost));
    setPrice(centsField(item.price));
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Loja da academia</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Estoque</h1>
          <p className="mt-1 text-sm text-muted">Faixa, kimono, luva. Baixo do mínimo fica vermelho.</p>
        </div>
        <Button type="button" onClick={openNew}>
          Novo item
        </Button>
      </div>

      <p className="mt-4 text-sm text-muted">
        {stock.length === 0
          ? "Estoque vazio."
          : `${stock.length} itens · ${brl(value)} em estoque${low.length ? ` · ${low.length} abaixo do mínimo` : ""}`}
      </p>

      <ul className="mt-5 grid gap-2">
        {stock.map((item) => {
          const short = item.qty <= item.minQty;
          return (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {item.category} · venda {brl(item.price)} · custo {brl(item.unitCost)}
                </p>
              </div>
              {short ? <Badge tone="danger">Baixo</Badge> : <Badge>{item.category}</Badge>}
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" onClick={() => void adjustStock(item.id, -1)}>
                  −
                </Button>
                <span className={`min-w-8 text-center tabular text-sm ${short ? "text-danger" : ""}`}>
                  {item.qty}
                </span>
                <Button type="button" variant="ghost" onClick={() => void adjustStock(item.id, 1)}>
                  +
                </Button>
              </div>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" onClick={() => openEdit(item)}>
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(`Excluir ${item.name}?`)) void deleteStock(item.id);
                  }}
                >
                  Excluir
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-bg/70 p-0 md:place-items-center md:p-6">
          <form
            className="w-full max-w-md rounded-t-xl border border-border bg-surface p-5 md:rounded-lg"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              const payload = {
                name: name.trim(),
                category,
                qty: Math.max(0, Number(qty) || 0),
                minQty: Math.max(0, Number(minQty) || 0),
                unitCost: parseBRL(cost),
                price: parseBRL(price),
              };
              const done = () => setEditing(null);
              if (editing === "new") void addStock(payload).then(done);
              else void saveStock({ id: editing.id, ...payload }).then(done);
            }}
          >
            <h2 className="text-lg font-semibold">{editing === "new" ? "Novo item" : "Editar item"}</h2>
            <div className="mt-4 grid gap-3">
              <Field label="Nome">
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field label="Tipo">
                <select
                  className="min-h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantidade">
                  <Input type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} />
                </Field>
                <Field label="Mínimo">
                  <Input type="number" min={0} value={minQty} onChange={(e) => setMinQty(e.target.value)} />
                </Field>
              </div>
              <Field label="Custo unitário">
                <Input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="35,00" inputMode="decimal" />
              </Field>
              <Field label="Preço de venda">
                <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="59,90" inputMode="decimal" />
              </Field>
            </div>
            <div className="mt-5 flex gap-2">
              <Button type="submit">Salvar</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
