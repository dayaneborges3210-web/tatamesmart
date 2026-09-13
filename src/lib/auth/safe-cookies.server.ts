import { createAuthMiddleware } from "better-auth/api";
import { parseSetCookieHeader } from "better-auth/cookies";

type CookieSetter = (name: string, value: string, options?: Record<string, unknown>) => void;

async function loadSetCookie(): Promise<CookieSetter | null> {
  try {
    const mod = (await import("@tanstack/start-server-core")) as { setCookie?: CookieSetter };
    if (typeof mod.setCookie === "function") return mod.setCookie;
  } catch {
    /* ignore */
  }
  try {
    const mod = (await import("@tanstack/react-start/server")) as { setCookie?: CookieSetter };
    if (typeof mod.setCookie === "function") return mod.setCookie;
  } catch {
    /* ignore */
  }
  return null;
}

/** Drop-in for better-auth's tanstackStartCookies that never crashes if setCookie is missing. */
export function safeTanstackCookies() {
  return {
    id: "tanstack-start-cookies",
    hooks: {
      after: [
        {
          matcher() {
            return true;
          },
          handler: createAuthMiddleware(async (ctx) => {
            const returned = ctx.context.responseHeaders;
            if ("_flag" in ctx && (ctx as { _flag?: string })._flag === "router") return;
            if (!(returned instanceof Headers)) return;
            const setCookies = returned.get("set-cookie");
            if (!setCookies) return;
            const setCookie = await loadSetCookie();
            if (!setCookie) return;
            const parsed = parseSetCookieHeader(setCookies);
            parsed.forEach((value, key) => {
              if (!key) return;
              try {
                setCookie(key, value.value, value as unknown as Record<string, unknown>);
              } catch {
                /* ignore */
              }
            });
          }),
        },
      ],
    },
  };
}
