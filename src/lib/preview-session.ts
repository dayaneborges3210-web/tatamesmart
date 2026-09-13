/** Same key `src/lib/auth/client.ts` reads for the live-preview bearer. */
const BEARER_KEY = "grok-auth.bearer-token";

export function keepPreviewSession(token: string | null | undefined) {
  if (!token || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(BEARER_KEY, token);
    window.localStorage.setItem(BEARER_KEY, token);
  } catch {
    /* ignore */
  }
}

export function loginErrorMessage(err: unknown, kind: "entrar" | "criar" | "oauth" = "entrar") {
  const raw = err instanceof Error ? err.message : "";
  const m = raw.toLowerCase();
  if (m.includes("setcookie") || m.includes("set-cookie") || m.includes("destructure")) {
    return "O login ainda está atualizando. Recarregue a página e tente uma vez.";
  }
  if (m.includes("too many") || m.includes("try again later") || m.includes("429")) {
    return "Muitas tentativas. Espere 20 segundos e clique uma vez só.";
  }
  if (m.includes("origin")) {
    return "O endereço ainda está ligando o cadastro. Espere um minuto e clique de novo.";
  }
  if (m.includes("exist") || m.includes("already")) {
    return "Esse e-mail já tem academia. Clique em Já tenho conta.";
  }
  if (kind === "criar") {
    if (m.includes("password") && (m.includes("short") || m.includes("least") || m.includes("length") || m.includes("mín") || m.includes("min"))) {
      return "A senha precisa ter pelo menos 8 caracteres.";
    }
    return "Não deu para criar a academia. Confira o e-mail e tente de novo.";
  }
  if (m.includes("invalid") || m.includes("unauthorized") || m.includes("password")) {
    return "E-mail ou senha incorretos. Veja a senha no olho, use Esqueci a senha, ou Criar academia.";
  }
  if (m.includes("popup") || m.includes("pop-up")) {
    return "O navegador bloqueou a janela do Google. Permita pop-ups e tente de novo.";
  }
  if (m.includes("cancelled") || m.includes("canceled") || m.includes("fail")) {
    return "O Google não concluiu o login. Tente de novo ou entre com e-mail.";
  }
  return raw || "Não foi possível entrar. Tente Criar academia se a conta sumiu.";
}
