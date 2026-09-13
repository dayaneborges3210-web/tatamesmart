import { createFileRoute } from "@tanstack/react-router";
import { emailAuthCore } from "@/lib/school-auth";
import { SITE_DOMAIN } from "@/lib/site";

function originOk(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname;
    return (
      host === SITE_DOMAIN ||
      host === `www.${SITE_DOMAIN}` ||
      host.endsWith(".grok.me") ||
      host.endsWith(".grok-sandbox.com") ||
      host === "localhost" ||
      host === "127.0.0.1"
    );
  } catch {
    return false;
  }
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
          const secure = request.url.startsWith("https://") || request.headers.get("x-forwarded-proto") === "https";
          const hostCookie = secure
            ? `__Host-grok-auth.session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure`
            : `grok-auth.session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
              "content-type": "application/json",
              "set-cookie": hostCookie,
            },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Não foi possível entrar.";
          return Response.json({ message }, { status: 400 });
        }
      },
    },
  },
});
