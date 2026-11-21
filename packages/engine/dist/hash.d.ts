import { type CanonicalValue } from './canonical.js';
/** SHA-256 of a UTF-8 string or raw bytes, as lowercase hex. Runs in Node and browsers. */
export declare function sha256Hex(input: string | Uint8Array): string;
/** The content hash used for pick receipts and merkle leaves. */
export declare function hashCanonical(value: CanonicalValue): string;
//# sourceMappingURL=hash.d.ts.map