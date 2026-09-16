import { academyOf } from "@/lib/academy-actor";
import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { ensureSchoolWa } from "@/lib/platform-wa.server";
import { SITE_DOMAIN } from "@/lib/site";
import { evolutionQr, sendWhatsAppText } from "@/lib/whatsapp";

function originOk(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname;
    return (
      host === SITE_DOMAIN ||
      host === `www.${SITE_DOMAIN}` ||
      host.endsWith(".grok.me") ||
      host.endsWith(".grok-sandbox.com") ||
      host === "localhost" ||
      host === "127.0.0.1"
    );
  } catch {
    return false;
  }
}

async function sessionUserId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? "";
}

async function platformCreds(userId: string, branchId?: string) {
  return ensureSchoolWa(userId, branchId);
}

export const Route = createFileRoute("/api/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!originOk(request)) {
          return Response.json({ message: "Origem inválida." }, { status: 403 });
        }
        const userId = await sessionUserId(request);
        if (!userId) return Response.json({ message: "Entre de novo." }, { status: 401 });
        let body: { action?: string; branchId?: string } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          body = {};
        }
        try {
          const creds = await platformCreds(userId, body.branchId);
          if (body.action === "test") {
            const actor = await academyOf(userId);
            const sql = await getSql();
            const rows = await sql<{ name: string; owner_phone: string | null }>`
              select name, owner_phone from schools where user_id = ${actor.ownerId}
            `;
            if (!rows[0]?.owner_phone) {
              throw new Error("Cadastre o WhatsApp do dono em Identidade.");
            }
            await sendWhatsAppText({
              ...creds,
              to: rows[0].owner_phone,
              body: `TatameSmart: o WhatsApp da ${rows[0].name} está no ar.`,
            });
            return Response.json({ ok: true });
          }
          const qr = await evolutionQr(creds);
          return Response.json(qr);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Falha no WhatsApp.";
          return Response.json({ message }, { status: 400 });
        }
      },
    },
  },
});
