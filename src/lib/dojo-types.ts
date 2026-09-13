export type Belt =
  | "Branca"
  | "Azul"
  | "Roxa"
  | "Marrom"
  | "Preta"
  | "Iniciante";

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
  classId: string;
  status: "ativo" | "inativo" | "inadimplente" | "trial";
  joined: string;
  cpf: string;
  address: string;
  cep: string;
  hasHealth: boolean;
  healthNote: string;
};

export type ClassGroup = {
  id: string;
  name: string;
  modality: Modality;
  days: string[];
  time: string;
  timeEnd: string;
  instructor: string;
  capacity: number;
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
};

export type AgendaItem = {
  id: string;
  title: string;
  note: string;
  due: string;
  done: boolean;
  alarmAt: string;
  alarmSent: boolean;
};

export type Staff = {
  id: string;
  name: string;
  role: string;
  phone: string;
  pay: number;
};

export type StockItem = {
  id: string;
  name: string;
  category: string;
  qty: number;
  minQty: number;
  unitCost: number;
  price: number;
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
};
