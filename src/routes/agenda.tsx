import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell } from "@/components/shell";
import { Badge, Button, Field, Input } from "@/components/ui";
import { alarmDue, enableNotifications, formatAlarm, ownerWaLink } from "@/lib/alarms";
import { useDojo } from "@/lib/dojo-store";
import { daysUntil, formatDatePt, todayISO } from "@/lib/money";

export const Route = createFileRoute("/agenda")({ component: AgendaPage });

export function AgendaPage() {
  return (
    <Shell>
      <AgendaBody />
    </Shell>
  );
}

function AgendaBody() {
  const { agenda, addAgenda, toggleAgenda, ownerPhone } = useDojo();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [due, setDue] = useState(todayISO());
  const [alarmAt, setAlarmAt] = useState("");
  const today = todayISO();

  const ordered = useMemo(
    () =>
      [...agenda].sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return (a.alarmAt || a.due).localeCompare(b.alarmAt || b.due);
      }),
    [agenda],
  );
  const pending = ordered.filter((a) => !a.done);
  const todayCount = pending.filter((a) => a.due <= today).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Rotina</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Agenda</h1>
          <p className="mt-1 text-sm text-muted">
            Lembrete com alarme: notificação no celular e WhatsApp do dono.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => void enableNotifications()}>
            Permitir aviso
          </Button>
          <Button type="button" onClick={() => setOpen(true)}>
            Novo lembrete
          </Button>
        </div>
      </div>

      {!ownerPhone ? (
        <p className="mt-4 text-sm text-muted">
          Cadastre o WhatsApp do dono em Configurações para o alarme chegar lá também.
        </p>
      ) : null}

      <p className="mt-4 text-sm text-muted">
        {pending.length === 0
          ? "Nada pendente."
          : `${pending.length} pendente${pending.length === 1 ? "" : "s"}${todayCount ? ` · ${todayCount} para hoje ou atrasado` : ""}`}
      </p>

      <ul className="mt-5 grid gap-2">
        {ordered.map((item) => {
          const late = !item.done && daysUntil(item.due, today) < 0;
          const dueToday = !item.done && item.due === today;
          const ringing = !item.done && item.alarmAt && alarmDue(item.alarmAt);
          const wa =
            ownerPhone && item.alarmAt
              ? ownerWaLink(ownerPhone, item.title, item.note, formatAlarm(item.alarmAt))
              : "";
          return (
            <li
              key={item.id}
              className="flex flex-wrap items-start gap-3 rounded-lg border border-border bg-surface p-4"
            >
              <button
                type="button"
                className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-sm border border-border"
                aria-label={item.done ? "Reabrir" : "Concluir"}
                onClick={() => void toggleAgenda(item.id)}
              >
                <span className={`size-3 rounded-full ${item.done ? "bg-success" : "border border-border"}`} />
              </button>
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${item.done ? "text-muted line-through" : ""}`}>{item.title}</p>
                {item.note ? <p className="mt-1 text-sm text-muted">{item.note}</p> : null}
                <p className="mt-2 tabular text-xs text-subtle">{formatDatePt(item.due)}</p>
                {item.alarmAt ? (
                  <p className={`mt-1 tabular text-xs ${ringing ? "text-danger" : "text-muted"}`}>
                    Alarme {formatAlarm(item.alarmAt)}
                    {item.alarmSent ? " · enviado" : ringing ? " · agora" : ""}
                  </p>
                ) : null}
                {wa && !item.done ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex min-h-11 items-center text-sm text-accent"
                  >
                    Enviar no WhatsApp
                  </a>
                ) : null}
              </div>
              {item.done ? (
                <Badge tone="success">Feito</Badge>
              ) : ringing ? (
                <Badge tone="danger">Alarme</Badge>
              ) : late ? (
                <Badge tone="danger">Atrasado</Badge>
              ) : dueToday ? (
                <Badge tone="warning">Hoje</Badge>
              ) : (
                <Badge>A fazer</Badge>
              )}
            </li>
          );
        })}
      </ul>
      {ordered.length === 0 ? (
        <p className="mt-8 rounded-lg border border-border bg-surface p-6 text-sm text-muted">
          Nenhum lembrete ainda. Use para renovar alvará, comprar material, postar horário.
        </p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-bg/70 p-0 md:place-items-center md:p-6">
          <form
            className="w-full max-w-md rounded-t-xl border border-border bg-surface p-5 md:rounded-lg"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              void addAgenda({
                title: title.trim(),
                note: note.trim(),
                due,
                alarmAt,
              }).then(() => {
                setTitle("");
                setNote("");
                setAlarmAt("");
                setOpen(false);
              });
            }}
          >
            <h2 className="text-lg font-semibold">Novo lembrete</h2>
            <div className="mt-4 grid gap-3">
              <Field label="O que precisa fazer">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </Field>
              <Field label="Detalhe">
                <Input value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <Field label="Dia">
                <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} required />
              </Field>
              <Field label="Alarme (opcional)">
                <Input type="datetime-local" value={alarmAt} onChange={(e) => setAlarmAt(e.target.value)} />
              </Field>
              <p className="text-xs text-subtle">
                Na hora do alarme o celular avisa e o WhatsApp do dono recebe o texto pronto.
              </p>
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
