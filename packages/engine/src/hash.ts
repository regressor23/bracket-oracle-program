import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { canonicalJson, type CanonicalValue } from './canonical.js';

/** SHA-256 of a UTF-8 string or raw bytes, as lowercase hex. Runs in Node and browsers. */
export function sha256Hex(input: string | Uint8Array): string {
  return bytesToHex(sha256(typeof input === 'string' ? utf8ToBytes(input) : input));
}

/** The content hash used for pick receipts and merkle leaves. */
export function hashCanonical(value: CanonicalValue): string {
  return sha256Hex(canonicalJson(value));
}
