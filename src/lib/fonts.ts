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

const FONT_HREF: Record<(typeof FONTS)[number]["id"], string> = {
  plex: "",
  manrope: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&display=swap",
  source: "https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600&display=swap",
  franklin: "https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600&display=swap",
  public: "https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600&display=swap",
  dm: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap",
  outfit: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap",
  news: "https://fonts.googleapis.com/css2?family=Newsreader:wght@400;500;600&display=swap",
  literata: "https://fonts.googleapis.com/css2?family=Literata:wght@400;500;600&display=swap",
  fraunces: "https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600&display=swap",
};

export function loadFontFace(id: string) {
  if (typeof document === "undefined") return;
  const href = isFontId(id) ? FONT_HREF[id] : "";
  if (!href) return;
  const tagId = `dojo-font-${id}`;
  if (document.getElementById(tagId)) return;
  const link = document.createElement("link");
  link.id = tagId;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

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
