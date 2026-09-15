import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { Button, Field, Input } from "@/components/ui";
import { useDojo } from "@/lib/dojo-store";
import type { Modality } from "@/lib/dojo-types";
import { MODALITIES } from "@/lib/dojo-types";
import { WEEKDAYS, addMinutesHHMM, classHours } from "@/lib/money";

export const Route = createFileRoute("/turmas")({ component: TurmasPage });

const DAY_LABEL: Record<string, string> = {
  domingo: "Dom",
  segunda: "Seg",
  terça: "Ter",
  quarta: "Qua",
  quinta: "Qui",
  sexta: "Sex",
  sábado: "Sáb",
};

type Draft = {
  id?: string;
  name: string;
  modality: Modality;
  days: string[];
  time: string;
  timeEnd: string;
  instructor: string;
  capacity: string;
};

const EMPTY: Draft = {
  name: "",
  modality: "Jiu-jitsu",
  days: ["segunda", "quarta", "sexta"],
  time: "19:00",
  timeEnd: "20:30",
  instructor: "",
  capacity: "20",
};

export function TurmasPage() {
  return (
    <Shell>
      <TurmasBody />
    </Shell>
  );
}

function TurmasBody() {
  const { classes, students, staff, addClass, saveClass, deleteClass } = useDojo();
  const [draft, setDraft] = useState<Draft | null>(null);

  function toggleDay(day: string) {
    if (!draft) return;
    setDraft({
      ...draft,
      days: draft.days.includes(day) ? draft.days.filter((d) => d !== day) : [...draft.days, day],
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Grade</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Turmas</h1>
          <p className="mt-1 text-sm text-muted">Dias, horário e professor. A frequência e a grade semanal usam isso.</p>
        </div>
        <Button type="button" onClick={() => setDraft({ ...EMPTY, instructor: staff[0]?.name ?? "" })}>
          Nova turma
        </Button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="min-w-[720px] w-full text-sm">
          <thead className="bg-surface text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-3 font-medium">Horário</th>
              {WEEKDAYS.map((d) => (
                <th key={d} className="px-3 py-3 font-medium capitalize">
                  {DAY_LABEL[d] ?? d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(new Set(classes.map((c) => c.time).sort())).map((slot) => (
              <tr key={slot} className="border-t border-border align-top">
                <td className="px-3 py-3 tabular text-muted">{slot}</td>
                {WEEKDAYS.map((d) => {
                  const cell = classes.filter((c) => c.time === slot && c.days.includes(d));
                  return (
                    <td key={d} className="px-2 py-2">
                      {cell.map((c) => (
                        <p key={c.id} className="mb-1 rounded-sm bg-surface-2 px-2 py-1 text-xs">
                          <span className="font-medium">{c.name}</span>
                          <span className="mt-0.5 block text-muted">
                            {classHours(c.time, c.timeEnd)}
                          </span>
                        </p>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
            {classes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted">
                  Nenhuma turma. Crie a primeira para montar a grade.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {classes.map((c) => {
          const count = students.filter((s) => s.classId === c.id && s.status !== "inativo").length;
          return (
            <li key={c.id} className="rounded-lg border border-border bg-surface p-5">
              <p className="text-xs text-muted">{c.modality}</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">{c.name}</h2>
              <p className="mt-2 text-sm text-muted">
                {c.days.join(", ")} · {classHours(c.time, c.timeEnd)}
              </p>
              <p className="mt-1 text-sm text-muted">{c.instructor}</p>
              <p className="mt-4 tabular text-sm">
                {count} / {c.capacity} vagas
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full bg-accent" style={{ width: `${Math.min(100, (count / c.capacity) * 100)}%` }} />
              </div>
              <div className="mt-4 flex gap-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setDraft({
                    id: c.id,
                    name: c.name,
                    modality: c.modality,
                    days: [...c.days],
                    time: c.time,
                    timeEnd: c.timeEnd || addMinutesHHMM(c.time, 60),
                    instructor: c.instructor,
                    capacity: String(c.capacity),
                  })
                }
              >
                Editar
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (window.confirm(`Excluir a turma ${c.name}? Alunos ficam sem turma.`)) void deleteClass(c.id);
                }}
              >
                Excluir
              </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {draft ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-bg/70 p-0 md:place-items-center md:p-6">
          <form
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-xl border border-border bg-surface p-5 md:rounded-lg"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.name.trim() || draft.days.length === 0) return;
              const payload = {
                name: draft.name.trim(),
                modality: draft.modality,
                days: draft.days,
                time: draft.time,
                timeEnd: draft.timeEnd,
                instructor: draft.instructor.trim(),
                capacity: Number(draft.capacity) || 20,
              };
              const run = draft.id ? saveClass({ ...payload, id: draft.id }) : addClass(payload);
              void run.then(() => setDraft(null));
            }}
          >
            <h2 className="text-lg font-semibold">{draft.id ? "Editar turma" : "Nova turma"}</h2>
            <div className="mt-4 grid gap-3">
              <Field label="Nome">
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
              </Field>
              <Field label="Modalidade">
                <select
                  className="min-h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg"
                  value={draft.modality}
                  onChange={(e) => setDraft({ ...draft, modality: e.target.value as Modality })}
                >
                  {MODALITIES.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <fieldset>
                <legend className="mb-2 text-xs font-medium text-muted">Dias de aula</legend>
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((d) => {
                    const on = draft.days.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(d)}
                        className={`min-h-11 rounded-sm border text-xs ${
                          on ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg text-muted"
                        }`}
                      >
                        {DAY_LABEL[d]}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Início">
                  <Input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} required />
                </Field>
                <Field label="Término">
                  <Input type="time" value={draft.timeEnd} onChange={(e) => setDraft({ ...draft, timeEnd: e.target.value })} required />
                </Field>
              </div>
              <Field label="Professor">
                {staff.length ? (
                  <select
                    className="min-h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg"
                    value={draft.instructor}
                    onChange={(e) => setDraft({ ...draft, instructor: e.target.value })}
                  >
                    <option value="">—</option>
                    {staff.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input value={draft.instructor} onChange={(e) => setDraft({ ...draft, instructor: e.target.value })} />
                )}
              </Field>
              <Field label="Vagas">
                <Input type="number" min={1} value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: e.target.value })} />
              </Field>
            </div>
            <div className="mt-5 flex gap-2">
              <Button type="submit">Salvar</Button>
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
