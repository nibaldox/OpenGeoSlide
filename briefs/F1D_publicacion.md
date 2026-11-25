# Brief F1-D: publicación sin red, CI y PWA (Sonnet, un escritor)

Responde en **español neutro, sin voseo**. Lee completo `docs/fase1/exploracion/X4.md`, sobre todo §2.1, §2.4, §2.5,
§3 y §4, y sigue su propuesta salvo que este brief diga otra cosa.

## Directorio
Worktree `/home/xodla/archivos/opengeoslide-wt/f1d`, rama `f1d-publicacion`, desde `main`.

## Propietario del repositorio
El propietario **todavía no está decidido**. Usa `opengeoslide/opengeoslide` como valor provisional y concéntralo en el
menor número posible de lugares: `[workspace.package]`, `pyproject.toml`, `CITATION.cff`, README y `VITE_BASE`. En el
resumen, entrega la lista exacta de archivos y líneas para cambiarlo después con un solo `sed`.

## Tareas (todas sin red: no crees repos, no hagas push y no publiques nada)
1. **Metadatos (X4 §3.1):**
   - `Cargo.toml` raíz con `[workspace.package]`: `rust-version`, `repository`, `homepage`, `documentation`,
     `readme`, `authors`, `keywords` y `categories`;
   - los crates heredan esos campos;
   - las dependencias de ruta llevan `version` (por ejemplo, `ogs-core = { version = "0.1.0", path = "../ogs-core" }`).
   - **Verifica:** `cargo package --list` en los 4 crates (o el equivalente, si alguno no se publica, como `ogs-py`,
     que podría ir con `publish = false`) y `cargo publish --dry-run -p ogs-core --allow-dirty`, sin errores.
2. **Wheel de Python:**
   - en `crates/ogs-py/pyproject.toml`: `license-files`, `keywords` y clasificadores;
   - LICENSE y NOTICE deben quedar dentro del wheel (`*.dist-info/licenses/`), por ejemplo copiándolos en un paso de
     build documentado, sin editar el NOTICE raíz;
   - **verifica** un build local de manylinux2014, si es posible con `maturin build --release --zig --compatibility
     manylinux2014` (instala `ziglang` en un venv de scratch). Si no se puede, explica por qué y deja la receta.
     Inspecciona el wheel con `unzip -l` y con `auditwheel show`, si está disponible.
3. **Workflows** en `.github/workflows/`, según X4 §2.4:
   - **`ci.yml`:** jobs rust, acceptance, oracle, web y wasm. El job web falla si `dist/` no tiene `.wasm`.
     - Los comandos Python van con `env -u PYTHONPATH` solo si hace falta; en CI no hace falta.
     - Pytest:
       ```
       uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely --with jsonschema --with pytest python -m pytest -q verification
       ```
   - **`pages.yml`:** con `VITE_BASE=/opengeoslide/`.
   - **`wheels.yml`:** matriz Linux manylinux2014, macOS arm64 y x86_64, y Windows. Publica con Trusted Publishing en
     el environment `pypi`, solo con tags `v*`.
   - **`release.yml`:** GitHub Release más `cargo publish --dry-run`. La publicación real en crates.io queda **detrás
     de un input manual** `workflow_dispatch` y del secret `CARGO_REGISTRY_TOKEN`.
   - **Valida con `actionlint`:** descarga el binario oficial en tu scratch y verifica su checksum. Debe quedar sin
     errores. Fija las versiones de las actions a un tag mayor, como en X4.
4. **Web:**
   - `vite.config.ts` con `base: process.env.VITE_BASE ?? '/'`;
   - `"packageManager": "pnpm@11.8.0"` en `apps/web/package.json`;
   - `lang="es"` en `apps/web/index.html`.
   - **Verifica** que `VITE_BASE=/opengeoslide/ pnpm build`, servido bajo la subruta (por ejemplo, con un servidor
     estático de Python en el puerto 5183 que monte `dist/` en `/opengeoslide/`), carga el WASM real y calcula un caso
     en Chrome headless (`/usr/bin/google-chrome-stable`) sin errores de consola. Toma una captura.
5. **PWA instalable y offline (X4 §2.5):**
   - `public/manifest.webmanifest` con nombre «OpenGeoSlide», `lang` `es`, `display: standalone` e iconos PNG de 192
     y 512, generados a partir de un SVG simple propio de un talud;
   - un service worker propio, **sin dependencias nuevas**, con precache del shell, el JS, el CSS, el glue y el
     `.wasm`, más las fuentes del informe en caché bajo demanda. La lista de precache se genera en el build con un
     plugin pequeño de Vite en `apps/web/build/` o un script post-build;
   - registro del service worker desde `index.html`, con un `<script type="module" src="/src/pwa/register.ts">` y el
     archivo `src/pwa/register.ts`. **No toques `main.tsx` ni `App.tsx`**, porque son de otro escritor.
   - **Verifica en Chrome headless:** el service worker queda activo; tras una recarga **sin red** (CDP
     `Network.emulateNetworkConditions offline`), la app carga y calcula.
6. **Archivos de comunidad:**
   - `rust-toolchain.toml`, `CHANGELOG.md` (Keep a Changelog, con 0.1.0-fase0 y Unreleased para la Fase 1);
   - `CITATION.cff`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1, en español), `SECURITY.md` y `CONTRIBUTING.md`,
     en español, con el flujo de verificación obligatorio de un PR: aceptación, harness y batería.

## Archivos que te pertenecen
- `Cargo.toml` raíz y los `crates/*/Cargo.toml`, **solo los metadatos**;
- `crates/ogs-py/pyproject.toml` y archivos de empaquetado;
- `.github/**`;
- `apps/web/{vite.config.ts,package.json (solo packageManager),index.html,public/manifest.webmanifest,public/icons/**,build/**}`;
- `apps/web/src/pwa/**`;
- los archivos de comunidad de la raíz.

**No toques:** código Rust, `README.md`, `NOTICE`, `apps/web/src/` fuera de `pwa/`, el lockfile ni `briefs/`.

## Gates
- `cargo fmt --all --check` y `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`
- `cargo test -p ogs-core --release`
- `cd apps/web && pnpm install --frozen-lockfile && pnpm test && pnpm build`
- `actionlint` limpio
- Los puertos 5183 y 5184 quedan libres al terminar. Nunca uses el 5180, 5181 ni 5182.

## Cierre
- Commits pequeños con rutas explícitas. Sin push.
- **Resumen:** archivos, verificaciones con salida real (`cargo package`, wheel, `actionlint`, build en subruta,
  offline), rutas de las capturas, lista de archivos y líneas para cambiar el propietario, y hashes.
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`.
- **Presupuesto:** unas 90 iteraciones.
