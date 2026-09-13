const KEY = "tatamesmart.printerAgent";
const DEFAULT_AGENT = "http://127.0.0.1:17891";

export function printerAgentUrl() {
  try {
    return (localStorage.getItem(KEY) || DEFAULT_AGENT).replace(/\/$/, "");
  } catch {
    return DEFAULT_AGENT;
  }
}

export function setPrinterAgentUrl(url: string) {
  localStorage.setItem(KEY, url.trim().replace(/\/$/, "") || DEFAULT_AGENT);
}

function pad(line: string, width = 48) {
  const t = line.length > width ? line.slice(0, width) : line;
  return t;
}

function dash(width = 48) {
  return "-".repeat(width);
}

export function receiptMensalidade(opts: {
  school: string;
  aluno: string;
  month: string;
  amount: string;
  due: string;
  paidAt: string;
}) {
  return [
    opts.school.toUpperCase(),
    "TatameSmart",
    dash(),
    "RECIBO DE MENSALIDADE",
    dash(),
    `Aluno: ${opts.aluno}`,
    `Competencia: ${opts.month}`,
    `Vencimento: ${opts.due}`,
    `Valor: ${opts.amount}`,
    `Pago em: ${opts.paidAt}`,
    dash(),
    "Pagamento recebido.",
    "Obrigado. Oss.",
  ].map((l) => pad(l));
}

export function receiptVenda(opts: {
  school: string;
  item: string;
  qty: number;
  total: string;
  pay: string;
  aluno: string;
  soldOn: string;
}) {
  return [
    opts.school.toUpperCase(),
    "TatameSmart",
    dash(),
    "CUPOM DE VENDA",
    dash(),
    `Item: ${opts.item}`,
    `Qtd: ${opts.qty}`,
    `Aluno: ${opts.aluno}`,
    `Pagamento: ${opts.pay}`,
    `Total: ${opts.total}`,
    `Data: ${opts.soldOn}`,
    dash(),
    "Obrigado. Oss.",
  ].map((l) => pad(l));
}

export async function printRaw(lines: string[]) {
  const url = printerAgentUrl();
  const res = await fetch(`${url}/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines, cut: true }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Agente recusou a impressão (${res.status}).`);
  }
}

export async function pingPrinter() {
  const url = printerAgentUrl();
  const res = await fetch(`${url}/health`);
  if (!res.ok) throw new Error("Agente offline.");
  return (await res.json()) as { ok: boolean; printer?: string };
}
