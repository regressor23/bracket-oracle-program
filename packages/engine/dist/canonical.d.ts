/**
 * Canonical JSON: the exact byte string we hash for brackets, results and payouts.
 *
 * Rules (stable forever — changing them changes every published root):
 * - object keys sorted by UTF-16 code unit order, no whitespace;
 * - only finite numbers; integers are recommended (money is in USDC base units);
 * - `undefined`, functions, symbols, bigint and non-finite numbers are rejected,
 *   never silently dropped.
 */
export type CanonicalValue = null | boolean | number | string | CanonicalValue[] | {
    [key: string]: CanonicalValue;
};
export declare class CanonicalJsonError extends Error {
    constructor(path: string, reason: string);
}
export declare function canonicalJson(value: CanonicalValue): string;
//# sourceMappingURL=canonical.d.ts.map