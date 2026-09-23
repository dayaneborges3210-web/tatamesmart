import { getSql } from "@/lib/db";
import { isMaeEmail } from "@/lib/site";
import { academyReadOnly } from "./trial-notice";

export async function assertAcademyWritable(ownerId: string) {
  const sql = await getSql();
  const rows = await sql<{ email: string; created: Date | string; billing_plan: string; access_status: string; paid_until: Date | string | null }>`
    select u.email, u."createdAt" as created, s.billing_plan, s.access_status, s.paid_until
    from schools s join "user" u on u.id = s.user_id where s.user_id = ${ownerId}
  `;
  const row = rows[0];
  if (row && !isMaeEmail(row.email) && academyReadOnly(row)) {
    throw new Error("Academia em modo somente leitura. O dono deve acessar Configurações → Plano TatameSmart e efetuar o pagamento para liberar as alterações.");
  }
}
