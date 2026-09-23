import { useEffect, useState } from "react";
import { trialNoticeFn } from "@/lib/saas-billing";
import type { trialNotice } from "@/lib/trial-notice";

export function TrialBanner({ userId }: { userId: string }) {
  const [notice, setNotice] = useState<ReturnType<typeof trialNotice>>(null);
  useEffect(() => {
    let stopped = false;
    const refresh = () => {
      void trialNoticeFn().then((next) => {
        if (stopped) return;
        setNotice(next);
        if (!next?.due) return;
        const key = `tatamesmart-trial:${userId}:${next.date}`;
        try {
          if (sessionStorage.getItem(key)) return;
          sessionStorage.setItem(key, "shown");
        } catch { return; }
        if (window.location.pathname !== "/configuracoes") {
          window.location.assign("/configuracoes#plano");
        } else {
          window.location.hash = "plano";
        }
      }).catch(() => { /* Retry on focus or next interval without disrupting the academy. */ });
    };
    refresh();
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [userId]);
  if (!notice) return null;
  return <aside aria-label="Teste gratuito TatameSmart" className="mb-6 rounded-lg border border-warning bg-surface p-4" role="status">
    <p className="font-semibold">{notice.due ? "Assine o Plano Completo — R$ 99,00/mês" : `Teste gratuito — dia ${notice.day} de 7`}</p>
    <p className="mt-2 text-sm">{notice.message}</p>
    <a className="mt-3 inline-block font-medium underline" href="/configuracoes#plano">Acessar Plano TatameSmart</a>
  </aside>;
}
