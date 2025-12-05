/**
 * Formats a number as IDR (Indonesian Rupiah) currency
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "Rp 1.234,56")
 */
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0, // IDR doesn't use decimal places in common usage
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Parses a currency string back to a number
 * @param currencyString - The currency string to parse (e.g., "Rp 1.234,56")
 * @returns The parsed number (e.g., 1234.56)
 */
export function parseCurrency(currencyString: string): number {
  // Remove all non-numeric characters except decimal point
  const numericString = currencyString
    .replace(/[^\d,-]/g, '')
    .replace(',', '.');
  
  return parseFloat(numericString) || 0;
}
