/** Project only explicitly changed, validated document fields into JSON audit data.
 * No ORM relation tree or unrelated sensitive fields are written to AuditLog. */
export function auditProjection(row: object, keys: readonly string[]): Record<string, unknown> {
  const source = row as Record<string, unknown>;
  return Object.fromEntries(keys.filter((key) => Object.prototype.hasOwnProperty.call(source, key))
    .map((key) => [key, source[key] === undefined ? null : JSON.parse(JSON.stringify(source[key]))]));
}
