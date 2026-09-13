import { brl, daysUntil, formatDatePt, monthLabel, waDigits } from "./money";
import type { ChargeTexts, Invoice, Student } from "./dojo-types";

export type ChargePhase = "inicio" | "lembrete" | "vencimento" | "atraso";
export type { ChargeTexts };

export const DEFAULT_CHARGE_TEXTS: ChargeTexts = {
  inicio: `Olá, {aluno}. Aqui é a {escola}.

Sua mensalidade de {competencia}, no valor de {valor}, vence em {vencimento}.

Este é o aviso com 5 dias de antecedência para você se organizar com calma.

PIX: {pix}

Se já pagou, desconsidere esta mensagem.`,
  lembrete: `Olá, {aluno}. Tudo bem?

Passando só para lembrar: a mensalidade de {competencia} ({valor}) vence em {dias}, no dia {vencimento}.

PIX: {pix}

Qualquer dúvida, estamos à disposição.`,
  vencimento: `Olá, {aluno}. Chegou o dia do vencimento.

A mensalidade de {competencia}, no valor de {valor}, vence hoje ({vencimento}).

Se puder regularizar ainda hoje, sua matrícula segue em dia e evitamos atraso.

PIX: {pix}`,
  atraso: `Olá, {aluno}. Identificamos que a mensalidade de {competencia} ({valor}) está atrasada.

O vencimento era {vencimento} ({dias} em atraso).

Pedimos que regularize o quanto antes para manter o acesso às aulas.

PIX: {pix}

Se o pagamento já foi feito, nos avise para baixarmos no sistema.`,
};

export function invoiceStatus(inv: Invoice, today?: string): Invoice["status"] {
  if (inv.status === "paga") return "paga";
  return daysUntil(inv.due, today) < 0 ? "atrasada" : "aberta";
}

export function phaseFor(days: number): ChargePhase | null {
  if (days === 5) return "inicio";
  if (days >= 1 && days <= 4) return "lembrete";
  if (days === 0) return "vencimento";
  if (days < 0) return "atraso";
  return null;
}

export function phaseLabel(phase: ChargePhase) {
  if (phase === "inicio") return "5 dias antes";
  if (phase === "lembrete") return "Vencimento próximo";
  if (phase === "vencimento") return "Vence hoje";
  return "Em atraso";
}

function fillTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{([a-z]+)\}/gi, (_, key: string) => vars[key] ?? `{${key}}`);
}

export function buildMessage(opts: {
  school: string;
  pix: string;
  student: Student;
  invoice: Invoice;
  phase: ChargePhase;
  today?: string;
  templates?: Partial<ChargeTexts>;
}) {
  const first = opts.student.name.split(" ")[0];
  const valor = brl(opts.invoice.amount);
  const venc = formatDatePt(opts.invoice.due);
  const comp = monthLabel(opts.invoice.month);
  const n = daysUntil(opts.invoice.due, opts.today);
  const atraso = Math.abs(Math.min(n, 0));
  const dias =
    opts.phase === "inicio"
      ? "5 dias"
      : opts.phase === "lembrete"
        ? n === 1
          ? "1 dia"
          : `${n} dias`
        : opts.phase === "vencimento"
          ? "hoje"
          : atraso === 1
            ? "1 dia"
            : `${atraso} dias`;
  const template = opts.templates?.[opts.phase]?.trim() || DEFAULT_CHARGE_TEXTS[opts.phase];
  return fillTemplate(template, {
    aluno: first,
    escola: opts.school,
    valor,
    vencimento: venc,
    competencia: comp,
    dias,
    pix: opts.pix,
  });
}

export function waLink(phone: string, text: string) {
  return `https://wa.me/${waDigits(phone)}?text=${encodeURIComponent(text)}`;
}
