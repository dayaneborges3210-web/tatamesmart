import { randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getSql } from "@/lib/db";
import { ensureMaeAccount } from "@/lib/mae.server";
import { isMaeEmail } from "@/lib/site";

function newId() {
  return randomBytes(24).toString("base64url");
}

async function openSession(userId: string) {
  const sql = await getSql();
  const token = newId();
  const id = newId();
  await sql`
    insert into "session" (id, "expiresAt", token, "createdAt", "updatedAt", "userId")
    values (${id}, now() + interval '30 days', ${token}, now(), now(), ${userId})
  `;
  return token;
}

export async function emailAuthCore(data: {
  kind: "entrar" | "criar";
  email: string;
  password: string;
  name?: string;
}) {
  const email = data.email.trim().toLowerCase();
  const password = data.password.trim();
  const name = (data.name ?? "").trim() || "Minha academia";
  if (!email.includes("@")) throw new Error("Informe o e-mail da academia.");
  if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  await ensureMaeAccount();

  const sql = await getSql();
  await sql.query(`alter table schools add column if not exists access_status text not null default 'ok'`).catch(() => undefined);
  await sql.query(`alter table schools add column if not exists billing_plan text not null default 'basico'`).catch(() => undefined);
  const users = await sql<{ id: string }>`
    select id from "user" where lower(email) = ${email} limit 1
  `;
  let userId = users[0]?.id ?? "";

  if (isMaeEmail(email) && !userId) throw new Error("Conta administrativa ainda não configurada.");

  if (data.kind === "criar" && !userId) {
    userId = newId();
    const hashed = await hashPassword(password);
    await sql`
      insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
      values (${userId}, ${name}, ${email}, false, now(), now())
    `;
    await sql`
      insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
      values (${newId()}, ${userId}, ${"credential"}, ${userId}, ${hashed}, now(), now())
    `;
    await sql`
      insert into schools (user_id, name, pix, owner_phone, wa_auto, access_status, billing_plan)
      values (${userId}, ${name}, ${""}, ${""}, ${true}, ${"ok"}, ${"trial"})
      on conflict (user_id) do nothing
    `;
    return { token: await openSession(userId) };
  }

  if (!userId) throw new Error("E-mail ou senha incorretos.");

  const acc = await sql<{ password: string | null }>`
    select password from "account"
    where "userId" = ${userId} and "providerId" = ${"credential"}
    limit 1
  `;
  const hash = acc[0]?.password;
  if (!hash) throw new Error("Esse e-mail entra com Google. Use Continuar com Google.");
  const ok = await verifyPassword({ hash, password });
  if (!ok) throw new Error("E-mail ou senha incorretos.");
  if (data.kind === "criar") {
    await sql`update "user" set name = ${name}, "updatedAt" = now() where id = ${userId}`;
  }
  return { token: await openSession(userId) };
}

export const emailAuthFn = createServerFn({ method: "POST" })
  .validator((d: { kind: "entrar" | "criar"; email: string; password: string; name?: string }) => d)
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    return emailAuthCore(data);
  });

export async function changePasswordCore(userId: string, current: string, next: string) {
  const currentPassword = current.trim();
  const nextPassword = next.trim();
  if (currentPassword.length < 8) throw new Error("Informe a senha atual.");
  if (nextPassword.length < 8) throw new Error("A senha nova precisa ter pelo menos 8 caracteres.");
  if (currentPassword === nextPassword) throw new Error("A senha nova precisa ser diferente da atual.");
  const sql = await getSql();
  const acc = await sql<{ id: string; password: string | null }>`
    select id, password from "account"
    where "userId" = ${userId} and "providerId" = ${"credential"}
    limit 1
  `;
  const hash = acc[0]?.password;
  if (!acc[0] || !hash) throw new Error("Essa conta entra com Google. Não há senha para trocar.");
  const ok = await verifyPassword({ hash, password: currentPassword });
  if (!ok) throw new Error("A senha atual está incorreta.");
  const hashed = await hashPassword(nextPassword);
  await sql`update "account" set password = ${hashed}, "updatedAt" = now() where id = ${acc[0].id}`;
  return { ok: true as const };
}
