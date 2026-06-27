import { describe, expect, it } from 'vitest';
import { budgetStatus, formatMoney, percentUsed, projectMonthEnd, remainingBudget } from './money';

describe('money helpers', () => {
  it('formats GBP values for dashboard display', () => {
    expect(formatMoney(1234.5)).toBe('\u00a31,234.50');
    expect(formatMoney(1234.5, true)).toBe('\u00a31,235');
  });

  it('projects month-end spend from elapsed days', () => {
    expect(projectMonthEnd(900, 15, 30)).toBe(1800);
    expect(projectMonthEnd(900, 0, 30)).toBe(900);
  });

  it('keeps review queues visibly distinct from ordinary budgets', () => {
    expect(budgetStatus(20, 0, 20, true)).toBe('review');
    expect(budgetStatus(0, 0, 0, true)).toBe('ok');
  });

  it('classifies projected overspend before month-end', () => {
    expect(percentUsed(475, 500)).toBe(95);
    expect(remainingBudget(500, 475)).toBe(25);
    expect(budgetStatus(475, 500, 540)).toBe('risk');
    expect(budgetStatus(430, 500, 480)).toBe('watch');
  });
});
