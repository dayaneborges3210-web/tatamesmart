import { createFileRoute } from "@tanstack/react-router";
import { createHmac } from "node:crypto";
import { emailAuthCore } from "@/lib/school-auth";
import { authCookieSecret, SESSION_TOKEN_COOKIE } from "@/lib/auth/server";
import { SITE_DOMAIN } from "@/lib/site";

function originOk(request: Request) {
  const origin = request.headers.get("origin");
  const host = (request.headers.get("host") || "").split(":")[0];
  if (!origin) return true;
  if (host.endsWith(".grok-sandbox.com") || host.endsWith(".grok.me") || host === "localhost" || host === "127.0.0.1") {
    return true;
  }
  try {
    const h = new URL(origin).hostname;
    return (
      h === SITE_DOMAIN ||
      h === `www.${SITE_DOMAIN}` ||
      h.endsWith(".grok.me") ||
      h.endsWith(".grok-sandbox.com") ||
      h === "localhost" ||
      h === "127.0.0.1"
    );
  } catch {
    return false;
  }
}

function signSessionToken(token: string) {
  const sig = createHmac("sha256", authCookieSecret()).update(token).digest("base64");
  return encodeURIComponent(`${token}.${sig}`);
}

export const Route = createFileRoute("/api/entrar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!originOk(request)) {
          return Response.json({ message: "Origem inválida." }, { status: 403 });
        }
        let body: { kind?: string; email?: string; password?: string; name?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ message: "Dados inválidos." }, { status: 400 });
        }
        const kind = body.kind === "criar" ? "criar" : "entrar";
        try {
          const result = await emailAuthCore({
            kind,
            email: body.email ?? "",
            password: body.password ?? "",
            name: body.name,
          });
          const token = result.token;
          const signed = signSessionToken(token);
          const secure =
            request.url.startsWith("https://") || request.headers.get("x-forwarded-proto") === "https";
          const headers = new Headers({ "content-type": "application/json" });
          headers.append(
            "set-cookie",
            `${SESSION_TOKEN_COOKIE}=${signed}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=2592000`,
          );
          if (!secure) {
            headers.append(
              "set-cookie",
              `grok-auth.session_token=${signed}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
            );
          }
          return new Response(JSON.stringify(result), { status: 200, headers });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Não foi possível entrar.";
          return Response.json({ message }, { status: 400 });
        }
      },
    },
  },
});
