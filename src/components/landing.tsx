import { Link } from "@tanstack/react-router";
import { TatameLogo } from "@/components/logo";
import { Button } from "@/components/ui";
import { PLANS } from "@/lib/plans";
import { SITE_DOMAIN, SITE_MAIL } from "@/lib/site";

const BLOCKS = [
  { title: "Alunos", text: "Ficha, faixa, turma, saúde e aniversário. Cada academia vê só a própria lista." },
  { title: "Cobrança", text: "Régua de mensalidade no WhatsApp: 5 dias antes, no vencimento e no atraso." },
  { title: "Frequência", text: "Calendário do mês, chamada por aula e faltas no fechamento." },
  { title: "Operação", text: "Turmas, professores, loja, estoque, contas, agenda e campeonatos." },
];

export function Landing() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5">
        <TatameLogo compact />
        <div className="flex items-center gap-2">
          <Link to="/login" className="hidden min-h-11 items-center px-3 text-sm text-muted hover:text-fg sm:inline-flex">
            Entrar
          </Link>
          <Link to="/login">
            <Button>Criar academia</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20">
        <section className="grid gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:py-16">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">SaaS para academias de luta</p>
            <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
              A academia no controle. A mensalidade no WhatsApp do aluno.
            </h1>
            <p className="mt-4 max-w-lg text-base text-muted">
              TatameSmart é o sistema da sua escola — alunos, turmas, frequência, loja e cobrança — com cada academia isolada da outra.
            </p>
            <p className="mt-3 text-sm text-subtle">{SITE_DOMAIN}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login">
                <Button>Criar minha academia</Button>
              </Link>
              <Link to="/login">
                <Button variant="ghost">Ver demonstração</Button>
              </Link>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {BLOCKS.map((b) => (
              <li key={b.title} className="rounded-lg border border-border bg-surface p-4">
                <p className="text-sm font-medium">{b.title}</p>
                <p className="mt-2 text-sm text-muted">{b.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="planos" className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Planos mensais</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Duas formas. Sem promoção vitalícia.</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {PLANS.map((plan) => (
              <article
                key={plan.id}
                className={`rounded-xl border p-6 ${plan.featured ? "border-accent bg-surface" : "border-border bg-surface"}`}
              >
                <p className="text-sm font-medium">{plan.name}</p>
                <p className="mt-3 text-3xl font-semibold tabular tracking-tight">
                  R$ {plan.price}
                  <span className="ml-1 text-sm font-normal text-muted">{plan.period}</span>
                </p>
                <p className="mt-2 text-sm text-muted">{plan.blurb}</p>
                <ul className="mt-5 grid gap-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="text-fg">
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/login" className="mt-6 block">
                  <Button className="w-full">{plan.cta}</Button>
                </Link>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-border px-5 py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>TatameSmart · {SITE_DOMAIN}</p>
          <p>{SITE_MAIL}</p>
        </div>
      </footer>
    </div>
  );
}
