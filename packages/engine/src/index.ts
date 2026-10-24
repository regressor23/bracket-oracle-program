export { canonicalJson, CanonicalJsonError, type CanonicalValue } from './canonical.js';
export { hashCanonical, sha256Hex } from './hash.js';

/** Bumped whenever scoring or hashing output can change. Recorded next to every published root. */
export const ENGINE_VERSION = '0.1.0';
