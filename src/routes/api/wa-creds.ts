import { createFileRoute } from "@tanstack/react-router";
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
          const creds = await ensureSchoolWa(userId);
          const sql = await getSql();
          const rows = await sql<{ owner_phone: string | null }>`
            select owner_phone from schools where user_id = ${userId}
          `;
          return Response.json({
            url: creds.url,
            instance: creds.instance,
            token: creds.token,
            ownerPhone: rows[0]?.owner_phone ?? "",
          });
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
