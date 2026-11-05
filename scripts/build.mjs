/**
 * Build the browser half.
 *
 * The host loads a client plugin by evaluating a file that calls
 * `window.__ModuleLoader__.load({ id, factory })`, where `require` resolves the
 * shared modules (react, host services) from the app's own registry instead of
 * bundling a second copy. esbuild produces the CJS body; this script wraps it.
 */
import { build } from 'esbuild'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'lib/client.js')

const result = await build({
  entryPoints: [resolve(root, 'src/client/index.tsx')],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  jsxImportSource: 'react',
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/*'],
  logLevel: 'warning',
})

const body = result.outputFiles[0].text

const wrapped = `window.__ModuleLoader__.load({
\tid: "dsh-client-ui-session-panels",
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${body
  .split('\n')
  .map((line) => (line ? `\t\t${line}` : line))
  .join('\n')}
\t\treturn module.exports;
\t}
});
`

await mkdir(dirname(out), { recursive: true })
await writeFile(out, wrapped, 'utf8')
console.log(`lib/client.js  ${wrapped.length} bytes`)

// The host half is plain ESM with no bundle step: copy it into place so `lib/`
// stays the only thing the profile links to.
await copyFile(resolve(root, 'src/host/index.js'), resolve(root, 'lib/index.js'))
console.log('lib/index.js   copied from src/host/index.js')
