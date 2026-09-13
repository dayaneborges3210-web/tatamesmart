import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell } from "@/components/shell";
import { Badge, Button, Field, Input } from "@/components/ui";
import { useDojo } from "@/lib/dojo-store";
import { brl, daysUntil, formatDatePt, parseBRL, todayISO } from "@/lib/money";

export const Route = createFileRoute("/contas")({ component: ContasPage });

const CATEGORIES = ["Aluguel", "Energia", "Professor", "Material", "Imposto", "Outro"];

export function ContasPage() {
  return (
    <Shell>
      <ContasBody />
    </Shell>
  );
}

function ContasBody() {
  const { payables, addPayable, settlePayable } = useDojo();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState("Aluguel");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState(todayISO());

  const today = todayISO();
  const openBills = useMemo(() => payables.filter((p) => p.status !== "paga"), [payables]);
  const lateSum = openBills.filter((p) => p.status === "atrasada").reduce((n, p) => n + p.amount, 0);
  const openSum = openBills.reduce((n, p) => n + p.amount, 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Financeiro</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Contas a pagar</h1>
          <p className="mt-1 text-sm text-muted">Aluguel, energia, professores e o que a academia deve.</p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          Nova conta
        </Button>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <article className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted">Em aberto</p>
          <p className="mt-2 truncate text-xl font-semibold tabular">{brl(openSum)}</p>
        </article>
        <article className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted">Atrasadas</p>
          <p className={`mt-2 truncate text-xl font-semibold tabular ${lateSum ? "text-danger" : ""}`}>
            {brl(lateSum)}
          </p>
        </article>
        <article className="rounded-lg border border-border bg-surface p-4 col-span-2 lg:col-span-1">
          <p className="text-xs text-muted">Pagas</p>
          <p className="mt-2 truncate text-xl font-semibold tabular">
            {payables.filter((p) => p.status === "paga").length}
          </p>
        </article>
      </section>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-surface text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Conta</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Vencimento</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {payables.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-muted">{p.vendor || "—"}</p>
                </td>
                <td className="px-4 py-3 text-muted">{p.category}</td>
                <td className="px-4 py-3 tabular text-muted">
                  {formatDatePt(p.due)}
                  {p.status !== "paga" && daysUntil(p.due, today) < 0 ? (
                    <span className="ml-2 text-danger">atraso</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 tabular">{brl(p.amount)}</td>
                <td className="px-4 py-3">
                  <Badge tone={p.status === "paga" ? "success" : p.status === "atrasada" ? "danger" : "warning"}>
                    {p.status === "paga" ? "Paga" : p.status === "atrasada" ? "Atrasada" : "Aberta"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {p.status !== "paga" ? (
                    <Button type="button" variant="ghost" onClick={() => void settlePayable(p.id)}>
                      Baixar
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {payables.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Nenhuma conta lançada.</p>
        ) : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-bg/70 p-0 md:place-items-center md:p-6">
          <form
            className="w-full max-w-md rounded-t-xl border border-border bg-surface p-5 md:rounded-lg"
            onSubmit={(e) => {
              e.preventDefault();
              const cents = parseBRL(amount);
              if (!title.trim() || cents <= 0) return;
              void addPayable({
                title: title.trim(),
                vendor: vendor.trim(),
                category,
                amount: cents,
                due,
              }).then(() => {
                setTitle("");
                setVendor("");
                setAmount("");
                setOpen(false);
              });
            }}
          >
            <h2 className="text-lg font-semibold">Nova conta</h2>
            <div className="mt-4 grid gap-3">
              <Field label="Descrição">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </Field>
              <Field label="Fornecedor">
                <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
              </Field>
              <Field label="Categoria">
                <select
                  className="min-h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Valor (R$)">
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="350,00" required />
              </Field>
              <Field label="Vencimento">
                <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} required />
              </Field>
            </div>
            <div className="mt-5 flex gap-2">
              <Button type="submit">Salvar</Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
