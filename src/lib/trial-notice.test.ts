import { test } from "node:test";
import assert from "node:assert/strict";
import { trialNotice } from "./trial-notice.ts";

test("seven calendar days in Brasilia, then overdue", () => {
  for (let day = 1; day <= 8; day++) {
    const notice = trialNotice("2026-09-22T15:00:00Z", new Date(`2026-09-${21 + day}T15:00:00Z`))!;
    assert.equal(notice.day, day);
    assert.equal(notice.remaining, Math.max(0, 7 - day));
    assert.equal(notice.due, day >= 7);
    if (day === 7) assert.match(notice.message, /Hoje é o dia/);
    if (day === 8) assert.match(notice.message, /terminou/);
  }
});
test("changes at Brasilia midnight, not UTC midnight", () => {
  const start = "2026-09-22T15:00:00Z";
  assert.equal(trialNotice(start, new Date("2026-09-23T02:59:00Z"))?.day, 1);
  assert.equal(trialNotice(start, new Date("2026-09-23T03:00:00Z"))?.day, 2);
  assert.equal(trialNotice("invalid"), null);
});
