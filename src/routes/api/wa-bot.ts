import { createFileRoute } from "@tanstack/react-router";
import { runWaBot } from "@/lib/dojo-api";

const WA_BOT_KEY = (process.env.TATAMESMART_BOT_KEY || "").trim();

function keyOk(request: Request) {
  const header = request.headers.get("x-bot-key") || "";
  return Boolean(WA_BOT_KEY) && header === WA_BOT_KEY;
}

export const Route = createFileRoute("/api/wa-bot")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!keyOk(request)) return Response.json({ message: "Chave inválida." }, { status: 401 });
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
        if (!keyOk(request)) return Response.json({ message: "Chave inválida." }, { status: 401 });
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
