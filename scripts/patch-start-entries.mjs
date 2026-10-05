import { existsSync, readFileSync, writeFileSync } from "node:fs";

const pkgPath = "node_modules/@tanstack/start-server-core/package.json";
if (!existsSync(pkgPath)) process.exit(0);

const router = `export { getRouter } from "../../../../../src/router.tsx";\n`;
const start = `export { startInstance } from "../../../react-start/dist/plugin/default-entry/start.ts";\n`;
writeFileSync("node_modules/@tanstack/start-server-core/dist/esm/patched-router-entry.js", router);
writeFileSync("node_modules/@tanstack/start-server-core/dist/esm/patched-start-entry.js", start);

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.imports = {
  ...(pkg.imports || {}),
  "#tanstack-router-entry": {
    default: "./dist/esm/patched-router-entry.js",
  },
  "#tanstack-start-entry": {
    default: "./dist/esm/patched-start-entry.js",
  },
};
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
