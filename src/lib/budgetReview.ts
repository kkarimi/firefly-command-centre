import type { BudgetCard } from '../data/fixtures';
import { budgetStatus, formatMoney, percentUsed, projectMonthEnd, remainingBudget, type BudgetStatus } from './money';

export type BudgetReviewTarget = {
  action: string;
  budget: BudgetCard;
  budgetId: string;
  guidance: string;
  projected: number;
  remaining: number;
  status: BudgetStatus;
  statusLabel: string;
  used: number;
};

const statusLabels: Record<BudgetStatus, string> = {
  ok: 'On track',
  watch: 'Tight',
  risk: 'Overrun',
  review: 'Review',
};

export function findBudgetReviewTarget({ budgetId, budgets }: { budgetId: string; budgets: BudgetCard[] }) {
  const cleanId = budgetId.trim();
  if (!cleanId) {
    return null;
  }

  const budget = budgets.find((entry) => budgetActionId(entry.fireflyBudgetHref) === cleanId);
  if (!budget) {
    return null;
  }

  return budgetReviewTarget({ budget, budgetId: cleanId });
}

export function budgetActionId(href: string | undefined) {
  if (!href) {
    return '';
  }

  try {
    return new URL(href, 'https://finances.home').searchParams.get('budgetId') ?? '';
  } catch {
    return '';
  }
}

export function budgetReviewCopyText({ fireflyHref, target }: { fireflyHref: string | undefined; target: BudgetReviewTarget }) {
  return [
    `Firefly budget: ${target.budgetId}`,
    `Name: ${target.budget.name}`,
    `Spent: ${formatMoney(target.budget.spent)}`,
    `Plan: ${formatMoney(target.budget.limit)}`,
    `Remaining: ${formatMoney(target.remaining)}`,
    `Projected: ${formatMoney(target.projected)}`,
    `Status: ${target.statusLabel}`,
    `Action: ${target.action}`,
    fireflyHref ? `Open: ${fireflyHref}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function budgetReviewTarget({ budget, budgetId }: { budget: BudgetCard; budgetId: string }): BudgetReviewTarget {
  const projected = projectMonthEnd(budget.spent, budget.daysElapsed, budget.totalDays);
  const remaining = remainingBudget(budget.limit, budget.spent);
  const status = budgetStatus(budget.spent, budget.limit, projected, budget.reviewQueue);

  return {
    action: budgetAction(status),
    budget,
    budgetId,
    guidance: budgetGuidance(status),
    projected,
    remaining,
    status,
    statusLabel: statusLabels[status],
    used: percentUsed(budget.spent, budget.limit),
  };
}

function budgetGuidance(status: BudgetStatus) {
  if (status === 'review') {
    return 'Classify the review rows or confirm why they should stay outside household spend.';
  }

  if (status === 'risk') {
    return 'This budget is over plan or forecast to finish over plan. Check the rows before adding more spend.';
  }

  if (status === 'watch') {
    return 'This budget is close to plan. Confirm the top merchants and forecast before adding more spend.';
  }

  return 'No budget warning is active. Use Firefly only if the ledger rows need inspection.';
}

function budgetAction(status: BudgetStatus) {
  if (status === 'review') {
    return 'Open the Firefly budget to reclassify leakage rows or confirm they remain review work.';
  }

  if (status === 'risk') {
    return 'Inspect spend rows, top merchants, and the budget limit in Firefly.';
  }

  if (status === 'watch') {
    return 'Check the forecast, recent merchants, and remaining room in Firefly.';
  }

  return 'No review action is currently queued for this budget.';
}
