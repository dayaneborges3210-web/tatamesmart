export const FONTS = [
  { id: "plex", label: "Plex", stack: '"IBM Plex Sans", "Segoe UI", sans-serif' },
  { id: "manrope", label: "Manrope", stack: "Manrope, sans-serif" },
  { id: "source", label: "Source", stack: '"Source Sans 3", sans-serif' },
  { id: "franklin", label: "Franklin", stack: '"Libre Franklin", sans-serif' },
  { id: "public", label: "Public", stack: '"Public Sans", sans-serif' },
  { id: "dm", label: "DM Sans", stack: '"DM Sans", sans-serif' },
  { id: "outfit", label: "Outfit", stack: "Outfit, sans-serif" },
  { id: "news", label: "Newsreader", stack: "Newsreader, serif" },
  { id: "literata", label: "Literata", stack: "Literata, serif" },
  { id: "fraunces", label: "Fraunces", stack: "Fraunces, serif" },
] as const;

export type FontId = (typeof FONTS)[number]["id"];

export const SCALE_MIN = 80;
export const SCALE_MAX = 150;
export const SCALE_STEP = 10;

export function isFontId(v: string): v is FontId {
  return FONTS.some((f) => f.id === v);
}

export function clampScale(n: number) {
  const x = Math.round(n);
  if (x < SCALE_MIN) return SCALE_MIN;
  if (x > SCALE_MAX) return SCALE_MAX;
  return x;
}
