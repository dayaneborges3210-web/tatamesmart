import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { Badge, Button, Field, Input } from "@/components/ui";
import { useDojo } from "@/lib/dojo-store";
import type { Championship, Modality } from "@/lib/dojo-types";
import { MODALITIES } from "@/lib/dojo-types";
import { addDaysISO, formatDatePt, todayISO } from "@/lib/money";

export const Route = createFileRoute("/campeonatos")({ component: CampeonatosPage });

type Draft = {
  id?: string;
  name: string;
  place: string;
  modality: Modality;
  date: string;
  time: string;
  participants: string[];
  gold: string;
  silver: string;
  bronze: string;
  trophies: string;
};

function emptyDraft(): Draft {
  return {
    name: "",
    place: "",
    modality: "Jiu-jitsu",
    date: addDaysISO(todayISO(), 14),
    time: "09:00",
    participants: [],
    gold: "0",
    silver: "0",
    bronze: "0",
    trophies: "0",
  };
}

function fromChamp(c: Championship): Draft {
  return {
    id: c.id,
    name: c.name,
    place: c.place,
    modality: c.modality,
    date: c.date,
    time: c.time,
    participants: [...c.participants],
    gold: String(c.gold),
    silver: String(c.silver),
    bronze: String(c.bronze),
    trophies: String(c.trophies),
  };
}

export function CampeonatosPage() {
  return (
    <Shell>
      <CampeonatosBody />
    </Shell>
  );
}

function CampeonatosBody() {
  const { championships, students, addChampionship, saveChampionship } = useDojo();
  const today = todayISO();
  const [draft, setDraft] = useState<Draft | null>(null);
  const active = students.filter((s) => s.status !== "inativo");
  const roster = draft ? active.filter((s) => s.modality === draft.modality) : [];
  const gold = championships.reduce((n, c) => n + c.gold, 0);
  const silver = championships.reduce((n, c) => n + c.silver, 0);
  const bronze = championships.reduce((n, c) => n + c.bronze, 0);
  const trophies = championships.reduce((n, c) => n + c.trophies, 0);
  const upcoming = championships.filter((c) => c.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const done = championships.filter((c) => c.date < today).sort((a, b) => b.date.localeCompare(a.date));

  function toggleAluno(id: string) {
    if (!draft) return;
    setDraft({
      ...draft,
      participants: draft.participants.includes(id)
        ? draft.participants.filter((x) => x !== id)
        : [...draft.participants, id],
    });
  }

  function names(c: Championship) {
    return c.participants
      .map((id) => students.find((s) => s.id === id && s.modality === c.modality)?.name)
      .filter(Boolean)
      .join(", ");
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Tatame</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Campeonatos</h1>
          <p className="mt-1 text-sm text-muted">Datas, alunos inscritos e o quadro de medalhas da academia.</p>
        </div>
        <Button type="button" onClick={() => setDraft(emptyDraft())}>
          Novo campeonato
        </Button>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ouro" value={gold} />
        <Stat label="Prata" value={silver} />
        <Stat label="Bronze" value={bronze} />
        <Stat label="Troféus" value={trophies} />
      </section>

      <h2 className="mt-8 text-sm font-semibold">Próximos</h2>
      {upcoming.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nenhum campeonato marcado. Cadastre a data e o horário.</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {upcoming.map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-surface p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {c.modality} · {formatDatePt(c.date)} · {c.time || "horário a confirmar"}
                    {c.place ? ` · ${c.place}` : ""}
                  </p>
                </div>
                <Button type="button" variant="ghost" onClick={() => setDraft(fromChamp(c))}>
                  Inscrever / editar
                </Button>
              </div>
              <p className="mt-3 text-sm">
                {c.participants.length
                  ? `Alunos: ${names(c)}`
                  : "Nenhum aluno inscrito ainda."}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-sm font-semibold">Quadro de medalhas</h2>
      <p className="mt-1 text-sm text-muted">O que a academia trouxe de cada evento.</p>
      {done.length === 0 && upcoming.filter((c) => c.gold + c.silver + c.bronze + c.trophies > 0).length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nenhuma medalha registrada ainda.</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {[...done, ...upcoming.filter((c) => c.gold + c.silver + c.bronze + c.trophies > 0 && c.date >= today)].map(
            (c) => (
              <li key={c.id} className="rounded-lg border border-border bg-surface p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{c.name}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {c.modality} · {formatDatePt(c.date)}
                      {c.place ? ` · ${c.place}` : ""}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" onClick={() => setDraft(fromChamp(c))}>
                    Registrar resultado
                  </Button>
                </div>
                <p className="mt-3 text-sm">
                  {c.gold} medalhas de ouro · {c.silver} de prata · {c.bronze} de bronze
                  {c.trophies ? ` · ${c.trophies} troféu(s)` : ""}
                </p>
                {c.participants.length ? (
                  <p className="mt-2 text-sm text-muted">Alunos: {names(c)}</p>
                ) : null}
              </li>
            ),
          )}
        </ul>
      )}

      {draft ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-bg/70 p-0 md:place-items-center md:p-6">
          <form
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-border bg-surface p-5 md:rounded-lg"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.name.trim()) return;
              const payload = {
                name: draft.name.trim(),
                place: draft.place.trim(),
                modality: draft.modality,
                date: draft.date,
                time: draft.time,
                participants: draft.participants,
                gold: Number(draft.gold) || 0,
                silver: Number(draft.silver) || 0,
                bronze: Number(draft.bronze) || 0,
                trophies: Number(draft.trophies) || 0,
              };
              const run = draft.id ? saveChampionship({ ...payload, id: draft.id }) : addChampionship(payload);
              void run.then(() => setDraft(null));
            }}
          >
            <h2 className="text-lg font-semibold">{draft.id ? "Editar campeonato" : "Novo campeonato"}</h2>
            <div className="mt-4 grid gap-3">
              <Field label="Nome">
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Campeonato Brasileiro"
                  required
                />
              </Field>
              <Field label="Modalidade">
                <select
                  className="min-h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg"
                  value={draft.modality}
                  onChange={(e) => {
                    const modality = e.target.value as Modality;
                    setDraft({
                      ...draft,
                      modality,
                      participants: draft.participants.filter((id) =>
                        active.some((s) => s.id === id && s.modality === modality),
                      ),
                    });
                  }}
                >
                  {MODALITIES.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="Local">
                <Input
                  value={draft.place}
                  onChange={(e) => setDraft({ ...draft, place: e.target.value })}
                  placeholder="São Paulo, SP"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data">
                  <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />
                </Field>
                <Field label="Horário">
                  <Input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
                </Field>
              </div>

              <fieldset>
                <legend className="mb-2 text-xs font-medium text-muted">
                  Alunos de {draft.modality} que vão participar
                </legend>
                {roster.length === 0 ? (
                  <p className="rounded-sm border border-border p-3 text-sm text-muted">
                    Nenhum aluno cadastrado em {draft.modality}. Cadastre a turma e os alunos dessa luta primeiro.
                  </p>
                ) : (
                  <ul className="max-h-40 overflow-y-auto rounded-sm border border-border">
                    {roster.map((s) => {
                      const on = draft.participants.includes(s.id);
                      return (
                        <li key={s.id} className="border-b border-border last:border-0">
                          <button
                            type="button"
                            onClick={() => toggleAluno(s.id)}
                            className={`flex min-h-11 w-full items-center justify-between px-3 text-left text-sm ${
                              on ? "bg-surface-2 text-fg" : "text-muted"
                            }`}
                          >
                            <span>{s.name}</span>
                            {on ? <Badge>Inscrito</Badge> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-xs font-medium text-muted">Resultado da academia</legend>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Medalhas de ouro">
                    <Input
                      type="number"
                      min={0}
                      value={draft.gold}
                      onChange={(e) => setDraft({ ...draft, gold: e.target.value })}
                    />
                  </Field>
                  <Field label="Medalhas de prata">
                    <Input
                      type="number"
                      min={0}
                      value={draft.silver}
                      onChange={(e) => setDraft({ ...draft, silver: e.target.value })}
                    />
                  </Field>
                  <Field label="Medalhas de bronze">
                    <Input
                      type="number"
                      min={0}
                      value={draft.bronze}
                      onChange={(e) => setDraft({ ...draft, bronze: e.target.value })}
                    />
                  </Field>
                  <Field label="Troféus">
                    <Input
                      type="number"
                      min={0}
                      value={draft.trophies}
                      onChange={(e) => setDraft({ ...draft, trophies: e.target.value })}
                    />
                  </Field>
                </div>
              </fieldset>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 tabular text-xl font-semibold">{value}</p>
    </article>
  );
}
