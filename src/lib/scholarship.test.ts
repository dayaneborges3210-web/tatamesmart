import { test } from "node:test";
import assert from "node:assert/strict";
import { includeScholarshipInvoice } from "./scholarship.ts";

test("scholarship suspends open and overdue charges but preserves paid history", () => {
  assert.equal(includeScholarshipInvoice("aberta", true), false);
  assert.equal(includeScholarshipInvoice("atrasada", true), false);
  assert.equal(includeScholarshipInvoice("paga", true), true);
  assert.equal(includeScholarshipInvoice("aberta", false), true);
  assert.equal(includeScholarshipInvoice("atrasada", false), true);
});
