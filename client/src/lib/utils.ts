import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Transaction } from "@shared/schema"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function filterCardBillPayments(
  transactionsToFilter: Transaction[],
  allTransactions?: Transaction[]
): Transaction[] {
  const reference = allTransactions || transactionsToFilter;
  const importedBillMonths = new Set<string>();
  for (const t of reference) {
    if (t.source === 'cartao' && t.cardBillMonth && !t.isCardBillPayment) {
      importedBillMonths.add(t.cardBillMonth);
    }
  }
  return transactionsToFilter.filter(t => {
    if (!t.isCardBillPayment) return true;
    const billMonth = t.cardBillMonth || deriveBillMonthFromDate(t.date);
    if (!billMonth) return true;
    return !importedBillMonths.has(billMonth);
  });
}

function deriveBillMonthFromDate(dateStr: string | Date): string | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}
