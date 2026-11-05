import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { predictionJsonSchema } from './json-schema.js';

describe('prediction JSON Schema', () => {
  it('matches the committed file', () => {
    const committed = JSON.parse(
      readFileSync(new URL('../../predictions/prediction.schema.json', import.meta.url), 'utf8'),
    ) as unknown;
    // Regenerate with `pnpm --filter @bracket-oracle/engine formats:export`.
    expect(committed).toEqual(predictionJsonSchema());
  });
});
