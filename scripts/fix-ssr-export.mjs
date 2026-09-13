import { readFileSync, writeFileSync, existsSync } from "node:fs";

const HELPER = `function __exportAllLocal(all, no_symbols) {
  const target = {};
  for (const name in all) Object.defineProperty(target, name, { get: all[name], enumerable: true });
  if (!no_symbols) Object.defineProperty(target, Symbol.toStringTag, { value: "Module" });
  return target;
}
`;

const ssr = ".vercel/output/functions/__server.func/_ssr/ssr.mjs";
const ssr2 = ".vercel/output/functions/__server.func/_ssr/ssr2.mjs";

if (existsSync(ssr)) {
  let src = readFileSync(ssr, "utf8");
  src = src.replace("ssr_exports as s", "server_default as s");
  if (!src.includes("server_default as s")) {
    src = src.replace(
      "server_default as default,",
      "server_default as default, server_default as s,",
    );
  }
  writeFileSync(ssr, src);
}

if (existsSync(ssr2)) {
  let src = readFileSync(ssr2, "utf8");
  if (src.includes('from "./ssr.mjs"')) {
    src = src.replace(/import \{ c as __exportAll\$1 \} from "\.\/ssr\.mjs";\n/, HELPER);
    src = src.replace(/__exportAll\$1\(/g, "__exportAllLocal(");
    writeFileSync(ssr2, src);
    console.log("[fix-ssr] patched ssr barrel + broke ssr2 cycle");
  } else if (src.includes("__exportAllLocal")) {
    console.log("[fix-ssr] ssr2 already patched");
  }
}
