import { randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { academyOf } from "@/lib/academy-actor";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { mpConfigured, mpFetch } from "@/lib/mp";
import { isMaeEmail, SITE_URL } from "@/lib/site";

export const SAAS_PRICE_CENTS = { basico: 5990, promaster: 9990 } as const;
export type SaasPlan = keyof typeof SAAS_PRICE_CENTS;
export type SaasMethod = "pix" | "card";

export type SaasDesk = {
  configured: boolean;
  plan: "trial" | "basico" | "promaster";
  access: "ok" | "blocked" | "vitalicio";
  paidUntil: string | null;
  payments: {
    id: string;
    plan: string;
    method: string;
    amountCents: number;
    status: string;
    createdAt: string;
  }[];
};

function newId() {
  return randomBytes(18).toString("hex");
}

function asPlan(v: string | null | undefined): SaasPlan {
  return v === "basico" ? "basico" : "promaster";
}

async function ensureBilling() {
  const sql = await getSql();
  await sql.query(`alter table schools add column if not exists billing_plan text not null default 'basico'`).catch(() => undefined);
  await sql.query(`alter table schools add column if not exists access_status text not null default 'ok'`).catch(() => undefined);
  await sql.query(`alter table schools add column if not exists paid_until date`).catch(() => undefined);
  await sql.query(`alter table schools add column if not exists mp_preapproval_id text`).catch(() => undefined);
  await sql.query(`
    create table if not exists saas_payments (
      id text primary key,
      user_id text not null,
      plan text not null,
      method text not null,
      amount_cents integer not null,
      status text not null default 'PENDING',
      preference_id text,
      checkout_url text,
      mp_payment_id text unique,
      mp_status text,
      paid_at timestamptz,
      created_at timestamptz not null default now()
    )
  `).catch(() => undefined);
}

async function requireOwner(sessionUserId: string) {
  const actor = await academyOf(sessionUserId);
  if (actor.isStaff) throw new Error("Só o dono da academia assina o TatameSmart.");
  const sql = await getSql();
  const me = await sql<{ email: string | null }>`select email from "user" where id = ${sessionUserId}`;
  if (isMaeEmail(me[0]?.email)) throw new Error("A empresa mãe não assina o próprio sistema.");
  return actor.ownerId;
}

function backUrl(returnUrl?: string) {
  const raw = (returnUrl || "").trim();
  if (/^https:\/\//i.test(raw)) {
    try {
      return new URL(raw).origin;
    } catch {
      /* site */
    }
  }
  return SITE_URL;
}

async function deskOf(userId: string): Promise<SaasDesk> {
  const sql = await getSql();
  await ensureBilling();
  const school = await sql<{ billing_plan: string | null; access_status: string | null; paid_until: Date | string | null }>`
    select billing_plan, access_status, paid_until from schools where user_id = ${userId}
  `;
  const payments = await sql<{
    id: string;
    plan: string;
    method: string;
    amount_cents: number;
    status: string;
    created_at: Date | string;
  }>`
    select id, plan, method, amount_cents, status, created_at
    from saas_payments
    where user_id = ${userId}
    order by created_at desc
    limit 8
  `;
  const paid = school[0]?.paid_until;
  return {
    configured: mpConfigured(),
    plan: school[0]?.billing_plan === "trial" || school[0]?.billing_plan === "promaster" || school[0]?.billing_plan === "basico"
      ? school[0].billing_plan
      : "trial",
    access: school[0]?.access_status === "blocked" || school[0]?.access_status === "vitalicio" ? school[0].access_status : "ok",
    paidUntil: paid ? new Date(paid).toISOString().slice(0, 10) : null,
    payments: payments.map((p) => ({
      id: p.id,
      plan: p.plan,
      method: p.method,
      amountCents: p.amount_cents,
      status: p.status,
      createdAt: new Date(p.created_at).toISOString(),
    })),
  };
}

export const saasDeskFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = await requireOwner(context.userId);
    return deskOf(userId);
  });

export const saasCheckoutFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { plan: SaasPlan; method: SaasMethod; returnUrl?: string }) => d)
  .handler(async ({ context, data }) => {
    const userId = await requireOwner(context.userId);
    if (!mpConfigured()) throw new Error("A TatameSmart ainda não ligou o Mercado Pago no servidor.");
    const plan = asPlan(data.plan);
    const method: SaasMethod = data.method === "pix" ? "pix" : "card";
    const amountCents = SAAS_PRICE_CENTS[plan];
    const sql = await getSql();
    await ensureBilling();
    const school = await sql<{ name: string | null; access_status: string | null }>`
      select name, access_status from schools where user_id = ${userId}
    `;
    if (school[0]?.access_status === "blocked") throw new Error("Academia bloqueada. Fale com a TatameSmart.");
    if (school[0]?.access_status === "vitalicio") throw new Error("Esta academia já está no vitalício.");
    const user = await sql<{ email: string | null; name: string | null }>`select email, name from "user" where id = ${userId}`;
    const id = newId();
    await sql`
      insert into saas_payments (id, user_id, plan, method, amount_cents, status)
      values (${id}, ${userId}, ${plan}, ${method.toUpperCase()}, ${amountCents}, ${"PENDING"})
    `;
    const origin = backUrl(data.returnUrl);
    const title = plan === "basico" ? "TatameSmart Básico — mensalidade" : "TatameSmart ProMaster — mensalidade";
    const email = (user[0]?.email || "").trim();
    if (method === "card") {
      if (!email.includes("@")) throw new Error("A academia precisa de e-mail para assinar no cartão.");
      const sub = await mpFetch<{ id: string; init_point?: string; status?: string }>(
        "/preapproval",
        {
          method: "POST",
          body: JSON.stringify({
            reason: title,
            external_reference: `${userId}:${plan}:${id}`,
            payer_email: email,
            auto_recurring: {
              frequency: 1,
              frequency_type: "months",
              transaction_amount: amountCents / 100,
              currency_id: "BRL",
            },
            back_url: `${origin}/assinatura?pagamento=ok`,
            status: "pending",
          }),
        },
      );
      const checkoutUrl = sub.init_point;
      if (!checkoutUrl) throw new Error("O Mercado Pago não devolveu o link da assinatura.");
      await sql`
        update saas_payments set preference_id = ${sub.id}, checkout_url = ${checkoutUrl} where id = ${id}
      `;
      return { paymentId: id, checkoutUrl, plan, method, amountCents };
    }
    const excluded = [{ id: "credit_card" }, { id: "debit_card" }, { id: "ticket" }, { id: "atm" }];
    const preference = await mpFetch<{ id: string; init_point?: string; sandbox_init_point?: string }>(
      "/checkout/preferences",
      {
        method: "POST",
        body: JSON.stringify({
          items: [
            {
              id: `${plan}-monthly`,
              title,
              description: "Assinatura mensal TatameSmart",
              quantity: 1,
              currency_id: "BRL",
              unit_price: amountCents / 100,
            },
          ],
          payer: { email: email || undefined, name: school[0]?.name || user[0]?.name || "Academia" },
          payment_methods: { excluded_payment_types: excluded, installments: 1 },
          back_urls: {
            success: `${origin}/assinatura?pagamento=ok`,
            failure: `${origin}/assinatura?pagamento=falhou`,
            pending: `${origin}/assinatura?pagamento=pendente`,
          },
          auto_return: "approved",
          notification_url: `${SITE_URL}/api/billing-webhook`,
          external_reference: `${userId}:${plan}:${id}`,
          metadata: { userId, plan, paymentId: id, method },
          statement_descriptor: "TATAMESMART",
        }),
      },
    );
    const checkoutUrl = preference.init_point || preference.sandbox_init_point;
    if (!checkoutUrl) throw new Error("O Mercado Pago não devolveu o link de pagamento.");
    await sql`
      update saas_payments set preference_id = ${preference.id}, checkout_url = ${checkoutUrl} where id = ${id}
    `;
    return { paymentId: id, checkoutUrl, plan, method, amountCents };
  });

export const saasConfirmFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { paymentId?: string }) => d)
  .handler(async ({ context, data }) => {
    const userId = await requireOwner(context.userId);
    const mpId = (data.paymentId || "").trim();
    if (mpId) await applyMercadoPagoPayment(mpId, userId);
    return deskOf(userId);
  });

export async function applyMercadoPagoPayment(mpPaymentId: string, expectedUserId?: string) {
  await ensureBilling();
  const mp = await mpFetch<{
    id: number | string;
    status?: string;
    currency_id?: string;
    transaction_amount?: number;
    external_reference?: string;
    date_approved?: string;
  }>(`/v1/payments/${encodeURIComponent(mpPaymentId)}`);
  const reference = String(mp.external_reference || "");
  const [userId, planRaw, paymentId] = reference.split(":");
  if (!userId || !paymentId) return { ignored: "reference" };
  if (expectedUserId && expectedUserId !== userId) return { ignored: "tenant" };
  const plan = asPlan(planRaw);
  const amountCents = SAAS_PRICE_CENTS[plan];
  if (mp.currency_id && mp.currency_id !== "BRL") return { ignored: "currency" };
  if (mp.transaction_amount != null && Math.round(Number(mp.transaction_amount) * 100) !== amountCents) {
    return { ignored: "amount" };
  }
  const sql = await getSql();
  const row = await sql<{ id: string; user_id: string }>`
    select id, user_id from saas_payments where id = ${paymentId} and user_id = ${userId} limit 1
  `;
  if (!row[0]) return { ignored: "payment" };
  const status = String(mp.status || "").toLowerCase();
  const mapped = status === "approved" ? "APPROVED" : status === "rejected" || status === "cancelled" ? "REJECTED" : "PENDING";
  const paidAt = mapped === "APPROVED" ? new Date() : null;
  await sql`
    update saas_payments
    set mp_payment_id = ${String(mp.id)}, mp_status = ${status}, status = ${mapped}, paid_at = ${paidAt}
    where id = ${row[0].id}
  `;
  if (mapped !== "APPROVED") return { status: mapped };
  const until = new Date(Date.now() + 32 * 86_400_000).toISOString().slice(0, 10);
  await sql`
    update schools
    set billing_plan = ${plan}, access_status = ${"ok"}, paid_until = ${until}
    where user_id = ${userId}
  `;
  return { status: "APPROVED", userId, plan };
}

export async function handleSaasWebhook(query: Record<string, unknown>, body: Record<string, unknown>) {
  const type = String(body.type || body.topic || query.type || query.topic || "").toLowerCase();
  const data = (body.data && typeof body.data === "object" ? body.data : {}) as Record<string, unknown>;
  const id = String(data.id || body.id || query.id || query["data.id"] || "");
  if (!id) return { received: true };
  try {
    if (type.includes("preapproval") || type.includes("subscription")) {
      const sub = await mpFetch<{
        id: string;
        status?: string;
        external_reference?: string;
      }>(`/preapproval/${encodeURIComponent(id)}`);
      const reference = String(sub.external_reference || "");
      const [userId, planRaw] = reference.split(":");
      if (userId && (sub.status === "authorized" || sub.status === "paused")) {
        const plan = asPlan(planRaw);
        const until = new Date(Date.now() + 32 * 86_400_000).toISOString().slice(0, 10);
        const sql = await getSql();
        await sql`
          update schools
          set billing_plan = ${plan}, access_status = ${"ok"}, paid_until = ${until}, mp_preapproval_id = ${String(sub.id)}
          where user_id = ${userId}
        `;
      }
      return { received: true };
    }
    if (!type || type.includes("payment")) await applyMercadoPagoPayment(id);
  } catch {
    /* conciliação no retorno da academia */
  }
  return { received: true };
}
