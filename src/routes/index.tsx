import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Landing } from "@/components/landing";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/ui";
import { authClient, getBearerToken } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { invoiceStatus, phaseFor, phaseLabel } from "@/lib/cobranca";
import { useDojo } from "@/lib/dojo-store";
import { brl, classHours, daysUntil, formatDatePt, todayISO, weekdayPt } from "@/lib/money";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  const [hold, setHold] = useState(() => Boolean(typeof window !== "undefined" && getBearerToken()));

  useEffect(() => {
    if (user) {
      setHold(false);
      return;
    }
    if (!getBearerToken()) {
      setHold(false);
      return;
    }
    setHold(true);
    let n = 0;
    const tick = () => {
      n += 1;
      void authClient.getSession();
      try {
        authClient.$store.notify("$sessionSignal");
      } catch {
        /* older client */
      }
      if (n >= 6) setHold(false);
    };
    tick();
    const t = window.setInterval(tick, 120);
    return () => window.clearInterval(t);
  }, [user]);

  if (isPending || (hold && !user)) {
    return <div className="min-h-dvh bg-bg" />;
  }
  if (!user) return <Landing />;
  return (
    <Shell>
      <Dashboard />
    </Shell>
  );
}

function Dashboard() {
  const { students, classes, invoices, attendance, reminders, school, stock, sales, waReady, waAuto } = useDojo();
  const today = todayISO();
  const day = weekdayPt();
  const active = students.filter((s) => s.status === "ativo").length;
  const todayClasses = classes.filter((c) => c.days.includes(day));
  const present = attendance.filter((a) => a.date === today && a.present).length;

  const billed = invoices.map((inv) => {
    const status = invoiceStatus(inv, today);
    const days = daysUntil(inv.due, today);
    const phase = status === "paga" ? null : phaseFor(days);
    const student = students.find((s) => s.id === inv.studentId);
    const sentToday = reminders.some((r) => r.invoiceId === inv.id && r.date === today);
    return { inv, status, days, phase, student, sentToday };
  });

  const late = billed.filter((b) => b.status === "atrasada");
  const openSum = billed.filter((b) => b.status !== "paga").reduce((n, b) => n + b.inv.amount, 0);
  const paidSum = billed.filter((b) => b.status === "paga").reduce((n, b) => n + b.inv.amount, 0);
  const shopSum = sales.reduce((n, s) => n + s.total, 0);
  const receita = paidSum + shopSum;
  const queue = billed.filter((b) => b.status !== "paga" && b.phase && !b.sentToday);
  const stockLow = stock.filter((s) => s.qty <= s.minQty).length;
  const billedCount = billed.length;
  const latePct = billedCount ? Math.round((late.length / billedCount) * 100) : 0;
  const trials = students.filter((s) => s.status === "trial");
  const birthdays = students.filter((s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.birth)) return false;
    const mmdd = s.birth.slice(5);
    let next = `${today.slice(0, 4)}-${mmdd}`;
    if (next < today) next = `${Number(today.slice(0, 4)) + 1}-${mmdd}`;
    const n = daysUntil(next, today);
    return n >= 0 && n <= 7;
  });
  const ready = students.filter((s) => {
    if (s.status !== "ativo") return false;
    if (s.belt === "Preta" || s.belt === "Coral" || s.belt === "Vermelha") return false;
    return daysUntil(today, s.joined) >= 120;
  });

  return (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Painel</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{school}</h1>
      <p className="mt-1 text-sm text-muted">
        {day}, {formatDatePt(today)} ·{" "}
        {waReady ? "WhatsApp da TatameSmart enviando sozinho" : "cadastre o WhatsApp do aluno"}
      </p>

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi
          label="Receita"
          value={brl(receita)}
          hint={`${brl(paidSum)} alunos · ${brl(shopSum)} loja`}
          wide
        />
        <Kpi label="A receber" value={brl(openSum)} hint={`${billed.filter((b) => b.status !== "paga").length} em aberto`} danger={late.length > 0} />
        <Kpi label="Atrasadas" value={String(late.length)} hint={late.length ? brl(late.reduce((n, b) => n + b.inv.amount, 0)) : "Em dia"} danger={late.length > 0} />
        <Kpi label="Disparos hoje" value={String(queue.length)} hint="Régua D-5 até atraso" />
        <Kpi label="Alunos ativos" value={String(active)} hint={stockLow ? `${stockLow} itens baixos no estoque` : `${present} presentes · ${todayClasses.length} aulas`} danger={stockLow > 0} />
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Inadimplência" value={`${latePct}%`} hint={late.length ? `${late.length} atrasadas` : "Em dia"} danger={latePct >= 20} />
        <Kpi label="Experimentais" value={String(trials.length)} hint={trials.length ? "Converter em aluno" : "Nenhuma aula teste"} />
        <Kpi label="Aniversários (7 dias)" value={String(birthdays.length)} hint={birthdays[0]?.name ?? "Ninguém esta semana"} />
        <Kpi label="Prontos a graduar" value={String(ready.length)} hint={ready.length ? "4 meses ou mais na faixa" : "Ninguém na fila"} />
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4 md:p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Cobrança de hoje</h2>
            <Link to="/mensalidades" className="text-xs text-muted hover:text-fg">
              Abrir cobrança
            </Link>
          </div>
          {queue.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Fila zerada. Nada pendente de WhatsApp hoje.</p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {queue.slice(0, 6).map((row) => (
                <li key={row.inv.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg px-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{row.student?.name}</p>
                    <p className="text-xs text-muted">
                      {row.phase ? phaseLabel(row.phase) : ""} · {formatDatePt(row.inv.due)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-sm whitespace-nowrap">{brl(row.inv.amount)}</p>
                    <Badge tone={row.status === "atrasada" ? "danger" : "warning"}>
                      {row.status === "atrasada" ? "Atrasada" : "Aberta"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 md:p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Turmas de hoje</h2>
            <Link to="/frequencia" className="text-xs text-muted hover:text-fg">
              Fazer chamada
            </Link>
          </div>
          {todayClasses.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nenhuma turma neste dia.</p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {todayClasses.map((c) => {
                const count = students.filter((s) => s.classId === c.id && s.status === "ativo").length;
                return (
                  <li key={c.id} className="flex items-center justify-between rounded-md border border-border bg-bg px-3 py-3">
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted">
                        {classHours(c.time, c.timeEnd)} · {c.instructor}
                      </p>
                    </div>
                    <p className="tabular text-sm text-muted">
                      {count}/{c.capacity}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

function Kpi({
  label,
  value,
  hint,
  danger,
  wide,
}: {
  label: string;
  value: string;
  hint: string;
  danger?: boolean;
  wide?: boolean;
}) {
  return (
    <article className={`rounded-lg border border-border bg-surface p-4 ${wide ? "col-span-2 lg:col-span-1" : ""}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-2 truncate text-xl font-semibold tabular tracking-tight whitespace-nowrap ${danger ? "text-danger" : "text-fg"}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-subtle">{hint}</p>
    </article>
  );
}
