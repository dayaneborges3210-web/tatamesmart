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
  }) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  addPlan: (d: { name: string; durationMonths: number; billing: "mensal" | "unico"; amount: number; weeklyLimit: number; dueDay: number }) => Promise<void>;
  savePlan: (d: { id: string; name: string; durationMonths: number; billing: "mensal" | "unico"; amount: number; weeklyLimit: number; dueDay: number }) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
  toggleAttendance: (studentId: string, classId: string, date: string, present: boolean) => Promise<void>;
  markPaid: (invoiceId: string) => Promise<void>;
  markReminderSent: (invoiceId: string, phase: ReminderSend["phase"]) => Promise<void>;
  addPayable: (d: { title: string; vendor: string; category: string; amount: number; due: string }) => Promise<void>;
  settlePayable: (id: string) => Promise<void>;
  addAgenda: (d: { title: string; note: string; due: string; alarmAt: string }) => Promise<void>;
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
  addStaff: (d: { name: string; role: string; phone: string; pay: number }) => Promise<void>;
  saveStaff: (d: { id: string; name: string; role: string; phone: string; pay: number }) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  addStock: (d: { name: string; category: string; qty: number; minQty: number; unitCost: number; price: number }) => Promise<void>;
  saveStock: (d: { id: string; name: string; category: string; qty: number; minQty: number; unitCost: number; price: number }) => Promise<void>;
  deleteStock: (id: string) => Promise<void>;
  adjustStock: (id: string, delta: number) => Promise<void>;
  sellStock: (d: { itemId: string; studentId: string; qty: number; payMethod: string }) => Promise<void>;
  addClass: (d: { name: string; modality: string; days: string[]; time: string; timeEnd: string; instructor: string; capacity: number }) => Promise<void>;
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
  };
}

export function DojoProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DojoSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);

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
    if (!data) return;
    const root = document.documentElement;
    root.dataset.brand = data.theme || "aco";
    root.dataset.font = data.font || "plex";
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

  const value: Store = {
    ...data,
    loading,
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
            planId: input.planId,
            dueDay: input.dueDay,
            docs: input.docs,
            trial: input.status === "trial",
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
      apply(await addPlanFn({ data: d }));
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
      apply(await addPayableFn({ data: d }));
    },
    settlePayable: async (id) => {
      apply(await settlePayableFn({ data: id }));
    },
    addAgenda: async (d) => {
      if (d.alarmAt) void enableNotifications();
      apply(await addAgendaFn({ data: d }));
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
      apply(await addStaffFn({ data: d }));
    },
    saveStaff: async (d) => {
      apply(await saveStaffFn({ data: d }));
    },
    deleteStaff: async (id) => {
      apply(await deleteStaffFn({ data: { id } }));
    },
    addStock: async (d) => {
      apply(await addStockFn({ data: d }));
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
      apply(await addClassFn({ data: d }));
    },
    saveClass: async (d) => {
      apply(await saveClassFn({ data: d }));
    },
    deleteClass: async (id) => {
      apply(await deleteClassFn({ data: { id } }));
    },
    addChampionship: async (d) => {
      apply(await addChampionshipFn({ data: d }));
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
