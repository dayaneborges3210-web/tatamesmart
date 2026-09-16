import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { Button, Field, Input } from "@/components/ui";
import { DueDayPicker } from "@/components/due-day";
import { useDojo } from "@/lib/dojo-store";
import type { Plan } from "@/lib/dojo-types";
import { brl, parseBRL } from "@/lib/money";

export const Route = createFileRoute("/planos")({ component: PlanosPage });

const DURATIONS = [
  { n: 1, label: "Mensal (1 mês)" },
  { n: 3, label: "Trimestral (3 meses)" },
  { n: 6, label: "Semestral (6 meses)" },
  { n: 12, label: "Anual (12 meses)" },
];

function centsField(cents: number) {
  if (!cents) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function PlanosPage() {
  return (
    <Shell>
      <PlanosBody />
    </Shell>
  );
}

function PlanosBody() {
  const { plans, students, branches, branchId, addPlan, savePlan, deletePlan } = useDojo();
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(1);
  const [billing, setBilling] = useState<"mensal" | "unico">("mensal");
  const [amount, setAmount] = useState("180,00");
  const [weekly, setWeekly] = useState("0");
  const [dueDay, setDueDay] = useState(10);
  const [unitId, setUnitId] = useState(branchId);

  const total = parseBRL(amount) * (billing === "mensal" ? duration : 1);

  function reset() {
    setName("");
    setDuration(1);
    setBilling("mensal");
    setAmount("180,00");
    setWeekly("0");
    setDueDay(10);
    setUnitId(branchId);
    setEditing(null);
  }

  function openEdit(p: Plan) {
    setEditing(p);
    setName(p.name);
    setDuration(p.durationMonths);
    setBilling(p.billing);
    setAmount(centsField(p.amount) || "0,00");
    setWeekly(String(p.weeklyLimit));
    setDueDay(p.dueDay);
    setUnitId(p.branchId || branchId);
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Cobrança</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Planos</h1>
          <p className="mt-1 text-sm text-muted">
            Cada unidade tem os próprios planos, valores e vencimento. A mensalidade do aluno nasce do plano desta filial.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setUnitId(branchId || branches.find((b) => b.kind === "matriz")?.id || branches[0]?.id || "");
            setEditing("new");
          }}
        >
          Novo plano
        </Button>
      </div>

      {plans.length === 0 ? (
        <p className="mt-8 max-w-lg text-sm text-muted">
          Ainda não há plano. Crie um, por exemplo «Jiu-jitsu 2x na semana» ou «Kids mensal», com valor e dia de vencimento.
        </p>
      ) : (
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {plans.map((p) => {
            const count = students.filter((s) => s.planId === p.id && s.status !== "inativo").length;
            return (
              <li key={p.id} className="rounded-lg border border-border bg-surface p-5">
                <p className="text-xs text-muted">{p.billing === "unico" ? "Pagamento único" : "Cobrança mensal"}</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">{p.name}</h2>
                {!branchId ? (
                  <p className="mt-1 text-xs text-muted">
                    {branches.find((b) => b.id === p.branchId)?.name || "Matriz"}
                  </p>
                ) : null}
                <p className="mt-3 tabular text-xl">{brl(p.amount)}</p>
                <p className="mt-1 text-sm text-muted">
                  {DURATIONS.find((d) => d.n === p.durationMonths)?.label ?? `${p.durationMonths} meses`} · vence dia {p.dueDay}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {p.weeklyLimit ? `${p.weeklyLimit} treinos por semana` : "Treinos livres"}
                </p>
                <p className="mt-4 text-sm text-muted">{count} aluno{count === 1 ? "" : "s"} neste plano</p>
                <div className="mt-4 flex gap-1">
                  <Button type="button" variant="ghost" onClick={() => openEdit(p)}>
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm(`Excluir o plano ${p.name}? Alunos ficam sem plano.`)) void deletePlan(p.id);
                    }}
                  >
                    Excluir
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-bg/70 p-0 md:place-items-center md:p-6">
          <form
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-xl border border-border bg-surface p-5 md:rounded-lg"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim() || parseBRL(amount) <= 0) return;
              const payload = {
                name: name.trim(),
                durationMonths: duration,
                billing,
                amount: parseBRL(amount),
                weeklyLimit: Number(weekly) || 0,
                dueDay,
                branchId: unitId || branchId,
              };
              const run = editing === "new" ? addPlan(payload) : savePlan({ id: editing.id, ...payload });
              void run.then(reset);
            }}
          >
            <h2 className="text-lg font-semibold">{editing === "new" ? "Novo plano" : "Editar plano"}</h2>
            <div className="mt-4 grid gap-3">
              <Field label="Unidade">
                <select
                  className="min-h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg"
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  disabled={editing !== "new"}
                >
                  {branches.filter((b) => b.active).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.kind === "matriz" ? `Matriz · ${b.name}` : b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nome do plano">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jiu-jitsu 2x na semana" required />
              </Field>
              <Field label="Duração">
                <select
                  className="min-h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                >
                  {DURATIONS.map((d) => (
                    <option key={d.n} value={d.n}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Pagamento">
                <select
                  className="min-h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg"
                  value={billing}
                  onChange={(e) => setBilling(e.target.value as "mensal" | "unico")}
                >
                  <option value="mensal">Cobrança mensal</option>
                  <option value="unico">Pagamento único do período</option>
                </select>
              </Field>
              <Field label={billing === "mensal" ? "Valor da parcela (R$)" : "Valor total (R$)"}>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required />
              </Field>
              {billing === "mensal" ? (
                <p className="text-xs text-muted">
                  Aluno paga {brl(parseBRL(amount))} por mês durante {duration} {duration === 1 ? "mês" : "meses"} (total {brl(total)}).
                </p>
              ) : null}
              <Field label="Limite semanal de treinos (0 = livre)">
                <Input value={weekly} onChange={(e) => setWeekly(e.target.value)} inputMode="numeric" />
              </Field>
              <Field label="Melhor dia de pagamento">
                <DueDayPicker value={dueDay} onChange={setDueDay} />
              </Field>
            </div>
            <div className="mt-5 flex gap-2">
              <Button type="submit">Salvar</Button>
              <Button type="button" variant="ghost" onClick={reset}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
