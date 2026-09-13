import { getSql } from "@/lib/db";
import { createEvolutionInstance, instanceNameFor, normalizeEvolutionUrl } from "@/lib/whatsapp";
import { isMaeEmail } from "@/lib/site";

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
    }>`select wa_url, wa_phone_id, wa_token, user_id from schools
       where coalesce(wa_token, '') <> '' and coalesce(wa_phone_id, '') <> '' and coalesce(wa_url, '') <> ''
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
  if (current.token && current.ownerUserId && current.ownerUserId !== userId && !isMaeEmail(me[0]?.email)) {
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
  const me = await sql<{ email: string | null; wa_phone_id: string | null }>`
    select u.email, s.wa_phone_id
    from "user" u
    left join schools s on s.user_id = u.id
    where u.id = ${userId}
  `;
  const mae = isMaeEmail(me[0]?.email);
  let instance = (me[0]?.wa_phone_id ?? "").trim();
  if (!instance || (!mae && instance === platform.instance)) {
    instance = mae && platform.instance ? platform.instance : instanceNameFor(userId);
    await createEvolutionInstance({ url: platform.url, token: platform.token, instance });
    await sql`update schools set wa_phone_id = ${instance}, wa_url = ${platform.url}, wa_auto = ${true} where user_id = ${userId}`;
  }
  return { url: platform.url, token: platform.token, instance };
}
