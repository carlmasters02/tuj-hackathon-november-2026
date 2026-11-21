/**
 * Deterministic JSON: object keys sorted lexicographically (by UTF-16 code unit),
 * no whitespace, `undefined` properties dropped. Arrays keep their order.
 * Used everywhere a value is hashed or signed so client and server agree byte-for-byte.
 */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("canonicalJSON: non-finite number");
    if (value === undefined) throw new Error("canonicalJSON: undefined");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return "[" + value.map((v) => canonicalJSON(v === undefined ? null : v)).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJSON(obj[k])).join(",") + "}";
}
