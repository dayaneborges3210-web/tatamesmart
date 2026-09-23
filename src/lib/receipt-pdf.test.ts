import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { receiptPdf } from "./receipt-pdf.ts";

test("receipt generates a valid single-page A4 PDF with accented names", async () => {
  const base64 = await receiptPdf({ school: "Academia São João", student: "João 🥋 da Silva", reference: "Setembro de 2026", amount: "R$ 179,90", due: "22/09/2026", paidAt: "22/09/2026", id: "EXEMPLO-001" });
  const bytes = Buffer.from(base64, "base64");
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 1);
  assert.equal(Math.round(doc.getPage(0).getWidth()), 595);
});
