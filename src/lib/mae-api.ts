import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { ensureMaeAccount } from "@/lib/mae.server";
import { isMaeEmail, PLATFORM_OWNER_EMAIL } from "@/lib/site";

export type AcademyRow = {
  userId: string;
  name: string;
  email: string;
  access: "ok" | "blocked" | "vitalicio";
  createdAt: string;
};

async function requireMae(userId: string) {
  const sql = await getSql();
  const me = await sql<{ email: string | null }>`select email from "user" where id = ${userId}`;
  if (!isMaeEmail(me[0]?.email)) throw new Error("Só a empresa mãe acessa esta tela.");
  await ensureMaeAccount();
}

async function listRows(): Promise<AcademyRow[]> {
  const sql = await getSql();
  const rows = await sql<{
    user_id: string;
    name: string;
    email: string | null;
    access_status: string | null;
    createdAt: Date | string | null;
  }>`
    select s.user_id, s.name, u.email, s.access_status, u."createdAt"
    from schools s
    join "user" u on u.id = s.user_id
    where lower(u.email) <> ${PLATFORM_OWNER_EMAIL}
    order by u."createdAt" desc
  `;
  return rows.map((r) => ({
    userId: r.user_id,
    name: r.name,
    email: r.email ?? "",
    access: (r.access_status === "blocked" || r.access_status === "vitalicio" ? r.access_status : "ok") as AcademyRow["access"],
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : "",
  }));
}

export const listAcademiesFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireMae(context.userId);
    return listRows();
  });

export const setAccessFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { userId: string; access: "ok" | "blocked" | "vitalicio" }) => d)
  .handler(async ({ context, data }) => {
    await requireMae(context.userId);
    if (data.userId === context.userId) throw new Error("A empresa mãe não se bloqueia.");
    const sql = await getSql();
    await sql`update schools set access_status = ${data.access} where user_id = ${data.userId}`;
    return listRows();
  });
