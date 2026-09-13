import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/video")({ component: VideoPage });

function VideoPage() {
  return (
    <main className="min-h-dvh bg-bg px-4 py-8 text-fg md:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">TatameSmart</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Vídeo de demonstração</h1>
        <p className="mt-1 text-sm text-muted">Clique no play. Login, painel, alunos, cobrança, frequência e loja.</p>
        <video
          className="mt-6 w-full rounded-lg border border-border bg-black"
          src="/tatamesmart-demo.mp4"
          controls
          playsInline
          preload="metadata"
        />
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <a href="/tatamesmart-demo.mp4" download className="text-fg underline-offset-2 hover:underline">
            Baixar o vídeo
          </a>
          <Link to="/login" className="text-muted hover:text-fg">
            Voltar ao login
          </Link>
        </div>
      </div>
    </main>
  );
}
