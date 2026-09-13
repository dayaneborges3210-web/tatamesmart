import { waDigits } from "@/lib/money";

export function evoBrowserBase(url: string) {
  let u = url.trim().replace(/\/$/, "");
  u = u.replace(/\/manager$/i, "").replace(/\/+$/, "");
  if (u.startsWith("http://")) return `https://${u.slice("http://".length)}`;
  return u;
}

function pickQr(json: Record<string, unknown>) {
  const nested = json.qrcode;
  const bag =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : json;
  const raw = [bag.base64, bag.qr, bag.code, json.base64, json.qr, json.code].find(
    (v) => typeof v === "string" && v.length > 20,
  );
  if (typeof raw !== "string") return "";
  if (raw.startsWith("data:") || raw.startsWith("http")) return raw;
  return `data:image/png;base64,${raw}`;
}

async function evoFetch(url: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(url, { ...init, credentials: "omit" });
  } catch {
    throw new Error("Abra https://129.121.55.118 no Chrome, clique em Avançar, e tente de novo.");
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error;
    const msg =
      (typeof err === "string" ? err : (err as { message?: string } | undefined)?.message) ||
      (typeof json.message === "string" ? json.message : "") ||
      `Evolution recusou (${res.status}).`;
    throw new Error(msg);
  }
  return json;
}

export async function browserCreateInstance(opts: { url: string; token: string; instance: string }) {
  const base = evoBrowserBase(opts.url);
  try {
    await evoFetch(`${base}/instance/create`, {
      method: "POST",
      headers: { apikey: opts.token, "Content-Type": "application/json" },
      body: JSON.stringify({
        instanceName: opts.instance,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/exist|already|já exist|403|409/i.test(msg)) return;
    throw err;
  }
}

export async function browserQr(opts: { url: string; token: string; instance: string }) {
  const base = evoBrowserBase(opts.url);
  const json = await evoFetch(`${base}/instance/connect/${encodeURIComponent(opts.instance)}`, {
    headers: { apikey: opts.token },
  });
  const qr = pickQr(json);
  const inst = json.instance as { state?: string } | undefined;
  const state = String(inst?.state || json.state || "").toLowerCase();
  if (state.includes("open")) return { qr: "", state: "open" as const };
  if (!qr) throw new Error("A Evolution não mandou o QR.");
  return { qr, state: "connecting" as const };
}

export async function browserState(opts: { url: string; token: string; instance: string }) {
  const json = await evoFetch(`${evoBrowserBase(opts.url)}/instance/connectionState/${encodeURIComponent(opts.instance)}`, {
    headers: { apikey: opts.token },
  });
  const instance = json.instance as { state?: string } | undefined;
  const state = String(instance?.state || json.state || "").toLowerCase();
  return state === "open" || state === "connected" ? "open" : state === "connecting" ? "connecting" : "close";
}

export async function browserSendText(opts: {
  url: string;
  token: string;
  instance: string;
  to: string;
  body: string;
}) {
  const base = evoBrowserBase(opts.url);
  const to = waDigits(opts.to);
  if (to.length < 12) throw new Error("Número do dono incompleto. Salve o WhatsApp em Identidade.");
  await evoFetch(`${base}/message/sendText/${encodeURIComponent(opts.instance)}`, {
    method: "POST",
    headers: { apikey: opts.token, "Content-Type": "application/json" },
    body: JSON.stringify({ number: to, text: opts.body.slice(0, 4096) }),
  });
}
