import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import ts from 'typescript';

// Load real project TypeScript into a small isolated CommonJS test harness.
// No browser runtime, no Jest, no copied src tree, no platform SDK emulation.
// Run from the repository root (the npm scripts do): paths are confined to it.
const cache = new Map();
const root = process.cwd();
const phaser = { Events: { EventEmitter } };

export function loadSource(filename) {
  const absolute = resolve(filename.endsWith('.ts') ? filename : filename + '.ts');
  if (!absolute.startsWith(root + sep)) throw new Error(`Outside project: ${absolute}`);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = { exports: {} };
  cache.set(absolute, module);
  const js = ts.transpileModule(readFileSync(absolute, 'utf8'), {
    fileName: absolute,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  const localRequire = (specifier) => {
    if (specifier === 'phaser') return { __esModule: true, default: phaser };
    if (specifier.startsWith('.')) return loadSource(resolve(dirname(absolute), specifier));
    throw new Error(`Unexpected test dependency: ${specifier}`);
  };
  const execute = new Function('module', 'exports', 'require', js);
  execute(module, module.exports, localRequire);
  return module.exports;
}

/** Merge the exports of several project modules into one namespace object. */
export function loadModules(...filenames) {
  return Object.assign({}, ...filenames.map(loadSource));
}
