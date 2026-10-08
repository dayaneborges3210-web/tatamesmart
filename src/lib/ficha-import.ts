import { createServerFn } from "@tanstack/react-start";
import { academyWriteMiddleware } from "@/lib/academy-actor";
import { getSql } from "@/lib/db";
import { isBelt, isModality, type Belt, type Modality } from "@/lib/dojo-types";
import { todayISO } from "@/lib/money";

type FichaRead = {
  name: string;
  cpf: string;
  phone: string;
  cep: string;
  address: string;
  birth: string;
  joined: string;
  belt: Belt;
  modality: Modality;
};

const READ_PROMPT = `Você lê uma ficha de matrícula de academia, muitas vezes escrita à mão.
Devolva só um JSON, sem texto em volta, neste formato:
{"name":"","cpf":"","phone":"","cep":"","address":"","birth":"","joined":"","belt":"","modality":""}
Regras:
- name: nome completo do aluno, com acentos, como está escrito. Não corrija um nome incomum.
- cpf: só os números do CPF do aluno.
- phone: celular do aluno, só números, com DDD. Se houver celular e outro contato, use o celular.
- cep: só os números.
- address: rua ou quadra e lote, bairro, cidade e UF, numa linha.
- birth: data de nascimento AAAA-MM-DD. Vazio se não der para ler.
- joined: data da ficha ou da matrícula AAAA-MM-DD. Vazio se não houver.
- belt: uma destas, a partir da anotação de faixa (amarelo = Amarela): Sem faixa, Branca, Cinza, Amarela, Laranja, Verde, Azul, Roxa, Marrom, Preta, Coral, Vermelha, Iniciante. Se não houver faixa, Branca.
- modality: Kids se a pessoa tem menos de 16 anos, senão Jiu-jitsu.
Não invente dado que não está na foto.`;

function digits(value: string, max: number) {
  return value.replace(/\D/g, "").slice(0, max);
}

function formatCpf(raw: string) {
  const d = digits(raw, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatCep(raw: string) {
  const d = digits(raw, 8);
  return d.replace(/(\d{5})(\d)/, "$1-$2");
}

function isoDate(raw: string) {
  const v = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const br = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!br) return "";
  return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
}

function titleName(raw: string) {
  const small = new Set(["da", "de", "do", "dos", "das", "e"]);
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((word, index) => {
      if (index > 0 && small.has(word)) return word;
      return word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1);
    })
    .join(" ")
    .slice(0, 80);
}

function ageOn(birth: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return 99;
  let age = Number(today.slice(0, 4)) - Number(birth.slice(0, 4));
  if (today.slice(5) < birth.slice(5)) age -= 1;
  return age;
}

function textFromModel(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const chunks: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node === "string") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== "object") return;
    const row = node as { type?: unknown; text?: unknown; content?: unknown; output?: unknown };
    if (row.type === "output_text" && typeof row.text === "string") chunks.push(row.text);
    if (row.content) walk(row.content);
    if (row.output) walk(row.output);
  };
  walk((payload as { output?: unknown }).output);
  return chunks.join("\n");
}

function parseFicha(raw: string, today: string): FichaRead {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Não consegui ler a ficha. Tire a foto mais perto e sem sombra.");
  const json = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  const name = titleName(String(json.name ?? ""));
  if (name.length < 5) throw new Error("Não achei o nome na ficha. Tire outra foto.");
  const birth = isoDate(String(json.birth ?? ""));
  const joined = isoDate(String(json.joined ?? "")) || today;
  const beltRaw = String(json.belt ?? "Branca");
  const modalityRaw = String(json.modality ?? "");
  return {
    name,
    cpf: formatCpf(String(json.cpf ?? "")),
    phone: digits(String(json.phone ?? ""), 13),
    cep: formatCep(String(json.cep ?? "")),
    address: String(json.address ?? "").trim().replace(/\s+/g, " ").slice(0, 200),
    birth,
    joined,
    belt: isBelt(beltRaw) ? beltRaw : "Branca",
    modality: isModality(modalityRaw) ? modalityRaw : ageOn(birth, today) < 16 ? "Kids" : "Jiu-jitsu",
  };
}

async function fichaKey() {
  const env = (process.env.XAI_API_KEY || "").trim();
  if (env) return env;
  try {
    const sql = await getSql();
    await sql.query(`alter table platform_settings add column if not exists ficha_key text not null default ''`);
    const rows = await sql<{ ficha_key: string | null }>`select ficha_key from platform_settings where id = 1`;
    return (rows[0]?.ficha_key || "").trim();
  } catch {
    return "";
  }
}

async function readFicha(image: string): Promise<FichaRead> {
  const key = await fichaKey();
  if (!key) throw new Error("A leitura da ficha ainda não está ligada no servidor.");
  let res: Response;
  try {
    res = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(20000),
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "grok-4-fast-non-reasoning",
        input: [
          {
            role: "user",
            content: [
              { type: "input_image", image_url: image, detail: "high" },
              { type: "input_text", text: READ_PROMPT },
            ],
          },
        ],
      }),
    });
  } catch {
    throw new Error("A leitura demorou demais. Tire a foto de novo.");
  }
  if (!res.ok) throw new Error("A leitura da ficha falhou. Tente outra foto.");
  return parseFicha(textFromModel(await res.json()), todayISO());
}

export const importFichaFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: { image: string }) => {
    if (!d || typeof d.image !== "string" || !d.image.startsWith("data:image/")) {
      throw new Error("Envie uma foto da ficha.");
    }
    if (d.image.length > 1_800_000) throw new Error("A foto ficou grande demais. Aproxime e tire de novo.");
    return d;
  })
  .handler(async ({ context, data }) => {
    const ficha = await readFicha(data.image);
    const sql = await getSql();
    const dup = await sql<{ id: string }>`
      select id from students
      where user_id = ${context.userId}
        and (
          lower(name) = ${ficha.name.toLocaleLowerCase("pt-BR")}
          or (${ficha.cpf} <> '' and cpf = ${ficha.cpf})
        )
      limit 1
    `;
    if (dup[0]) throw new Error(`${ficha.name} já está na lista.`);
    const matriz = await sql<{ id: string }>`
      select id from branches where user_id = ${context.userId} and kind = ${"matriz"} limit 1
    `;
    const id = `${context.userId}:s${Date.now()}`;
    await sql`insert into students (
        id, user_id, name, phone, modality, belt, degree, class_id, status, joined,
        cpf, address, cep, has_health, health_note, birth, plan_id, due_day, docs, branch_id, scholarship
      ) values (
        ${id},
        ${context.userId},
        ${ficha.name},
        ${ficha.phone},
        ${ficha.modality},
        ${ficha.belt},
        ${0},
        ${""},
        ${"ativo"},
        ${ficha.joined},
        ${ficha.cpf},
        ${ficha.address},
        ${ficha.cep},
        ${false},
        ${""},
        ${ficha.birth || null},
        ${""},
        ${10},
        ${""},
        ${context.lockedBranchId || matriz[0]?.id || ""},
        ${false}
      )`;
    return { name: ficha.name, belt: ficha.belt };
  });
