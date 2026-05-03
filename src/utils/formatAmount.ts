/**
 * Formats an amount with currency symbol
 * @param amount - The amount to format
 * @param currency - Optional currency code (RUB, USD, EUR, GBP)
 * @returns Formatted string with currency symbol
 */
export function formatAmount(amount: number, currency?: string): string {
  const getCurrencySymbol = (curr?: string): string => {
    switch (curr) {
      case "USD": return "$";
      case "EUR": return "€";
      case "GBP": return "£";
      case "RUB":
      default:
        return "₽";
    }
  };

  const symbol = getCurrencySymbol(currency);
  const formatted = Math.abs(amount).toFixed(2);
  
  return `${formatted} ${symbol}`;
}
