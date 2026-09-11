/**
 * Supported currencies, centrally defined.
 * The company operates from UAE; international shipping uses USD and AED.
 * TODO: This will later be configurable via CompanySettings rather than hard-coded.
 */
export const SUPPORTED_CURRENCIES = ['USD', 'AED'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export type CurrencyCode = string;
