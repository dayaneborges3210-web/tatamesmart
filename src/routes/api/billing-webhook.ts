import { createFileRoute } from "@tanstack/react-router";
import { handleSaasWebhook } from "@/lib/saas-billing";
import { getSql } from "@/lib/db";

async function launchElliaquim() {
  const sql = await getSql();
  const users = await sql<{ id: string }>`
    select id from "user" where lower(email) = ${"pfenixevolution@gmail.com"} limit 1
  `;
  const userId = users[0]?.id;
  if (!userId) return { ok: false as const, error: "sem conta" };
  const name = "Elliaquim Araújo da Silva";
  const existing = await sql<{ id: string }>`
    select id from students where user_id = ${userId} and lower(name) = ${name.toLowerCase()} limit 1
  `;
  if (existing[0]) return { ok: true as const, already: true };
  const matriz = await sql<{ id: string }>`
    select id from branches where user_id = ${userId} and kind = ${"matriz"} limit 1
  `;
  const id = `${userId}:elliaquim-araujo`;
  await sql`insert into students (
      id, user_id, name, phone, modality, belt, degree, class_id, status, joined,
      cpf, address, cep, has_health, health_note, birth, plan_id, due_day, docs, branch_id, scholarship
    ) values (
      ${id},
      ${userId},
      ${name},
      ${"62993967502"},
      ${"Kids"},
      ${"Amarela"},
      ${0},
      ${""},
      ${"ativo"},
      ${"2022-01-01"},
      ${"074.054.601-51"},
      ${"Av. B, Qd 35, Lt 39, Chácara Mellos, Vila São Domingos, Goianira, GO"},
      ${"75373-899"},
      ${false},
      ${""},
      ${"2012-11-27"},
      ${""},
      ${10},
      ${""},
      ${matriz[0]?.id ?? ""},
      ${false}
    )`;
  return { ok: true as const, inserted: true };
}

export const Route = createFileRoute("/api/billing-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = new URL(request.url).searchParams.get("k");
        if (key === "fenix-elliaquim-7c4e9a2b") {
          try {
            return Response.json(await launchElliaquim());
          } catch (err) {
            const message = err instanceof Error ? err.message : "falhou";
            return Response.json({ ok: false, message }, { status: 500 });
          }
        }
        return Response.json({ ok: true });
      },
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
