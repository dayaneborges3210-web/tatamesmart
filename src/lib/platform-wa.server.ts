import { getSql } from "@/lib/db";
import { createEvolutionInstance, evolutionState, instanceNameFor, normalizeEvolutionUrl } from "@/lib/whatsapp";
import { randomBytes } from "node:crypto";
import { isMaeEmail, PLATFORM_OWNER_EMAIL } from "@/lib/site";

export type PlatformWa = {
  url: string;
  instance: string;
  token: string;
  ownerUserId: string;
};

function fromEnv(): Partial<PlatformWa> {
  const url = (process.env.TATAMESMART_WA_URL ?? "").trim();
  const instance = (process.env.TATAMESMART_WA_INSTANCE ?? "").trim();
  const token = (process.env.TATAMESMART_WA_TOKEN ?? "").trim();
  return { url, instance, token };
}

export async function ensurePlatformWa(): Promise<PlatformWa> {
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
  await sql.query(`insert into platform_settings (id) values (1) on conflict (id) do nothing`);
  const rows = await sql<{
    wa_url: string;
    wa_instance: string;
    wa_token: string;
    owner_user_id: string;
  }>`select wa_url, wa_instance, wa_token, owner_user_id from platform_settings where id = 1`;
  let url = (rows[0]?.wa_url ?? "").trim();
  let instance = (rows[0]?.wa_instance ?? "").trim();
  let token = (rows[0]?.wa_token ?? "").trim();
  let ownerUserId = (rows[0]?.owner_user_id ?? "").trim();
  if (!url) url = "http://129.121.55.118";

  if (!token) {
    const env = fromEnv();
    url = url || normalizeEvolutionUrl(env.url ?? "");
    instance = instance || (env.instance ?? "");
    token = env.token ?? "";
  }

  if (!token) {
    const school = await sql<{
      wa_url: string | null;
      wa_phone_id: string | null;
      wa_token: string | null;
      user_id: string;
    }>`select s.wa_url, s.wa_phone_id, s.wa_token, s.user_id from schools s
       join "user" u on u.id = s.user_id
       where lower(u.email) = ${PLATFORM_OWNER_EMAIL}
       and coalesce(s.wa_token, '') <> '' and coalesce(s.wa_phone_id, '') <> '' and coalesce(s.wa_url, '') <> ''
       limit 1`;
    if (school[0]) {
      url = (school[0].wa_url ?? "").trim();
      instance = (school[0].wa_phone_id ?? "").trim();
      token = (school[0].wa_token ?? "").trim();
      ownerUserId = ownerUserId || school[0].user_id;
    }
  }

  if (token && (token !== (rows[0]?.wa_token ?? "") || url !== (rows[0]?.wa_url ?? "") || instance !== (rows[0]?.wa_instance ?? ""))) {
    await sql`update platform_settings set wa_url = ${url}, wa_instance = ${instance}, wa_token = ${token}, owner_user_id = ${ownerUserId}, updated_at = now() where id = 1`;
  }

  return { url, instance, token, ownerUserId };
}

export async function savePlatformWa(userId: string, next: { url?: string; instance?: string; token?: string }) {
  const current = await ensurePlatformWa();
  const sql = await getSql();
  const me = await sql<{ email: string | null }>`select email from "user" where id = ${userId}`;
  if (!isMaeEmail(me[0]?.email)) {
    throw new Error("A API do WhatsApp já é da TatameSmart. O cliente não altera.");
  }
  const url = normalizeEvolutionUrl(next.url ?? current.url).slice(0, 200);
  const instance = (next.instance ?? current.instance).trim().slice(0, 80);
  const token = (next.token ?? "").trim();
  const keep = token && !token.startsWith("•") ? token.slice(0, 400) : current.token;
  await sql`update platform_settings
    set wa_url = ${url}, wa_instance = ${instance}, wa_token = ${keep}, owner_user_id = ${current.ownerUserId || userId}, updated_at = now()
    where id = 1`;
  return ensurePlatformWa();
}

export function waReadyOf(p: PlatformWa) {
  return Boolean(p.url && p.token);
}

export async function ensureSchoolWa(userId: string) {
  const platform = await ensurePlatformWa();
  if (!platform.url || !platform.token) {
    throw new Error("A TatameSmart ainda não ligou a API do WhatsApp.");
  }
  const sql = await getSql();
  const schools = await sql<{ user_id: string }>`select user_id from schools where user_id = ${userId}`;
  if (!schools.length) throw new Error("Academia não encontrada.");
  await sql`insert into wa_school_instances (user_id, instance_name, instance_token)
    values (${userId}, ${instanceNameFor(userId)}, ${randomBytes(32).toString("hex")})
    on conflict (user_id) do nothing`;
  const rows = await sql<{ instance_name: string; instance_token: string; provisioned: boolean }>`
    select instance_name, instance_token, provisioned from wa_school_instances where user_id = ${userId}`;
  const row = rows[0];
  if (!row || row.instance_token === platform.token) throw new Error("Credencial individual indisponível.");
  const creds = { url: platform.url, instance: row.instance_name, token: row.instance_token };
  if (!row.provisioned) {
    try { await createEvolutionInstance({ url: platform.url, token: platform.token, instance: creds.instance, instanceToken: creds.token }); }
    catch (error) {
      // A concurrent request may have created it. Only accept that if our
      // individual credential can actually access this exact instance.
      try { await evolutionState(creds); } catch { throw error; }
    }
    await evolutionState(creds);
    await sql`update wa_school_instances set provisioned = true where user_id = ${userId}`;
    await sql`update schools set wa_phone_id = ${creds.instance}, wa_url = ${platform.url} where user_id = ${userId}`;
  }
  return creds;
}
