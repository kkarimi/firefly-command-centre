export type BudgetStatus = 'ok' | 'watch' | 'risk' | 'review';

export function formatMoney(amount: number, compact = false): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: compact ? 0 : 2,
  }).format(amount);
}

export function formatSignedMoney(amount: number): string {
  const formatted = formatMoney(Math.abs(amount));

  if (amount === 0) {
    return formatted;
  }

  return `${amount > 0 ? '+' : '-'}${formatted}`;
}

export function projectMonthEnd(spent: number, daysElapsed: number, totalDays: number): number {
  if (daysElapsed <= 0 || totalDays <= 0) {
    return spent;
  }

  return spent * (totalDays / Math.min(daysElapsed, totalDays));
}

export function percentUsed(spent: number, limit: number): number {
  if (limit <= 0) {
    return spent > 0 ? 100 : 0;
  }

  return Math.round((spent / limit) * 100);
}

export function budgetStatus(spent: number, limit: number, projected: number, reviewQueue = false): BudgetStatus {
  if (reviewQueue) {
    return spent > 0 ? 'review' : 'ok';
  }

  if (limit <= 0) {
    return spent > 0 ? 'risk' : 'ok';
  }

  if (spent > limit || projected >= limit * 1.08) {
    return 'risk';
  }

  if (projected > limit * 0.95) {
    return 'watch';
  }

  return 'ok';
}

export function remainingBudget(limit: number, spent: number): number {
  return limit - spent;
}
