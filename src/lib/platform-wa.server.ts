import { getSql } from "@/lib/db";
import { academyOf } from "@/lib/academy-actor";
import { createEvolutionInstance, evolutionState, instanceNameFor, instanceNameForBranch, normalizeEvolutionUrl } from "@/lib/whatsapp";
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
  if (!url) url = "https://whatsapp.metalcoreerp.com.br";
  if (/^metalcore$/i.test(instance) || /^autocore$/i.test(instance)) instance = "";

  if (!token) {
    const env = fromEnv();
    url = url || normalizeEvolutionUrl(env.url ?? "");
    instance = instance || (env.instance ?? "");
    if (/^metalcore$/i.test(instance) || /^autocore$/i.test(instance)) instance = "";
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
       and coalesce(s.wa_token, '') <> '' and coalesce(s.wa_url, '') <> ''
       limit 1`;
    if (school[0]) {
      url = (school[0].wa_url ?? "").trim();
      instance = (school[0].wa_phone_id ?? "").trim();
      if (/^metalcore$/i.test(instance) || /^autocore$/i.test(instance)) instance = "";
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
  let instance = (next.instance ?? current.instance).trim().slice(0, 80);
  if (/^metalcore$/i.test(instance) || /^autocore$/i.test(instance)) instance = "";
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

export async function ensureBranchWa(ownerUserId: string, branchId: string) {
  const platform = await ensurePlatformWa();
  if (!platform.url || !platform.token) {
    throw new Error("A TatameSmart ainda não ligou a API do WhatsApp.");
  }
  const sql = await getSql();
  await sql.query(`
    create table if not exists wa_school_instances (
      user_id text primary key,
      instance_name text not null unique,
      instance_token text not null,
      provisioned boolean not null default false,
      created_at timestamptz not null default now()
    )
  `);
  await sql.query(`
    create table if not exists wa_branch_instances (
      branch_id text primary key,
      owner_user_id text not null,
      instance_name text not null unique,
      instance_token text not null,
      provisioned boolean not null default false,
      created_at timestamptz not null default now()
    )
  `);
  const branches = await sql<{ id: string; kind: string }>`
    select id, kind from branches where user_id = ${ownerUserId} and id = ${branchId} limit 1
  `;
  if (!branches[0]) throw new Error("Unidade não encontrada.");

  const existing = await sql<{ instance_name: string; instance_token: string; provisioned: boolean }>`
    select instance_name, instance_token, provisioned from wa_branch_instances where branch_id = ${branchId}
  `;
  if (!existing.length) {
    let instanceName = instanceNameForBranch(ownerUserId, branchId);
    let instanceToken = randomBytes(32).toString("hex");
    let provisioned = false;
    if (branches[0].kind === "matriz") {
      const school = await sql<{ instance_name: string; instance_token: string; provisioned: boolean }>`
        select instance_name, instance_token, provisioned from wa_school_instances where user_id = ${ownerUserId}
      `;
      if (school[0] && !/^metalcore$/i.test(school[0].instance_name) && !/^autocore$/i.test(school[0].instance_name)) {
        instanceName = school[0].instance_name;
        instanceToken = school[0].instance_token;
        provisioned = Boolean(school[0].provisioned);
      }
    }
    await sql`insert into wa_branch_instances (branch_id, owner_user_id, instance_name, instance_token, provisioned)
      values (${branchId}, ${ownerUserId}, ${instanceName}, ${instanceToken}, ${provisioned})
      on conflict (branch_id) do nothing`;
  }

  const rows = await sql<{ instance_name: string; instance_token: string; provisioned: boolean }>`
    select instance_name, instance_token, provisioned from wa_branch_instances where branch_id = ${branchId}`;
  const row = rows[0];
  if (!row || row.instance_token === platform.token) throw new Error("Credencial individual indisponível.");
  if (/^metalcore$/i.test(row.instance_name) || /^autocore$/i.test(row.instance_name)) {
    throw new Error("Instância inválida. Cada unidade usa o próprio QR.");
  }
  const creds = { url: platform.url, instance: row.instance_name, token: row.instance_token };
  if (!row.provisioned) {
    try {
      await createEvolutionInstance({
        url: platform.url,
        token: platform.token,
        instance: creds.instance,
        instanceToken: creds.token,
      });
    } catch (error) {
      try {
        await evolutionState(creds);
      } catch {
        throw error;
      }
    }
    await evolutionState(creds);
    await sql`update wa_branch_instances set provisioned = true where branch_id = ${branchId}`;
    if (branches[0].kind === "matriz") {
      await sql`insert into wa_school_instances (user_id, instance_name, instance_token, provisioned)
        values (${ownerUserId}, ${creds.instance}, ${creds.token}, ${true})
        on conflict (user_id) do update set instance_name = excluded.instance_name, instance_token = excluded.instance_token, provisioned = true`;
      await sql`update schools set wa_phone_id = ${creds.instance}, wa_url = ${platform.url} where user_id = ${ownerUserId}`;
    }
  }
  return creds;
}

export async function ensureSchoolWa(sessionUserId: string, branchId?: string) {
  const actor = await academyOf(sessionUserId);
  const sql = await getSql();
  const branches = await sql<{ id: string; kind: string }>`
    select id, kind from branches where user_id = ${actor.ownerId} order by kind, name
  `;
  const wanted =
    actor.lockedBranchId ||
    (branchId && branches.some((b) => b.id === branchId) ? branchId : "") ||
    branches.find((b) => b.kind === "matriz")?.id ||
    branches[0]?.id ||
    "";
  if (!wanted) {
    const fallback = await ensureSchoolWaLegacy(actor.ownerId);
    return fallback;
  }
  return ensureBranchWa(actor.ownerId, wanted);
}

async function ensureSchoolWaLegacy(userId: string) {
  const platform = await ensurePlatformWa();
  if (!platform.url || !platform.token) {
    throw new Error("A TatameSmart ainda não ligou a API do WhatsApp.");
  }
  const sql = await getSql();
  await sql.query(`
    create table if not exists wa_school_instances (
      user_id text primary key,
      instance_name text not null unique,
      instance_token text not null,
      provisioned boolean not null default false,
      created_at timestamptz not null default now()
    )
  `);
  const schools = await sql<{ user_id: string }>`select user_id from schools where user_id = ${userId}`;
  if (!schools.length) throw new Error("Academia não encontrada.");
  await sql`insert into wa_school_instances (user_id, instance_name, instance_token)
    values (${userId}, ${instanceNameFor(userId)}, ${randomBytes(32).toString("hex")})
    on conflict (user_id) do nothing`;
  const rows = await sql<{ instance_name: string; instance_token: string; provisioned: boolean }>`
    select instance_name, instance_token, provisioned from wa_school_instances where user_id = ${userId}`;
  const row = rows[0];
  if (!row || row.instance_token === platform.token) throw new Error("Credencial individual indisponível.");
  if (/^metalcore$/i.test(row.instance_name) || /^autocore$/i.test(row.instance_name)) {
    throw new Error("Instância inválida. Cada academia usa o próprio QR.");
  }
  const creds = { url: platform.url, instance: row.instance_name, token: row.instance_token };
  if (!row.provisioned) {
    try {
      await createEvolutionInstance({
        url: platform.url,
        token: platform.token,
        instance: creds.instance,
        instanceToken: creds.token,
      });
    } catch (error) {
      try {
        await evolutionState(creds);
      } catch {
        throw error;
      }
    }
    await evolutionState(creds);
    await sql`update wa_school_instances set provisioned = true where user_id = ${userId}`;
    await sql`update schools set wa_phone_id = ${creds.instance}, wa_url = ${platform.url} where user_id = ${userId}`;
  }
  return creds;
}
