import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { Badge, Button } from "@/components/ui";
import { listAcademiesFn, setAccessFn, type AcademyRow } from "@/lib/mae-api";
import { isMaeEmail } from "@/lib/site";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { formatDatePt } from "@/lib/money";

export const Route = createFileRoute("/empresa")({ component: EmpresaPage });

export function EmpresaPage() {
  const user = useCurrentUser();
  if (!isMaeEmail(user?.primaryEmail)) {
    return <Navigate to="/" />;
  }
  return (
    <Shell>
      <EmpresaBody />
    </Shell>
  );
}

function EmpresaBody() {
  const [rows, setRows] = useState<AcademyRow[]>([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    void listAcademiesFn()
      .then(setRows)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Não carregou."));
  }, []);

  async function setAccess(userId: string, access: AcademyRow["access"]) {
    setBusy(userId + access);
    setErr("");
    try {
      setRows(await setAccessFn({ data: { userId, access } }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não salvou.");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Empresa mãe</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Academias</h1>
      <p className="mt-1 text-sm text-muted">
        Libera, bloqueia ou deixa vitalício pelo UID da academia que se cadastrou.
      </p>
      {err ? <p className="mt-3 text-sm text-danger">{err}</p> : null}
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Nenhuma academia cliente ainda.</p>
      ) : (
        <ul className="mt-6 grid gap-2">
          {rows.map((r) => (
            <li key={r.userId} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{r.name || "Sem nome"}</p>
                  <p className="mt-1 text-sm text-muted">{r.email}</p>
                  <p className="mt-1 break-all font-mono text-xs text-subtle">UID {r.userId}</p>
                  {r.createdAt ? (
                    <p className="mt-1 text-xs text-subtle">Desde {formatDatePt(r.createdAt.slice(0, 10))}</p>
                  ) : null}
                </div>
                <Badge tone={r.access === "blocked" ? "danger" : r.access === "vitalicio" ? "success" : "neutral"}>
                  {r.access === "blocked" ? "Bloqueada" : r.access === "vitalicio" ? "Vitalício" : "Ativa"}
                </Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!!busy}
                  onClick={() => void setAccess(r.userId, "ok")}
                >
                  Liberar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!!busy}
                  onClick={() => void setAccess(r.userId, "blocked")}
                >
                  Bloquear
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!!busy}
                  onClick={() => void setAccess(r.userId, "vitalicio")}
                >
                  Vitalício grátis
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
