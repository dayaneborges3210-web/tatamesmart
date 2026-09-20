const MP_API = "https://api.mercadopago.com";

export function mpToken() {
  return (process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
}

export function mpConfigured() {
  return mpToken().length > 20;
}

export async function mpFetch<T = Record<string, unknown>>(path: string, init: RequestInit = {}): Promise<T> {
  const token = mpToken();
  if (token.length < 20) throw new Error("A TatameSmart ainda não ligou o Mercado Pago no servidor.");
  const response = await fetch(MP_API + path, {
    ...init,
    signal: init.signal || AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }
  if (!response.ok) {
    const message =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      "O Mercado Pago recusou a cobrança.";
    throw new Error(message);
  }
  return data as T;
}
