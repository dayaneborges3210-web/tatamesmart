import { createMiddleware } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

export type AcademyActor = {
  ownerId: string;
  sessionUserId: string;
  lockedBranchId: string;
  isStaff: boolean;
};

export async function ensureStaffLoginCols() {
  const sql = await getSql();
  await sql.query(`alter table staff add column if not exists email text not null default ''`);
  await sql.query(`alter table staff add column if not exists login_user_id text not null default ''`);
}

export async function academyOf(sessionUserId: string): Promise<AcademyActor> {
  const sql = await getSql();
  await ensureStaffLoginCols();
  const staff = await sql<{ user_id: string; branch_id: string }>`
    select user_id, branch_id from staff where login_user_id = ${sessionUserId} limit 1
  `;
  if (staff[0]?.user_id) {
    return {
      ownerId: staff[0].user_id,
      sessionUserId,
      lockedBranchId: staff[0].branch_id || "",
      isStaff: true,
    };
  }
  return { ownerId: sessionUserId, sessionUserId, lockedBranchId: "", isStaff: false };
}

export const academyMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    const actor = await academyOf(context.userId);
    return next({
      context: {
        userId: actor.ownerId,
        sessionUserId: actor.sessionUserId,
        lockedBranchId: actor.lockedBranchId,
        isStaff: actor.isStaff,
      },
    });
  });

export const academyWriteMiddleware = createMiddleware({ type: "function" })
  .middleware([academyMiddleware])
  .server(async ({ next, context }) => {
    const { assertAcademyWritable } = await import("./academy-access.server");
    await assertAcademyWritable(context.userId);
    return next();
  });
