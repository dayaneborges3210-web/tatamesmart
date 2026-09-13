export function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function parseBRL(raw: string) {
  const t = raw.trim().replace(/\s/g, "");
  if (!t) return 0;
  if (t.includes(",")) {
    const [reais, cents = "0"] = t.replace(/\./g, "").split(",");
    const c = (cents + "00").slice(0, 2);
    return Math.round(Number(reais || "0") * 100 + Number(c));
  }
  return Math.round(Number(t.replace(/\./g, "")) * 100);
}

export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function weekdayPt(iso = todayISO()) {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

export function weekdayShort(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAYS_SHORT[new Date(y, m - 1, d).getDay()];
}

export function weekdayHeaders() {
  return WEEKDAYS_SHORT;
}

export function firstWeekdayOfMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).getDay();
}

export function formatDatePt(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function daysUntil(due: string, from = todayISO()) {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = due.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}

export function monthDays(month: string, until?: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= last; d++) {
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (until && iso > until) break;
    out.push(iso);
  }
  return out;
}

export function classDates(days: string[], month: string, until?: string) {
  return monthDays(month, until).filter((iso) => days.includes(weekdayPt(iso)));
}

export function monthTitle(month: string) {
  const [y, m] = month.split("-").map(Number);
  const names = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  return `${names[m - 1]} de ${y}`;
}

export function monthLabel(iso: string) {
  const [y, m] = iso.split("-");
  return `${m}/${y}`;
}

export function waDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

export function addMinutesHHMM(hhmm: string, mins: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = (((h || 0) * 60 + (m || 0) + mins) % 1440 + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function classHours(start: string, end?: string) {
  if (!start) return "horário a confirmar";
  if (!end) return start;
  return `${start} às ${end}`;
}
