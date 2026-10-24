/**
 * Canonical JSON: the exact byte string we hash for brackets, results and payouts.
 *
 * Rules (stable forever — changing them changes every published root):
 * - object keys sorted by UTF-16 code unit order, no whitespace;
 * - only finite numbers; integers are recommended (money is in USDC base units);
 * - `undefined`, functions, symbols, bigint and non-finite numbers are rejected,
 *   never silently dropped.
 */
export type CanonicalValue =
  null | boolean | number | string | CanonicalValue[] | { [key: string]: CanonicalValue };

export class CanonicalJsonError extends Error {
  constructor(path: string, reason: string) {
    super(`Cannot canonicalize ${path || '<root>'}: ${reason}`);
    this.name = 'CanonicalJsonError';
  }
}

function encode(value: unknown, path: string): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) throw new CanonicalJsonError(path, 'non-finite number');
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map((item, i) => encode(item, `${path}[${i}]`)).join(',')}]`;
      }
      const proto = Object.getPrototypeOf(value) as unknown;
      if (proto !== Object.prototype && proto !== null) {
        throw new CanonicalJsonError(path, 'only plain objects are allowed');
      }
      const keys = Object.keys(value).sort();
      const record = value as Record<string, unknown>;
      return `{${keys.map((key) => `${JSON.stringify(key)}:${encode(record[key], `${path}.${key}`)}`).join(',')}}`;
    }
    default:
      throw new CanonicalJsonError(path, `unsupported type ${typeof value}`);
  }
}

export function canonicalJson(value: CanonicalValue): string {
  return encode(value, '');
}
