export const BRANDS = [
  { id: "aco", label: "Aço" },
  { id: "coral", label: "Coral" },
  { id: "ambar", label: "Âmbar" },
  { id: "tatame", label: "Tatame" },
  { id: "gi", label: "Gi" },
  { id: "vinho", label: "Vinho" },
  { id: "roxa", label: "Faixa roxa" },
  { id: "kimono", label: "Kimono" },
  { id: "oceano", label: "Oceano" },
  { id: "oss", label: "Oss" },
] as const;

export type BrandId = (typeof BRANDS)[number]["id"];

export function isBrandId(v: string): v is BrandId {
  return BRANDS.some((b) => b.id === v);
}
