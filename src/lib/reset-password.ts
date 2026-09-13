import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { SITE_NAME, SITE_NOREPLY } from "@/lib/site";

function hashCode(email: string, code: string) {
  return createHash("sha256").update(`${email}:${code}`).digest("hex");
}

function sameHash(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function previewMail() {
  return !process.env.DATABASE_URL;
}

async function sendResetEmail(to: string, code: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${SITE_NAME} <${SITE_NOREPLY}>`,
      to: [to],
      subject: `Código para recuperar a senha — ${SITE_NAME}`,
      text: `Seu código ${SITE_NAME} é ${code}.\n\nEle vale por 15 minutos. Se não foi você, ignore este e-mail.`,
    }),
  });
  return res.ok;
}

export const requestResetFn = createServerFn({ method: "POST" })
  .validator((d: { email: string }) => d)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      throw new Error("Informe o e-mail da academia.");
    }
    const sql = await getSql();
    const recent = await sql<{ n: number }>`
      select count(*)::int as n from password_reset_attempts
      where email = ${email} and at > now() - interval '15 minutes'
    `;
    if ((recent[0]?.n ?? 0) >= 5) {
      throw new Error("Muitas tentativas. Espere 15 minutos.");
    }
    await sql`insert into password_reset_attempts (id, email)
      values (${`${email}:${Date.now()}`}, ${email})`;

    const users = await sql<{ id: string }>`
      select u.id from "user" u
      join "account" a on a."userId" = u.id
      where lower(u.email) = ${email} and a."providerId" = ${"credential"}
    `;
    if (!users[0]) {
      return { ok: true as const };
    }

    const last = await sql<{ created_at: Date | string }>`
      select created_at from password_resets where email = ${email}
    `;
    if (last[0]) {
      const created = new Date(last[0].created_at).getTime();
      if (Date.now() - created < 60_000) {
        throw new Error("Aguarde um minuto para pedir outro código.");
      }
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = hashCode(email, code);
    await sql`
      insert into password_resets (email, code_hash, expires_at, attempts, created_at)
      values (${email}, ${codeHash}, now() + interval '15 minutes', 0, now())
      on conflict (email) do update set
        code_hash = excluded.code_hash,
        expires_at = excluded.expires_at,
        attempts = 0,
        created_at = excluded.created_at
    `;

    const mailed = await sendResetEmail(email, code);
    if (!mailed && !previewMail()) {
      throw new Error("Não foi possível enviar o e-mail. Tente de novo em instantes.");
    }
    return {
      ok: true as const,
      previewCode: previewMail() ? code : undefined,
    };
  });

export const confirmResetFn = createServerFn({ method: "POST" })
  .validator((d: { email: string; code: string; password: string }) => d)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const code = data.code.replace(/\D/g, "").slice(0, 6);
    const password = data.password;
    if (code.length !== 6) throw new Error("Digite o código de 6 dígitos.");
    if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
    const sql = await getSql();
    const rows = await sql<{ code_hash: string; expires_at: Date | string; attempts: number }>`
      select code_hash, expires_at, attempts from password_resets where email = ${email}
    `;
    const row = rows[0];
    if (!row) throw new Error("Peça um código novo.");
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await sql`delete from password_resets where email = ${email}`;
      throw new Error("Código vencido. Peça um novo.");
    }
    if (Number(row.attempts) >= 5) {
      await sql`delete from password_resets where email = ${email}`;
      throw new Error("Código bloqueado. Peça um novo.");
    }
    if (!sameHash(row.code_hash, hashCode(email, code))) {
      await sql`update password_resets set attempts = attempts + 1 where email = ${email}`;
      throw new Error("Código inválido.");
    }

    const acc = await sql<{ id: string }>`
      select a.id from "account" a
      join "user" u on u.id = a."userId"
      where lower(u.email) = ${email} and a."providerId" = ${"credential"}
    `;
    if (!acc[0]) throw new Error("Peça um código novo.");
    const hashed = await hashPassword(password);
    await sql`
      update "account" set password = ${hashed}, "updatedAt" = now() where id = ${acc[0].id}
    `;
    await sql`delete from password_resets where email = ${email}`;
    await sql`delete from password_reset_attempts where email = ${email}`;
    return { ok: true as const };
  });
