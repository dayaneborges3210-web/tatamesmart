import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { Button, Field, Input } from "@/components/ui";
import { useDojo } from "@/lib/dojo-store";
import { brl, parseBRL } from "@/lib/money";

export const Route = createFileRoute("/professores")({ component: ProfessoresPage });

const ROLES = ["Professor", "Professora", "Sensei", "Recepção", "Auxiliar"];

export function ProfessoresPage() {
  return (
    <Shell>
      <ProfessoresBody />
    </Shell>
  );
}

function ProfessoresBody() {
  const { staff, classes, addStaff } = useDojo();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Professor");
  const [phone, setPhone] = useState("");
  const [pay, setPay] = useState("");
  const payroll = staff.reduce((n, s) => n + s.pay, 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Equipe</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Professores</h1>
          <p className="mt-1 text-sm text-muted">Quem dá aula, o WhatsApp e o repasse do mês.</p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          Novo professor
        </Button>
      </div>

      <p className="mt-4 text-sm text-muted">
        {staff.length === 0 ? "Nenhum professor ainda." : `${staff.length} na equipe · folha ${brl(payroll)}`}
      </p>

      <ul className="mt-5 grid gap-2">
        {staff.map((p) => {
          const turmas = classes.filter((c) => c.instructor.toLowerCase().includes(p.name.split(" ")[0].toLowerCase()));
          return (
            <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {p.role}
                  {p.phone ? ` · ${p.phone}` : ""}
                </p>
                {turmas.length ? (
                  <p className="mt-1 text-xs text-subtle">{turmas.map((c) => c.name).join(" · ")}</p>
                ) : null}
              </div>
              <p className="tabular text-sm">{brl(p.pay)}/mês</p>
            </li>
          );
        })}
      </ul>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-bg/70 p-0 md:place-items-center md:p-6">
          <form
            className="w-full max-w-md rounded-t-xl border border-border bg-surface p-5 md:rounded-lg"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              void addStaff({
                name: name.trim(),
                role,
                phone: phone.trim(),
                pay: parseBRL(pay),
              }).then(() => {
                setName("");
                setPhone("");
                setPay("");
                setOpen(false);
              });
            }}
          >
            <h2 className="text-lg font-semibold">Novo professor</h2>
            <div className="mt-4 grid gap-3">
              <Field label="Nome">
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field label="Função">
                <select
                  className="min-h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <Field label="WhatsApp">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="62 9...." />
              </Field>
              <Field label="Repasse mensal">
                <Input value={pay} onChange={(e) => setPay(e.target.value)} placeholder="1.800,00" inputMode="decimal" />
              </Field>
            </div>
            <div className="mt-5 flex gap-2">
              <Button type="submit">Salvar</Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
