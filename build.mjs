// Builds private/app.html from the source parts in src/app/ (joined in file-name order).
//   node build.mjs           write private/app.html
//   node build.mjs --check   fail if private/app.html is not exactly what src/app/ builds
//   node build.mjs --test    also write .test-build/test.html (adds the test hook from tests/hook.js)
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dir = join(root, 'src', 'app');
const parts = readdirSync(dir).filter(f => /^\d\d-/.test(f)).sort();
const read = f => readFileSync(join(dir, f), 'utf8');
const tailName = parts[parts.length - 1];
const build = hook => parts.map(f => (hook && f === tailName ? hook : '') + read(f)).join('');

const out = build('');
const target = join(root, 'private', 'app.html');
const arg = process.argv[2];

if (arg === '--check') {
  const cur = readFileSync(target, 'utf8');
  if (cur !== out) {
    console.error('private/app.html is out of date. Edit files in src/app/ and run: node build.mjs');
    process.exit(1);
  }
  console.log('OK: private/app.html matches src/app (' + parts.length + ' parts, ' + out.length + ' bytes)');
} else {
  writeFileSync(target, out);
  console.log('Built private/app.html from ' + parts.length + ' parts (' + out.length + ' bytes)');
  if (arg === '--test') {
    const hook = readFileSync(join(root, 'tests', 'hook.js'), 'utf8') + '\n';
    mkdirSync(join(root, '.test-build'), { recursive: true });
    writeFileSync(join(root, '.test-build', 'test.html'), build(hook));
    console.log('Built .test-build/test.html (with test hook)');
  }
}
