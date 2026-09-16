import { getBearerToken } from "@/lib/auth/client";
import { browserQr, browserSendText, browserState } from "@/lib/evo-browser";

type Creds = { url: string; instance: string; token: string; ownerPhone: string };

async function loadCreds(branchId?: string): Promise<Creds> {
  const headers: Record<string, string> = {};
  const token = getBearerToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const qs = branchId ? `?branch=${encodeURIComponent(branchId)}` : "";
  const res = await fetch(`/api/wa-creds${qs}`, { credentials: "include", cache: "no-store", headers });
  const json = (await res.json().catch(() => ({}))) as Creds & { message?: string };
  if (!res.ok) throw new Error(json.message || "Cole o token no campo Token e clique Enviar teste.");
  if (!json.url || !json.token || !json.instance) throw new Error("Cole o token no campo Token e clique Enviar teste.");
  return json;
}

export async function waQrClient(override?: { url?: string; instance?: string; token?: string; branchId?: string }) {
  const saved = await loadCreds(override?.branchId);
  const url = override?.url || saved?.url || "";
  const instance = override?.instance || saved?.instance || "";
  const token = override?.token || saved?.token || "";
  if (!token || !url || !instance) throw new Error("Cole o token no campo Token.");
  return browserQr({ url, token, instance });
}

export async function waTestClient(override?: { url?: string; instance?: string; token?: string; to?: string; branchId?: string }) {
  const saved = await loadCreds(override?.branchId);
  const url = override?.url || saved?.url || "";
  const instance = override?.instance || saved?.instance || "";
  const token = override?.token || saved?.token || "";
  const to = override?.to || saved?.ownerPhone || "";
  if (!token || !url || !instance) throw new Error("Cole o token no campo Token e clique Enviar teste.");
  if (!to) throw new Error("Cadastre o WhatsApp do dono em Identidade e clique Salvar identidade.");
  await browserSendText({
    url,
    token,
    instance,
    to,
    body: "TatameSmart: seu WhatsApp está no ar. As mensalidades dos alunos saem deste número.",
  });
}

export async function waStateClient(branchId?: string) {
  return browserState(await loadCreds(branchId));
}
