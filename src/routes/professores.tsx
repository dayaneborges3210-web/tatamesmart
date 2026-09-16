import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { Button, Field, Input, PasswordInput } from "@/components/ui";
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
  const { staff, classes, branches, branchId, role, addStaff, saveStaff, deleteStaff } = useDojo();
  const [editing, setEditing] = useState<(typeof staff)[number] | "new" | null>(null);
  const [name, setName] = useState("");
  const [roleName, setRoleName] = useState("Professor");
  const [phone, setPhone] = useState("");
  const [pay, setPay] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [unitId, setUnitId] = useState(branchId);
  const payroll = staff.reduce((n, s) => n + s.pay, 0);
  const owner = role !== "staff";

  function reset() {
    setName("");
    setRoleName("Professor");
    setPhone("");
    setPay("");
    setEmail("");
    setPassword("");
    setUnitId(branchId);
    setEditing(null);
  }

  function openEdit(p: (typeof staff)[number]) {
    setEditing(p);
    setName(p.name);
    setRoleName(p.role);
    setPhone(p.phone);
    setPay(p.pay ? (p.pay / 100).toFixed(2).replace(".", ",") : "");
    setEmail(p.email);
    setPassword("");
    setUnitId(p.branchId || branchId);
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Equipe</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Professores</h1>
          <p className="mt-1 text-sm text-muted">
            O professor da filial entra com o e-mail dele e lê o QR do WhatsApp daquela unidade.
          </p>
        </div>
        {owner ? (
          <Button type="button" onClick={() => setEditing("new")}>
            Novo professor
          </Button>
        ) : null}
      </div>

      <p className="mt-4 text-sm text-muted">
        {staff.length === 0 ? "Nenhum professor ainda." : `${staff.length} na equipe · folha ${brl(payroll)}`}
      </p>

      <ul className="mt-5 grid gap-2">
        {staff.map((p) => {
          const turmas = classes.filter((c) => c.instructor.toLowerCase().includes(p.name.split(" ")[0].toLowerCase()));
          const unit = branches.find((b) => b.id === p.branchId);
          return (
            <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {p.role}
                  {p.phone ? ` · ${p.phone}` : ""}
                  {unit ? ` · ${unit.name}` : ""}
                </p>
                <p className="mt-1 text-xs text-subtle">
                  {p.hasLogin ? `Entra com ${p.email}` : "Sem login da filial"}
                </p>
                {turmas.length ? (
                  <p className="mt-1 text-xs text-subtle">{turmas.map((c) => c.name).join(" · ")}</p>
                ) : null}
              </div>
              <p className="tabular text-sm">{brl(p.pay)}/mês</p>
              {owner ? (
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" onClick={() => openEdit(p)}>
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm(`Excluir ${p.name}?`)) void deleteStaff(p.id);
                    }}
                  >
                    Excluir
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {editing && owner ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-bg/70 p-0 md:place-items-center md:p-6">
          <form
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-xl border border-border bg-surface p-5 md:rounded-lg"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              const payload = {
                name: name.trim(),
                role: roleName,
                phone: phone.trim(),
                pay: parseBRL(pay),
                branchId: unitId,
                email: email.trim(),
                password: password.trim(),
              };
              const run = editing === "new" ? addStaff(payload) : saveStaff({ id: editing.id, ...payload });
              void run.then(reset);
            }}
          >
            <h2 className="text-lg font-semibold">{editing === "new" ? "Novo professor" : "Editar professor"}</h2>
            <div className="mt-4 grid gap-3">
              <Field label="Nome">
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field label="Função">
                <select
                  className="min-h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <Field label="Unidade">
                <select
                  className="min-h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg"
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                >
                  {branches.filter((b) => b.active).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.kind === "matriz" ? `Matriz · ${b.name}` : b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="WhatsApp">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="62 9...." />
              </Field>
              <Field label="Repasse mensal">
                <Input value={pay} onChange={(e) => setPay(e.target.value)} placeholder="1.800,00" inputMode="decimal" />
              </Field>
              <Field label="E-mail de acesso da filial">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="professor@academia.com"
                  autoComplete="off"
                />
              </Field>
              <Field label={editing === "new" ? "Senha de acesso" : "Nova senha (se quiser trocar)"}>
                <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </Field>
              <p className="text-xs text-muted">
                Com e-mail e senha, o professor entra no TatameSmart, vê só a filial dele e lê o QR do WhatsApp da unidade no celular.
              </p>
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