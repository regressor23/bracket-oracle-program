import { z } from 'zod';
import { formatTemplateSchema } from './schema.js';

export const FORMAT_SCHEMA_ID =
  'https://github.com/regressor23/bracket-oracle-program/blob/main/packages/engine/formats/format.schema.json';

/**
 * JSON Schema (draft 2020-12) of a format template, generated from the Zod schema. It covers the
 * shape only; slot wiring, Swiss records and bucket sizes are checked by `validateFormat`.
 */
export function formatJsonSchema(): Record<string, unknown> {
  return {
    $id: FORMAT_SCHEMA_ID,
    title: 'Bracket Oracle format template',
    ...z.toJSONSchema(formatTemplateSchema, { target: 'draft-2020-12' }),
  };
}
