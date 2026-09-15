import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, keepSessionToken, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button, Field, Input, PasswordInput } from "@/components/ui";
import { keepPreviewSession, loginErrorMessage } from "@/lib/preview-session";
import { TatameLogo } from "@/components/logo";
import { confirmResetFn, requestResetFn } from "@/lib/reset-password";
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_SCHOOL } from "@/lib/demo";

export const Route = createFileRoute("/login")({ component: Login });

async function postEntrar(payload: {
  kind: "entrar" | "criar";
  email: string;
  password: string;
  name?: string;
}) {
  const res = await fetch("/api/entrar", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as { token?: string; message?: string };
  if (!res.ok || !json.token) throw new Error(json.message || "Não foi possível entrar.");
  return json.token;
}

function Login() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"entrar" | "criar" | "restaurar">("entrar");
  const [school, setSchool] = useState("");
  const [email, setEmail] = useState(import.meta.env.DEV ? "contato@smarttatame.com.br" : "");
  const [password, setPassword] = useState(import.meta.env.DEV ? "TatameTest-Qr-2026" : "");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [resetStep, setResetStep] = useState<"email" | "code">("email");
  const [previewCode, setPreviewCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  if (isPending) return <main className="min-h-dvh bg-bg" />;
  if (user) return <Navigate to="/" />;

  async function finishLogin(token: string) {
    keepSessionToken(token);
    keepPreviewSession(token);
    for (let i = 0; i < 8; i += 1) {
      try {
        const session = await authClient.getSession();
        authClient.$store.notify("$sessionSignal");
        if (session.data?.user) break;
      } catch {
        /* next try */
      }
      await new Promise((r) => window.setTimeout(r, 180));
    }
    await navigate({ to: "/" });
  }

  async function enterWithEmail() {
    const token = await postEntrar({
      kind: mode === "criar" ? "criar" : "entrar",
      email,
      password,
      name: school.trim() || "Minha academia",
    });
    await finishLogin(token);
  }

  async function enterDemo() {
    setError("");
    setInfo("");
    setBusy(true);
    try {
      let token = "";
      try {
        token = await postEntrar({ kind: "entrar", email: DEMO_EMAIL, password: DEMO_PASSWORD });
      } catch {
        token = await postEntrar({
          kind: "criar",
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
          name: DEMO_SCHOOL,
        });
      }
      keepSessionToken(token);
      keepPreviewSession(token);
      await finishLogin(token);
    } catch (err) {
      setError(loginErrorMessage(err, "entrar"));
    } finally {
      setBusy(false);
    }
  }

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "restaurar") {
        if (resetStep === "email") {
          const res = await requestResetFn({ data: { email } });
          setResetStep("code");
          setPreviewCode(res.previewCode ?? "");
          setInfo(
            res.previewCode
              ? "No preview o e-mail ainda não sai. Use o código abaixo."
              : "Se o e-mail estiver cadastrado, enviamos um código de 6 dígitos. Vale 15 minutos.",
          );
          return;
        }
        if (password !== confirm) throw new Error("As senhas não são iguais.");
        await confirmResetFn({ data: { email, code, password } });
        setInfo("Senha atualizada. Entre com o e-mail e a senha nova.");
        setMode("entrar");
        setResetStep("email");
        setPassword("");
        setConfirm("");
        setCode("");
        setPreviewCode("");
        return;
      }
      await enterWithEmail();
    } catch (err) {
      setError(loginErrorMessage(err, mode === "criar" ? "criar" : "entrar"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-y-auto bg-bg text-fg">
      <img
        src="/login-hero.png"
        alt="Atletas de jiu-jitsu, muay thai, karatê e capoeira"
        className="pointer-events-none absolute inset-0 size-full object-cover opacity-70"
        style={{ objectPosition: "68% 88%" }}
      />
      <div className="relative flex min-h-dvh flex-col md:flex-row">
        <div className="order-1 min-h-80 flex-1" />
        <div className="order-2 m-4 w-auto max-w-sm rounded-lg border border-border bg-bg/10 p-5 backdrop-blur-xl md:my-8 md:mr-8 md:ml-0 md:p-6">
        <TatameLogo />
        {import.meta.env.DEV ? (
          <div className="mt-3 rounded-sm border border-warning/40 bg-bg/40 px-3 py-2 text-xs text-muted">
            <p className="font-medium text-fg">Ambiente de teste</p>
            <p className="mt-1">O site no ar não muda. Use estes logins só aqui.</p>
            <p className="mt-2">
              Empresa mãe: <span className="text-fg">contato@smarttatame.com.br</span>
              <br />
              Senha: <span className="text-fg">TatameTest-Qr-2026</span>
            </p>
          </div>
        ) : null}
        <p className="mt-2 text-sm text-muted">
          {mode === "restaurar"
            ? resetStep === "email"
              ? "Enviamos um código de 6 dígitos para o e-mail da academia."
              : "Digite o código e escolha a senha nova."
            : "Gestão de academias de luta em todo o Brasil."}
        </p>

        {mode !== "restaurar" && authEnabled ? (
          <div className="mt-6 grid gap-2">
            {GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="ghost"
                className="w-full"
                disabled={busy}
                onClick={() => {
                  setError("");
                  setBusy(true);
                  void signIn(p.providerId, { callbackURL: "/" }).catch((err: unknown) => {
                    setError(loginErrorMessage(err, "oauth"));
                    setBusy(false);
                  });
                }}
              >
                Continuar com {p.label}
              </Button>
            ))}
          </div>
        ) : null}

        {mode !== "restaurar" ? (
          <p className="my-5 rounded-sm bg-bg px-3 py-2 text-center text-xs text-muted">ou e-mail da escola</p>
        ) : (
          <div className="mt-6" />
        )}

        <form className="grid gap-3" onSubmit={onEmail}>
          {mode === "criar" ? (
            <Field label="Nome da academia">
              <Input value={school} onChange={(e) => setSchool(e.target.value)} required />
            </Field>
          ) : null}
          <Field label="E-mail">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={mode === "restaurar" && resetStep === "code"}
            />
          </Field>
          {mode === "restaurar" && resetStep === "code" ? (
            <>
              {previewCode ? (
                <p className="rounded-sm bg-bg px-3 py-2 text-center text-sm tabular">
                  Código: <span className="font-semibold tracking-widest">{previewCode}</span>
                </p>
              ) : null}
              <Field label="Código de 6 dígitos">
                <Input
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  minLength={6}
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </Field>
            </>
          ) : null}
          {mode === "restaurar" && resetStep === "email" ? null : (
          <Field label={mode === "restaurar" ? "Senha nova" : "Senha"}>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === "entrar" ? "current-password" : "new-password"}
            />
          </Field>
          )}
          {mode === "restaurar" && resetStep === "code" ? (
            <Field label="Repita a senha">
              <PasswordInput
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </Field>
          ) : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {info ? <p className="text-sm text-success">{info}</p> : null}
          <Button type="submit" disabled={busy}>
            {busy
              ? "Aguarde…"
              : mode === "criar"
                ? "Criar academia"
                : mode === "restaurar"
                  ? resetStep === "email"
                    ? "Enviar código"
                    : "Salvar senha nova"
                  : "Entrar"}
          </Button>
        </form>
        {mode !== "restaurar" ? (
          <Button type="button" className="mt-3 w-full" disabled={busy} onClick={() => void enterDemo()}>
            {busy ? "Aguarde…" : "Ver demonstração"}
          </Button>
        ) : null}
        {mode !== "restaurar" ? (
          <Link
            to="/video"
            className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-sm border border-border bg-surface text-sm text-fg hover:bg-surface-2"
          >
            Assistir vídeo
          </Link>
        ) : null}
        <button
          type="button"
          className="mt-4 w-full text-sm text-muted hover:text-fg"
          onClick={() => {
            setError("");
            setInfo("");
            setMode(mode === "criar" ? "entrar" : "criar");
          }}
        >
          {mode === "criar" ? "Já tenho conta" : "Primeira vez? Criar academia"}
        </button>
        {mode === "restaurar" ? (
          <button
            type="button"
            className="mt-2 w-full text-sm text-muted hover:text-fg"
            onClick={() => {
              setError("");
              setInfo("");
              setResetStep("email");
              setPreviewCode("");
              setCode("");
              setMode("entrar");
            }}
          >
            Voltar ao login
          </button>
        ) : (
          <button
            type="button"
            className="mt-2 w-full text-sm text-muted hover:text-fg"
            onClick={() => {
              setError("");
              setInfo("");
              setResetStep("email");
              setPreviewCode("");
              setMode("restaurar");
            }}
          >
            Esqueci a senha
          </button>
        )}
        </div>
      </div>
    </main>
  );
}
