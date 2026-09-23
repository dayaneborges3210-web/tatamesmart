import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function receiptPdf(data: { school: string; student: string; reference: string; amount: string; due: string; paidAt: string; id: string }) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.08, 0.1, 0.14), muted = rgb(0.38, 0.42, 0.48);
  const clean = (value: string) => Array.from(value).map((char) => { try { regular.encodeText(char); return char; } catch { return "?"; } }).join("");
  const text = (value: string, x: number, y: number, size = 12, strong = false, color = ink) => {
    const font = strong ? bold : regular;
    const safe = clean(value);
    let fitted = size;
    while (font.widthOfTextAtSize(safe, fitted) > 490 && fitted > 7) fitted -= 0.5;
    page.drawText(safe, { x, y, size: fitted, font, color });
  };
  page.drawRectangle({ x: 0, y: 720, width: 596, height: 122, color: ink });
  text("TATAMESMART", 48, 790, 12, true, rgb(0.8, 0.83, 0.87));
  text("RECIBO DE QUITAÇÃO", 48, 749, 25, true, rgb(1, 1, 1));
  text(data.school, 48, 676, 20, true);
  text("MENSALIDADE QUITADA", 48, 637, 10, true, rgb(0.1, 0.45, 0.28));
  const fields = [["ALUNO", data.student], ["COMPETÊNCIA", data.reference], ["VENCIMENTO", data.due], ["PAGAMENTO REGISTRADO EM", data.paidAt]];
  fields.forEach(([label, value], i) => { const y = 585 - i * 63; text(label, 48, y, 9, true, muted); text(value, 48, y - 22, 14); });
  page.drawRectangle({ x: 48, y: 270, width: 499, height: 79, color: rgb(0.94, 0.96, 0.95) });
  text("VALOR RECEBIDO", 65, 327, 9, true, muted);
  text(data.amount, 65, 292, 27, true);
  text("Confirmamos a quitação da mensalidade acima identificada.", 48, 226, 11);
  text("Este recibo se refere exclusivamente à mensalidade indicada.", 48, 207, 10, false, muted);
  text(`Identificador: ${data.id}`, 48, 114, 8, false, muted);
  text("Emitido pela academia através do TatameSmart", 48, 88, 9, false, muted);
  return pdf.saveAsBase64();
}
