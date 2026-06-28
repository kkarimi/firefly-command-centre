import { readFileSync } from 'node:fs';
import {
  dashboardFixture,
  type Account,
  type BudgetCard,
  type DashboardData,
  type ExpectedEvent,
  type ReviewItem,
  type Tone,
} from '../data/fixtures';
import { budgetStatus, percentUsed, projectMonthEnd } from '../lib/money';

type FireflyDocument<T> = {
  data: T[];
};

type FireflyResource = {
  id: string;
  attributes?: Record<string, unknown>;
};

type FireflySplit = Record<string, unknown>;

type LoadDashboardOptions = {
  bypassCache?: boolean;
  month?: string | null;
};

type DashboardCacheEntry = {
  expiresAt: number;
  promise: Promise<DashboardData>;
};

const householdBudgetNames = [
  'Bills & Utilities',
  'Groceries',
  'Eating Out',
  'Shopping & Personal',
  'Transport',
  'Travel & Holidays',
  'General / Review',
];

const historyMonthCount = 12;
const dashboardCache = new Map<string, DashboardCacheEntry>();

function dashboardCacheTtlMs() {
  const value = Number.parseInt(process.env.FIREFLY_DASHBOARD_CACHE_TTL_SECONDS ?? '90', 10);
  return Number.isFinite(value) && value > 0 ? value * 1000 : 90_000;
}

export async function loadDashboardData(options: LoadDashboardOptions = {}): Promise<DashboardData> {
  const period = buildMonthPeriod(options.month ?? currentMonthKey());
  if (!period) {
    throw new Error(`Invalid month: ${options.month}`);
  }

  if (!options.bypassCache) {
    return loadDashboardDataCached(period);
  }

  return buildDashboardData(period);
}

async function loadDashboardDataCached(period: DashboardData['period']) {
  const now = Date.now();
  const cacheKey = period.key;
  const cached = dashboardCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return structuredClone(await cached.promise);
  }

  const promise = buildDashboardData(period);
  dashboardCache.set(cacheKey, { expiresAt: now + dashboardCacheTtlMs(), promise });

  try {
    return structuredClone(await promise);
  } catch (error) {
    dashboardCache.delete(cacheKey);
    throw error;
  }
}

async function buildDashboardData(period: DashboardData['period']): Promise<DashboardData> {
  const data = cloneFixture();
  applyPeriod(data, period);

  const token = fireflyToken();
  if (!token) {
    markOps(data, 'Firefly', 'Fixture', 'watch');
    return data;
  }

  try {
    prepareLiveData(data);

    const [accounts, budgets, bills, transactions] = await Promise.all([
      loadAccounts(token, data.period),
      loadBudgets(token, data.period),
      loadBills(token),
      loadTransactions(token, data.period),
    ]);

    applyAccounts(data, accounts);
    applyBudgets(data, budgets, transactions);
    applyReviewItems(data, transactions);
    applyExpected(data, transactions, bills);
    applyDailySpend(data, transactions);
    await applyPreviousMonthComparison(data, token);
    markOps(data, 'Firefly', 'Live', 'ok');
    markOps(data, 'Repo', 'Live app', 'ok');
  } catch (error) {
    markOps(data, 'Firefly', 'API failed', 'risk');
    data.reviewItems = [
      {
        id: 'firefly-api-error',
        source: 'Finance UI',
        payee: 'Firefly API',
        amount: 0,
        ageDays: 0,
        reason: error instanceof Error ? error.message : 'Live Firefly load failed',
        suggestion: 'Check FIREFLY_BASE_URL and FIREFLY_TOKEN_FILE on Umbrel',
        severity: 'risk',
        fireflyGroupId: 'runtime',
      },
      ...data.reviewItems,
    ];
  }

  return data;
}

export async function loadHealthStatus() {
  const token = fireflyToken();
  if (!token) {
    return { ok: false, mode: 'fixture', firefly: 'token-missing' };
  }

  try {
    await fireflyGet<FireflyResource>(token, '/about');
    return { ok: true, mode: 'live', firefly: 'ok' };
  } catch (error) {
    return {
      ok: false,
      mode: 'live',
      firefly: error instanceof Error ? error.message : 'failed',
    };
  }
}

function cloneFixture(): DashboardData {
  return structuredClone(dashboardFixture);
}

function prepareLiveData(data: DashboardData) {
  data.cash = {
    monzoBalance: 0,
    fireflyDrift: 0,
    budgetableCash: 0,
    committedUntilMonthEnd: 0,
    projectedLeft: 0,
  };
  data.dailySpend = [];
  data.budgets = [];
  data.reviewItems = [];
  data.moneyMap = {
    budgetableCash: [],
    creditAndLiabilities: [],
    wealth: [],
    excluded: [],
  };
  data.expected = {
    income: [],
    obligations: [],
    candidates: [],
  };
  data.comparison = undefined;
  data.ops = data.ops.map((item) => {
    if (item.label === 'Repo' || item.label === 'Firefly') {
      return { ...item, value: 'Checking', tone: 'watch' };
    }

    return { ...item, value: 'Not wired', tone: 'neutral' };
  });
}

export function isSelectableMonthKey(value: string | null | undefined, now = new Date()) {
  const parsed = parseMonthKey(value);
  if (!parsed) {
    return false;
  }

  const selected = parsed.year * 12 + parsed.monthIndex;
  const current = now.getFullYear() * 12 + now.getMonth();
  return selected <= current;
}

export function currentMonthKey(now = new Date()) {
  return monthKey(now.getFullYear(), now.getMonth());
}

export function buildMonthPeriod(value: string, now = new Date()): DashboardData['period'] | null {
  const parsed = parseMonthKey(value);
  if (!parsed || !isSelectableMonthKey(value, now)) {
    return null;
  }

  const start = new Date(parsed.year, parsed.monthIndex, 1);
  const end = new Date(parsed.year, parsed.monthIndex + 1, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isCurrent = parsed.year === now.getFullYear() && parsed.monthIndex === now.getMonth();
  const formatDayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  const formatMonth = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
  const formatShortMonth = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' });
  const formatRefresh = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/London',
  });

  return {
    key: monthKey(parsed.year, parsed.monthIndex),
    label: formatMonth.format(start),
    shortLabel: formatShortMonth.format(start),
    range: `${formatDayMonth.format(start)}-${formatDayMonth.format(end)}`,
    start: isoDate(start),
    end: isoDate(end),
    balanceDate: isoDate(isCurrent ? today : end),
    lastRefresh: formatRefresh.format(now).replace(',', ''),
    daysElapsed: isCurrent ? Math.min(now.getDate(), end.getDate()) : end.getDate(),
    totalDays: end.getDate(),
    isCurrent,
    previous: monthOption(addMonths(start, -1), now),
    history: monthHistory(now, start),
  };
}

function applyPeriod(data: DashboardData, period: DashboardData['period']) {
  data.period = period;
  if (data.comparison && data.comparison.previous.key >= period.key) {
    data.comparison = undefined;
  }
  data.dailySpend = remapDailySpend(data.dailySpend, period);
  data.budgets = data.budgets.map((budget) => ({
    ...budget,
    daysElapsed: period.daysElapsed,
    totalDays: period.totalDays,
  }));
}

async function applyPreviousMonthComparison(data: DashboardData, token: string) {
  if (!data.period.previous) {
    return;
  }

  try {
    const previousPeriod = buildMonthPeriod(data.period.previous.key);
    if (!previousPeriod) {
      return;
    }

    const [accounts, budgets, transactions] = await Promise.all([
      loadAccounts(token, previousPeriod),
      loadBudgets(token, previousPeriod),
      loadTransactions(token, previousPeriod),
    ]);
    data.comparison = {
      previous: {
        key: data.period.previous.key,
        label: data.period.previous.label,
        shortLabel: data.period.previous.shortLabel,
        href: data.period.previous.href,
      },
      ...monthSnapshot(previousPeriod, accounts, budgets, transactions),
    };
  } catch {
    data.comparison = undefined;
  }
}

function monthSnapshot(
  period: DashboardData['period'],
  accounts: FireflyResource[],
  budgets: FireflyResource[],
  transactions: FireflyResource[],
) {
  const snapshot = cloneFixture();
  applyPeriod(snapshot, period);
  prepareLiveData(snapshot);
  applyAccounts(snapshot, accounts);
  applyBudgets(snapshot, budgets, transactions);
  applyReviewItems(snapshot, transactions);
  applyExpected(snapshot, transactions, []);
  applyDailySpend(snapshot, transactions);

  const visibleBudgets = snapshot.budgets.filter(isVisibleSnapshotBudget);
  const spend = visibleBudgets.reduce((sum, budget) => sum + budget.spent, 0);
  const plan = visibleBudgets.reduce((sum, budget) => sum + budget.limit, 0);
  const riskBudgets = visibleBudgets.filter((budget) => {
    const projected = projectMonthEnd(budget.spent, budget.daysElapsed, budget.totalDays);
    return budgetStatus(budget.spent, budget.limit, projected, budget.reviewQueue) === 'risk';
  }).length;

  return {
    spend,
    plan,
    planUsed: percentUsed(spend, plan),
    cash: snapshot.cash.projectedLeft,
    reviewRows: snapshot.reviewItems.length,
    riskBudgets,
  };
}

function isVisibleSnapshotBudget(budget: BudgetCard) {
  return !budget.reviewQueue || budget.spent > 0 || budget.merchants.length > 0 || Boolean(budget.unusual);
}

function monthHistory(now: Date, selected: Date) {
  const months = Array.from({ length: historyMonthCount }, (_, index) =>
    monthOption(addMonths(new Date(now.getFullYear(), now.getMonth(), 1), -index), now),
  );
  const selectedOption = monthOption(selected, now);

  if (months.some((month) => month.key === selectedOption.key)) {
    return months;
  }

  return [...months, selectedOption];
}

function monthOption(date: Date, now: Date) {
  const key = monthKey(date.getFullYear(), date.getMonth());
  const label = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(date);
  const shortLabel = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(date);
  return {
    key,
    label,
    shortLabel,
    href: `/months/${key}`,
    isCurrent: key === currentMonthKey(now),
  };
}

function parseMonthKey(value: string | null | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1] ?? '', 10);
  const month = Number.parseInt(match[2] ?? '', 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || year < 2000 || month < 1 || month > 12) {
    return null;
  }

  return { year, monthIndex: month - 1 };
}

function addMonths(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function monthKey(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function markOps(data: DashboardData, label: string, value: string, tone: Tone) {
  const item = data.ops.find((entry) => entry.label === label);
  if (item) {
    item.value = value;
    item.tone = tone;
  }
}

function fireflyToken() {
  if (process.env.FIREFLY_TOKEN?.trim()) {
    return process.env.FIREFLY_TOKEN.trim();
  }

  const tokenFile = process.env.FIREFLY_TOKEN_FILE;
  if (!tokenFile) {
    return null;
  }

  try {
    return readFileSync(tokenFile, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

function apiBase() {
  const base = (process.env.FIREFLY_BASE_URL || 'http://127.0.0.1:18080').replace(/\/+$/, '');
  return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
}

async function fireflyGet<T>(token: string, path: string, params?: Record<string, string>) {
  const url = new URL(`${apiBase()}${path.startsWith('/') ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Firefly ${path} returned HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

async function loadAccounts(token: string, period: DashboardData['period']) {
  const groups = await Promise.allSettled([
    loadCollection(token, '/accounts', { type: 'asset', date: period.balanceDate, limit: '200' }),
    loadCollection(token, '/accounts', { type: 'liabilities', date: period.balanceDate, limit: '200' }),
  ]);
  return groups.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
}

async function loadBudgets(token: string, period: DashboardData['period']) {
  const { start, end } = monthApiRange(period);
  return loadCollection(token, '/budgets', { start, end, limit: '100' });
}

async function loadBills(token: string) {
  return loadCollection(token, '/bills', { limit: '100' });
}

async function loadTransactions(token: string, period: DashboardData['period']) {
  const { start, end } = monthApiRange(period);
  return loadCollection(token, '/transactions', { start, end, limit: '200' });
}

async function loadCollection(token: string, path: string, params: Record<string, string>) {
  const response = await fireflyGet<FireflyDocument<FireflyResource>>(token, path, params);
  return response.data ?? [];
}

function monthApiRange(period: DashboardData['period']) {
  return {
    start: period.start,
    end: period.end,
  };
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function applyAccounts(data: DashboardData, accounts: FireflyResource[]) {
  const mapped = accounts.map(accountFromResource).filter((account): account is Account => account !== null);
  if (mapped.length === 0) {
    return;
  }

  const budgetable = mapped.filter((account) => /monzo/i.test(account.name) && account.balance >= 0);
  const liabilities = mapped.filter((account) => /amex|loan|liabil|credit|m&s|m & s/i.test(`${account.name} ${account.kind}`));
  const excluded = mapped.filter((account) => /house|company|cost basis|contribution/i.test(account.name));
  const wealth = mapped.filter(
    (account) => /prosper|kraken|gold|sipp|isa|gia|fixed/i.test(account.name) && !excluded.includes(account),
  );

  data.moneyMap.budgetableCash = budgetable.slice(0, 8);
  const budgetableCash = budgetable.reduce((sum, account) => sum + account.balance, 0);
  data.cash.budgetableCash = budgetableCash;
  data.cash.monzoBalance = budgetable[0]?.balance ?? 0;
  data.cash.projectedLeft = budgetableCash - data.cash.committedUntilMonthEnd;

  data.moneyMap.creditAndLiabilities = liabilities.slice(0, 8);
  data.moneyMap.wealth = wealth.slice(0, 10);
  data.moneyMap.excluded = excluded.slice(0, 8);
}

function accountFromResource(resource: FireflyResource): Account | null {
  const attributes = resource.attributes ?? {};
  const name = stringValue(attributes.name);
  if (!name) {
    return null;
  }

  const balance = numberValue(attributes.current_balance ?? attributes.virtual_balance);
  const kind = stringValue(attributes.type) || 'Account';
  const updated = stringValue(attributes.updated_at) || stringValue(attributes.created_at);

  return {
    name,
    kind: titleCase(kind.replaceAll('_', ' ')),
    balance,
    freshness: updated ? `Updated ${updated.slice(0, 10)}` : 'Live Firefly',
    tone: accountTone({ kind, name, updatedAt: updated }),
  };
}

export function accountTone({
  kind,
  name,
  now = new Date(),
  updatedAt,
}: {
  kind: string;
  name: string;
  now?: Date;
  updatedAt?: string;
}): Tone {
  const text = `${name} ${kind}`;

  if (/amex|prosper|gold|fixed|manual|house|company|cost basis|contribution/i.test(text)) {
    return 'watch';
  }

  return isStaleAccountUpdate({ now, updatedAt }) ? 'watch' : 'ok';
}

function isStaleAccountUpdate({ now, updatedAt }: { now: Date; updatedAt?: string }) {
  const updatedTime = utcTimeFromDateKey(updatedAt?.slice(0, 10) ?? '');
  if (!Number.isFinite(updatedTime)) {
    return false;
  }

  const nowTime = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((nowTime - updatedTime) / 86_400_000) > 7;
}

function utcTimeFromDateKey(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return Number.NaN;
  }

  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function applyBudgets(data: DashboardData, budgets: FireflyResource[], transactions: FireflyResource[]) {
  if (budgets.length === 0) {
    return;
  }

  const merchantsByBudget = topMerchantsByBudget(transactions);
  data.budgets = householdBudgetNames.flatMap((name) => {
    const live = budgets.find((budget) => stringValue(budget.attributes?.name).toLowerCase() === name.toLowerCase());
    if (!live?.attributes) {
      return [];
    }

    const spent = Math.abs(spentFromBudget(live.attributes));
    const limit = limitFromBudget(live.attributes);
    const reviewQueue = /review/i.test(name);
    const card = {
      id: slugify(name),
      name,
      limit,
      spent,
      daysElapsed: data.period.daysElapsed,
      totalDays: data.period.totalDays,
      merchants: merchantsByBudget.get(name)?.slice(0, 3) ?? [],
      unusual: reviewQueue && spent > 0 ? 'Live review queue contains material spend' : undefined,
      reviewQueue,
      fireflyBudgetHref: fireflyBudgetActionHref(live.id),
    } satisfies BudgetCard;
    return [card];
  });
}

function topMerchantsByBudget(transactions: FireflyResource[]) {
  const totals = new Map<string, Map<string, number>>();
  for (const split of transactionSplits(transactions)) {
    const budget = stringValue(split.budget_name);
    const merchant = payeeName(split);
    const type = stringValue(split.type);
    if (!budget || !merchant || type !== 'withdrawal') {
      continue;
    }

    const merchants = totals.get(budget) ?? new Map<string, number>();
    merchants.set(merchant, (merchants.get(merchant) ?? 0) + Math.abs(numberValue(split.amount)));
    totals.set(budget, merchants);
  }

  return new Map(
    [...totals.entries()].map(([budget, merchants]) => [
      budget,
      [...merchants.entries()]
        .sort(([, left], [, right]) => right - left)
        .map(([merchant]) => merchant),
    ]),
  );
}

function spentFromBudget(attributes: Record<string, unknown>) {
  const spent = attributes.spent;
  if (Array.isArray(spent)) {
    return spent.reduce((sum, entry) => sum + numberValue((entry as Record<string, unknown>).sum), 0);
  }

  return numberValue(spent);
}

function limitFromBudget(attributes: Record<string, unknown>) {
  for (const key of ['amount', 'auto_budget_amount', 'current_limit', 'limit']) {
    const value = attributes[key];
    if (typeof value === 'object' && value !== null) {
      const nested = value as Record<string, unknown>;
      const amount = numberValue(nested.amount ?? nested.sum);
      if (amount) {
        return amount;
      }
    }

    const amount = numberValue(value);
    if (amount) {
      return amount;
    }
  }

  return 0;
}

function applyReviewItems(data: DashboardData, transactions: FireflyResource[]) {
  const items: ReviewItem[] = [];

  for (const { group, split } of transactionSplitEntries(transactions)) {
    const review = reviewReason(split);
    if (!review) {
      continue;
    }

    const signed = signedAmount(split);
    items.push({
      id: stringValue(split.transaction_journal_id) || `${group.id}-${items.length}`,
      source: stringValue(split.source_name) || 'Firefly',
      payee: payeeName(split) || 'Review transaction',
      amount: signed,
      ageDays: ageDays(stringValue(split.date), data.period.isCurrent ? new Date() : new Date(data.period.end)),
      reason: review.reason,
      suggestion: review.suggestion,
      severity: Math.abs(signed) > 100 ? 'risk' : 'watch',
      fireflyGroupId: group.id,
      fireflyEditHref: fireflyTransactionActionHref(group.id),
    });
  }

  data.reviewItems = items.sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount)).slice(0, 12);
}

export function reviewReason(split: FireflySplit) {
  const category = stringValue(split.category_name);
  const budget = stringValue(split.budget_name);
  const tags = tagsFromSplit(split);
  const type = stringValue(split.type);
  const amount = Math.abs(numberValue(split.amount));
  const text = `${category} ${budget} ${tags.join(' ')} ${stringValue(split.description)}`;

  if (/review|uncategor|setup/i.test(text)) {
    return {
      reason: category ? `Review marker: ${category}` : 'Review marker present',
      suggestion: 'Decide category, budget, tags, and future rule',
    };
  }

  if (!category) {
    return {
      reason: 'Missing category',
      suggestion: 'Assign a category or mark as transfer/accounting movement',
    };
  }

  if (type === 'withdrawal' && !budget && isHouseholdCategory(category) && amount >= 25) {
    return {
      reason: 'Household spend has no budget',
      suggestion: `Attach to ${categoryBudgetSuggestion(category)} or confirm it stays outside budgets`,
    };
  }

  if (/^general$/i.test(category) && amount >= 25) {
    if (type !== 'withdrawal') {
      return {
        reason: 'Generic category on material cash-in',
        suggestion: 'Confirm income, transfer, or accounting category instead of General',
      };
    }

    return {
      reason: 'Generic category on material row',
      suggestion: 'Replace General with the smallest useful household category',
    };
  }

  return null;
}

export function fireflyTransactionEditHref(transactionGroupId: string) {
  const cleanId = transactionGroupId.trim();
  if (!cleanId) {
    return undefined;
  }

  return `${fireflyWebBase()}/transactions/edit/${encodeURIComponent(cleanId)}`;
}

export function fireflyTransactionActionHref(transactionGroupId: string) {
  const cleanId = transactionGroupId.trim();
  if (!cleanId) {
    return undefined;
  }

  return `/actions/firefly/transactions/edit?groupId=${encodeURIComponent(cleanId)}`;
}

export function fireflyBudgetHref(budgetId: string) {
  const cleanId = budgetId.trim();
  if (!cleanId) {
    return undefined;
  }

  return `${fireflyWebBase()}/budgets/show/${encodeURIComponent(cleanId)}`;
}

export function fireflyBudgetActionHref(budgetId: string) {
  const cleanId = budgetId.trim();
  if (!cleanId) {
    return undefined;
  }

  return `/actions/firefly/budgets/show?budgetId=${encodeURIComponent(cleanId)}`;
}

export function fireflyHomeHref() {
  return fireflyWebBase();
}

function fireflyWebBase() {
  return (process.env.FIREFLY_WEB_URL || 'https://firefly.home').replace(/\/+$/, '');
}

function applyExpected(data: DashboardData, transactions: FireflyResource[], bills: FireflyResource[]) {
  const splits = transactionSplits(transactions);
  data.expected.income = expectedIncome(splits);
  data.expected.obligations = expectedObligations(splits, bills, data.period);
  data.expected.candidates = expectedBillCandidates(bills, data.period);

  const remainingMonthBills = data.expected.obligations
    .filter((event) => event.status === 'Upcoming')
    .filter((event) => isPeriodDue(event, data.period))
    .reduce((sum, event) => sum + event.expected, 0);

  data.cash.committedUntilMonthEnd = remainingMonthBills;
  data.cash.projectedLeft = data.cash.budgetableCash - remainingMonthBills;
}

function applyDailySpend(data: DashboardData, transactions: FireflyResource[]) {
  const totals = new Map<string, number>();
  for (const split of transactionSplits(transactions)) {
    const type = stringValue(split.type);
    const budget = stringValue(split.budget_name);
    const date = isoDateFromRaw(stringValue(split.date));
    if (type !== 'withdrawal' || !date || !isTrackedHouseholdBudget(budget)) {
      continue;
    }

    totals.set(date, (totals.get(date) ?? 0) + Math.abs(signedAmount(split)));
  }

  data.dailySpend = daysInPeriod(data.period).map((date, index) => ({
    date,
    day: index + 1,
    amount: totals.get(date) ?? 0,
  }));
}

function expectedIncome(splits: FireflySplit[]): ExpectedEvent[] {
  const rows = splits.filter((split) => {
    const tags = tagsFromSplit(split).join(' ');
    const text = `${stringValue(split.description)} ${stringValue(split.source_name)} ${tags}`;
    return stringValue(split.type) === 'deposit' && /salary|regular-income|variable-income|bonus|super-payments|wefindflats/i.test(text);
  });

  return rows
    .sort((left, right) => dateSort(right, left))
    .map((split) => ({
      name: stringValue(split.description) || payeeName(split) || 'Income',
      expected: signedAmount(split),
      actual: signedAmount(split),
      due: `Paid ${shortDate(stringValue(split.date))}`,
      dateKey: isoDateFromRaw(stringValue(split.date)),
      status: tagsFromSplit(split).some((tag) => /bonus|variable-income/i.test(tag)) ? 'Variable income' : 'Matched',
      tone: 'ok' as const,
    }));
}

function expectedObligations(splits: FireflySplit[], bills: FireflyResource[], period: DashboardData['period']): ExpectedEvent[] {
  const paid = splits
    .filter((split) => {
      const text = `${stringValue(split.description)} ${stringValue(split.destination_name)} ${tagsFromSplit(split).join(' ')}`;
      return stringValue(split.type) === 'withdrawal' && /hmrc|self-assessment|tax|american express|amex|council/i.test(text);
    })
    .map((split) => ({
      name: stringValue(split.description) || payeeName(split) || 'Obligation',
      expected: Math.abs(signedAmount(split)),
      actual: Math.abs(signedAmount(split)),
      due: `Paid ${shortDate(stringValue(split.date))}`,
      dateKey: isoDateFromRaw(stringValue(split.date)),
      status: 'Paid',
      tone: 'ok' as const,
    }));

  const upcoming = period.isCurrent ? bills.map(billFromResource).filter((bill): bill is ExpectedEvent => Boolean(bill)) : [];

  return [...upcoming, ...paid]
    .sort((left, right) => expectedSort(left, right))
    .slice(0, 10);
}

function expectedBillCandidates(bills: FireflyResource[], period: DashboardData['period']): ExpectedEvent[] {
  if (!period.isCurrent) {
    return [];
  }

  return bills
    .map(billFromResource)
    .filter((bill): bill is ExpectedEvent => Boolean(bill))
    .filter((bill) => bill.tone === 'neutral')
    .slice(0, 8);
}

function billFromResource(resource: FireflyResource): ExpectedEvent | null {
  const attributes = resource.attributes ?? {};
  if (attributes.active === false) {
    return null;
  }

  const name = stringValue(attributes.name);
  const rawDate = stringValue(attributes.date) || stringValue(attributes.next_expected_match);
  if (!name || !rawDate) {
    return null;
  }

  const amountMin = numberValue(attributes.amount_min);
  const amountMax = numberValue(attributes.amount_max);
  const expected = amountMax || amountMin;
  const dueDate = new Date(rawDate);
  if (!expected || Number.isNaN(dueDate.getTime())) {
    return null;
  }

  const today = startOfToday();
  const inFuture = dueDate >= today;
  const soon = dueDate.getTime() - today.getTime() <= 45 * 86_400_000;
  if (!soon && !/hmrc|tax|amex|council/i.test(name)) {
    return null;
  }

  return {
    name,
    expected,
    due: shortDate(rawDate),
    dateKey: isoDate(dueDate),
    status: inFuture ? 'Upcoming' : 'Known bill',
    tone: inFuture ? 'watch' : 'neutral',
  };
}

function expectedSort(left: ExpectedEvent, right: ExpectedEvent) {
  const rank = { Upcoming: 0, Paid: 1, 'Known bill': 2 } as Record<string, number>;
  const leftRank = rank[left.status] ?? 3;
  const rightRank = rank[right.status] ?? 3;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  const leftDate = eventTime(left);
  const rightDate = eventTime(right);
  if (left.status === 'Paid' && right.status === 'Paid') {
    return rightDate - leftDate;
  }
  return leftDate - rightDate;
}

function ageDays(rawDate: string, reference = new Date()) {
  const date = rawDate ? new Date(rawDate) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return 0;
  }

  const referenceDay = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const transactionDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.max(0, Math.floor((referenceDay.getTime() - transactionDay.getTime()) / 86_400_000));
}

function transactionSplits(transactions: FireflyResource[]): FireflySplit[] {
  return transactionSplitEntries(transactions).map(({ split }) => split);
}

function transactionSplitEntries(transactions: FireflyResource[]): Array<{ group: FireflyResource; split: FireflySplit }> {
  const entries: Array<{ group: FireflyResource; split: FireflySplit }> = [];
  for (const group of transactions) {
    const splits = group.attributes?.transactions;
    if (!Array.isArray(splits)) {
      continue;
    }

    for (const split of splits) {
      entries.push({ group, split: split as FireflySplit });
    }
  }
  return entries;
}

function signedAmount(split: FireflySplit) {
  const amount = Math.abs(numberValue(split.amount));
  const type = stringValue(split.type);
  if (type === 'withdrawal') {
    return -amount;
  }
  return amount;
}

function payeeName(split: FireflySplit) {
  const type = stringValue(split.type);
  if (type === 'deposit') {
    return stringValue(split.source_name) || stringValue(split.description);
  }
  return stringValue(split.destination_name) || stringValue(split.description);
}

function tagsFromSplit(split: FireflySplit) {
  return Array.isArray(split.tags) ? split.tags.map(String) : [];
}

function isHouseholdCategory(category: string) {
  return /bills|utilities|groceries|eating|leisure|shopping|personal|transport|travel|holidays|general/i.test(category);
}

function isTrackedHouseholdBudget(budget: string) {
  return householdBudgetNames.some((name) => name.toLowerCase() === budget.toLowerCase());
}

function categoryBudgetSuggestion(category: string) {
  if (/eating|leisure/i.test(category)) return 'Eating Out';
  if (/grocer/i.test(category)) return 'Groceries';
  if (/transport/i.test(category)) return 'Transport';
  if (/travel|holiday/i.test(category)) return 'Travel & Holidays';
  if (/bill|util/i.test(category)) return 'Bills & Utilities';
  if (/shopping|personal/i.test(category)) return 'Shopping & Personal';
  return 'General / Review';
}

function shortDate(rawDate: string) {
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) {
    return rawDate;
  }
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' }).format(date);
}

function isoDateFromRaw(rawDate: string) {
  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? undefined : isoDate(date);
}

function remapDailySpend(days: DashboardData['dailySpend'], period: DashboardData['period']) {
  if (days.length === 0) {
    return days;
  }

  const amounts = days.map((day) => day.amount);
  return daysInPeriod(period).map((date, index) => ({
    date,
    day: index + 1,
    amount: amounts[index] ?? 0,
  }));
}

function daysInPeriod(period: DashboardData['period']) {
  const start = new Date(`${period.start}T00:00:00`);
  return Array.from({ length: period.daysElapsed }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return isoDate(date);
  });
}

function dateSort(left: FireflySplit, right: FireflySplit) {
  return new Date(stringValue(left.date)).getTime() - new Date(stringValue(right.date)).getTime();
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function isPeriodDue(event: ExpectedEvent, period: DashboardData['period']) {
  if (event.dateKey) {
    return event.dateKey >= period.start && event.dateKey <= period.end;
  }

  const due = parseShortDue(event.due, Number.parseInt(period.key.slice(0, 4), 10));
  return Number.isFinite(due) && due >= Date.parse(period.start) && due <= Date.parse(period.end);
}

function eventTime(event: ExpectedEvent) {
  if (event.dateKey) {
    return Date.parse(event.dateKey);
  }

  return parseShortDue(event.due, new Date().getFullYear());
}

function parseShortDue(value: string, year: number) {
  const paid = value.match(/Paid (.+)$/);
  const raw = paid?.[1] ?? value;
  const parsed = Date.parse(`${raw} ${year}`);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function slugify(value: string) {
  return value.toLowerCase().replaceAll('&', 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function numberValue(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function titleCase(value: string) {
  return value.replace(/\w\S*/g, (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
}
