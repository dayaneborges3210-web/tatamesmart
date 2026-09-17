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

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function RelatoriosBody() {
  const { students, invoices, payables, staff, stock, sales } = useDojo();
  const today = todayISO();
  const month = today.slice(0, 7);
  const billed = invoices.map((inv) => ({ ...inv, status: invoiceStatus(inv, today) }));
  const monthBilled = billed.filter((i) => i.month === month || i.due.startsWith(month));
  const receivedMonth = monthBilled.filter((i) => i.status === "paga").reduce((n, i) => n + i.amount, 0);
  const receivedAll = billed.filter((i) => i.status === "paga").reduce((n, i) => n + i.amount, 0);
  const open = billed.filter((i) => i.status !== "paga").reduce((n, i) => n + i.amount, 0);
  const late = billed.filter((i) => i.status === "atrasada");
  const shopMonth = sales.filter((s) => s.soldOn.startsWith(month)).reduce((n, s) => n + s.total, 0);
  const monthPayables = payables.filter((p) => p.due.startsWith(month));
  const paidBills = monthPayables.filter((p) => p.status === "paga");
  const openBills = payables.filter((p) => p.status !== "paga");
  const paidOut = paidBills.reduce((n, p) => n + p.amount, 0);
  const billsOpen = openBills.reduce((n, p) => n + p.amount, 0);
  const payroll = staff.reduce((n, s) => n + s.pay, 0);
  const professorBills = payables
    .filter((p) => p.category.toLowerCase().includes("professor"))
    .reduce((n, p) => n + p.amount, 0);
  const folhaFalta = Math.max(0, payroll - professorBills);
  const income = receivedMonth + shopMonth;
  const lucro = income - paidOut;
  const lucroSePagar = lucro - billsOpen - folhaFalta;
  const stockValue = stock.reduce((n, s) => n + s.qty * s.unitCost, 0);
  const stockLow = stock.filter((s) => s.qty <= s.minQty);
  const active = students.filter((s) => s.status === "ativo").length;

  const byCategory = new Map<string, number>();
  for (const p of paidBills) {
    byCategory.set(p.category, (byCategory.get(p.category) ?? 0) + p.amount);
  }

  return (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Financeiro</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Relatórios</h1>
      <p className="mt-1 text-sm text-muted">
        O lucro do mês: o que os alunos e a loja trouxeram, menos o que a academia já pagou.
      </p>

      <section className="mt-6 rounded-lg border border-border bg-surface p-5 md:p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Lucro de {monthLabel(month)}</p>
        <p className={`mt-2 text-3xl font-semibold tabular sm:text-4xl ${lucro < 0 ? "text-danger" : "text-success"}`}>
          {brl(lucro)}
        </p>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          {lucro >= 0
            ? "Sobrou depois de receber dos alunos e da loja e pagar as contas deste mês."
            : "Neste mês as contas pagas passaram do que entrou. O vermelho é prejuízo."}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Entrou" value={brl(income)} hint={`Alunos ${brl(receivedMonth)} · loja ${brl(shopMonth)}`} />
          <Stat label="Saiu" value={brl(paidOut)} hint={paidBills.length ? `${paidBills.length} contas pagas` : "Nenhuma conta paga ainda"} />
          <Stat
            label="Ainda a pagar"
            value={brl(billsOpen + folhaFalta)}
            hint={folhaFalta ? `Contas ${brl(billsOpen)} · folha ${brl(folhaFalta)}` : `${openBills.length} contas em aberto`}
            danger={billsOpen + folhaFalta > 0}
          />
        </div>

        <p className="mt-5 text-sm text-muted">
          Se pagar o que falta neste mês, o lucro fica{" "}
          <span className={`tabular font-medium ${lucroSePagar < 0 ? "text-danger" : "text-fg"}`}>{brl(lucroSePagar)}</span>.
        </p>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4 md:p-5">
          <h2 className="text-sm font-semibold">De onde veio</h2>
          <ul className="mt-4 grid gap-3 text-sm">
            <Line label="Mensalidades recebidas" value={brl(receivedMonth)} />
            <Line label="Loja" value={brl(shopMonth)} />
            <Line label="Total que entrou" value={brl(income)} strong />
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 md:p-5">
          <h2 className="text-sm font-semibold">Para onde foi</h2>
          {paidBills.length === 0 && !folhaFalta ? (
            <p className="mt-4 text-sm text-muted">Nenhuma conta marcada como paga neste mês.</p>
          ) : (
            <ul className="mt-4 grid gap-3 text-sm">
              {[...byCategory.entries()].map(([cat, amount]) => (
                <Line key={cat} label={cat} value={brl(amount)} />
              ))}
              <Line label="Total que saiu" value={brl(paidOut)} strong />
            </ul>
          )}
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Recebido no mês" value={brl(receivedMonth)} hint={`${monthBilled.filter((i) => i.status === "paga").length} mensalidades`} />
        <Card label="A receber" value={brl(open)} hint={`${billed.filter((i) => i.status !== "paga").length} em aberto`} danger={late.length > 0} />
        <Card label="A pagar" value={brl(billsOpen)} hint={payroll ? `Folha ${brl(payroll)}` : "Contas em aberto"} danger={billsOpen > 0} />
        <Card
          label="Estoque"
          value={brl(stockValue)}
          hint={shopMonth ? `Loja ${brl(shopMonth)} no mês` : stockLow.length ? `${stockLow.length} abaixo do mínimo` : `${active} alunos ativos`}
          danger={stockLow.length > 0}
        />
      </section>
      <p className="mt-2 text-xs text-subtle">Recebido no acumulado: {brl(receivedAll)}</p>

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
            <p className="mt-4 tabular text-sm">Total atrasado {brl(late.reduce((n, i) => n + i.amount, 0))}</p>
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

function Stat({
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
    <div className="rounded-md border border-border bg-bg px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular ${danger ? "text-danger" : ""}`}>{value}</p>
      <p className="mt-1 text-xs text-subtle">{hint}</p>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <li className={`flex items-center justify-between gap-3 ${strong ? "border-t border-border pt-3 font-medium" : ""}`}>
      <span className={strong ? "" : "text-muted"}>{label}</span>
      <span className="tabular whitespace-nowrap">{value}</span>
    </li>
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
      <p className={`mt-2 text-xl font-semibold tabular ${danger ? "text-danger" : ""}`}>{value}</p>
      <p className="mt-1 text-xs text-subtle">{hint}</p>
    </article>
  );
}
