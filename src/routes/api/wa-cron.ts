import { createFileRoute } from "@tanstack/react-router";
import { runWaBot } from "@/lib/dojo-api";

const WA_BOT_KEY = (process.env.TATAMESMART_BOT_KEY || "").trim();

function keyOk(request: Request) {
  const header = request.headers.get("x-bot-key") || "";
  return Boolean(WA_BOT_KEY) && header === WA_BOT_KEY;
}

function allowed(request: Request) {
  if (keyOk(request)) return true;
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = request.headers.get("authorization") || "";
  if (secret && auth === `Bearer ${secret}`) return true;
  if (!secret && (process.env.TATAMESMART_BOT_KEY || "").trim() && auth === `Bearer ${(process.env.TATAMESMART_BOT_KEY || "").trim()}`) {
    return true;
  }
  if (!secret && request.headers.get("x-vercel-cron") === "1") return true;
  return false;
}

export const Route = createFileRoute("/api/wa-cron")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!allowed(request)) return Response.json({ message: "Chave inválida." }, { status: 401 });
        try {
          const results = await runWaBot();
          return Response.json({ ok: true, at: new Date().toISOString(), results });
        } catch (err) {
          return Response.json(
            { message: err instanceof Error ? err.message : "Bot falhou." },
            { status: 500 },
          );
        }
      },
      POST: async ({ request }) => {
        if (!allowed(request)) return Response.json({ message: "Chave inválida." }, { status: 401 });
        try {
          const results = await runWaBot();
          return Response.json({ ok: true, at: new Date().toISOString(), results });
        } catch (err) {
          return Response.json(
            { message: err instanceof Error ? err.message : "Bot falhou." },
            { status: 500 },
          );
        }
      },
    },
  },
});
