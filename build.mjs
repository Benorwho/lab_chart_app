#!/usr/bin/env node
// Build script: assembles the single-file deploy (index.html) from src/.
//
// Layout:
//   src/index.template.html  — page skeleton with {{PLACEHOLDER}} slots
//   src/styles/main.css      — all CSS
//   src/vendor/d3.v7.min.js  — vendored d3 bundle
//   src/core/*.js            — shared, Node-testable modules (ES exports are
//                              stripped at build time and inlined into the
//                              Plotbench IIFE via the {{CORE}} marker)
//   src/showbench/*.js, src/plotbench/*.js, src/shell/*.js
//
// Core module constraints (so the strip stays trivial):
//   - imports only from other core files (all core code lands in one scope,
//     so import lines are simply dropped at build time)
//   - only `export function` / `export const` / `export class` forms
//
// Usage:
//   node build.mjs          write index.html
//   node build.mjs --check  build to memory and fail if index.html differs
//                           (used by CI to catch uncommitted build drift)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

// Core modules, in dependency order.
const CORE_FILES = ['src/core/stats.js', 'src/core/csv.js'];

function stripExports(code, file) {
  if (/export\s+default/.test(code)) throw new Error(file + ': export default is not supported');
  for (const m of code.matchAll(/^import\s.*?from\s*['"](.*?)['"];?\s*$/gm)) {
    if (!m[1].startsWith('./')) throw new Error(file + ': core modules may only import sibling core files, got ' + m[1]);
  }
  return code
    .replace(/^import\s.*$/gm, '')
    .replace(/^export (function|const|let|class)\b/gm, '$1');
}

function buildCore() {
  return CORE_FILES.map(f =>
    `/* ==== inlined ${f} ==== */\n` + stripExports(read(f), f)
  ).join('\n');
}

export function build() {
  let plotbench = read('src/plotbench/plotbench.js');
  if (!plotbench.includes('/*{{CORE}}*/')) throw new Error('plotbench.js is missing the /*{{CORE}}*/ marker');
  plotbench = plotbench.replace('/*{{CORE}}*/', buildCore());

  const slots = {
    CSS: read('src/styles/main.css'),
    VENDOR: read('src/vendor/d3.v7.min.js'),
    SHOWBENCH: read('src/showbench/showbench.js'),
    PLOTBENCH: plotbench,
    SHELL: read('src/shell/bench-switch.js'),
  };

  let out = read('src/index.template.html');
  for (const [k, v] of Object.entries(slots)) {
    const slot = `{{${k}}}`;
    if (!out.includes(slot)) throw new Error('template is missing slot ' + slot);
    out = out.replace(slot, () => v); // fn form: keep $-sequences in v literal
  }
  if (/{{[A-Z]+}}/.test(out)) throw new Error('unfilled slot left in template');
  return out;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const out = build();
  const target = path.join(ROOT, 'index.html');
  if (process.argv.includes('--check')) {
    const current = fs.readFileSync(target, 'utf8');
    if (current !== out) {
      console.error('index.html is out of date — run `node build.mjs` and commit the result.');
      process.exit(1);
    }
    console.log('index.html is up to date (' + out.length + ' bytes).');
  } else {
    fs.writeFileSync(target, out);
    console.log('wrote index.html (' + out.length + ' bytes)');
  }
}
