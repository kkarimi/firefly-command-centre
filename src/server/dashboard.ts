import { readFileSync } from 'node:fs';
import {
  commandCentreFixture,
  type Account,
  type BudgetCard,
  type CommandCentreData,
  type ExpectedEvent,
  type ReviewItem,
  type Tone,
} from '../data/fixtures';

type FireflyDocument<T> = {
  data: T[];
};

type FireflyResource = {
  id: string;
  attributes?: Record<string, unknown>;
};

type FireflySplit = Record<string, unknown>;

const householdBudgetNames = [
  'Bills & Utilities',
  'Groceries',
  'Eating Out',
  'Shopping & Personal',
  'Transport',
  'Travel & Holidays',
  'General / Review',
];

export async function loadCommandCentreData(): Promise<CommandCentreData> {
  const data = cloneFixture();
  applyCurrentPeriod(data);

  const token = fireflyToken();
  if (!token) {
    markOps(data, 'Firefly', 'Fixture', 'watch');
    return data;
  }

  try {
    prepareLiveData(data);

    const [accounts, budgets, bills, transactions] = await Promise.all([
      loadAccounts(token),
      loadBudgets(token, data.period),
      loadBills(token),
      loadTransactions(token),
    ]);

    applyAccounts(data, accounts);
    applyBudgets(data, budgets, transactions);
    applyReviewItems(data, transactions);
    applyExpected(data, transactions, bills);
    markOps(data, 'Firefly', 'Live', 'ok');
    markOps(data, 'Repo', 'Live app', 'ok');
  } catch (error) {
    markOps(data, 'Firefly', 'API failed', 'risk');
    data.reviewItems = [
      {
        id: 'firefly-api-error',
        source: 'Command Centre',
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

function cloneFixture(): CommandCentreData {
  return structuredClone(commandCentreFixture);
}

function prepareLiveData(data: CommandCentreData) {
  data.cash = {
    monzoBalance: 0,
    fireflyDrift: 0,
    budgetableCash: 0,
    committedUntilMonthEnd: 0,
    projectedLeft: 0,
  };
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
  data.ops = data.ops.map((item) => {
    if (item.label === 'Repo' || item.label === 'Firefly') {
      return { ...item, value: 'Checking', tone: 'watch' };
    }

    return { ...item, value: 'Not wired', tone: 'neutral' };
  });
}

function applyCurrentPeriod(data: CommandCentreData) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const formatDayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  const formatMonth = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
  const formatRefresh = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/London',
  });

  data.period = {
    label: formatMonth.format(now),
    range: `${formatDayMonth.format(start)}-${formatDayMonth.format(end)}`,
    lastRefresh: formatRefresh.format(now).replace(',', ''),
    daysElapsed: Math.min(now.getDate(), end.getDate()),
    totalDays: end.getDate(),
  };
}

function markOps(data: CommandCentreData, label: string, value: string, tone: Tone) {
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

async function loadAccounts(token: string) {
  const groups = await Promise.allSettled([
    loadCollection(token, '/accounts', { type: 'asset', limit: '200' }),
    loadCollection(token, '/accounts', { type: 'liabilities', limit: '200' }),
  ]);
  return groups.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
}

async function loadBudgets(token: string, period: CommandCentreData['period']) {
  const { start, end } = monthApiRange(period);
  return loadCollection(token, '/budgets', { start, end, limit: '100' });
}

async function loadBills(token: string) {
  return loadCollection(token, '/bills', { limit: '100' });
}

async function loadTransactions(token: string) {
  const now = new Date();
  const start = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const end = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  return loadCollection(token, '/transactions', { start, end, limit: '200' });
}

async function loadCollection(token: string, path: string, params: Record<string, string>) {
  const response = await fireflyGet<FireflyDocument<FireflyResource>>(token, path, params);
  return response.data ?? [];
}

function monthApiRange(_period: CommandCentreData['period']) {
  const now = new Date();
  return {
    start: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function applyAccounts(data: CommandCentreData, accounts: FireflyResource[]) {
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
    tone: /manual|asset/i.test(kind) ? 'watch' : 'ok',
  };
}

function applyBudgets(data: CommandCentreData, budgets: FireflyResource[], transactions: FireflyResource[]) {
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

function applyReviewItems(data: CommandCentreData, transactions: FireflyResource[]) {
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
      ageDays: ageDays(stringValue(split.date)),
      reason: review.reason,
      suggestion: review.suggestion,
      severity: Math.abs(signed) > 100 ? 'risk' : 'watch',
      fireflyGroupId: group.id,
    });
  }

  data.reviewItems = items.sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount)).slice(0, 12);
}

function reviewReason(split: FireflySplit) {
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
    return {
      reason: 'Generic category on material row',
      suggestion: 'Replace General with the smallest useful household category',
    };
  }

  return null;
}

function applyExpected(data: CommandCentreData, transactions: FireflyResource[], bills: FireflyResource[]) {
  const splits = transactionSplits(transactions);
  data.expected.income = expectedIncome(splits);
  data.expected.obligations = expectedObligations(splits, bills);
  data.expected.candidates = expectedBillCandidates(bills);

  const remainingMonthBills = data.expected.obligations
    .filter((event) => event.status === 'Upcoming')
    .filter((event) => isCurrentMonthDue(event.due))
    .reduce((sum, event) => sum + event.expected, 0);

  data.cash.committedUntilMonthEnd = remainingMonthBills;
  data.cash.projectedLeft = data.cash.budgetableCash - remainingMonthBills;
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
      status: tagsFromSplit(split).some((tag) => /bonus|variable-income/i.test(tag)) ? 'Variable income' : 'Matched',
      tone: 'ok' as const,
    }));
}

function expectedObligations(splits: FireflySplit[], bills: FireflyResource[]): ExpectedEvent[] {
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
      status: 'Paid',
      tone: 'ok' as const,
    }));

  const upcoming = bills.map(billFromResource).filter((bill): bill is ExpectedEvent => Boolean(bill));

  return [...upcoming, ...paid]
    .sort((left, right) => expectedSort(left, right))
    .slice(0, 10);
}

function expectedBillCandidates(bills: FireflyResource[]): ExpectedEvent[] {
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

  const leftDate = parseShortDue(left.due);
  const rightDate = parseShortDue(right.due);
  if (left.status === 'Paid' && right.status === 'Paid') {
    return rightDate - leftDate;
  }
  return leftDate - rightDate;
}

function ageDays(rawDate: string) {
  const date = rawDate ? new Date(rawDate) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
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

function dateSort(left: FireflySplit, right: FireflySplit) {
  return new Date(stringValue(left.date)).getTime() - new Date(stringValue(right.date)).getTime();
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function isCurrentMonthDue(shortDue: string) {
  const due = parseShortDue(shortDue);
  if (!Number.isFinite(due)) {
    return false;
  }

  const date = new Date(due);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function parseShortDue(value: string) {
  const paid = value.match(/Paid (.+)$/);
  const raw = paid?.[1] ?? value;
  const parsed = Date.parse(`${raw} ${new Date().getFullYear()}`);
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
