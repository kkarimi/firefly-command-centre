export type Tone = 'ok' | 'watch' | 'risk' | 'neutral';

export type BudgetCard = {
  id: string;
  name: string;
  limit: number;
  spent: number;
  daysElapsed: number;
  totalDays: number;
  merchants: string[];
  unusual?: string;
  tone?: Tone;
  reviewQueue?: boolean;
  fireflyBudgetHref?: string;
};

export type ReviewItem = {
  id: string;
  source: string;
  payee: string;
  amount: number;
  ageDays: number;
  reason: string;
  suggestion: string;
  severity: Tone;
  fireflyGroupId: string;
  fireflyEditHref?: string;
  fireflyReviewHref?: string;
};

export type Account = {
  name: string;
  kind: string;
  balance: number;
  freshness: string;
  tone: Tone;
};

export type ExpectedEvent = {
  name: string;
  expected: number;
  actual?: number;
  due: string;
  dateKey?: string;
  status: string;
  tone: Tone;
  fireflyBillHref?: string;
};

export type DailySpend = {
  date: string;
  day: number;
  amount: number;
};

export type MonthOption = {
  key: string;
  label: string;
  shortLabel: string;
  href: string;
  isCurrent: boolean;
};

export type MonthComparison = {
  previous: Pick<MonthOption, 'key' | 'label' | 'shortLabel' | 'href'>;
  spend: number;
  plan: number;
  planUsed: number;
  cash: number;
  reviewRows: number;
  riskBudgets: number;
};

export type DashboardData = {
  period: {
    key: string;
    label: string;
    shortLabel: string;
    range: string;
    start: string;
    end: string;
    balanceDate: string;
    lastRefresh: string;
    daysElapsed: number;
    totalDays: number;
    isCurrent: boolean;
    previous: MonthOption | null;
    history: MonthOption[];
  };
  cash: {
    monzoBalance: number;
    fireflyDrift: number;
    budgetableCash: number;
    committedUntilMonthEnd: number;
    projectedLeft: number;
  };
  dailySpend: DailySpend[];
  ops: Array<{ label: string; value: string; tone: Tone; href?: string }>;
  budgets: BudgetCard[];
  reviewItems: ReviewItem[];
  moneyMap: Record<string, Account[]>;
  expected: Record<string, ExpectedEvent[]>;
  comparison?: MonthComparison;
};

export const dashboardFixture = {
  period: {
    key: '2026-06',
    label: 'June 2026',
    shortLabel: 'Jun 2026',
    range: '1-30 Jun',
    start: '2026-06-01',
    end: '2026-06-30',
    balanceDate: '2026-06-27',
    lastRefresh: '27 Jun 2026, 18:40',
    daysElapsed: 27,
    totalDays: 30,
    isCurrent: true,
    previous: {
      key: '2026-05',
      label: 'May 2026',
      shortLabel: 'May 2026',
      href: '/months/2026-05',
      isCurrent: false,
    },
    history: [
      { key: '2026-06', label: 'June 2026', shortLabel: 'Jun 2026', href: '/months/2026-06', isCurrent: true },
      { key: '2026-05', label: 'May 2026', shortLabel: 'May 2026', href: '/months/2026-05', isCurrent: false },
      { key: '2026-04', label: 'April 2026', shortLabel: 'Apr 2026', href: '/months/2026-04', isCurrent: false },
      { key: '2026-03', label: 'March 2026', shortLabel: 'Mar 2026', href: '/months/2026-03', isCurrent: false },
    ],
  },
  cash: {
    monzoBalance: 5840.24,
    fireflyDrift: -0.09,
    budgetableCash: 4930.24,
    committedUntilMonthEnd: 1810,
    projectedLeft: 3120.24,
  },
  dailySpend: dailySpendFromAmounts('2026-06', [
    84.2, 132.4, 28.8, 214, 45.7, 96.1, 182.3, 64.5, 52.9, 310.2,
    25.4, 74.8, 143.6, 58.1, 420.7, 90.2, 112.4, 38.5, 215.2, 61.3,
    72.6, 104.8, 318.9, 44.2, 52.1, 188.4, 124.6,
  ]),
  ops: [
    { label: 'Repo', value: 'Aligned', tone: 'ok', href: 'https://github.com/kkarimi/firefly-command-centre' },
    { label: 'Firefly', value: 'Online', tone: 'ok', href: '/actions/firefly' },
    { label: 'Monzo', value: '7m ago', tone: 'ok' },
    { label: 'Kraken', value: '41m ago', tone: 'ok' },
    { label: 'Backup', value: '03:14', tone: 'ok' },
    { label: 'Restore', value: 'Passed', tone: 'ok' },
    { label: 'Pico', value: 'Healthy', tone: 'ok' },
    { label: 'Alerts', value: 'Telegram ok', tone: 'ok' },
  ] satisfies Array<{ label: string; value: string; tone: Tone; href?: string }>,
  budgets: [
    {
      id: 'bills',
      name: 'Bills & Utilities',
      limit: 2100,
      spent: 1824.4,
      daysElapsed: 27,
      totalDays: 30,
      merchants: ['Mortgage reserve', 'Energy Co', 'Council tax'],
      tone: 'ok',
      fireflyBudgetHref: '/actions/firefly/budgets/show?budgetId=bills',
    },
    {
      id: 'groceries',
      name: 'Groceries',
      limit: 720,
      spent: 696.1,
      daysElapsed: 27,
      totalDays: 30,
      merchants: ['Waitrose', 'Sainsbury', 'Ocado'],
      unusual: 'Weekend shop higher than trailing average',
      tone: 'watch',
      fireflyBudgetHref: '/actions/firefly/budgets/show?budgetId=groceries',
    },
    {
      id: 'eating-out',
      name: 'Eating Out',
      limit: 420,
      spent: 507.2,
      daysElapsed: 27,
      totalDays: 30,
      merchants: ['Dishoom', 'Pret', 'Local pub'],
      unusual: 'Already over monthly target',
      tone: 'risk',
      fireflyBudgetHref: '/actions/firefly/budgets/show?budgetId=eating-out',
    },
    {
      id: 'shopping',
      name: 'Shopping & Personal',
      limit: 520,
      spent: 336.79,
      daysElapsed: 27,
      totalDays: 30,
      merchants: ['John Lewis', 'Boots', 'Apple'],
      tone: 'ok',
      fireflyBudgetHref: '/actions/firefly/budgets/show?budgetId=shopping',
    },
    {
      id: 'transport',
      name: 'Transport',
      limit: 260,
      spent: 202.35,
      daysElapsed: 27,
      totalDays: 30,
      merchants: ['TfL', 'Uber', 'Parking'],
      tone: 'ok',
      fireflyBudgetHref: '/actions/firefly/budgets/show?budgetId=transport',
    },
    {
      id: 'travel',
      name: 'Travel & Holidays',
      limit: 650,
      spent: 610.58,
      daysElapsed: 27,
      totalDays: 30,
      merchants: ['Eurostar', 'Hotel hold', 'Airline'],
      unusual: 'Statement hold awaiting AMEX import',
      tone: 'watch',
      fireflyBudgetHref: '/actions/firefly/budgets/show?budgetId=travel',
    },
    {
      id: 'review',
      name: 'General / Review',
      limit: 0,
      spent: 384.22,
      daysElapsed: 27,
      totalDays: 30,
      merchants: ['Unknown presentment', 'Imported adjustment', 'New payee'],
      unusual: 'Leakage queue contains material spend',
      tone: 'risk',
      reviewQueue: true,
      fireflyBudgetHref: '/actions/firefly/budgets/show?budgetId=review',
    },
  ] satisfies BudgetCard[],
  reviewItems: [
    {
      id: 'tx-20491',
      source: 'AMEX',
      payee: 'Unknown card presentment',
      amount: -184.2,
      ageDays: 2,
      reason: 'Missing category and statement marker',
      suggestion: 'Travel & Holidays, tag statement-review',
      severity: 'risk',
      fireflyGroupId: 'grp_9A2F',
      fireflyEditHref: '/actions/firefly/transactions/edit?groupId=grp_9A2F',
      fireflyReviewHref: '/actions/firefly/transactions/review?groupId=grp_9A2F&month=2026-06',
    },
    {
      id: 'tx-20477',
      source: 'Monzo',
      payee: 'New local merchant',
      amount: -42.8,
      ageDays: 3,
      reason: 'Payee not mapped by rules',
      suggestion: 'Eating Out, create deterministic payee rule',
      severity: 'watch',
      fireflyGroupId: 'grp_87B1',
      fireflyEditHref: '/actions/firefly/transactions/edit?groupId=grp_87B1',
      fireflyReviewHref: '/actions/firefly/transactions/review?groupId=grp_87B1&month=2026-06',
    },
    {
      id: 'tx-20402',
      source: 'Monzo',
      payee: 'Cash movement',
      amount: -2000,
      ageDays: 5,
      reason: 'Material transfer outside household budgets',
      suggestion: 'Transfers, Savings & Investments; tag cash-movement',
      severity: 'watch',
      fireflyGroupId: 'grp_7C41',
      fireflyEditHref: '/actions/firefly/transactions/edit?groupId=grp_7C41',
      fireflyReviewHref: '/actions/firefly/transactions/review?groupId=grp_7C41&month=2026-06',
    },
    {
      id: 'tx-20388',
      source: 'Firefly',
      payee: 'Generated payee 1842',
      amount: -18.99,
      ageDays: 7,
      reason: 'Generated name still visible',
      suggestion: 'Rewrite payee from import metadata',
      severity: 'neutral',
      fireflyGroupId: 'grp_5B01',
      fireflyEditHref: '/actions/firefly/transactions/edit?groupId=grp_5B01',
      fireflyReviewHref: '/actions/firefly/transactions/review?groupId=grp_5B01&month=2026-06',
    },
  ] satisfies ReviewItem[],
  moneyMap: {
    budgetableCash: [
      { name: 'Monzo current', kind: 'Primary cash', balance: 5840.24, freshness: '7m ago', tone: 'ok' },
      { name: 'Monzo savings', kind: 'Reserve cash', balance: 1250, freshness: '7m ago', tone: 'ok' },
    ],
    creditAndLiabilities: [
      { name: 'AMEX', kind: 'Credit card', balance: -1434.82, freshness: 'Statement checked', tone: 'watch' },
      { name: 'M&S loan', kind: 'Active liability', balance: -8430.16, freshness: 'API balance', tone: 'ok' },
      { name: 'Closed loan archive', kind: 'Paid off', balance: 0, freshness: 'Verified', tone: 'neutral' },
    ],
    wealth: [
      { name: 'Prosper SIPP', kind: 'Pension', balance: 48650, freshness: 'Manual, 21 Jun', tone: 'watch' },
      { name: 'Prosper ISA', kind: 'Investment', balance: 14220, freshness: 'Manual, 21 Jun', tone: 'watch' },
      { name: 'Fixed-term deposit', kind: 'Cash asset', balance: 10000, freshness: 'Matures 17 Oct', tone: 'ok' },
      { name: 'Gold holdings', kind: 'Manual asset', balance: 6120, freshness: 'Manual, 18 Jun', tone: 'watch' },
      { name: 'Kraken portfolio', kind: 'Crypto', balance: 2940.33, freshness: '41m ago', tone: 'ok' },
    ],
    excluded: [
      { name: 'House purchase', kind: 'Project bucket', balance: 15200, freshness: 'Excluded from bills', tone: 'neutral' },
      { name: 'Own-company loans', kind: 'Cash movements', balance: 3800, freshness: 'Tagged, not income', tone: 'neutral' },
      { name: 'Kraken cost basis', kind: 'Accounting account', balance: -1210, freshness: 'Sync managed', tone: 'neutral' },
    ],
  } satisfies Record<string, Account[]>,
  expected: {
    income: [
      {
        name: 'Super Payments salary',
        expected: 5400,
        actual: 5400,
        due: 'Paid 26 Jun',
        dateKey: '2026-06-26',
        status: 'Matched',
        tone: 'ok',
      },
      {
        name: 'WEFINDFLATS base salary',
        expected: 2400,
        actual: 2400,
        due: 'Paid 25 Jun',
        dateKey: '2026-06-25',
        status: 'Matched',
        tone: 'ok',
      },
      { name: 'WEFINDFLATS variable income', expected: 0, actual: 1500, due: 'Ad hoc', status: 'Bonus tagged separately', tone: 'neutral' },
    ],
    obligations: [
      {
        name: 'HMRC payment on account',
        expected: 2000,
        due: '31 Jul',
        dateKey: '2026-07-31',
        status: 'Outstanding',
        tone: 'watch',
        fireflyBillHref: '/actions/firefly/bills/show?billId=hmrc-payment-on-account',
      },
      {
        name: 'AMEX statement payment',
        expected: 1434.82,
        due: '4 Jul',
        dateKey: '2026-07-04',
        status: 'Awaiting bank-side transfer',
        tone: 'watch',
        fireflyBillHref: '/actions/firefly/bills/show?billId=amex-statement-payment',
      },
      {
        name: 'Council tax',
        expected: 214,
        actual: 214,
        due: 'Paid 3 Jun',
        dateKey: '2026-06-03',
        status: 'Matched',
        tone: 'ok',
      },
    ],
    candidates: [
      { name: 'Apple services', expected: 12.99, actual: 12.99, due: 'Seen once', status: 'One-off expense', tone: 'neutral' },
      {
        name: 'Private health provider',
        expected: 0,
        due: 'No longer recurring',
        status: 'Do not create bill',
        tone: 'neutral',
        fireflyBillHref: '/actions/firefly/bills/show?billId=private-health-provider',
      },
    ],
  } satisfies Record<string, ExpectedEvent[]>,
  comparison: {
    previous: { key: '2026-05', label: 'May 2026', shortLabel: 'May 2026', href: '/months/2026-05' },
    spend: 4561.64,
    plan: 4670,
    planUsed: 98,
    cash: 2860.1,
    reviewRows: 6,
    riskBudgets: 2,
  },
} satisfies DashboardData;

function dailySpendFromAmounts(monthKey: string, amounts: number[]): DailySpend[] {
  return amounts.map((amount, index) => ({
    date: `${monthKey}-${String(index + 1).padStart(2, '0')}`,
    day: index + 1,
    amount,
  }));
}
