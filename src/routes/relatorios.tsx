import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { invoiceStatus } from "@/lib/cobranca";
import { useDojo } from "@/lib/dojo-store";
import { brl, todayISO } from "@/lib/money";

export const Route = createFileRoute("/relatorios")({ component: RelatoriosPage });

export function RelatoriosPage() {
  return (
    <Shell>
      <RelatoriosBody />
    </Shell>
  );
}

function RelatoriosBody() {
  const { students, invoices, payables, staff, stock, sales } = useDojo();
  const today = todayISO();
  const month = today.slice(0, 7);
  const billed = invoices.map((inv) => ({ ...inv, status: invoiceStatus(inv, today) }));
  const received = billed.filter((i) => i.status === "paga").reduce((n, i) => n + i.amount, 0);
  const open = billed.filter((i) => i.status !== "paga").reduce((n, i) => n + i.amount, 0);
  const late = billed.filter((i) => i.status === "atrasada");
  const billsOpen = payables.filter((p) => p.status !== "paga").reduce((n, p) => n + p.amount, 0);
  const payroll = staff.reduce((n, s) => n + s.pay, 0);
  const stockValue = stock.reduce((n, s) => n + s.qty * s.unitCost, 0);
  const stockLow = stock.filter((s) => s.qty <= s.minQty);
  const active = students.filter((s) => s.status === "ativo").length;
  const thisMonth = billed.filter((i) => i.month === month);
  const shopMonth = sales.filter((s) => s.soldOn.startsWith(month)).reduce((n, s) => n + s.total, 0);

  return (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Financeiro</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Relatórios</h1>
      <p className="mt-1 text-sm text-muted">O que entra, o que sai e o que está parado no estoque.</p>

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Recebido" value={brl(received)} hint={`${thisMonth.filter((i) => i.status === "paga").length} mensalidades pagas`} />
        <Card label="A receber" value={brl(open)} hint={`${billed.filter((i) => i.status !== "paga").length} em aberto`} danger={late.length > 0} />
        <Card label="A pagar" value={brl(billsOpen)} hint={`Folha ${brl(payroll)}`} danger={billsOpen > 0} />
        <Card label="Estoque" value={brl(stockValue)} hint={shopMonth ? `Loja ${brl(shopMonth)} no mês` : stockLow.length ? `${stockLow.length} abaixo do mínimo` : `${active} alunos ativos`} danger={stockLow.length > 0} />
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4 md:p-5">
          <h2 className="text-sm font-semibold">Inadimplência</h2>
          {late.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nenhuma mensalidade atrasada.</p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {late.map((inv) => {
                const student = students.find((s) => s.id === inv.studentId);
                return (
                  <li key={inv.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>{student?.name ?? "Aluno"}</span>
                    <span className="tabular text-danger">{brl(inv.amount)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {late.length > 0 ? (
            <p className="mt-4 tabular text-sm">
              Total atrasado {brl(late.reduce((n, i) => n + i.amount, 0))}
            </p>
          ) : null}
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 md:p-5">
          <h2 className="text-sm font-semibold">Estoque baixo</h2>
          {stockLow.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nada abaixo do mínimo.</p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {stockLow.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{s.name}</span>
                  <span className="tabular text-danger">
                    {s.qty} / min {s.minQty}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

function Card({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: string;
  hint: string;
  danger?: boolean;
}) {
  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-2 truncate text-xl font-semibold tabular ${danger ? "text-danger" : ""}`}>{value}</p>
      <p className="mt-1 text-xs text-subtle">{hint}</p>
    </article>
  );
}
