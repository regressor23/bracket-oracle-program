import { z } from 'zod';
import { predictionSchema } from './schema.js';

export const PREDICTION_SCHEMA_ID =
  'https://github.com/regressor23/bracket-oracle-program/blob/main/packages/engine/predictions/prediction.schema.json';

/**
 * JSON Schema (draft 2020-12) of a prediction document, generated from the Zod schema. It covers
 * the shape only; `checkPrediction` also checks the picks against the template and the teams.
 */
export function predictionJsonSchema(): Record<string, unknown> {
  return {
    $id: PREDICTION_SCHEMA_ID,
    title: 'Bracket Oracle prediction',
    ...z.toJSONSchema(predictionSchema, { target: 'draft-2020-12' }),
  };
}
