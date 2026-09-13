import { randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getSql } from "@/lib/db";
import { ensureMaeAccount, isMaePassword } from "@/lib/mae.server";
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
  const users = await sql<{ id: string }>`
    select id from "user" where lower(email) = ${email} limit 1
  `;
  let userId = users[0]?.id ?? "";

  if (isMaeEmail(email) && isMaePassword(password)) {
    if (!userId) {
      await ensureMaeAccount();
      const again = await sql<{ id: string }>`
        select id from "user" where lower(email) = ${email} limit 1
      `;
      userId = again[0]?.id ?? "";
    }
    if (userId) return { token: await openSession(userId) };
  }

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
