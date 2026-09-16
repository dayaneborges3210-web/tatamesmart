import { createFileRoute } from "@tanstack/react-router";
import { academyOf } from "@/lib/academy-actor";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { ensureSchoolWa } from "@/lib/platform-wa.server";
import { SITE_DOMAIN } from "@/lib/site";

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

export const Route = createFileRoute("/api/wa-creds")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!originOk(request)) {
          return Response.json({ message: "Origem inválida." }, { status: 403 });
        }
        const session = await auth.api.getSession({ headers: request.headers });
        const userId = session?.user?.id ?? "";
        if (!userId) return Response.json({ message: "Entre de novo." }, { status: 401 });
        try {
          const branch = new URL(request.url).searchParams.get("branch") || "";
          const actor = await academyOf(userId);
          const creds = await ensureSchoolWa(userId, branch);
          const sql = await getSql();
          const rows = await sql<{ owner_phone: string | null }>`
            select owner_phone from schools where user_id = ${actor.ownerId}
          `;
          const unit = await sql<{ phone: string | null }>`
            select phone from branches where user_id = ${actor.ownerId} and id = ${actor.lockedBranchId || branch} limit 1
          `;
          return Response.json({
            url: creds.url,
            instance: creds.instance,
            token: creds.token,
            ownerPhone: unit[0]?.phone || rows[0]?.owner_phone || "",
          }, { headers: { "Cache-Control": "no-store, private", "Vary": "Cookie, Authorization" } });
        } catch (err) {
          return Response.json(
            { message: err instanceof Error ? err.message : "Sem credenciais." },
            { status: 400 },
          );
        }
      },
    },
  },
});
