import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell } from "@/components/shell";
import { Badge, Button } from "@/components/ui";
import { useDojo } from "@/lib/dojo-store";
import {
  classDates,
  classHours,
  firstWeekdayOfMonth,
  formatDatePt,
  monthDays,
  monthTitle,
  todayISO,
  weekdayHeaders,
  weekdayPt,
} from "@/lib/money";

export const Route = createFileRoute("/frequencia")({ component: FrequenciaPage });

export function FrequenciaPage() {
  return (
    <Shell>
      <FrequenciaBody />
    </Shell>
  );
}

function FrequenciaBody() {
  const { classes, students, attendance, toggleAttendance } = useDojo();
  const today = todayISO();
  const month = today.slice(0, 7);
  const days = monthDays(month);
  const classDaySet = useMemo(() => {
    const set = new Set<string>();
    for (const c of classes) {
      for (const d of classDates(c.days, month)) set.add(d);
    }
    return set;
  }, [classes, month]);
  const [date, setDate] = useState(today);
  const selected = days.includes(date) ? date : today;
  const weekday = weekdayPt(selected);
  const dayClasses = classes.filter((c) => c.days.includes(weekday));
  const active = students.filter((s) => s.status !== "inativo");
  const pad = firstWeekdayOfMonth(month);
  const cells: (string | null)[] = [...Array(pad).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthRows = active
    .map((s) => {
      const turma = classes.find((c) => c.id === s.classId);
      const sessions = turma ? classDates(turma.days, month, today) : [];
      const recs = attendance.filter(
        (a) => a.studentId === s.id && a.classId === s.classId && a.date.startsWith(month) && a.date <= today,
      );
      const presentes = recs.filter((a) => a.present).length;
      const faltas = recs.filter((a) => !a.present).length;
      return { s, turma, aulas: sessions.length, presentes, faltas };
    })
    .sort((a, b) => b.faltas - a.faltas || a.s.name.localeCompare(b.s.name, "pt-BR"));

  return (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Chamada</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Frequência</h1>
      <p className="mt-1 text-sm text-muted">
        Calendário do mês à esquerda. Dias de cada turma ao lado. Clique no dia para fazer a chamada.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="rounded-lg border border-border bg-surface p-4 md:p-5">
          <h2 className="text-sm font-semibold">{monthTitle(month)}</h2>
          <p className="mt-1 text-xs text-muted">Os 30 dias. Marcado = tem aula.</p>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-muted">
            {weekdayHeaders().map((w, i) => (
              <span key={`${w}-${i}`} className="py-1">
                {w}
              </span>
            ))}
            {cells.map((iso, i) => {
              if (!iso) return <span key={`e-${i}`} />;
              const hasClass = classDaySet.has(iso);
              const on = iso === selected;
              const isToday = iso === today;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setDate(iso)}
                  className={`grid min-h-11 place-items-center rounded-sm border text-sm tabular ${
                    on
                      ? "border-accent bg-accent text-accent-fg"
                      : hasClass
                        ? "border-border bg-surface-2 text-fg"
                        : "border-transparent text-muted hover:border-border hover:text-fg"
                  } ${isToday && !on ? "ring-1 ring-accent" : ""}`}
                >
                  {Number(iso.slice(8))}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">Dia selecionado: {formatDatePt(selected)} · {weekday}</p>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4 md:p-5">
          <h2 className="text-sm font-semibold">Dias de cada aula</h2>
          <p className="mt-1 text-xs text-muted">Grade da turma neste mês.</p>
          <ul className="mt-4 grid gap-4">
            {classes.map((c) => {
              const dates = classDates(c.days, month);
              return (
                <li key={c.id}>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted">
                    {c.days.join(", ")} · {classHours(c.time, c.timeEnd)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {dates.map((d) => {
                      const on = d === selected;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDate(d)}
                          className={`min-h-8 min-w-8 rounded-sm border px-2 tabular text-xs ${
                            on ? "border-accent bg-accent text-accent-fg" : "border-border text-muted hover:text-fg"
                          }`}
                        >
                          {Number(d.slice(8))}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {dayClasses.length === 0 ? (
        <p className="mt-6 rounded-lg border border-border bg-surface p-6 text-sm text-muted">
          {formatDatePt(selected)} não tem aula na grade. Escolha um dia marcado no calendário.
        </p>
      ) : (
        dayClasses.map((c) => {
          const roster = active.filter((s) => s.classId === c.id);
          const presentes = roster.filter((s) =>
            attendance.some((a) => a.studentId === s.id && a.classId === c.id && a.date === selected && a.present),
          );
          return (
            <section key={c.id} className="mt-6 rounded-lg border border-border bg-surface p-4 md:p-5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">
                    {c.name} · {classHours(c.time, c.timeEnd)}
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    {formatDatePt(selected)} · {presentes.length}/{roster.length} presentes
                  </p>
                </div>
                <Badge>{c.instructor}</Badge>
              </div>

              {presentes.length > 0 ? (
                <p className="mt-3 text-sm text-muted">Presentes: {presentes.map((s) => s.name).join(", ")}</p>
              ) : (
                <p className="mt-3 text-sm text-muted">Ninguém marcado ainda nesta aula.</p>
              )}

              <ul className="mt-3 divide-y divide-border">
                {roster.map((s) => {
                  const rec = attendance.find(
                    (a) => a.studentId === s.id && a.classId === c.id && a.date === selected,
                  );
                  const present = rec?.present === true;
                  const absent = rec?.present === false;
                  return (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted">{s.belt}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={present ? "primary" : "ghost"}
                          onClick={() => void toggleAttendance(s.id, c.id, selected, true)}
                        >
                          Presente
                        </Button>
                        <Button
                          type="button"
                          variant={absent ? "danger" : "ghost"}
                          onClick={() => void toggleAttendance(s.id, c.id, selected, false)}
                        >
                          Falta
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold">Faltas de {monthTitle(month)}</h2>
        <p className="mt-1 text-sm text-muted">Aulas da grade até hoje. Só conta falta quando o mestre marca.</p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-surface text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Aluno</th>
                <th className="px-4 py-3 font-medium">Turma</th>
                <th className="px-4 py-3 font-medium">Aulas</th>
                <th className="px-4 py-3 font-medium">Presentes</th>
                <th className="px-4 py-3 font-medium">Faltas</th>
              </tr>
            </thead>
            <tbody>
              {monthRows.map((row) => (
                <tr key={row.s.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{row.s.name}</td>
                  <td className="px-4 py-3 text-muted">{row.turma?.name ?? "—"}</td>
                  <td className="px-4 py-3 tabular">{row.aulas}</td>
                  <td className="px-4 py-3 tabular">{row.presentes}</td>
                  <td className={`px-4 py-3 tabular ${row.faltas ? "text-danger" : ""}`}>{row.faltas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
