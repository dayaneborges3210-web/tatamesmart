import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { waDigits } from "@/lib/money";
import { SITE_NAME, SITE_NOREPLY, PLATFORM_OWNER_EMAIL } from "@/lib/site";

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

function codeText(code: string) {
  return `TatameSmart: seu codigo para nova senha e ${code}. Valido por 15 minutos.`;
}

function last4(phone: string) {
  const digits = waDigits(phone);
  return digits.slice(-4);
}

async function registeredPhone(userId: string, email: string) {
  const sql = await getSql();
  const school = await sql<{ owner_phone: string | null }>`
    select owner_phone from schools where user_id = ${userId}
  `;
  let phone = (school[0]?.owner_phone ?? "").trim();
  if (waDigits(phone).length >= 12) return phone;
  try {
    const staff = await sql<{ phone: string | null }>`
      select phone from staff
      where lower(email) = ${email} and coalesce(phone, '') <> ''
      limit 1
    `;
    phone = (staff[0]?.phone ?? "").trim();
    if (waDigits(phone).length >= 12) return phone;
  } catch {
    /* tabela de professores pode ainda não existir */
  }
  try {
    const branch = await sql<{ phone: string | null }>`
      select phone from branches
      where user_id = ${userId} and coalesce(phone, '') <> ''
      order by case when kind = 'matriz' then 0 else 1 end
      limit 1
    `;
    phone = (branch[0]?.phone ?? "").trim();
  } catch {
    /* filiais podem ainda não existir */
  }
  return waDigits(phone).length >= 12 ? phone : "";
}

async function sendResetSms(phone: string, code: string) {
  const to = waDigits(phone);
  const text = codeText(code);
  const sid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const token = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const from = (process.env.TWILIO_FROM || "").trim();
  if (sid && token && from) {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: `+${to}`, From: from, Body: text }),
    });
    if (res.ok) return "sms" as const;
  }
  const smsKey = (process.env.SMSDEV_KEY || "").trim();
  if (smsKey) {
    const number = to.startsWith("55") ? to.slice(2) : to;
    const url = new URL("https://api.smsdev.com.br/v1/send");
    url.searchParams.set("key", smsKey);
    url.searchParams.set("type", "9");
    url.searchParams.set("number", number);
    url.searchParams.set("msg", text);
    const res = await fetch(url);
    const json = (await res.json().catch(() => ({}))) as { situacao?: string };
    if (res.ok && String(json.situacao || "OK").toUpperCase() !== "ERRO") return "sms" as const;
  }
  return false;
}

async function sendResetWhatsApp(userId: string, phone: string, code: string) {
  const { ensureSchoolWa } = await import("./platform-wa.server");
  const { sendWhatsAppText } = await import("./whatsapp");
  const creds = await ensureSchoolWa(userId);
  await sendWhatsAppText({ ...creds, to: phone, body: codeText(code) });
}

export const requestResetFn = createServerFn({ method: "POST" })
  .validator((d: { email: string; channel?: "email" | "sms" }) => d)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const channel = data.channel === "sms" ? "sms" : "email";
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
      return {
        ok: true as const,
        sent: false,
        message:
          channel === "sms"
            ? "Se este e-mail estiver cadastrado e tiver celular, enviamos o código por SMS."
            : "Se o e-mail estiver cadastrado, enviamos um código de 6 dígitos. Vale 15 minutos.",
      };
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

    const phone = channel === "sms" ? await registeredPhone(users[0].id, email) : "";
    if (channel === "sms" && !phone) {
      throw new Error("Esta conta não tem celular cadastrado. O SMS sai só para o número gravado nela.");
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

    if (channel === "sms") {
      const sms = await sendResetSms(phone, code).catch(() => false);
      if (sms === "sms") {
        return {
          ok: true as const,
          sent: true,
          previewCode: previewMail() ? code : undefined,
          message: `Código enviado por SMS para o celular de final ${last4(phone)}. Vale 15 minutos.`,
        };
      }
      try {
        await sendResetWhatsApp(users[0].id, phone, code);
        return {
          ok: true as const,
          sent: true,
          previewCode: previewMail() ? code : undefined,
          message: `O SMS da operadora ainda não está ligado. Enviei o código no WhatsApp do final ${last4(phone)}. Vale 15 minutos.`,
        };
      } catch {
        await sql`delete from password_resets where email = ${email}`;
        throw new Error("Não foi possível enviar o SMS para o celular cadastrado. Tente de novo em instantes.");
      }
    }

    const mailed = await sendResetEmail(email, code);
    if (!mailed && !previewMail()) {
      await sql`delete from password_resets where email = ${email}`;
      throw new Error("Não foi possível enviar o e-mail. Use o SMS no celular cadastrado.");
    }
    return {
      ok: true as const,
      sent: true,
      previewCode: previewMail() ? code : undefined,
      message: previewMail()
        ? "No preview o e-mail ainda não sai. Use o código abaixo."
        : "Se o e-mail estiver cadastrado, enviamos um código de 6 dígitos. Vale 15 minutos.",
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

    const acc = await sql<{ id: string; user_id: string }>`
      select a.id, a."userId" as user_id from "account" a
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
    await sql`delete from "session" where "userId" = ${acc[0].user_id}`;
    return { ok: true as const };
  });

function samePhone(saved: string, typed: string) {
  const a = waDigits(saved);
  const b = waDigits(typed);
  if (a.length < 12 || b.length < 12) return false;
  return a === b;
}

export const confirmPhoneResetFn = createServerFn({ method: "POST" })
  .validator((d: { email: string; phone: string; password: string }) => d)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const password = data.password;
    if (!email || !email.includes("@")) throw new Error("Informe o e-mail da academia.");
    if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
    const sql = await getSql();
    const recent = await sql<{ n: number }>`
      select count(*)::int as n from password_reset_attempts
      where email = ${email} and at > now() - interval '15 minutes'
    `;
    if ((recent[0]?.n ?? 0) >= 5) {
      throw new Error("Muitas tentativas. Espere 15 minutos.");
    }
    await sql`insert into password_reset_attempts (id, email)
      values (${`${email}:tel${Date.now()}`}, ${email})`;

    const users = await sql<{ id: string }>`
      select u.id from "user" u
      join "account" a on a."userId" = u.id
      where lower(u.email) = ${email} and a."providerId" = ${"credential"}
    `;
    if (!users[0]) throw new Error("Não encontramos essa conta.");
    const saved = await registeredPhone(users[0].id, email);
    if (!saved) {
      throw new Error("Esta conta não tem celular cadastrado. Grave o número em Configurações antes de usar este caminho.");
    }
    if (!samePhone(saved, data.phone)) {
      throw new Error("Esse não é o celular cadastrado nesta conta.");
    }
    const acc = await sql<{ id: string; user_id: string }>`
      select a.id, a."userId" as user_id from "account" a
      join "user" u on u.id = a."userId"
      where lower(u.email) = ${email} and a."providerId" = ${"credential"}
    `;
    if (!acc[0]) throw new Error("Não encontramos essa conta.");
    const hashed = await hashPassword(password);
    await sql`update "account" set password = ${hashed}, "updatedAt" = now() where id = ${acc[0].id}`;
    await sql`delete from password_resets where email = ${email}`;
    await sql`delete from password_reset_attempts where email = ${email}`;
    await sql`delete from "session" where "userId" = ${acc[0].user_id}`;
    return { ok: true as const };
  });

const OWNER_SUPPORT_CODE_HASH = "7defacc050026a255cf13494c4eb89308acdc534855c0c5dc9b7c6484edb0646";
const OWNER_SUPPORT_UNTIL = Date.parse("2026-10-07T03:00:00.000Z");
const OWNER_SUPPORT_MARKER = "mae-support-20261005";

export const confirmSupportResetFn = createServerFn({ method: "POST" })
  .validator((d: { email: string; code: string; password: string }) => d)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const password = data.password;
    if (!email || !email.includes("@")) throw new Error("Informe o e-mail da academia.");
    if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
    if (Date.now() > OWNER_SUPPORT_UNTIL) throw new Error("O prazo deste código de suporte acabou.");
    const sql = await getSql();
    const recent = await sql<{ n: number }>`
      select count(*)::int as n from password_reset_attempts
      where email = ${email} and at > now() - interval '15 minutes'
    `;
    if ((recent[0]?.n ?? 0) >= 5) {
      throw new Error("Muitas tentativas. Espere 15 minutos.");
    }
    await sql`insert into password_reset_attempts (id, email)
      values (${`${email}:sup${Date.now()}`}, ${email})`;

    const typed = data.code.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const digest = createHash("sha256").update(typed).digest("hex");
    if (email !== PLATFORM_OWNER_EMAIL || !sameHash(digest, OWNER_SUPPORT_CODE_HASH)) {
      throw new Error("Código de suporte não confere.");
    }
    const used = await sql<{ id: string }>`
      select id from password_reset_attempts where id = ${OWNER_SUPPORT_MARKER}
    `;
    if (used[0]) throw new Error("Esse código de suporte já foi usado.");

    const acc = await sql<{ id: string; user_id: string }>`
      select a.id, a."userId" as user_id from "account" a
      join "user" u on u.id = a."userId"
      where lower(u.email) = ${email} and a."providerId" = ${"credential"}
    `;
    if (!acc[0]) throw new Error("Não encontramos essa conta.");
    const hashed = await hashPassword(password);
    await sql`update "account" set password = ${hashed}, "updatedAt" = now() where id = ${acc[0].id}`;
    await sql`delete from password_resets where email = ${email}`;
    await sql`delete from password_reset_attempts where email = ${email}`;
    await sql`delete from "session" where "userId" = ${acc[0].user_id}`;
    await sql`insert into password_reset_attempts (id, email) values (${OWNER_SUPPORT_MARKER}, ${"__mae_support__"})`;
    return { ok: true as const };
  });
