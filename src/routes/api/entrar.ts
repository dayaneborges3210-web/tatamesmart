import { createFileRoute } from "@tanstack/react-router";
import { serializeSignedCookie } from "better-call";
import { emailAuthCore } from "@/lib/school-auth";
import { authCookieSecret, SESSION_TOKEN_COOKIE } from "@/lib/auth/server";
import { SITE_DOMAIN } from "@/lib/site";

function originOk(request: Request) {
  const origin = request.headers.get("origin");
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  if (!origin) return true;
  try {
    const h = new URL(origin).hostname.toLowerCase();
    if (h === host) return true;
    if (h === SITE_DOMAIN || h === `www.${SITE_DOMAIN}`) return true;
    if (h.endsWith(".vercel.app") || h === "vercel.app") return true;
    if (h.endsWith(".grok-sandbox.com") || h.endsWith(".grok.me")) return true;
    if (h === "localhost" || h === "127.0.0.1") return true;
    return false;
  } catch {
    return false;
  }
}

async function cookieHeaders(token: string, request: Request) {
  const dest = (request.headers.get("sec-fetch-dest") || "").toLowerCase();
  const framed = dest === "iframe" || dest === "embed";
  const secure =
    request.url.startsWith("https://") || request.headers.get("x-forwarded-proto") === "https";
  const secret = authCookieSecret();
  const out: string[] = [];
  if (secure) {
    out.push(
      await serializeSignedCookie(SESSION_TOKEN_COOKIE, token, secret, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: framed ? "none" : "lax",
        maxAge: 2592000,
        partitioned: framed,
      }),
    );
  }
  out.push(
    await serializeSignedCookie("grok-auth.session_token", token, secret, {
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 2592000,
    }),
  );
  return out;
}

export const Route = createFileRoute("/api/entrar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!originOk(request)) {
          return Response.json(
            { message: "Origem inválida. Abra smarttatame.com.br e entre de novo." },
            { status: 403 },
          );
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
          const headers = new Headers({ "content-type": "application/json" });
          for (const c of await cookieHeaders(result.token, request)) headers.append("set-cookie", c);
          return new Response(JSON.stringify(result), { status: 200, headers });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Não foi possível entrar.";
          return Response.json({ message }, { status: 400 });
        }
      },
    },
  },
});
