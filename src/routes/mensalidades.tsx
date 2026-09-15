import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell } from "@/components/shell";
import { Badge, Button } from "@/components/ui";
import {
  buildMessage,
  invoiceStatus,
  phaseFor,
  phaseLabel,
  waLink,
  type ChargePhase,
} from "@/lib/cobranca";
import { useDojo } from "@/lib/dojo-store";
import { brl, daysUntil, formatDatePt, monthLabel, todayISO } from "@/lib/money";
import { printA4, receiptMensalidade } from "@/lib/thermal";

export const Route = createFileRoute("/mensalidades")({ component: MensalidadesPage });

const CADENCE: { day: string; phase: ChargePhase; copy: string }[] = [
  { day: "D-5", phase: "inicio", copy: "Primeiro aviso. Tempo para se organizar." },
  { day: "D-4 a D-1", phase: "lembrete", copy: "Mensagem amigável: o vencimento está chegando." },
  { day: "D-0", phase: "vencimento", copy: "Aviso: chegou o dia do vencimento." },
  { day: "D+1 em diante", phase: "atraso", copy: "Lembrete diário até a baixa no sistema." },
];

export function MensalidadesPage() {
  return (
    <Shell>
      <CobrancaBody />
    </Shell>
  );
}

function CobrancaBody() {
  const { invoices, students, school, pix, reminders, markPaid, markReminderSent, chargeTexts, waReady, waAuto, dispatchToday } =
    useDojo();
  const today = todayISO();
  const [preview, setPreview] = useState<ChargePhase>("inicio");
  const [sending, setSending] = useState(false);
  const [sendInfo, setSendInfo] = useState("");

  const rows = useMemo(() => {
    return invoices
      .map((inv) => {
        const student = students.find((s) => s.id === inv.studentId);
        const status = invoiceStatus(inv, today);
        const days = daysUntil(inv.due, today);
        const phase = status === "paga" ? null : phaseFor(days);
        const sentToday = reminders.some((r) => r.invoiceId === inv.id && r.date === today);
        return { inv, student, status, days, phase, sentToday };
      })
      .sort((a, b) => a.days - b.days);
  }, [invoices, students, reminders, today]);

  const queue = rows.filter((r) => r.status !== "paga" && r.phase);
  const lateSum = rows.filter((r) => r.status === "atrasada").reduce((n, r) => n + r.inv.amount, 0);
  const openSum = rows.filter((r) => r.status !== "paga").reduce((n, r) => n + r.inv.amount, 0);
  const sample = students.find((s) => s.status === "ativo") ?? students[0];
  const sampleInv = invoices[0];
  const sampleMsg =
    sample && sampleInv
      ? buildMessage({ school, pix, student: sample, invoice: { ...sampleInv, due: sampleInv.due }, phase: preview, templates: chargeTexts })
      : "";

  return (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Cobrança</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Mensalidades</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        {waReady
          ? "WhatsApp da TatameSmart incluso. A fila sai sozinha no número do aluno."
          : "WhatsApp automático incluso no plano. Cadastre o número do aluno."}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={sending || !waReady}
          onClick={() => {
            setSendInfo("");
            setSending(true);
            void dispatchToday()
              .then((r) =>
                setSendInfo(
                  r.failed
                    ? `Enviados ${r.sent}. Falharam ${r.failed}. ${r.errors[0] ?? ""}`
                    : `Enviados ${r.sent} pelo WhatsApp.`,
                ),
              )
              .catch((err: unknown) => setSendInfo(err instanceof Error ? err.message : "Falha no envio."))
              .finally(() => setSending(false));
          }}
        >
          {sending ? "Enviando…" : "Enviar fila agora"}
        </Button>
        {sendInfo ? <p className="text-sm text-muted">{sendInfo}</p> : null}
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Fila de hoje" value={String(queue.filter((q) => !q.sentToday).length)} hint="Ainda não enviados" />
        <Stat label="Em aberto" value={brl(openSum)} hint={`${rows.filter((r) => r.status !== "paga").length} faturas`} />
        <Stat label="Em atraso" value={brl(lateSum)} hint="Após o vencimento" danger={lateSum > 0} />
        <Stat label="Enviados hoje" value={String(reminders.filter((r) => r.date === today).length)} hint="WhatsApp disparado" />
      </section>

      <section className="mt-6 rounded-lg border border-border bg-surface p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Régua de cobrança</h2>
          <Link to="/configuracoes" className="text-xs text-muted hover:text-fg">
            Editar frases
          </Link>
        </div>
        <ol className="mt-4 grid gap-3 md:grid-cols-4">
          {CADENCE.map((step) => (
            <li key={step.day} className="rounded-md border border-border bg-bg px-3 py-3">
              <p className="font-mono text-xs text-muted">{step.day}</p>
              <p className="mt-1 text-sm font-medium">{phaseLabel(step.phase)}</p>
              <p className="mt-1 text-xs text-muted">{step.copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Fila de hoje</h2>
        {queue.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nada para disparar neste dia.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {queue.map((row) => {
              if (!row.student || !row.phase) return null;
              const student = row.student;
              const text = buildMessage({
                school,
                pix,
                student,
                invoice: row.inv,
                phase: row.phase,
                templates: chargeTexts,
              });
              return (
                <li
                  key={row.inv.id}
                  className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{student.name}</p>
                    <p className="text-xs text-muted">
                      {student.phone} · {phaseLabel(row.phase)} · vence {formatDatePt(row.inv.due)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.sentToday ? <Badge tone="success">Enviado hoje</Badge> : null}
                    <a
                      href={waLink(student.phone, text)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center rounded-sm bg-accent px-4 text-sm font-medium text-accent-fg"
                      onClick={() => markReminderSent(row.inv.id, row.phase!)}
                    >
                      Enviar WhatsApp
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        void markPaid(row.inv.id);
                        printA4(
                          receiptMensalidade({
                            school,
                            aluno: student.name,
                            month: monthLabel(row.inv.month),
                            amount: brl(row.inv.amount),
                            due: formatDatePt(row.inv.due),
                            paidAt: formatDatePt(today),
                          }),
                        );
                      }}
                    >
                      Baixar e imprimir
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8 overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-surface text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Aluno</th>
              <th className="px-4 py-3 font-medium">Vencimento</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Régua</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const tone =
                row.status === "paga" ? "success" : row.status === "atrasada" ? "danger" : "warning";
              return (
                <tr key={row.inv.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.student?.name ?? "—"}</p>
                    <p className="text-xs text-muted">{row.student?.phone}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular">{formatDatePt(row.inv.due)}</td>
                  <td className="px-4 py-3 whitespace-nowrap tabular">{brl(row.inv.amount)}</td>
                  <td className="px-4 py-3 text-muted">{row.phase ? phaseLabel(row.phase) : "Fora da régua"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={tone}>{row.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.status !== "paga" && row.student && row.phase ? (
                      <a
                        href={waLink(
                          row.student.phone,
                          buildMessage({
                            school,
                            pix,
                            student: row.student,
                            invoice: row.inv,
                            phase: row.phase,
                            templates: chargeTexts,
                          }),
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted hover:text-fg"
                        onClick={() => markReminderSent(row.inv.id, row.phase!)}
                      >
                        WhatsApp
                      </a>
                    ) : (
                      <span className="text-xs text-subtle">{monthLabel(row.inv.month)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="mt-8 rounded-lg border border-border bg-surface p-4 md:p-5">
        <h2 className="text-sm font-semibold">Modelo da mensagem</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["inicio", "lembrete", "vencimento", "atraso"] as ChargePhase[]).map((p) => (
            <Button key={p} type="button" variant={preview === p ? "primary" : "ghost"} onClick={() => setPreview(p)}>
              {phaseLabel(p)}
            </Button>
          ))}
        </div>
        <pre className="mt-4 whitespace-pre-wrap rounded-md border border-border bg-bg p-4 font-sans text-sm leading-relaxed text-fg">
          {sampleMsg}
        </pre>
        <p className="mt-3 text-xs text-subtle">PIX cadastrado da escola: {pix}</p>
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
    <article className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-2 truncate text-xl font-semibold tabular tracking-tight whitespace-nowrap ${danger ? "text-danger" : "text-fg"}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-subtle">{hint}</p>
    </article>
  );
}
