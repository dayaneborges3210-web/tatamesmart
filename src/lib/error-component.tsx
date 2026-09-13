import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <span className="text-danger" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Algo deu errado</h1>
      <p className="max-w-md text-sm break-words text-muted">
        {error.message?.includes("theme")
          ? "A tela travou ao carregar o visual da academia. Recarregue e entre de novo."
          : error.message || "Não foi possível abrir esta tela."}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-sm bg-accent px-4 text-sm font-medium text-accent-fg"
          onClick={() => {
            try {
              reset();
            } catch {
              window.location.reload();
            }
          }}
        >
          Tentar de novo
        </button>
        <a
          href="/login"
          className="inline-flex min-h-11 items-center rounded-sm border border-border bg-surface px-4 text-sm"
        >
          Voltar ao login
        </a>
      </div>
    </main>
  );
}
