import http from "node:http";
import https from "node:https";
import { waDigits } from "./money";

export function normalizeEvolutionUrl(raw: string) {
  let url = raw.trim().replace(/\/$/, "");
  url = url.replace(/\/manager$/i, "").replace(/\/+$/, "");
  return url;
}

function evoHeaders(token: string) {
  return {
    apikey: token,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function evoHeaderRecord(h?: HeadersInit): Record<string, string> {
  if (!h) return {};
  if (h instanceof Headers) return Object.fromEntries(h.entries());
  if (Array.isArray(h)) return Object.fromEntries(h);
  return { ...h };
}

function evoRaw(url: string, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method: init?.method || "GET",
        headers: evoHeaderRecord(init?.headers),
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () => {
          resolve(
            new Response(Buffer.concat(chunks), {
              status: res.statusCode || 500,
              headers: { "content-type": String(res.headers["content-type"] || "application/json") },
            }),
          );
        });
      },
    );
    req.on("error", reject);
    if (typeof init?.body === "string") req.write(init.body);
    req.end();
  });
}

async function evoJson(url: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await evoRaw(url, init);
  } catch {
    const alt = url.startsWith("https://")
      ? `http://${url.slice("https://".length)}`
      : `https://${url.slice("http://".length)}`;
    try {
      res = await evoRaw(alt, init);
    } catch {
      throw new Error("Não alcançou a Evolution. URL: http://129.121.55.118");
    }
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
  if (raw.startsWith("data:")) return raw;
  if (raw.startsWith("http")) return raw;
  return `data:image/png;base64,${raw}`;
}

export async function sendWhatsAppText(opts: {
  url: string;
  instance: string;
  token: string;
  to: string;
  body: string;
}) {
  const base = normalizeEvolutionUrl(opts.url);
  const instance = opts.instance.trim();
  const token = opts.token.trim();
  const to = waDigits(opts.to);
  if (!base || !instance || !token) {
    throw new Error("Preencha URL, instância e token da Evolution.");
  }
  if (to.length < 12) throw new Error("Número do aluno incompleto.");
  const json = await evoJson(`${base}/message/sendText/${encodeURIComponent(instance)}`, {
    method: "POST",
    headers: evoHeaders(token),
    body: JSON.stringify({ number: to, text: opts.body.slice(0, 4096) }),
  });
  return typeof json.id === "string" ? json.id : "ok";
}

export async function evolutionState(opts: { url: string; instance: string; token: string }) {
  const base = normalizeEvolutionUrl(opts.url);
  const instance = encodeURIComponent(opts.instance.trim());
  const json = await evoJson(`${base}/instance/connectionState/${instance}`, {
    headers: evoHeaders(opts.token.trim()),
  });
  const inst = json.instance as { state?: string } | undefined;
  const state = String(inst?.state || json.state || json.status || "").toLowerCase();
  return state.includes("open") ? "open" : state.includes("connect") ? "connecting" : "close";
}

export async function evolutionQr(opts: { url: string; instance: string; token: string }) {
  const base = normalizeEvolutionUrl(opts.url);
  const instance = encodeURIComponent(opts.instance.trim());
  const json = await evoJson(`${base}/instance/connect/${instance}`, {
    method: "GET",
    headers: evoHeaders(opts.token.trim()),
  });
  const qr = pickQr(json);
  const inst = json.instance as { state?: string } | undefined;
  const nested = json.qrcode as { pairingCode?: string } | undefined;
  const state = String(inst?.state || json.state || "").toLowerCase();
  if (!qr && state.includes("open")) {
    return { qr: "", state: "open" as const };
  }
  if (!qr) {
    throw new Error(
      nested?.pairingCode
        ? `Use o código ${nested.pairingCode} no WhatsApp.`
        : "A Evolution não mandou o QR. Confira o nome da instância.",
    );
  }
  return {
    qr,
    state: state.includes("open") ? "open" : "connecting",
  };
}

export async function createEvolutionInstance(opts: { url: string; token: string; instance: string }) {
  const base = normalizeEvolutionUrl(opts.url);
  const instance = opts.instance.trim();
  if (!base || !instance || !opts.token.trim()) return;
  try {
    await evoJson(`${base}/instance/create`, {
      method: "POST",
      headers: evoHeaders(opts.token.trim()),
      body: JSON.stringify({
        instanceName: instance,
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

export function instanceNameFor(userId: string) {
  const s = userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
  return `ts${s || "escola"}`.slice(0, 30);
}
