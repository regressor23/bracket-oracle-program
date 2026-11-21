export class CanonicalJsonError extends Error {
    constructor(path, reason) {
        super(`Cannot canonicalize ${path || '<root>'}: ${reason}`);
        this.name = 'CanonicalJsonError';
    }
}
function encode(value, path) {
    if (value === null)
        return 'null';
    switch (typeof value) {
        case 'boolean':
            return value ? 'true' : 'false';
        case 'string':
            return JSON.stringify(value);
        case 'number':
            if (!Number.isFinite(value))
                throw new CanonicalJsonError(path, 'non-finite number');
            return JSON.stringify(Object.is(value, -0) ? 0 : value);
        case 'object': {
            if (Array.isArray(value)) {
                return `[${value.map((item, i) => encode(item, `${path}[${i}]`)).join(',')}]`;
            }
            const proto = Object.getPrototypeOf(value);
            if (proto !== Object.prototype && proto !== null) {
                throw new CanonicalJsonError(path, 'only plain objects are allowed');
            }
            const keys = Object.keys(value).sort();
            const record = value;
            return `{${keys.map((key) => `${JSON.stringify(key)}:${encode(record[key], `${path}.${key}`)}`).join(',')}}`;
        }
        default:
            throw new CanonicalJsonError(path, `unsupported type ${typeof value}`);
    }
}
export function canonicalJson(value) {
    return encode(value, '');
}
//# sourceMappingURL=canonical.js.map