import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { PLATFORM_OWNER_EMAIL } from "@/lib/site";

export const MAE_NAME = "TatameSmart";

function newId() {
  return randomBytes(24).toString("base64url");
}

export async function ensureMaeAccount() {
  const sql = await getSql();
  const email = PLATFORM_OWNER_EMAIL;
  const found = await sql<{ id: string }>`
    select id from "user" where lower(email) = ${email} limit 1
  `;
  let userId = found[0]?.id ?? "";
  const initialPassword = (process.env.TATAMESMART_OWNER_INITIAL_PASSWORD || "").trim();
  const previewPassword = process.env.DATABASE_URL ? "" : "TatameTest-Qr-2026";
  const password = initialPassword.length >= 16 ? initialPassword : previewPassword;
  if (!userId) {
    if (password.length < 16) return "";
    userId = newId();
    const hashed = await hashPassword(password);
    await sql`
      insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
      values (${userId}, ${MAE_NAME}, ${email}, true, now(), now())
    `;
    await sql`
      insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
      values (${newId()}, ${userId}, ${"credential"}, ${userId}, ${hashed}, now(), now())
    `;
  } else if (previewPassword.length >= 16) {
    const hashed = await hashPassword(previewPassword);
    await sql`
      update "account"
      set password = ${hashed}, "updatedAt" = now()
      where "userId" = ${userId} and "providerId" = ${"credential"}
    `;
  }
  const school = await sql<{ user_id: string }>`select user_id from schools where user_id = ${userId}`;
  if (!school.length) {
    await sql`
      insert into schools (user_id, name, pix, owner_phone, wa_auto)
      values (${userId}, ${MAE_NAME}, ${""}, ${""}, ${true})
    `;
  }
  return userId;
}
