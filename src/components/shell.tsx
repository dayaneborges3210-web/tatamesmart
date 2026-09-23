import { Link, useRouterState } from "@tanstack/react-router";
import { Building2, CalendarCheck, CreditCard, LayoutGrid, Users, Dumbbell, Wallet, CalendarClock, Settings, UserRound, Package, BarChart3, ShoppingBag, Trophy, LogOut, Layers, MessageCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { signOut } from "@/lib/auth/client";
import { useCurrentUser, useCurrentUserState } from "@/lib/auth/use-current-user";
import { isDemoEmail } from "@/lib/demo";
import { isMaeEmail } from "@/lib/site";
import { cn } from "@/lib/cn";
import { invoiceStatus, phaseFor } from "@/lib/cobranca";
import { DojoProvider, useDojo } from "@/lib/dojo-store";
import { TatameLogo } from "@/components/logo";
import { daysUntil, todayISO } from "@/lib/money";
import type { Branch } from "@/lib/dojo-types";
import { activeBranches } from "@/lib/branch-scope";

import { TrialBanner } from "@/components/trial-banner";

const NAV = [
  { to: "/", label: "Painel", icon: LayoutGrid },
  { to: "/mensalidades", label: "Cobrança", icon: CreditCard },
  { to: "/contas", label: "Contas a pagar", icon: Wallet },
  { to: "/agenda", label: "Agenda", icon: CalendarClock },
  { to: "/alunos", label: "Alunos", icon: Users },
  { to: "/planos", label: "Planos", icon: Layers },
  { to: "/turmas", label: "Turmas", icon: Dumbbell },
  { to: "/professores", label: "Professores", icon: UserRound },
  { to: "/estoque", label: "Estoque", icon: Package },
  { to: "/loja", label: "Loja", icon: ShoppingBag },
  { to: "/frequencia", label: "Frequência", icon: CalendarCheck },
  { to: "/campeonatos", label: "Campeonatos", icon: Trophy },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/empresa", label: "Empresa mãe", icon: Building2 },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Shell({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <AppSkeleton />;
  if (!user) return <RedirectToSignIn />;
  return (
    <DojoProvider>
      <ShellInner>{children}</ShellInner>
    </DojoProvider>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useCurrentUser();
  const { school, logo, invoices, reminders, payables, agenda, stock, loading, blocked, waOwner, branches, branchId, setBranch, role, lockedBranchId } = useDojo();
  const [leaving, setLeaving] = useState(false);
  const today = todayISO();
  const queueCount = invoices.filter((inv) => {
    const status = invoiceStatus(inv, today);
    if (status === "paga") return false;
    const phase = phaseFor(daysUntil(inv.due, today));
    if (!phase) return false;
    return !reminders.some((r) => r.invoiceId === inv.id && r.date === today);
  }).length;
  const billCount = payables.filter((p) => p.status !== "paga").length;
  const agendaCount = agenda.filter((a) => !a.done && a.due <= today).length;
  const stockLow = stock.filter((s) => s.qty <= s.minQty).length;

  const mae = waOwner && isMaeEmail(user?.primaryEmail) && role !== "staff";
  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.filter((item) => {
        if (item.to === "/empresa") return mae;
        return true;
      }).map((item) => {
        const active = pathname === item.to;
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            preload={false}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-3 text-sm transition-colors duration-150",
              active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.75} />
            {item.label}
            {item.to === "/mensalidades" && queueCount > 0 ? (
              <span className="ml-auto tabular text-xs text-danger">{queueCount}</span>
            ) : item.to === "/contas" && billCount > 0 ? (
              <span className="ml-auto tabular text-xs text-danger">{billCount}</span>
            ) : item.to === "/agenda" && agendaCount > 0 ? (
              <span className="ml-auto tabular text-xs text-warning">{agendaCount}</span>
            ) : item.to === "/estoque" && stockLow > 0 ? (
              <span className="ml-auto tabular text-xs text-danger">{stockLow}</span>
            ) : active ? (
              <span className="ml-auto h-4 w-0.5 rounded-full bg-accent" />
            ) : null}
          </Link>
        );
      })}
      <a
        href="https://wa.me/5562992289560"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Suporte pelo WhatsApp (abre em nova aba)"
        className="flex min-h-11 items-center gap-3 rounded-sm px-3 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <MessageCircle className="size-4 shrink-0" strokeWidth={1.75} />
        Suporte
      </a>
    </nav>
  );

  const sair = (
    <button
      type="button"
      disabled={leaving}
      onClick={() => {
        setLeaving(true);
        void signOut("/login").catch(() => setLeaving(false));
      }}
      className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left text-sm text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-40"
    >
      <LogOut className="size-4 shrink-0" strokeWidth={1.75} />
      {leaving ? "Saindo…" : "Sair"}
    </button>
  );

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-52 flex-col border-r border-border bg-bg sm:w-56">
        <div className="flex items-center gap-2 border-b border-border px-4 py-4">
          {logo ? (
            <>
              <BrandMark school={school} logo={logo} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold tracking-tight">{loading ? "…" : school || "TatameSmart"}</p>
                <BranchSwitch branches={branches} branchId={branchId} onChange={setBranch} locked={Boolean(lockedBranchId)} />
              </div>
            </>
          ) : (
            <div className="min-w-0 flex-1">
              <TatameLogo compact title={loading ? "…" : school || "TATAMESMART"} />
              <BranchSwitch branches={branches} branchId={branchId} onChange={setBranch} locked={Boolean(lockedBranchId)} />
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{nav}</div>
        <div className="border-t border-border p-3">{sair}</div>
      </aside>

      <main className="pl-52 sm:pl-56">
        {isDemoEmail(user?.primaryEmail) ? (
          <p className="border-b border-border bg-surface px-4 py-2 text-center text-xs text-muted md:px-8">
            Demonstração com alunos de exemplo. Nada aqui é academia real.
          </p>
        ) : null}
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          {!loading && !blocked && !isMaeEmail(user?.primaryEmail) && !isDemoEmail(user?.primaryEmail) && user ? <TrialBanner userId={user.id} /> : null}
          {blocked ? (
            <div className="rounded-lg border border-border bg-surface p-6">
              <h1 className="text-xl font-semibold">Acesso bloqueado</h1>
              <p className="mt-2 text-sm text-muted">
                Esta academia está bloqueada pela TatameSmart. Fale com o suporte.
              </p>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}

function BrandMark({ school, logo }: { school: string; logo: string }) {
  if (logo) {
    return <img src={logo} alt="" className="size-8 shrink-0 rounded-sm object-cover" />;
  }
  const letter = (school.trim()[0] || "T").toUpperCase();
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-accent text-xs font-semibold text-accent-fg">
      {letter}
    </span>
  );
}

function BranchSwitch({
  branches,
  branchId,
  onChange,
  locked,
}: {
  branches: Branch[];
  branchId: string;
  onChange: (id: string) => void;
  locked?: boolean;
}) {
  const live = activeBranches(branches);
  const current = live.find((b) => b.id === branchId);
  if (!live.length) return <p className="text-xs text-muted">TatameSmart</p>;
  if (locked) {
    return (
      <p className="mt-1 truncate text-xs text-muted">
        {current ? (current.kind === "matriz" ? `Matriz · ${current.name}` : current.name) : "Filial"}
      </p>
    );
  }
  return (
    <select
      className="mt-1 w-full truncate rounded-sm border-0 bg-transparent p-0 text-xs text-muted outline-none"
      value={branchId}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Unidade"
    >
      {live.length > 1 ? <option value="">Todas as unidades</option> : null}
      {live.map((b) => (
        <option key={b.id} value={b.id}>
          {b.kind === "matriz" ? `Matriz · ${b.name}` : b.name}
        </option>
      ))}
    </select>
  );
}

function AppSkeleton() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-52 flex-col border-r border-border bg-bg sm:w-56">
        <div className="flex items-center gap-2 border-b border-border px-4 py-4">
          <span className="grid size-8 place-items-center rounded-sm border border-border text-xs font-semibold tracking-tight">
            TS
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight">TatameSmart</p>
            <p className="h-3 w-24 animate-pulse rounded-sm bg-surface-2" />
          </div>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {NAV.map((item) => (
            <span key={item.to} className="flex min-h-11 items-center gap-3 rounded-sm px-3 text-sm text-muted">
              <item.icon className="size-4 shrink-0" strokeWidth={1.75} />
              {item.label}
            </span>
          ))}
        </nav>
      </aside>
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-bg px-4 py-3 md:hidden">
        <p className="text-sm font-semibold">TatameSmart</p>
      </header>
      <main className="pl-52 sm:pl-56">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Painel</p>
          <div className="mt-3 h-8 w-56 animate-pulse rounded-sm bg-surface-2" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg border border-border bg-surface" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
