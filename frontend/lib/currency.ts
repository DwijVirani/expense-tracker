/**
 * Format a number as Indian-style currency (lakh/crore grouping).
 * The symbol and grouping locale are driven by the user's `currency` setting.
 */
export function formatCurrency(amount: number, symbol = "₹"): string {
  // Indian grouping: 12,34,567
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return `${symbol}${formatted}`;
}

export function formatCurrencyFull(amount: number, symbol = "₹"): string {
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${symbol}${formatted}`;
}
