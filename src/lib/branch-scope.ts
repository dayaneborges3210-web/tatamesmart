import type { Branch, DojoSnapshot } from "@/lib/dojo-types";

export function matrizOf(branches: Branch[]) {
  return branches.find((b) => b.kind === "matriz" && b.active) || branches.find((b) => b.active) || branches[0];
}

export function activeBranches(branches: Branch[]) {
  return branches.filter((b) => b.active);
}

export function scopeSnapshot(snap: DojoSnapshot, branchId: string): DojoSnapshot {
  if (!branchId) return snap;
  const unit = snap.branches.find((b) => b.id === branchId);
  const students = snap.students.filter((s) => s.branchId === branchId);
  const ids = new Set(students.map((s) => s.id));
  const classes = snap.classes.filter((c) => c.branchId === branchId);
  const classIds = new Set(classes.map((c) => c.id));
  const staff = snap.staff.filter((s) => s.branchId === branchId);
  const stock = snap.stock.filter((s) => s.branchId === branchId);
  return {
    ...snap,
    pix: unit?.pix || snap.pix,
    students,
    classes,
    plans: snap.plans.filter((p) => p.branchId === branchId),
    invoices: snap.invoices.filter((i) => i.branchId === branchId || (!i.branchId && ids.has(i.studentId))),
    attendance: snap.attendance.filter((a) => ids.has(a.studentId) || classIds.has(a.classId)),
    payables: snap.payables.filter((p) => p.branchId === branchId),
    agenda: snap.agenda.filter((a) => a.branchId === branchId),
    staff,
    stock,
    sales: snap.sales.filter((s) => s.branchId === branchId || ids.has(s.studentId)),
    championships: snap.championships.filter((c) => c.branchId === branchId),
  };
}
