import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell } from "@/components/shell";
import { Badge, Button, Field, Input } from "@/components/ui";
import { useDojo } from "@/lib/dojo-store";
import type { StockItem } from "@/lib/dojo-types";
import { brl, formatDatePt, parseBRL, todayISO } from "@/lib/money";
import { printRaw, receiptVenda } from "@/lib/thermal";

export const Route = createFileRoute("/loja")({ component: LojaPage });

const PAY = ["PIX", "Dinheiro", "Cartão"];
const CATS = ["Faixa", "Kimono", "Luva", "Outro"];

function centsField(cents: number) {
  if (!cents) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function LojaPage() {
  return (
    <Shell>
      <LojaBody />
    </Shell>
  );
}

function LojaBody() {
  const { stock, students, sales, sellStock, saveStock, deleteStock, school } = useDojo();
  const today = todayISO();
  const [pick, setPick] = useState<StockItem | null>(null);
  const [edit, setEdit] = useState<StockItem | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Faixa");
  const [editQty, setEditQty] = useState("1");
  const [minQty, setMinQty] = useState("2");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [studentId, setStudentId] = useState("");
  const [qty, setQty] = useState("1");
  const [pay, setPay] = useState("PIX");
  const [busy, setBusy] = useState(false);
  const todaySales = useMemo(() => sales.filter((s) => s.soldOn === today), [sales, today]);
  const todaySum = todaySales.reduce((n, s) => n + s.total, 0);
  const monthSum = sales.filter((s) => s.soldOn.startsWith(today.slice(0, 7))).reduce((n, s) => n + s.total, 0);

  function close() {
    setPick(null);
    setQty("1");
    setStudentId("");
    setPay("PIX");
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Balcão</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Loja</h1>
          <p className="mt-1 text-sm text-muted">Venda faixa, kimono e luva. Baixa o estoque na hora.</p>
        </div>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <article className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted">Vendas de hoje</p>
          <p className="mt-2 truncate text-xl font-semibold tabular">{brl(todaySum)}</p>
          <p className="mt-1 text-xs text-subtle">{todaySales.length} cupom(ns)</p>
        </article>
        <article className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted">No mês</p>
          <p className="mt-2 truncate text-xl font-semibold tabular">{brl(monthSum)}</p>
        </article>
      </section>

      <h2 className="mt-8 text-sm font-semibold">Produtos</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {stock.map((item) => {
          const empty = item.qty <= 0;
          return (
            <li key={item.id} className="flex flex-col rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="mt-1 text-sm text-muted">{item.category}</p>
                </div>
                {empty ? <Badge tone="danger">Esgotado</Badge> : <Badge>{item.qty} un.</Badge>}
              </div>
              <p className="mt-4 tabular text-lg font-semibold">{brl(item.price)}</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  disabled={empty}
                  onClick={() => {
                    setPick(item);
                    setQty("1");
                  }}
                >
                  Vender
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEdit(item);
                    setName(item.name);
                    setCategory(item.category);
                    setEditQty(String(item.qty));
                    setMinQty(String(item.minQty));
                    setCost(centsField(item.unitCost));
                    setPrice(centsField(item.price));
                  }}
                >
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

      <h2 className="mt-10 text-sm font-semibold">Vendas de hoje</h2>
      {todaySales.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nenhuma venda ainda hoje.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {todaySales.map((s) => {
            const aluno = students.find((st) => st.id === s.studentId);
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {s.qty}× {s.itemName}
                  </p>
                  <p className="text-xs text-muted">
                    {aluno?.name ?? "Balcão"} · {s.payMethod} · {formatDatePt(s.soldOn)}
                  </p>
                </div>
                <p className="tabular text-sm">{brl(s.total)}</p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    void printRaw(
                      receiptVenda({
                        school: school || "TatameSmart",
                        item: s.itemName,
                        qty: s.qty,
                        total: brl(s.total),
                        pay: s.payMethod,
                        aluno: aluno?.name ?? "Balcão",
                        soldOn: formatDatePt(s.soldOn),
                      }),
                    ).catch(() => undefined);
                  }}
                >
                  Imprimir
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {pick ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-bg/70 p-0 md:place-items-center md:p-6">
          <form
            className="w-full max-w-md rounded-t-xl border border-border bg-surface p-5 md:rounded-lg"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Math.max(1, Number(qty) || 1);
              if (n > pick.qty) return;
              setBusy(true);
              void sellStock({ itemId: pick.id, studentId, qty: n, payMethod: pay }).then(() => {
                const aluno = students.find((s) => s.id === studentId);
                void printRaw(
                  receiptVenda({
                    school: school || "TatameSmart",
                    item: pick.name,
                    qty: n,
                    total: brl(pick.price * n),
                    pay,
                    aluno: aluno?.name ?? "Balcão",
                    soldOn: formatDatePt(today),
                  }),
                ).catch(() => undefined);
                setBusy(false);
                close();
              });
            }}
          >
            <h2 className="text-lg font-semibold">Vender {pick.name}</h2>
            <p className="mt-1 text-sm text-muted">
              {brl(pick.price)} · {pick.qty} em estoque
            </p>
            <div className="mt-4 grid gap-3">
              <Field label="Aluno">
                <select
                  className="min-h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                >
                  <option value="">Balcão / visitante</option>
                  {students
                    .filter((s) => s.status !== "inativo")
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Quantidade">
                <Input
                  type="number"
                  min={1}
                  max={pick.qty}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </Field>
              <Field label="Pagamento">
                <select
                  className="min-h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg"
                  value={pay}
                  onChange={(e) => setPay(e.target.value)}
                >
                  {PAY.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <p className="tabular text-sm">
                Total {brl(pick.price * Math.max(1, Number(qty) || 1))}
              </p>
            </div>
            <div className="mt-5 flex gap-2">
              <Button type="submit" disabled={busy}>
                Confirmar venda
              </Button>
              <Button type="button" variant="ghost" onClick={close}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      ) : null}
      {edit ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-bg/70 p-0 md:place-items-center md:p-6">
          <form
            className="w-full max-w-md rounded-t-xl border border-border bg-surface p-5 md:rounded-lg"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              void saveStock({
                id: edit.id,
                name: name.trim(),
                category,
                qty: Math.max(0, Number(editQty) || 0),
                minQty: Math.max(0, Number(minQty) || 0),
                unitCost: parseBRL(cost),
                price: parseBRL(price),
              }).then(() => setEdit(null));
            }}
          >
            <h2 className="text-lg font-semibold">Editar {edit.name}</h2>
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
                  <Input type="number" min={0} value={editQty} onChange={(e) => setEditQty(e.target.value)} />
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
              <Button type="button" variant="ghost" onClick={() => setEdit(null)}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
