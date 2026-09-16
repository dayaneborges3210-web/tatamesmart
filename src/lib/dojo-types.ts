export const BELTS = [
  "Sem faixa",
  "Branca",
  "Cinza",
  "Amarela",
  "Laranja",
  "Verde",
  "Azul",
  "Roxa",
  "Marrom",
  "Preta",
  "Coral",
  "Vermelha",
  "Iniciante",
] as const;

export type Belt = (typeof BELTS)[number];

export function isBelt(v: string): v is Belt {
  return (BELTS as readonly string[]).includes(v);
}

export function maxDegree(belt: string) {
  if (belt === "Preta" || belt === "Coral" || belt === "Vermelha") return 10;
  if (belt === "Sem faixa" || belt === "Iniciante") return 0;
  return 4;
}

export function clampDegree(belt: string, n: number) {
  const max = maxDegree(belt);
  const x = Math.round(Number(n) || 0);
  if (x < 0) return 0;
  if (x > max) return max;
  return x;
}

export function formatBelt(belt: string, degree = 0) {
  const n = clampDegree(belt, degree);
  if (!n) return belt;
  if (belt === "Preta" || belt === "Coral" || belt === "Vermelha") {
    return n === 1 ? `${belt} · 1º dan` : `${belt} · ${n}º dan`;
  }
  return n === 1 ? `${belt} · 1º grau` : `${belt} · ${n}º grau`;
}

export const MODALITIES = ["Jiu-jitsu", "Judô", "Muay Thai", "Capoeira", "Kids"] as const;
export type Modality = (typeof MODALITIES)[number];

export function isModality(v: string): v is Modality {
  return (MODALITIES as readonly string[]).includes(v);
}

export type Student = {
  id: string;
  name: string;
  phone: string;
  modality: Modality;
  belt: Belt;
  degree: number;
  classId: string;
  status: "ativo" | "inativo" | "inadimplente" | "trial";
  joined: string;
  cpf: string;
  address: string;
  cep: string;
  hasHealth: boolean;
  healthNote: string;
  birth: string;
  planId: string;
  dueDay: number;
  docs: string[];
  branchId: string;
};

export type Plan = {
  id: string;
  name: string;
  durationMonths: number;
  billing: "mensal" | "unico";
  amount: number;
  weeklyLimit: number;
  dueDay: number;
};

export const STUDENT_DOCS = [
  { id: "contrato", label: "Contrato de prestação de serviços" },
  { id: "risco", label: "Termo de assunção de risco" },
  { id: "parq", label: "PAR-Q" },
  { id: "menor", label: "Autorização de menor de idade" },
  { id: "imagem", label: "Termo de uso de imagem" },
  { id: "atestado", label: "Atestado médico" },
] as const;

export function parseDocs(raw: string | null | undefined) {
  return (raw ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter((id) => STUDENT_DOCS.some((d) => d.id === id));
}

export function clampDueDay(dueDay: number) {
  return Math.min(31, Math.max(1, Math.round(dueDay) || 10));
}

export function dueDateInMonth(month: string, dueDay: number) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const day = Math.min(last, clampDueDay(dueDay));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(m)}-${pad(day)}`;
}

export function nextDueFromDay(dueDay: number, from: string) {
  const [y, m] = from.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const thisMonth = dueDateInMonth(`${y}-${pad(m)}`, dueDay);
  if (thisMonth > from) return thisMonth;
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return dueDateInMonth(`${ny}-${pad(nm)}`, dueDay);
}

export type ClassGroup = {
  id: string;
  name: string;
  modality: Modality;
  days: string[];
  time: string;
  timeEnd: string;
  instructor: string;
  capacity: number;
  branchId: string;
};

export type Invoice = {
  id: string;
  studentId: string;
  month: string;
  amount: number;
  status: "aberta" | "paga" | "atrasada";
  due: string;
};

export type Attendance = {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  present: boolean;
};

export type ReminderSend = {
  id: string;
  invoiceId: string;
  date: string;
  phase: "inicio" | "lembrete" | "vencimento" | "atraso";
};

export type Payable = {
  id: string;
  title: string;
  vendor: string;
  category: string;
  amount: number;
  due: string;
  status: "aberta" | "paga" | "atrasada";
  branchId: string;
};

export type AgendaItem = {
  id: string;
  title: string;
  note: string;
  due: string;
  done: boolean;
  alarmAt: string;
  alarmSent: boolean;
  branchId: string;
};

export type Staff = {
  id: string;
  name: string;
  role: string;
  phone: string;
  pay: number;
  branchId: string;
};

export type StockItem = {
  id: string;
  name: string;
  category: string;
  qty: number;
  minQty: number;
  unitCost: number;
  price: number;
  branchId: string;
};

export type Sale = {
  id: string;
  studentId: string;
  itemId: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  total: number;
  payMethod: string;
  soldOn: string;
  branchId: string;
};

export type Championship = {
  id: string;
  name: string;
  place: string;
  modality: Modality;
  date: string;
  time: string;
  participants: string[];
  gold: number;
  silver: number;
  bronze: number;
  trophies: number;
  branchId: string;
};

export type Branch = {
  id: string;
  name: string;
  kind: "matriz" | "filial";
  address: string;
  phone: string;
  active: boolean;
};

export type ChargeTexts = {
  inicio: string;
  lembrete: string;
  vencimento: string;
  atraso: string;
};

export type DojoSnapshot = {
  school: string;
  pix: string;
  theme: string;
  logo: string;
  font: string;
  typeScale: number;
  ownerPhone: string;
  chargeTexts: ChargeTexts;
  waReady: boolean;
  waAuto: boolean;
  waPhoneId: string;
  waUrl: string;
  waOwner: boolean;
  blocked: boolean;
  branches: Branch[];
  students: Student[];
  classes: ClassGroup[];
  invoices: Invoice[];
  attendance: Attendance[];
  reminders: ReminderSend[];
  payables: Payable[];
  agenda: AgendaItem[];
  staff: Staff[];
  stock: StockItem[];
  sales: Sale[];
  championships: Championship[];
  plans: Plan[];
};
