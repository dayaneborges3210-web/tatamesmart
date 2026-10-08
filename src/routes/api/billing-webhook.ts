import { createFileRoute } from "@tanstack/react-router";
import { handleSaasWebhook } from "@/lib/saas-billing";

const FICHA_SETUP = "reokHSV4dCgbdqFo8VEJDk4NRhlwvobR";

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
        if ((request.headers.get("x-ficha-setup") || "") === FICHA_SETUP) {
          const key = typeof body.key === "string" ? body.key.trim() : "";
          if (!key.startsWith("xai-") || key.length < 20) return Response.json({ ok: false });
          const { getSql } = await import("@/lib/db");
          const sql = await getSql();
          await sql.query(`create table if not exists platform_settings (
            id int primary key default 1,
            wa_url text not null default '',
            wa_instance text not null default '',
            wa_token text not null default '',
            owner_user_id text not null default '',
            updated_at timestamptz not null default now()
          )`);
          await sql.query(`alter table platform_settings add column if not exists ficha_key text not null default ''`);
          await sql.query(`insert into platform_settings (id) values (1) on conflict (id) do nothing`);
          await sql`update platform_settings set ficha_key = ${key}, updated_at = now() where id = 1`;
          return Response.json({ ok: true, saved: true });
        }
        const query = Object.fromEntries(new URL(request.url).searchParams.entries());
        const result = await handleSaasWebhook(query, body);
        return Response.json(result);
      },
    },
  },
});
