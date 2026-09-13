import { createFileRoute } from "@tanstack/react-router";
import { runWaBot } from "@/lib/dojo-api";

export const WA_BOT_KEY = process.env.TATAMESMART_BOT_KEY || "tatame-bot-2026-mae";

function keyOk(request: Request) {
  const header = request.headers.get("x-bot-key") || "";
  const url = new URL(request.url);
  const q = url.searchParams.get("key") || "";
  return header === WA_BOT_KEY || q === WA_BOT_KEY;
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
