const dateInBrazil = (value: Date | string) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(value));

export function trialNotice(created: Date | string, now: Date = new Date()) {
  if (!Number.isFinite(new Date(created).getTime())) return null;
  const date = dateInBrazil(now);
  const day = Math.max(1, Math.floor((Date.parse(date) - Date.parse(dateInBrazil(created))) / 86400000) + 1);
  const remaining = Math.max(0, 7 - day);
  const ordinals = ["primeiro", "segundo", "terceiro", "quarto", "quinto", "sexto"];
  const message = day < 7
    ? `Hoje é seu ${ordinals[day - 1]} dia de teste gratuito. ${remaining === 1 ? "Resta 1 dia" : `Restam ${remaining} dias`} para você efetuar o pagamento do seu plano.`
    : `${day === 7 ? "Hoje é o dia de você assinar seu plano." : "Seu teste gratuito terminou."} Acesse Configurações → Plano TatameSmart e efetue o pagamento do seu plano para seguir utilizando o melhor sistema de gestão de academias de luta.`;
  return { date, day, remaining, due: day >= 7, readOnly: day >= 8, message };
}

export function academyReadOnly(row: { created: Date | string; billing_plan: string; access_status: string; paid_until: Date | string | null }, now = new Date()) {
  if (row.access_status === "vitalicio") return false;
  if (row.access_status === "blocked") return true;
  if (row.paid_until) return false;
  return row.billing_plan === "trial" && !!trialNotice(row.created, now)?.readOnly;
}
