#!/usr/bin/env bun
// Precompile the game's JSX sources to plain classic-runtime JS.
//
// Why: the browser used to load @babel/standalone (~660KB gzip) and transform
// every game script in-page before first render. Instead we transform the JSX
// here, at commit time, into committed artifacts under dist/ that the HTML loads
// directly with <script defer> — no in-browser Babel, no compile-on-load.
//
// The scripts are NOT ES modules: they have no import/export and rely on one
// shared global scope (React is a UMD global from vendor/; components reference
// each other by bare name). So we emit the CLASSIC runtime — React.createElement,
// no injected imports — which keeps every top-level binding a plain global,
// exactly like babel-standalone's global eval did.
//
// Output is deterministic (fixed banner, no timestamps) so CI can recompile and
// byte-diff dist/ against the committed artifacts to enforce source<->dist sync.
// Run: bun run scripts/build.js   (pin bun to the CI version for a clean diff.)

import { Glob } from "bun";
import { dirname, join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

const ROOT = join(import.meta.dir, "..");

// Every JSX source that ships to the browser: the shared src/ modules (incl. the
// per-page boot-*.jsx entry scripts), the admin viewer, plus the main component
// at the repo root.
const sources = [
  ...new Glob("src/*.jsx").scanSync({ cwd: ROOT }),
  ...new Glob("admin/*.jsx").scanSync({ cwd: ROOT }),
  "green-radius.jsx",
].sort();

const transpiler = new Bun.Transpiler({
  loader: "jsx",
  // Whitespace/comment stripping only — identifiers are NOT renamed, which the
  // shared-global-scope architecture requires (components reference each other
  // by bare top-level name across separate <script> files). ~25% smaller raw,
  // ~10% smaller gzipped.
  minifyWhitespace: true,
  tsconfig: {
    compilerOptions: {
      jsx: "react", // classic: React.createElement / React.Fragment, no imports
      jsxFactory: "React.createElement",
      jsxFragmentFactory: "React.Fragment",
    },
  },
});

for (const rel of sources) {
  const src = await Bun.file(join(ROOT, rel)).text();
  const code = await transpiler.transform(src);
  const banner =
    `// @generated from ${rel} by scripts/build.js — DO NOT EDIT.\n` +
    `// Edit the .jsx source, then run: bun run scripts/build.js\n`;
  const out = join(ROOT, "dist", rel.replace(/\.jsx$/, ".js"));
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, banner + code);
  console.log(`compiled ${rel} -> dist/${rel.replace(/\.jsx$/, ".js")}`);
}

console.log(`\ndone: ${sources.length} files.`);
