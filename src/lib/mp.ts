import { getSql } from "@/lib/db";

const MP_API = "https://api.mercadopago.com";

async function tokenFromDb() {
  try {
    const sql = await getSql();
    await sql.query(`
      create table if not exists platform_settings (
        id int primary key default 1,
        wa_url text not null default '',
        wa_instance text not null default '',
        wa_token text not null default '',
        owner_user_id text not null default '',
        updated_at timestamptz not null default now()
      )
    `);
    await sql.query(`alter table platform_settings add column if not exists mp_access_token text not null default ''`);
    await sql.query(`insert into platform_settings (id) values (1) on conflict (id) do nothing`);
    const rows = await sql<{ mp_access_token: string | null }>`select mp_access_token from platform_settings where id = 1`;
    return (rows[0]?.mp_access_token || "").trim();
  } catch {
    return "";
  }
}

export async function mpToken() {
  const env = (process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
  if (env.length > 20) return env;
  return tokenFromDb();
}

export async function mpConfigured() {
  return (await mpToken()).length > 20;
}

export async function saveMpAccessToken(token: string) {
  const value = token.trim();
  if (value.length < 20) throw new Error("Cole o Access Token de produção inteiro, o que começa com APP_USR-.");
  const sql = await getSql();
  await tokenFromDb();
  await sql`update platform_settings set mp_access_token = ${value}, updated_at = now() where id = 1`;
}

export async function mpFetch<T = Record<string, unknown>>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await mpToken();
  if (token.length < 20) throw new Error("A TatameSmart ainda não ligou o Mercado Pago.");
  const response = await fetch(MP_API + path, {
    ...init,
    signal: init.signal || AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }
  if (!response.ok) {
    const message =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      "O Mercado Pago recusou a cobrança.";
    throw new Error(message);
  }
  return data as T;
}
