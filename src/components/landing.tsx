import { Link } from "@tanstack/react-router";
import { TatameLogo } from "@/components/logo";
import { Button } from "@/components/ui";
import { PLANS } from "@/lib/plans";
import { SITE_DOMAIN, SITE_MAIL } from "@/lib/site";

const REGUA = [
  { when: "5 dias antes", text: "Mensagem no WhatsApp cadastrado do aluno. Tom amigável, vencimento chegando." },
  { when: "No dia", text: "Avisa que chegou o vencimento. Sem o mestre precisar abrir conversa por conversa." },
  { when: "No atraso", text: "Continua lembrando até a mensalidade entrar. O relatório mostra quem pagou e quem deve." },
];

const INCLUSO = [
  "Alunos, turmas e frequência",
  "Mensalidades e contas a pagar",
  "WhatsApp automático da mensalidade",
  "Loja, estoque e campeonatos",
  "Relatório de lucro do mês",
];

export function Landing() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <section className="grid min-h-dvh lg:grid-cols-2">
        <div className="flex flex-col">
          <header className="flex items-center justify-between gap-4 px-5 py-5 lg:px-10">
            <TatameLogo compact />
            <Link to="/login" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-fg">
              Entrar
            </Link>
          </header>
          <div className="flex flex-1 flex-col justify-center px-5 pb-12 pt-6 lg:px-10 lg:pb-20">
            <p className="text-sm text-muted">{SITE_DOMAIN}</p>
            <h1 className="mt-4 max-w-[14ch] text-4xl font-semibold leading-[1.12] tracking-tight text-pretty sm:text-5xl">
              O aluno esquece de pagar. O sistema não.
            </h1>
            <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-muted">
              Sistema da academia de luta: ficha, turma, frequência, loja e a mensalidade no WhatsApp do aluno, sozinha, até entrar.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login" search={{ criar: "1" }}>
                <Button>Criar academia</Button>
              </Link>
              <Link to="/login">
                <Button variant="ghost">Ver demonstração</Button>
              </Link>
            </div>
            <p className="mt-6 text-sm text-subtle">Completo R$ 99,00/mês</p>
          </div>
        </div>
        <div className="relative min-h-[42vh] border-t border-border lg:min-h-dvh lg:border-t-0 lg:border-l">
          <img
            src="/login-hero.jpg"
            alt="Treino no tatame"
            className="absolute inset-0 size-full object-cover"
            style={{ objectPosition: "12% 80%" }}
            decoding="async"
          />
        </div>
      </section>


      <section className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:py-20">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">A cobrança que o mestre não dispara na mão</h2>
            <p className="mt-3 max-w-sm text-pretty text-sm leading-relaxed text-muted">
              Cinco dias antes, no vencimento e no atraso. O texto das mensagens o dono edita. O envio o sistema faz.
            </p>
          </div>
          <ol className="border-l border-border">
            {REGUA.map((row) => (
              <li key={row.when} className="relative px-5 py-4 sm:px-6">
                <span className="absolute top-6 -left-px h-3 w-3 -translate-x-1/2 rounded-full border border-border bg-bg" />
                <p className="text-sm font-medium">{row.when}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{row.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <h2 className="max-w-lg text-2xl font-semibold tracking-tight">No fim do mês, o número que importa é o lucro</h2>
          <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-muted">
            Recebeu do aluno, vendeu na loja, pagou professor, energia e aluguel do galpão. O relatório mostra o que sobrou.
          </p>
          <dl className="mt-10 grid border-y border-border sm:grid-cols-3">
            <div className="border-b border-border py-6 sm:border-b-0 sm:border-r sm:pr-6">
              <dt className="text-xs text-muted">Entrou</dt>
              <dd className="mt-2 text-sm leading-relaxed">Mensalidades e loja do mês.</dd>
            </div>
            <div className="border-b border-border py-6 sm:border-b-0 sm:border-r sm:px-6">
              <dt className="text-xs text-muted">Saiu</dt>
              <dd className="mt-2 text-sm leading-relaxed">Aluguel, energia, folha, o que a academia pagou.</dd>
            </div>
            <div className="py-6 sm:pl-6">
              <dt className="text-xs text-muted">Lucro</dt>
              <dd className="mt-2 text-sm leading-relaxed">O que ficou depois de pagar tudo.</dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="planos" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">Um plano. A academia completa.</h2>
          <p className="mt-3 max-w-lg text-pretty text-sm text-muted">
            Sem taxa de adesão. R$ 99,00 por mês, com cobrança no WhatsApp e o lucro no relatório.
          </p>

          <div className="mt-10 max-w-lg rounded-lg border border-border bg-surface p-6">
            <p className="text-sm font-medium">{PLANS[0].name}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular">
              R$ {PLANS[0].price}
              <span className="ml-2 text-sm font-normal text-muted">{PLANS[0].period}</span>
            </p>
            <ul className="mt-6 grid gap-2 text-sm text-muted">
              {INCLUSO.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link to="/login" search={{ criar: "1" }} className="mt-6 block">
              <Button className="w-full">{PLANS[0].cta}</Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>TatameSmart · {SITE_DOMAIN}</p>
          <p>{SITE_MAIL}</p>
        </div>
      </footer>
    </div>
  );
}
