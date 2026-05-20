import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { spawnSync } from 'child_process';
import { applyControls, type ControlsArtifact } from './controls-presets';
import type { Plan, ProductType } from './types';

function fail(msg: string): never {
  console.error(`\x1b[31m✖ apply-controls failed:\x1b[0m ${msg}`);
  process.exit(1);
}
function ok(msg: string): void {
  console.log(`\x1b[32m✓ apply-controls:\x1b[0m ${msg}`);
}

function readJson<T>(path: string, label: string): T {
  if (!existsSync(path)) fail(`${label} not found at ${path}`);
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch (err) {
    fail(`could not parse ${label} at ${path}: ${(err as Error).message}`);
  }
}

function main(): void {
  const workdir = resolve(process.cwd(), 'tmp/luly-agent');
  if (!existsSync(workdir)) fail(`workdir not found: ${workdir} — run earlier skills first`);

  const productType = readJson<ProductType>(join(workdir, 'product-type.json'), 'product-type.json');
  const plan = readJson<Plan>(join(workdir, 'plan.parsed.json'), 'plan.parsed.json');

  const lessonFiles = readdirSync(workdir).filter(f => /^lesson-\d+\.json$/.test(f));
  if (lessonFiles.length === 0) {
    fail(`no lesson-*.json files in ${workdir} — run /luly-fill-lesson first`);
  }
  const presentLessons = new Set(
    lessonFiles.map(f => Number(f.match(/^lesson-(\d+)\.json$/)![1]))
  );
  const planLessons = plan.lessons.map(l => l.n);
  const missing = planLessons.filter(n => !presentLessons.has(n));
  if (missing.length > 0) {
    fail(
      `plan has ${planLessons.length} lesson(s) but lesson(s) [${missing.join(', ')}] not yet filled — ` +
      `run /luly-fill-lesson to fill the remaining ones before applying controls`
    );
  }

  const artifact: ControlsArtifact = applyControls(productType.preset, plan);

  const outputPath = join(workdir, 'controls.json');
  writeFileSync(outputPath, JSON.stringify(artifact, null, 2) + '\n', 'utf8');

  ok(`wrote ${outputPath}`);
  console.log(`  preset       = ${productType.preset}`);
  console.log(`  paths        = ${Object.keys(artifact.controls).length}`);
  let total = 0;
  for (const list of Object.values(artifact.controls)) total += list.length;
  console.log(`  total ctrls  = ${total}`);

  const validatorPath = resolve(__dirname, 'validate-controls.ts');
  const tsconfigPath = resolve(__dirname, 'tsconfig.json');
  const result = spawnSync(
    'npx',
    ['ts-node', '--project', tsconfigPath, validatorPath, outputPath],
    { stdio: 'inherit' }
  );
  if (result.status !== 0) {
    fail(`validation failed for ${outputPath} — see message above`);
  }
}

main();
