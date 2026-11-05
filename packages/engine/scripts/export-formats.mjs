// Writes the format templates and their JSON Schema to packages/engine/formats/, and the
// prediction document's JSON Schema to packages/engine/predictions/, from the built package.
// Run `pnpm --filter @bracket-oracle/engine formats:export` after changing a template or the
// prediction schema; a test fails while the committed files differ from the code.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  FORMAT_TEMPLATES,
  formatJsonSchema,
  predictionJsonSchema,
  validateFormat,
} from '../dist/index.js';

const outDir = fileURLToPath(new URL('../formats/', import.meta.url));
const predictionsDir = fileURLToPath(new URL('../predictions/', import.meta.url));
await mkdir(outDir, { recursive: true });
await mkdir(predictionsDir, { recursive: true });

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
await writeFile(new URL('format.schema.json', `file://${outDir}`), json(formatJsonSchema()));
await writeFile(
  new URL('prediction.schema.json', `file://${predictionsDir}`),
  json(predictionJsonSchema()),
);
console.log('predictions/prediction.schema.json');

for (const template of FORMAT_TEMPLATES) {
  const result = validateFormat(template);
  if (!result.ok) {
    console.error(`${template.id} is invalid:`, result.issues);
    process.exitCode = 1;
    continue;
  }
  await writeFile(new URL(`${template.id}.json`, `file://${outDir}`), json(template));
  console.log(`formats/${template.id}.json`);
}
