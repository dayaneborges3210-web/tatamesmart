import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { isDemoEmail } from "@/lib/demo";
import { ensureMaeAccount } from "@/lib/mae.server";
import { mpConfigured, saveMpAccessToken } from "@/lib/mp";
import { isMaeEmail, PLATFORM_OWNER_EMAIL } from "@/lib/site";

export type AcademyPlan = "trial" | "completo";
export type AcademyAccess = "ok" | "blocked" | "vitalicio";

export type AcademyRow = {
  userId: string;
  name: string;
  email: string;
  plan: AcademyPlan;
  access: AcademyAccess;
  demo: boolean;
  createdAt: string;
  students: number;
  note: string;
};

function asPlan(v: string | null | undefined): AcademyPlan {
  if (v === "trial") return "trial";
  return "completo";
}

function asAccess(v: string | null | undefined): AcademyAccess {
  if (v === "blocked" || v === "vitalicio") return v;
  return "ok";
}

async function requireMae(userId: string) {
  const sql = await getSql();
  const me = await sql<{ email: string | null }>`select email from "user" where id = ${userId}`;
  if (!isMaeEmail(me[0]?.email)) throw new Error("Só a empresa mãe acessa esta tela.");
  await ensureMaeAccount();
}

async function ensureBillingCols() {
  const sql = await getSql();
  await sql.query(`alter table schools add column if not exists access_status text not null default 'ok'`);
  await sql.query(`alter table schools add column if not exists billing_plan text not null default 'basico'`);
  try {
    await sql.query(`alter table staff add column if not exists login_user_id text`);
  } catch {
    /* older preview */
  }
}

async function listRows(): Promise<AcademyRow[]> {
  const sql = await getSql();
  await ensureBillingCols();
  const rows = await sql<{
    id: string;
    user_name: string | null;
    email: string | null;
    createdAt: Date | string | null;
    school_name: string | null;
    access_status: string | null;
    billing_plan: string | null;
    students: number;
  }>`
    select
      s.user_id as id,
      u.name as user_name,
      u.email,
      coalesce(u."createdAt", now()) as "createdAt",
      s.name as school_name,
      s.access_status,
      s.billing_plan,
      (select count(*)::int from students st where st.user_id = s.user_id) as students
    from schools s
    left join "user" u on u.id = s.user_id
    where lower(coalesce(u.email, '')) <> ${PLATFORM_OWNER_EMAIL}
    order by lower(coalesce(s.name, u.name, ''))
  `;
  const staff = await sql<{ user_id: string; email: string | null; name: string | null }>`
    select user_id, email, name from staff where coalesce(email, '') <> ''
  `.catch(() => [] as { user_id: string; email: string | null; name: string | null }[]);
  const extra = await sql<{
    id: string;
    email: string | null;
    name: string | null;
    createdAt: Date | string | null;
    students: number;
  }>`
    select u.id, u.email, u.name, u."createdAt",
      (select count(*)::int from students st where st.user_id = u.id) as students
    from "user" u
    where lower(coalesce(u.email, '')) <> ${PLATFORM_OWNER_EMAIL}
      and not exists (select 1 from schools s where s.user_id = u.id)
    order by lower(coalesce(u.email, ''))
  `.catch(() => [] as {
    id: string;
    email: string | null;
    name: string | null;
    createdAt: Date | string | null;
    students: number;
  }[]);
  const notes = new Map<string, string[]>();
  for (const person of staff) {
    const mail = (person.email ?? "").trim();
    if (!mail) continue;
    const line = `${(person.name ?? "").trim() || "Professor"}: ${mail}`;
    notes.set(person.user_id, [...(notes.get(person.user_id) ?? []), line]);
  }
  const listed = rows.map((r) => ({
    userId: r.id,
    name: (r.school_name || r.user_name || "Sem nome").trim() || "Sem nome",
    email: r.email ?? "",
    plan: asPlan(r.billing_plan),
    access: asAccess(r.access_status),
    demo: isDemoEmail(r.email),
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : "",
    students: Number(r.students) || 0,
    note: (notes.get(r.id) ?? []).join(" · "),
  }));
  for (const user of extra) {
    listed.push({
      userId: user.id,
      name: (user.name || "Login sem academia").trim(),
      email: user.email ?? "",
      plan: "trial",
      access: "ok",
      demo: isDemoEmail(user.email),
      createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : "",
      students: Number(user.students) || 0,
      note: "Este login não tem linha em academias",
    });
  }
  return listed;
}

export const listAcademiesFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireMae(context.userId);
    return listRows();
  });

export const prepareWhatsAppFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireMae(context.userId);
    const { provisionAllAcademiesWa } = await import("./platform-wa.server");
    return provisionAllAcademiesWa();
  });

export const setAccessFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { userId: string; access: AcademyAccess }) => d)
  .handler(async ({ context, data }) => {
    await requireMae(context.userId);
    if (data.userId === context.userId) throw new Error("A empresa mãe não se bloqueia.");
    const sql = await getSql();
    await ensureBillingCols();
    await sql`
      insert into schools (user_id, name, pix, owner_phone, wa_auto, access_status, billing_plan)
      select ${data.userId}, coalesce(nullif(u.name, ''), 'Academia'), ${""}, ${""}, ${true}, ${data.access}, ${"trial"}
      from "user" u where u.id = ${data.userId}
      on conflict (user_id) do update set access_status = ${data.access}
    `;
    return listRows();
  });

export const setPlanFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { userId: string; plan: AcademyPlan }) => d)
  .handler(async ({ context, data }) => {
    await requireMae(context.userId);
    if (data.userId === context.userId) throw new Error("A empresa mãe não altera o próprio plano.");
    const sql = await getSql();
    await ensureBillingCols();
    await sql`
      insert into schools (user_id, name, pix, owner_phone, wa_auto, access_status, billing_plan)
      select ${data.userId}, coalesce(nullif(u.name, ''), 'Academia'), ${""}, ${""}, ${true}, ${"ok"}, ${data.plan}
      from "user" u where u.id = ${data.userId}
      on conflict (user_id) do update set billing_plan = ${data.plan}, access_status = ${"ok"}
    `;
    return listRows();
  });

export const mpStatusFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireMae(context.userId);
    return { configured: await mpConfigured() };
  });

export const saveMpTokenFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { token: string }) => d)
  .handler(async ({ context, data }) => {
    await requireMae(context.userId);
    await saveMpAccessToken(data.token);
    return { configured: true };
  });
