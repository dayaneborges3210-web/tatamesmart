import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell } from "@/components/shell";
import { Badge, Button, Field, Input } from "@/components/ui";
import { DueDayPicker } from "@/components/due-day";
import { type Belt, type Modality, type Student, useDojo } from "@/lib/dojo-store";
import { BELTS, clampDegree, formatBelt, maxDegree, STUDENT_DOCS } from "@/lib/dojo-types";
import { brl, formatDatePt } from "@/lib/money";

export const Route = createFileRoute("/alunos")({ component: AlunosPage });

export function AlunosPage() {
  return (
    <Shell>
      <AlunosBody />
    </Shell>
  );
}

function formatCpf(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatCep(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return d.replace(/(\d{5})(\d)/, "$1-$2");
}

async function addressFromCep(cep: string) {
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return "";
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    if (!res.ok) return "";
    const json = (await res.json()) as {
      erro?: boolean;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    if (json.erro) return "";
    return [json.logradouro, json.bairro, json.localidade, json.uf].filter(Boolean).join(", ");
  } catch {
    return "";
  }
}

function AlunosBody() {
  const { students, classes, plans, branches, branchId, addStudent, saveStudent, deleteStudent } = useDojo();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ficha, setFicha] = useState<Student | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [address, setAddress] = useState("");
  const [cep, setCep] = useState("");
  const [cepHint, setCepHint] = useState("");
  const [hasHealth, setHasHealth] = useState(false);
  const [healthNote, setHealthNote] = useState("");
  const [classId, setClassId] = useState(classes[0]?.id ?? "c1");
  const [belt, setBelt] = useState<Belt>("Branca");
  const [degree, setDegree] = useState(0);
  const [birth, setBirth] = useState("");
  const [planId, setPlanId] = useState("");
  const [dueDay, setDueDay] = useState(10);
  const [trial, setTrial] = useState(false);
  const [docs, setDocs] = useState<string[]>([]);
  const [unitId, setUnitId] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return students;
    const digits = t.replace(/\D/g, "");
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(t) ||
        s.modality.toLowerCase().includes(t) ||
        formatBelt(s.belt, s.degree).toLowerCase().includes(t) ||
        (digits && s.cpf.replace(/\D/g, "").includes(digits)) ||
        (digits && s.cep.replace(/\D/g, "").includes(digits)),
    );
  }, [q, students]);

  const cls = classes.find((c) => c.id === classId);

  function resetForm() {
    setName("");
    setPhone("");
    setCpf("");
    setAddress("");
    setCep("");
    setCepHint("");
    setHasHealth(false);
    setHealthNote("");
    setBelt("Branca");
    setDegree(0);
    setBirth("");
    setPlanId("");
    setDueDay(10);
    setTrial(false);
    setDocs([]);
    setUnitId(branchId);
    setEditingId(null);
    setOpen(false);
  }

  function fillStudent(s: Student) {
    setEditingId(s.id);
    setName(s.name);
    setPhone(s.phone);
    setCpf(s.cpf);
    setAddress(s.address);
    setCep(s.cep);
    setCepHint("");
    setHasHealth(s.hasHealth);
    setHealthNote(s.healthNote);
    setClassId(s.classId || classes[0]?.id || "c1");
    setBelt(s.belt);
    setDegree(s.degree);
    setBirth(s.birth);
    setPlanId(s.planId);
    setDueDay(s.dueDay || 10);
    setTrial(s.status === "trial");
    setDocs([...s.docs]);
    setUnitId(s.branchId || branchId);
    setFicha(null);
    setOpen(true);
  }

  function removeStudent(s: Student) {
    if (!window.confirm(`Excluir ${s.name}? Mensalidades em aberto deste aluno saem junto.`)) return;
    void deleteStudent(s.id).then(() => {
      if (ficha?.id === s.id) setFicha(null);
      if (editingId === s.id) resetForm();
    });
  }

  async function onCep(value: string) {
    const next = formatCep(value);
    setCep(next);
    if (next.replace(/\D/g, "").length !== 8) {
      setCepHint("");
      return;
    }
    setCepHint("Buscando endereço…");
    const found = await addressFromCep(next);
    if (found) {
      setAddress(found);
      setCepHint("");
    } else {
      setCepHint("CEP não encontrado. Digite o endereço.");
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Cadastro</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Alunos</h1>
          <p className="mt-1 text-sm text-muted">Matrícula com plano, turma, faixa, documentos e ficha de saúde.</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setUnitId(branchId || branches.find((b) => b.kind === "matriz")?.id || branches[0]?.id || "");
            setOpen(true);
          }}
        >
          Novo aluno
        </Button>
      </div>

      <div className="mt-5 max-w-md">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, CPF ou CEP"
        />
      </div>

      <div className="mt-5 overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-surface text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Aluno</th>
              <th className="px-4 py-3 font-medium">Faixa</th>
              <th className="px-4 py-3 font-medium">CPF</th>
              <th className="px-4 py-3 font-medium">Turma</th>
              <th className="px-4 py-3 font-medium">Plano</th>
              <th className="px-4 py-3 font-medium">Vence</th>
              <th className="px-4 py-3 font-medium">Saúde</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const turma = classes.find((c) => c.id === s.classId);
              return (
                <tr
                  key={s.id}
                  className="cursor-pointer border-t border-border hover:bg-surface-2"
                  onClick={() => setFicha(s)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted">{s.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatBelt(s.belt, s.degree)}</td>
                  <td className="px-4 py-3 tabular text-muted">{s.cpf || "—"}</td>
                  <td className="px-4 py-3 text-muted">{turma?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{plans.find((p) => p.id === s.planId)?.name ?? "—"}</td>
                  <td className="px-4 py-3 tabular text-muted">dia {s.dueDay || 10}</td>
                  <td className="px-4 py-3">
                    {s.hasHealth ? <Badge tone="warning">Restrição</Badge> : <Badge>Nenhuma</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={s.status === "ativo" ? "success" : s.status === "trial" ? "warning" : "neutral"}
                    >
                      {s.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" onClick={() => fillStudent(s)}>
                        Editar
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => removeStudent(s)}>
                        Excluir
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Nenhum aluno encontrado.</p>
        ) : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-bg/70 p-0 md:place-items-center md:p-6">
          <form
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-xl border border-border bg-surface p-5 md:rounded-lg"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim() || !cpf.trim() || !cep.trim() || !address.trim()) return;
              if (hasHealth && !healthNote.trim()) return;
              const payload = {
                name: name.trim(),
                phone,
                classId,
                modality: (cls?.modality ?? "Jiu-jitsu") as Modality,
                belt,
                degree: clampDegree(belt, degree),
                cpf,
                address,
                cep,
                hasHealth,
                healthNote,
                birth,
                planId,
                dueDay,
                docs,
                status: (trial ? "trial" : "ativo") as Student["status"],
                branchId: unitId,
              };
              const run = editingId
                ? saveStudent({ id: editingId, ...payload })
                : addStudent(payload);
              void run.then(resetForm);
            }}
          >
            <h2 className="text-lg font-semibold">{editingId ? "Editar aluno" : "Novo aluno"}</h2>
            <div className="mt-4 grid gap-3">
              <Field label="Nome">
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field label="CPF">
                <Input
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  required
                />
              </Field>
              <Field label="WhatsApp">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="62 9...." />
              </Field>
              <Field label="CEP">
                <Input
                  value={cep}
                  onChange={(e) => void onCep(e.target.value)}
                  placeholder="00000-000"
                  inputMode="numeric"
                  required
                />
              </Field>
              {cepHint ? <p className="text-xs text-muted">{cepHint}</p> : null}
              <Field label="Endereço">
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, número, bairro, cidade"
                  required
                />
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
              <Field label="Turma">
                <select
                  className="min-h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Faixa">
                  <select
                    className="min-h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg"
                    value={belt}
                    onChange={(e) => {
                      const next = e.target.value as Belt;
                      setBelt(next);
                      setDegree((d) => clampDegree(next, d));
                    }}
                  >
                    {BELTS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Grau">
                  <select
                    className="min-h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg"
                    value={degree}
                    disabled={maxDegree(belt) === 0}
                    onChange={(e) => setDegree(clampDegree(belt, Number(e.target.value)))}
                  >
                    {Array.from({ length: maxDegree(belt) + 1 }, (_, n) => (
                      <option key={n} value={n}>
                        {n === 0
                          ? "Sem grau"
                          : belt === "Preta" || belt === "Coral" || belt === "Vermelha"
                            ? `${n}º dan`
                            : `${n}º grau`}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Nascimento">
                <Input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
              </Field>
              <Field label="Plano">
                <select
                  className="min-h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg"
                  value={planId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setPlanId(id);
                    const plan = plans.find((p) => p.id === id);
                    if (plan) setDueDay(plan.dueDay);
                  }}
                >
                  <option value="">Sem plano — valor padrão da modalidade</option>
                  {plans
                    .filter((p) => !unitId || p.branchId === unitId || !p.branchId)
                    .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {brl(p.amount)} · dia {p.dueDay}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Melhor dia de pagamento">
                <DueDayPicker value={dueDay} onChange={setDueDay} />
              </Field>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={trial} onChange={(e) => setTrial(e.target.checked)} />
                Aula experimental
              </label>
              <fieldset>
                <legend className="mb-2 text-xs font-medium text-muted">Documentos solicitados</legend>
                <div className="grid gap-2">
                  {STUDENT_DOCS.map((d) => (
                    <label key={d.id} className="flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={docs.includes(d.id)}
                        onChange={(e) =>
                          setDocs(e.target.checked ? [...docs, d.id] : docs.filter((x) => x !== d.id))
                        }
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-xs font-medium text-muted">Possui algum problema de saúde ou alergia?</legend>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`min-h-11 rounded-sm border text-sm ${hasHealth ? "border-border bg-bg text-muted" : "border-accent bg-surface-2 text-fg"}`}
                    onClick={() => {
                      setHasHealth(false);
                      setHealthNote("");
                    }}
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    className={`min-h-11 rounded-sm border text-sm ${hasHealth ? "border-accent bg-surface-2 text-fg" : "border-border bg-bg text-muted"}`}
                    onClick={() => setHasHealth(true)}
                  >
                    Sim
                  </button>
                </div>
              </fieldset>
              <Field label="Qual problema de saúde ou alergia?">
                <textarea
                  className="min-h-24 w-full resize-y rounded-sm border border-border bg-bg px-3 py-2 text-sm text-fg outline-none placeholder:text-subtle focus:border-accent"
                  value={healthNote}
                  onChange={(e) => {
                    const v = e.target.value;
                    setHealthNote(v);
                    if (v.trim()) setHasHealth(true);
                  }}
                  placeholder="Ex.: asma, lesão no joelho, alergia a dipirona. Deixe em branco se não houver."
                  required={hasHealth}
                />
              </Field>
            </div>
            <div className="mt-5 flex gap-2">
              <Button type="submit">Salvar</Button>
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {ficha ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-bg/70 p-0 md:place-items-center md:p-6" onClick={() => setFicha(null)}>
          <div
            className="w-full max-w-md rounded-t-xl border border-border bg-surface p-5 md:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Ficha</p>
            <h2 className="mt-1 text-lg font-semibold">{ficha.name}</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <Row label="CPF" value={ficha.cpf || "—"} />
              <Row label="WhatsApp" value={ficha.phone || "—"} />
              <Row label="CEP" value={ficha.cep || "—"} />
              <Row label="Endereço" value={ficha.address || "—"} />
              <Row
                label="Problema de saúde ou alergia"
                value={ficha.hasHealth ? ficha.healthNote || "Possui restrição" : "Nenhum informado"}
              />
              <Row label="Faixa" value={formatBelt(ficha.belt, ficha.degree)} />
              <Row label="Plano" value={plans.find((p) => p.id === ficha.planId)?.name ?? "—"} />
              <Row label="Vencimento" value={`Todo dia ${ficha.dueDay || 10}`} />
              <Row label="Nascimento" value={ficha.birth ? formatDatePt(ficha.birth) : "—"} />
              <Row label="Desde" value={formatDatePt(ficha.joined)} />
              <div>
                <p className="text-xs text-muted">Documentos</p>
                <ul className="mt-2 grid gap-2">
                  {STUDENT_DOCS.map((d) => {
                    const on = ficha.docs.includes(d.id);
                    return (
                      <li key={d.id}>
                        <button
                          type="button"
                          className="flex min-h-11 w-full items-center justify-between rounded-sm border border-border px-3 text-left text-sm"
                          onClick={() => {
                            const next = on ? ficha.docs.filter((x) => x !== d.id) : [...ficha.docs, d.id];
                            void saveStudent({ id: ficha.id, docs: next }).then(() =>
                              setFicha({ ...ficha, docs: next }),
                            );
                          }}
                        >
                          <span>{d.label}</span>
                          <span className={on ? "text-success" : "text-muted"}>{on ? "Entregue" : "Pendente"}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" onClick={() => fillStudent(ficha)}>
                Editar
              </Button>
              <Button type="button" variant="ghost" onClick={() => removeStudent(ficha)}>
                Excluir
              </Button>
              <Button type="button" variant="ghost" onClick={() => setFicha(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-fg">{value}</dd>
    </div>
  );
}
