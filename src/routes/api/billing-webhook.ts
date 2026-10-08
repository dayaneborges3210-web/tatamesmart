import { createFileRoute } from "@tanstack/react-router";
import { handleSaasWebhook } from "@/lib/saas-billing";

export const Route = createFileRoute("/api/billing-webhook")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true }),
      POST: async ({ request }) => {
        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          body = {};
        }
        const query = Object.fromEntries(new URL(request.url).searchParams.entries());
        const result = await handleSaasWebhook(query, body);
        return Response.json(result);
      },
    },
  },
});
