export const DEMO_EMAIL = "demo@tatamesmart.com";
export const DEMO_PASSWORD = "tatame123";
export const DEMO_SCHOOL = "Academia Demonstração";

export function isDemoEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase() === DEMO_EMAIL;
}
