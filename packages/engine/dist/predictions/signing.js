/**
 * The exact text a player's wallet signs to save a prediction (ADR-09). It binds the signature to
 * one site, one contest and one document hash, and expires, so a signature cannot be replayed
 * elsewhere or later. The platform keeps the signed text, the signature and its own receipt;
 * anyone can rebuild the text from those fields and check the signature.
 *
 * Stable forever for version 1: changing a single character changes what wallets sign.
 */
export const SIGNING_MESSAGE_VERSION = 1;
export class SigningMessageError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SigningMessageError';
    }
}
const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const DOMAIN = new RegExp(`^${LABEL}(?:\\.${LABEL})*(?::\\d{1,5})?$`);
const CONTEST = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,62}[A-Za-z0-9])?$/;
const HASH = /^[0-9a-f]{64}$/;
const NONCE = /^[A-Za-z0-9]{8,64}$/;
function check(request) {
    if (request.domain.length > 253 || !DOMAIN.test(request.domain)) {
        throw new SigningMessageError(`domain "${request.domain}" is not a lowercase host name`);
    }
    if (!CONTEST.test(request.contest)) {
        throw new SigningMessageError(`contest "${request.contest}" is not a valid id`);
    }
    if (!HASH.test(request.hash)) {
        throw new SigningMessageError('hash must be 64 lowercase hex characters');
    }
    if (!NONCE.test(request.nonce)) {
        throw new SigningMessageError('nonce must be 8-64 letters or digits');
    }
    const time = Date.parse(request.expiresAt);
    if (!Number.isFinite(time) || new Date(time).toISOString() !== request.expiresAt) {
        throw new SigningMessageError(`expiresAt "${request.expiresAt}" must look like 2026-11-05T12:00:00.000Z`);
    }
}
/** The text to pass to the wallet's `signMessage`, encoded as UTF-8. */
export function signingMessage(request) {
    check(request);
    return [
        `${request.domain} asks you to sign your Bracket Oracle prediction.`,
        '',
        'Signing is free and does not send a transaction.',
        '',
        `Contest: ${request.contest}`,
        `Prediction: sha256:${request.hash}`,
        `Nonce: ${request.nonce}`,
        `Expires: ${request.expiresAt}`,
        `Version: ${SIGNING_MESSAGE_VERSION}`,
    ].join('\n');
}
const PATTERN = /^(\S+) asks you to sign your Bracket Oracle prediction\.\n\nSigning is free and does not send a transaction\.\n\nContest: (\S+)\nPrediction: sha256:(\S+)\nNonce: (\S+)\nExpires: (\S+)\nVersion: 1$/;
/**
 * Reads the fields back from a signed text. Returns null unless the text is exactly what
 * `signingMessage` builds from them.
 */
export function parseSigningMessage(text) {
    const match = PATTERN.exec(text);
    if (!match)
        return null;
    const [, domain, contest, hash, nonce, expiresAt] = match;
    const request = {
        domain: domain,
        contest: contest,
        hash: hash,
        nonce: nonce,
        expiresAt: expiresAt,
    };
    try {
        return signingMessage(request) === text ? request : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=signing.js.map