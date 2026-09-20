import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { Badge, Button } from "@/components/ui";
import { saasCheckoutFn, saasConfirmFn, saasDeskFn, type SaasDesk, type SaasPlan } from "@/lib/saas-billing";
import { PLANS } from "@/lib/plans";
import { isMaeEmail } from "@/lib/site";
import { useCurrentUser, useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatDatePt } from "@/lib/money";
import { useDojo } from "@/lib/dojo-store";

export const Route = createFileRoute("/assinatura")({ component: AssinaturaPage });

export function AssinaturaPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <Shell><p className="text-sm text-muted">Carregando…</p></Shell>;
  if (isMaeEmail(user?.primaryEmail)) return <Navigate to="/empresa" />;
  return (
    <Shell>
      <AssinaturaBody />
    </Shell>
  );
}

function planLabel(plan: string) {
  if (plan === "promaster") return "ProMaster";
  if (plan === "basico") return "Básico";
  return "Trial";
}

function AssinaturaBody() {
  const user = useCurrentUser();
  const { role } = useDojo();
  const [desk, setDesk] = useState<SaasDesk | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (role === "staff") return;
    void saasDeskFn()
      .then(setDesk)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Não carregou a assinatura."));
  }, [role]);

  useEffect(() => {
    const qs = new URLSearchParams(typeof location === "undefined" ? "" : location.search);
    const flag = qs.get("pagamento");
    const paymentId = qs.get("payment_id") || qs.get("collection_id") || "";
    if (!flag && !paymentId) return;
    void saasConfirmFn({ data: { paymentId } })
      .then((next) => {
        setDesk(next);
        setErr("");
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Não confirmou o pagamento."))
      .finally(() => {
        try {
          history.replaceState({}, "", "/assinatura");
        } catch {
          /* ignore */
        }
      });
  }, []);

  async function pay(plan: SaasPlan, method: "pix" | "card") {
    setBusy(plan + method);
    setErr("");
    try {
      const checkout = await saasCheckoutFn({
        data: { plan, method, returnUrl: location.origin + "/" },
      });
      window.location.assign(checkout.checkoutUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não abriu o Mercado Pago.");
      setBusy("");
    }
  }

  if (role === "staff") {
    return <p className="text-sm text-muted">Só o dono da academia gerencia a assinatura do TatameSmart.</p>;
  }

  return (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Sua academia</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Assinatura TatameSmart</h1>
      <p className="mt-1 text-sm text-muted">
        Básico R$ 59,90/mês ou ProMaster R$ 99,90/mês. O plano só muda depois que o Mercado Pago confirmar.
      </p>
      {err ? <p className="mt-3 text-sm text-danger">{err}</p> : null}
      {!desk ? (
        <p className="mt-6 text-sm text-muted">Carregando cobrança…</p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="text-xs text-muted">Situação</p>
              <p className="mt-2 text-xl font-semibold tracking-tight">{planLabel(desk.plan)}</p>
              <p className="mt-1 text-xs text-subtle">
                {desk.access === "vitalicio" ? "Vitalício" : desk.paidUntil ? `Pago até ${formatDatePt(desk.paidUntil)}` : "Aguardando pagamento"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="text-xs text-muted">Mercado Pago</p>
              <p className="mt-2">
                <Badge tone={desk.configured ? "success" : "warning"}>{desk.configured ? "Ligado" : "Ainda não ligado"}</Badge>
              </p>
              <p className="mt-2 text-xs text-subtle">{user?.primaryEmail}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="text-xs text-muted">Última cobrança</p>
              <p className="mt-2 text-sm">
                {desk.payments[0]
                  ? `${desk.payments[0].status === "APPROVED" ? "Aprovada" : desk.payments[0].status === "PENDING" ? "Pendente" : "Não concluída"} · R$ ${(desk.payments[0].amountCents / 100).toFixed(2).replace(".", ",")}`
                  : "Nenhuma ainda"}
              </p>
            </div>
          </div>

          {!desk.configured ? (
            <p className="mt-4 rounded-lg border border-warning/40 bg-surface px-4 py-3 text-sm text-muted">
              O Mercado Pago ainda não está ligado no servidor. Cadastre o token da TatameSmart na hospedagem (Vercel), não no Railway da Corex.
            </p>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {PLANS.map((plan) => {
              const id: SaasPlan = plan.id === "pro" ? "promaster" : "basico";
              const current = desk.plan === id && desk.access !== "blocked";
              return (
                <div key={plan.id} className="rounded-lg border border-border bg-surface p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">{plan.name}</h2>
                      <p className="mt-1 text-2xl font-semibold tracking-tight">
                        R$ {plan.price}
                        <span className="ml-1 text-sm font-normal text-muted">/mês</span>
                      </p>
                    </div>
                    {current ? <Badge tone="success">Plano atual</Badge> : null}
                  </div>
                  <p className="mt-3 text-sm text-muted">{plan.blurb}</p>
                  <ul className="mt-4 grid gap-1.5 text-sm text-muted">
                    {plan.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  {desk.access === "vitalicio" ? (
                    <Button className="mt-5 w-full" variant="ghost" disabled>Vitalício</Button>
                  ) : (
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button type="button" disabled={!!busy || !desk.configured} onClick={() => void pay(id, "pix")}>
                        {busy === id + "pix" ? "Abrindo Pix…" : "Pagar no Pix"}
                      </Button>
                      <Button type="button" variant="ghost" disabled={!!busy || !desk.configured} onClick={() => void pay(id, "card")}>
                        {busy === id + "card" ? "Abrindo cartão…" : "Pagar no cartão"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-subtle">
            Pix libera o mês. Cartão também. A renovação do mês seguinte é um novo pagamento, até a cobrança automática do cartão ficar estável.
          </p>
        </>
      )}
    </>
  );
}
