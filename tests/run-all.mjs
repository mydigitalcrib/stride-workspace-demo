// Runs every *.test.mjs file in this folder. Usage: npm test
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const files = readdirSync(dir).filter((name) => name.endsWith('.test.mjs')).sort();
let failed = 0;
for (const file of files) {
  const run = spawnSync(process.execPath, [file], { cwd: dir, encoding: 'utf8' });
  const passed = (run.stdout.match(/^PASS/gm) || []).length;
  const fails = (run.stdout.match(/^FAIL.*(?:\n {3}.*)*/gm) || []);
  if (run.status === 0) {
    console.log(`✓ ${file} (${passed} checks)`);
  } else {
    failed++;
    console.log(`✗ ${file}`);
    fails.forEach((line) => console.log(`  ${line}`));
    if (run.stderr) console.log(run.stderr);
  }
}
console.log(failed ? `\n${failed} of ${files.length} files failed` : `\nAll ${files.length} files passed`);
process.exit(failed ? 1 : 0);
