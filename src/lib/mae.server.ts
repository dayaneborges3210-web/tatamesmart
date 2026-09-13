import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { PLATFORM_OWNER_EMAIL } from "@/lib/site";

export const MAE_PASSWORD = "tatame2026";
export const MAE_NAME = "TatameSmart";

export function isMaePassword(raw: string) {
  const n = raw.trim().toLowerCase().replace(/\s/g, "");
  return n === "tatame2026" || n === "tatamemae2026" || n === "tatamemae26" || n === "tatame20126";
}

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
  if (!userId) {
    userId = newId();
    const hashed = await hashPassword(MAE_PASSWORD);
    await sql`
      insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
      values (${userId}, ${MAE_NAME}, ${email}, true, now(), now())
    `;
    await sql`
      insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
      values (${newId()}, ${userId}, ${"credential"}, ${userId}, ${hashed}, now(), now())
    `;
  } else {
    const hashed = await hashPassword(MAE_PASSWORD);
    const acc = await sql<{ id: string }>`
      select id from "account" where "userId" = ${userId} and "providerId" = ${"credential"} limit 1
    `;
    if (!acc[0]) {
      await sql`
        insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
        values (${newId()}, ${userId}, ${"credential"}, ${userId}, ${hashed}, now(), now())
      `;
    } else {
      await sql`update "account" set password = ${hashed}, "updatedAt" = now() where id = ${acc[0].id}`;
    }
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
