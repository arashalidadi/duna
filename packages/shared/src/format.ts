export const SYMBOL_LOOKUP: Record<string, string> = {
  USD: '$',
  AED: 'د.إ',
};

/**
 * Format a decimal value into a currency string without importing locale
 * implementation dependencies. Used consistently across API and UI.
 */
export function formatCurrency(value: number, currency: string): string {
  const symbol = SYMBOL_LOOKUP[currency] ?? currency;
  return `${symbol}${value.toFixed(2)}`;
}
