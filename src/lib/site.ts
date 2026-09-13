export const SITE_NAME = "TatameSmart";
export const SITE_DOMAIN = "smarttatame.com.br";
export const SITE_URL = `https://${SITE_DOMAIN}`;
export const SITE_MAIL = `contato@${SITE_DOMAIN}`;
export const SITE_NOREPLY = `noreply@${SITE_DOMAIN}`;
export const PLATFORM_OWNER_EMAIL = SITE_MAIL;

export function isMaeEmail(email?: string | null) {
  return (email ?? "").trim().toLowerCase() === PLATFORM_OWNER_EMAIL;
}
