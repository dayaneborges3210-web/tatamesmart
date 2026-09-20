import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { Badge, Button } from "@/components/ui";
import {
  listAcademiesFn,
  setAccessFn,
  setPlanFn,
  type AcademyAccess,
  type AcademyPlan,
  type AcademyRow,
} from "@/lib/mae-api";
import { isMaeEmail } from "@/lib/site";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatDatePt } from "@/lib/money";

export const Route = createFileRoute("/empresa")({ component: EmpresaPage });

export function EmpresaPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <Shell><p className="text-sm text-muted">Carregando…</p></Shell>;
  if (!isMaeEmail(user?.primaryEmail)) {
    return <Navigate to="/" />;
  }
  return (
    <Shell>
      <EmpresaBody />
    </Shell>
  );
}

function membership(row: AcademyRow) {
  if (row.access === "blocked") return { label: "Bloqueada", tone: "danger" as const };
  if (row.access === "vitalicio") return { label: "Vitalício", tone: "success" as const };
  if (row.plan === "trial") return { label: "Trial", tone: "warning" as const };
  return { label: "Completo", tone: "neutral" as const };
}

function EmpresaBody() {
  const [rows, setRows] = useState<AcademyRow[] | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    void listAcademiesFn()
      .then(setRows)
      .catch((e: unknown) => {
        setRows([]);
        setErr(e instanceof Error ? e.message : "Não carregou.");
      });
  }, []);

  async function run(key: string, work: () => Promise<AcademyRow[]>) {
    setBusy(key);
    setErr("");
    try {
      setRows(await work());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não salvou.");
    } finally {
      setBusy("");
    }
  }

  function setAccess(userId: string, access: AcademyAccess) {
    void run(userId + access, () => setAccessFn({ data: { userId, access } }));
  }

  function setPlan(userId: string, plan: AcademyPlan) {
    void run(userId + plan, () => setPlanFn({ data: { userId, plan } }));
  }

  return (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Empresa mãe</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Academias</h1>
      <p className="mt-1 text-sm text-muted">
        Toda academia que se cadastrou. Trial, Completo R$ 99,00 ou vitalício — e bloqueio pelo UID.
      </p>
      {err ? <p className="mt-3 text-sm text-danger">{err}</p> : null}
      {rows === null ? (
        <p className="mt-6 text-sm text-muted">Carregando academias…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Nenhuma academia cadastrada ainda.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-surface text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Academia</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Desde</th>
                <th className="px-4 py-3 font-medium">UID</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const m = membership(r);
                return (
                  <tr key={r.userId} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.name}</p>
                      <p className="mt-1 text-xs text-muted">{r.email}</p>
                      {r.demo ? <p className="mt-1 text-xs text-subtle">Demonstração</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={m.tone}>{m.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {r.createdAt ? formatDatePt(r.createdAt.slice(0, 10)) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-[11rem] break-all font-mono text-xs text-subtle">{r.userId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="ghost" disabled={!!busy} onClick={() => setPlan(r.userId, "trial")}>
                          Trial
                        </Button>
                        <Button type="button" variant="ghost" disabled={!!busy} onClick={() => setPlan(r.userId, "completo")}>
                          Completo
                        </Button>
                        <Button type="button" variant="ghost" disabled={!!busy} onClick={() => setAccess(r.userId, "vitalicio")}>
                          Vitalício
                        </Button>
                        {r.access === "blocked" ? (
                          <Button type="button" variant="ghost" disabled={!!busy} onClick={() => setAccess(r.userId, "ok")}>
                            Liberar
                          </Button>
                        ) : (
                          <Button type="button" variant="danger" disabled={!!busy} onClick={() => setAccess(r.userId, "blocked")}>
                            Bloquear
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows && rows.length > 0 ? (
        <p className="mt-3 text-xs text-subtle">{rows.length} academia{rows.length === 1 ? "" : "s"} no sistema</p>
      ) : null}
    </>
  );
}
