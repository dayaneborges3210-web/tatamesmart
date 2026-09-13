import { waDigits } from "./money";

export function alarmDue(alarmAt: string, now = Date.now()) {
  if (!alarmAt) return false;
  const t = Date.parse(alarmAt);
  if (Number.isNaN(t)) return false;
  return t <= now;
}

export function formatAlarm(alarmAt: string) {
  if (!alarmAt) return "";
  const [date, time] = alarmAt.split("T");
  if (!date || !time) return alarmAt;
  const [y, m, d] = date.split("-");
  const hhmm = time.slice(0, 5);
  return `${d}/${m}/${y} ${hhmm}`;
}

export function ownerWaLink(phone: string, title: string, note: string, when: string) {
  const text = [
    "TatameSmart — alarme da agenda",
    "",
    title,
    note,
    when ? `Horário: ${when}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return `https://wa.me/${waDigits(phone)}?text=${encodeURIComponent(text)}`;
}

export async function enableNotifications() {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function fireNotification(title: string, body: string, tag: string, href?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const n = new Notification(title, { body, tag });
  if (href) {
    n.onclick = () => {
      window.focus();
      window.open(href, "_blank", "noopener");
    };
  }
}
