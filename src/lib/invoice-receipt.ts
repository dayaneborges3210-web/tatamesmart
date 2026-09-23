import { createServerFn } from "@tanstack/react-start";
import { academyMiddleware, academyWriteMiddleware } from "./academy-actor";
import { getSql } from "./db";
import { brl, formatDatePt, monthLabel } from "./money";

async function receiptData(ownerId: string, branchId: string, invoiceId: string) {
  const sql = await getSql();
  const rows = await sql<{ id: string; status: string; name: string; phone: string; school: string; branch_id: string; month: string; amount: number; due: Date | string; paid_at: Date | string | null }>`
    select i.id, i.status, s.name, s.phone, coalesce(b.name, a.name) as school, coalesce(nullif(i.branch_id, ''), s.branch_id) as branch_id, i.month, i.amount, i.due, i.paid_at
    from invoices i join students s on s.id = i.student_id and s.user_id = i.user_id
    join schools a on a.user_id = i.user_id
    left join branches b on b.id = coalesce(nullif(i.branch_id, ''), s.branch_id) and b.user_id = i.user_id
    where i.id = ${invoiceId} and i.user_id = ${ownerId}
  `;
  const row = rows[0];
  if (!row || (branchId && row.branch_id !== branchId)) throw new Error("Mensalidade não encontrada nesta unidade.");
  if (row.status !== "paga") throw new Error("Confirme a baixa antes de emitir o recibo.");
  const { receiptPdf } = await import("./receipt-pdf");
  const pdf = await receiptPdf({ school: row.school, student: row.name, reference: monthLabel(row.month), amount: brl(Number(row.amount)), due: formatDatePt(new Date(row.due).toISOString().slice(0, 10)), paidAt: row.paid_at ? new Date(row.paid_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Data não registrada (baixa anterior)", id: row.id });
  return { row, pdf, fileName: `recibo-${row.id.replace(/[^a-zA-Z0-9-]/g, "-")}.pdf` };
}
export const invoiceReceiptFn = createServerFn({ method: "GET" }).middleware([academyMiddleware])
  .validator((data: { invoiceId: string }) => data)
  .handler(async ({ context, data }) => {
    const receipt = await receiptData(context.userId, context.lockedBranchId, data.invoiceId);
    return { pdf: receipt.pdf, fileName: receipt.fileName };
  });
export const sendInvoiceReceiptFn = createServerFn({ method: "POST" }).middleware([academyWriteMiddleware])
  .validator((data: { invoiceId: string }) => data)
  .handler(async ({ context, data }) => {
    const receipt = await receiptData(context.userId, context.lockedBranchId, data.invoiceId);
    const { ensureBranchWa } = await import("./platform-wa.server");
    const { sendWhatsAppDocument } = await import("./whatsapp");
    if (!receipt.row.branch_id) throw new Error("Defina a unidade do aluno antes de enviar.");
    const credentials = await ensureBranchWa(context.userId, receipt.row.branch_id);
    await sendWhatsAppDocument({ ...credentials, to: receipt.row.phone, media: receipt.pdf, fileName: receipt.fileName });
    return { accepted: true };
  });
