// A7 (WASM): tiempo y FS de V053 y S2 con y sin `global`, en el motor compilado a WebAssembly y corrido en V8.
// Uso: node wasm_a7.mjs <directorio de wasm-bindgen --target nodejs> <entrada.json>...
// Cada entrada es un modelo de `run.py` (paso `wasm`). Imprime una línea JSON por entrada, con tres repeticiones.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename } from "node:path";

const require = createRequire(import.meta.url);
const wasm = require(`${process.argv[2]}/ogs_wasm.js`);
for (const file of process.argv.slice(3)) {
  const input = readFileSync(file, "utf8");
  const seconds = [];
  let text = "";
  for (let i = 0; i < 3; i++) {
    const t = performance.now();
    text = wasm.analyze_json(input);
    seconds.push((performance.now() - t) / 1000);
  }
  const result = JSON.parse(text).results[0];
  console.log(JSON.stringify({
    input: basename(file, ".json"),
    fos: result.fos,
    seconds,
    sha256: createHash("sha256").update(text).digest("hex"),
    stats: result.search?.non_circular?.global ?? null,
  }));
}
