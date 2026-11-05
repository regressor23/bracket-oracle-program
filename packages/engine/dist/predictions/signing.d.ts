/**
 * The exact text a player's wallet signs to save a prediction (ADR-09). It binds the signature to
 * one site, one contest and one document hash, and expires, so a signature cannot be replayed
 * elsewhere or later. The platform keeps the signed text, the signature and its own receipt;
 * anyone can rebuild the text from those fields and check the signature.
 *
 * Stable forever for version 1: changing a single character changes what wallets sign.
 */
export declare const SIGNING_MESSAGE_VERSION = 1;
export interface SigningRequest {
    /** The site asking for the signature, as a host name with an optional port. */
    domain: string;
    contest: string;
    /** SHA-256 of the canonical prediction document, lowercase hex. */
    hash: string;
    /** One-time value the platform issues for this save. */
    nonce: string;
    /** When the platform stops accepting this signature, ISO 8601 in UTC with milliseconds. */
    expiresAt: string;
}
export declare class SigningMessageError extends Error {
    constructor(message: string);
}
/** The text to pass to the wallet's `signMessage`, encoded as UTF-8. */
export declare function signingMessage(request: SigningRequest): string;
/**
 * Reads the fields back from a signed text. Returns null unless the text is exactly what
 * `signingMessage` builds from them.
 */
export declare function parseSigningMessage(text: string): SigningRequest | null;
//# sourceMappingURL=signing.d.ts.map