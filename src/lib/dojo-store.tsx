import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  addAgendaFn,
  addChampionshipFn,
  addClassFn,
  addPayableFn,
  addStaffFn,
  addStockFn,
  addStudentFn,
  addPlanFn,
  addBranchFn,
  saveBranchFn,
  saveStudentFn,
  deleteStudentFn,
  savePlanFn,
  deletePlanFn,
  saveStaffFn,
  deleteStaffFn,
  deleteClassFn,
  adjustStockFn,
  deleteStockFn,
  dispatchTodayFn,
  loadDojo,
  markAlarmFn,
  markPaidFn,
  markReminderFn,
  saveChampionshipFn,
  saveClassFn,
  saveSchoolFn,
  saveStockFn,
  sellStockFn,
  settlePayableFn,
  testWhatsAppFn,
  waQrFn,
  waStateFn,
  toggleAgendaFn,
  toggleAttendanceFn,
} from "@/lib/dojo-api";
import { alarmDue, enableNotifications, fireNotification, formatAlarm, ownerWaLink } from "@/lib/alarms";
import { DEFAULT_CHARGE_TEXTS } from "@/lib/cobranca";
import { loadFontFace } from "@/lib/fonts";
import { matrizOf, scopeSnapshot } from "@/lib/branch-scope";
import type { DojoSnapshot, Modality, ReminderSend, Student } from "@/lib/dojo-types";

export type { Belt, ClassGroup, Invoice, Modality, Student } from "@/lib/dojo-types";

const EMPTY: DojoSnapshot = {
  school: "",
  pix: "",
  theme: "aco",
  logo: "",
  font: "plex",
  typeScale: 100,
  ownerPhone: "",
  chargeTexts: { ...DEFAULT_CHARGE_TEXTS },
  waReady: false,
  waAuto: false,
  waPhoneId: "",
  waUrl: "",
  waOwner: false,
  blocked: false,
  role: "owner",
  lockedBranchId: "",
  branches: [],
  students: [],
  classes: [],
  invoices: [],
  attendance: [],
  reminders: [],
  payables: [],
  agenda: [],
  staff: [],
  stock: [],
  sales: [],
  championships: [],
  plans: [],
};

type Store = DojoSnapshot & {
  loading: boolean;
  branchId: string;
  setBranch: (id: string) => void;
  addBranch: (d: { name: string; address?: string; phone?: string; pix?: string }) => Promise<void>;
  saveBranch: (d: { id: string; name: string; address?: string; phone?: string; pix?: string; active?: boolean }) => Promise<void>;
  addStudent: (s: Omit<Student, "id" | "joined">) => Promise<void>;
  saveStudent: (d: {
    id: string;
    name?: string;
    phone?: string;
    classId?: string;
    modality?: string;
    belt?: string;
    degree?: number;
    cpf?: string;
    address?: string;
    cep?: string;
    hasHealth?: boolean;
    healthNote?: string;
    birth?: string;
    docs?: string[];
    planId?: string;
    dueDay?: number;
    status?: Student["status"];
    branchId?: string;
  }) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  addPlan: (d: { name: string; durationMonths: number; billing: "mensal" | "unico"; amount: number; weeklyLimit: number; dueDay: number; branchId?: string }) => Promise<void>;
  savePlan: (d: { id: string; name: string; durationMonths: number; billing: "mensal" | "unico"; amount: number; weeklyLimit: number; dueDay: number }) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
  toggleAttendance: (studentId: string, classId: string, date: string, present: boolean) => Promise<void>;
  markPaid: (invoiceId: string) => Promise<void>;
  markReminderSent: (invoiceId: string, phase: ReminderSend["phase"]) => Promise<void>;
  addPayable: (d: { title: string; vendor: string; category: string; amount: number; due: string; branchId?: string }) => Promise<void>;
  settlePayable: (id: string) => Promise<void>;
  addAgenda: (d: { title: string; note: string; due: string; alarmAt: string; branchId?: string }) => Promise<void>;
  toggleAgenda: (id: string) => Promise<void>;
  markAlarm: (id: string) => Promise<void>;
  saveSchool: (d: {
    name: string;
    theme: string;
    logo: string;
    font: string;
    typeScale: number;
    ownerPhone: string;
    chargeTexts?: {
      inicio: string;
      lembrete: string;
      vencimento: string;
      atraso: string;
    };
    waPhoneId?: string;
    waToken?: string;
    waAuto?: boolean;
    waUrl?: string;
  }) => Promise<void>;
  dispatchToday: () => Promise<{ sent: number; failed: number; errors: string[] }>;
  testWhatsApp: () => Promise<void>;
  waState: () => Promise<"open" | "connecting" | "close">;
  waQr: () => Promise<{ qr: string; state: string }>;
  addStaff: (d: { name: string; role: string; phone: string; pay: number; branchId?: string; email?: string; password?: string }) => Promise<void>;
  saveStaff: (d: { id: string; name: string; role: string; phone: string; pay: number; email?: string; password?: string }) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  addStock: (d: { name: string; category: string; qty: number; minQty: number; unitCost: number; price: number; branchId?: string }) => Promise<void>;
  saveStock: (d: { id: string; name: string; category: string; qty: number; minQty: number; unitCost: number; price: number }) => Promise<void>;
  deleteStock: (id: string) => Promise<void>;
  adjustStock: (id: string, delta: number) => Promise<void>;
  sellStock: (d: { itemId: string; studentId: string; qty: number; payMethod: string }) => Promise<void>;
  addClass: (d: { name: string; modality: string; days: string[]; time: string; timeEnd: string; instructor: string; capacity: number; branchId?: string }) => Promise<void>;
  saveClass: (d: { id: string; name: string; modality: string; days: string[]; time: string; timeEnd: string; instructor: string; capacity: number }) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  addChampionship: (d: {
    name: string;
    place: string;
    modality: string;
    date: string;
    time: string;
    participants: string[];
    gold: number;
    silver: number;
    bronze: number;
    trophies: number;
  }) => Promise<void>;
  saveChampionship: (d: {
    id: string;
    name: string;
    place: string;
    modality: string;
    date: string;
    time: string;
    participants: string[];
    gold: number;
    silver: number;
    bronze: number;
    trophies: number;
  }) => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

function asSnap(next: unknown): DojoSnapshot | null {
  if (!next || typeof next !== "object") return null;
  const n = next as Partial<DojoSnapshot>;
  if (typeof n.school !== "string" && typeof n.theme !== "string") return null;
  return {
    ...EMPTY,
    ...n,
    theme: n.theme || "aco",
    font: n.font || "plex",
    typeScale: n.typeScale || 100,
    chargeTexts: n.chargeTexts ?? EMPTY.chargeTexts,
    students: n.students ?? [],
    classes: n.classes ?? [],
    invoices: n.invoices ?? [],
    attendance: n.attendance ?? [],
    reminders: n.reminders ?? [],
    payables: n.payables ?? [],
    agenda: n.agenda ?? [],
    staff: n.staff ?? [],
    stock: n.stock ?? [],
    sales: n.sales ?? [],
    championships: n.championships ?? [],
    plans: n.plans ?? [],
    branches: n.branches ?? [],
  };
}

export function DojoProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DojoSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState("");

  const apply = (next: unknown) => {
    const snap = asSnap(next);
    if (snap) setData(snap);
  };

  const refresh = useCallback(async () => {
    apply(await loadDojo());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh().catch(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (data.lockedBranchId) {
      setBranchId(data.lockedBranchId);
      return;
    }
    try {
      const saved = window.sessionStorage.getItem("ts-branch") || "";
      if (saved && data.branches.some((b) => b.id === saved && b.active)) setBranchId(saved);
    } catch {
      /* ignore */
    }
  }, [data.branches, data.lockedBranchId]);

  function pickBranch(id: string) {
    if (data.lockedBranchId) return;
    setBranchId(id);
    try {
      window.sessionStorage.setItem("ts-branch", id);
    } catch {
      /* ignore */
    }
  }

  const assignedBranch = branchId || matrizOf(data.branches)?.id || "";

  useEffect(() => {
    if (loading || !data.waReady || !data.waAuto) return;
    void dispatchTodayFn()
      .then((res) => {
        if (res && typeof res === "object" && "snapshot" in res) apply((res as { snapshot: unknown }).snapshot);
      })
      .catch(() => undefined);
  }, [loading, data.waReady, data.waAuto]);

  useEffect(() => {
    if (!data) return;
    const root = document.documentElement;
    root.dataset.brand = data.theme || "aco";
    root.dataset.font = data.font || "plex";
    loadFontFace(data.font || "plex");
    const scale = data.typeScale || 100;
    root.style.setProperty("--type-scale", String(scale / 100));
    root.style.setProperty("font-size", `${(16 * scale) / 100}px`);
    return () => {
      delete root.dataset.brand;
      delete root.dataset.font;
      root.style.removeProperty("--type-scale");
      root.style.removeProperty("font-size");
    };
  }, [data.theme, data.font, data.typeScale]);

  useEffect(() => {
    const fired = new Set<string>();
    const tick = () => {
      for (const item of data.agenda) {
        if (item.done || item.alarmSent || fired.has(item.id)) continue;
        if (!alarmDue(item.alarmAt)) continue;
        fired.add(item.id);
        const when = formatAlarm(item.alarmAt);
        const href = data.ownerPhone
          ? ownerWaLink(data.ownerPhone, item.title, item.note, when)
          : undefined;
        fireNotification(`Alarme: ${item.title}`, item.note || when, item.id, href);
        void markAlarmFn({ data: item.id }).then(apply).catch(() => undefined);
      }
    };
    tick();
    const id = window.setInterval(tick, 15000);
    return () => window.clearInterval(id);
  }, [data.agenda, data.ownerPhone]);

  const view = scopeSnapshot(data, branchId);

  const value: Store = {
    ...view,
    branches: data.branches,
    loading,
    branchId,
    setBranch: pickBranch,
    addBranch: async (d) => {
      apply(await addBranchFn({ data: d }));
    },
    saveBranch: async (d) => {
      apply(await saveBranchFn({ data: d }));
    },
    addStudent: async (input) => {
      apply(
        await addStudentFn({
          data: {
            name: input.name,
            phone: input.phone,
            classId: input.classId,
            modality: input.modality as Modality,
            belt: input.belt,
            degree: input.degree,
            cpf: input.cpf,
            address: input.address,
            cep: input.cep,
            hasHealth: input.hasHealth,
            healthNote: input.healthNote,
            birth: input.birth,
            scholarship: input.scholarship,
            planId: input.planId,
            dueDay: input.dueDay,
            docs: input.docs,
            trial: input.status === "trial",
            branchId: input.branchId || assignedBranch,
          },
        }),
      );
    },
    saveStudent: async (d) => {
      apply(await saveStudentFn({ data: d }));
    },
    deleteStudent: async (id) => {
      apply(await deleteStudentFn({ data: { id } }));
    },
    addPlan: async (d) => {
      apply(await addPlanFn({ data: { ...d, branchId: d.branchId || assignedBranch } }));
    },
    savePlan: async (d) => {
      apply(await savePlanFn({ data: d }));
    },
    deletePlan: async (id) => {
      apply(await deletePlanFn({ data: { id } }));
    },
    toggleAttendance: async (studentId, classId, date, present) => {
      apply(await toggleAttendanceFn({ data: { studentId, classId, date, present } }));
    },
    markPaid: async (invoiceId) => {
      apply(await markPaidFn({ data: invoiceId }));
    },
    markReminderSent: async (invoiceId, phase) => {
      apply(await markReminderFn({ data: { invoiceId, phase } }));
    },
    addPayable: async (d) => {
      apply(await addPayableFn({ data: { ...d, branchId: d.branchId || assignedBranch } }));
    },
    settlePayable: async (id) => {
      apply(await settlePayableFn({ data: id }));
    },
    addAgenda: async (d) => {
      if (d.alarmAt) void enableNotifications();
      apply(await addAgendaFn({ data: { ...d, branchId: d.branchId || assignedBranch } }));
    },
    toggleAgenda: async (id) => {
      apply(await toggleAgendaFn({ data: id }));
    },
    markAlarm: async (id) => {
      apply(await markAlarmFn({ data: id }));
    },
    saveSchool: async (d) => {
      setData((prev) => ({
        ...prev,
        school: d.name,
        theme: d.theme || prev.theme || "aco",
        logo: d.logo,
        font: d.font || prev.font || "plex",
        typeScale: d.typeScale || prev.typeScale || 100,
        ownerPhone: d.ownerPhone,
        chargeTexts: d.chargeTexts ?? prev.chargeTexts,
        waPhoneId: d.waPhoneId ?? prev.waPhoneId,
        waUrl: d.waUrl ?? prev.waUrl,
        waAuto: d.waAuto ?? prev.waAuto,
        waReady: d.waToken && !d.waToken.startsWith("•") ? true : prev.waReady,
      }));
      apply(await saveSchoolFn({ data: d }));
    },
    dispatchToday: async () => {
      const res = await dispatchTodayFn();
      apply(res?.snapshot);
      return { sent: res.sent, failed: res.failed, errors: res.errors };
    },
    testWhatsApp: async () => {
      const { waTestClient } = await import("@/lib/wa-client");
      await waTestClient();
    },
    waState: async () => {
      const res = await waStateFn();
      return res.state as "open" | "connecting" | "close";
    },
    waQr: async () => {
      const { waQrClient } = await import("@/lib/wa-client");
      return waQrClient();
    },
    addStaff: async (d) => {
      apply(await addStaffFn({ data: { ...d, branchId: d.branchId || assignedBranch } }));
    },
    saveStaff: async (d) => {
      apply(await saveStaffFn({ data: d }));
    },
    deleteStaff: async (id) => {
      apply(await deleteStaffFn({ data: { id } }));
    },
    addStock: async (d) => {
      apply(await addStockFn({ data: { ...d, branchId: d.branchId || assignedBranch } }));
    },
    saveStock: async (d) => {
      apply(await saveStockFn({ data: d }));
    },
    deleteStock: async (id) => {
      apply(await deleteStockFn({ data: { id } }));
    },
    adjustStock: async (id, delta) => {
      apply(await adjustStockFn({ data: { id, delta } }));
    },
    sellStock: async (d) => {
      apply(await sellStockFn({ data: d }));
    },
    addClass: async (d) => {
      apply(await addClassFn({ data: { ...d, branchId: d.branchId || assignedBranch } }));
    },
    saveClass: async (d) => {
      apply(await saveClassFn({ data: d }));
    },
    deleteClass: async (id) => {
      apply(await deleteClassFn({ data: { id } }));
    },
    addChampionship: async (d) => {
      apply(await addChampionshipFn({ data: { ...d, branchId: assignedBranch } }));
    },
    saveChampionship: async (d) => {
      apply(await saveChampionshipFn({ data: d }));
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDojo(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useDojo outside provider");
  }
  return ctx;
}
