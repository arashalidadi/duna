/**
 * Parses a boolean query-string value correctly. The global ValidationPipe uses
 * `enableImplicitConversion`, which turns the string "false" into `Boolean('false')
 * === true` — the classic pitfall.
 *
 * NOTE: enabling implicit conversion on a class still hazards ordering, so list
 * query DTOs type boolean query params as `string` (`@IsIn(['true', 'false'])`)
 * and convert here instead.
 */
export function parseBooleanFilter(value: string | undefined): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}