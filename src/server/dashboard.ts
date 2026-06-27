import { readFileSync } from 'node:fs';
import { commandCentreFixture, type Account, type BudgetCard, type CommandCentreData, type ReviewItem, type Tone } from '../data/fixtures';

type FireflyDocument<T> = {
  data: T[];
};

type FireflyResource = {
  id: string;
  attributes?: Record<string, unknown>;
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

export async function loadCommandCentreData(): Promise<CommandCentreData> {
  const data = cloneFixture();
  applyCurrentPeriod(data);

  const token = fireflyToken();
  if (!token) {
    markOps(data, 'Firefly', 'Fixture', 'watch');
    return data;
  }

  try {
    const [accounts, budgets, transactions] = await Promise.all([
      loadAccounts(token),
      loadBudgets(token, data.period),
      loadTransactions(token),
    ]);

    applyAccounts(data, accounts);
    applyBudgets(data, budgets);
    applyReviewItems(data, transactions);
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
  try {
    return await loadCollection(token, '/accounts', { limit: '200' });
  } catch {
    const groups = await Promise.allSettled([
      loadCollection(token, '/accounts', { type: 'asset', limit: '200' }),
      loadCollection(token, '/accounts', { type: 'liabilities', limit: '200' }),
    ]);
    return groups.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  }
}

async function loadBudgets(token: string, period: CommandCentreData['period']) {
  const { start, end } = monthApiRange(period);
  return loadCollection(token, '/budgets', { start, end, limit: '100' });
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

  const budgetable = mapped.filter((account) => /monzo|current|savings|pot/i.test(account.name) && account.balance >= 0);
  const liabilities = mapped.filter((account) => /amex|loan|liabil|credit|m&s|m & s/i.test(`${account.name} ${account.kind}`));
  const wealth = mapped.filter((account) => /prosper|kraken|gold|sipp|isa|gia|fixed/i.test(account.name));
  const excluded = mapped.filter((account) => /house|company|cost basis|contribution/i.test(account.name));

  if (budgetable.length > 0) {
    data.moneyMap.budgetableCash = budgetable.slice(0, 6);
    const budgetableCash = budgetable.reduce((sum, account) => sum + account.balance, 0);
    data.cash.budgetableCash = budgetableCash;
    data.cash.monzoBalance = budgetable[0]?.balance ?? data.cash.monzoBalance;
    data.cash.projectedLeft = budgetableCash - data.cash.committedUntilMonthEnd;
  }

  if (liabilities.length > 0) {
    data.moneyMap.creditAndLiabilities = liabilities.slice(0, 8);
  }

  if (wealth.length > 0) {
    data.moneyMap.wealth = wealth.slice(0, 8);
  }

  if (excluded.length > 0) {
    data.moneyMap.excluded = excluded.slice(0, 8);
  }
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

function applyBudgets(data: CommandCentreData, budgets: FireflyResource[]) {
  if (budgets.length === 0) {
    return;
  }

  data.budgets = householdBudgetNames.map((name) => {
    const existing = data.budgets.find((budget) => budget.name === name);
    const live = budgets.find((budget) => stringValue(budget.attributes?.name).toLowerCase() === name.toLowerCase());
    if (!existing || !live?.attributes) {
      return existing;
    }

    const spent = Math.abs(spentFromBudget(live.attributes));
    const limit = limitFromBudget(live.attributes) || existing.limit;
    return {
      ...existing,
      limit,
      spent,
      daysElapsed: data.period.daysElapsed,
      totalDays: data.period.totalDays,
      merchants: existing.merchants,
      unusual: existing.reviewQueue && spent > 0 ? 'Live review queue contains material spend' : existing.unusual,
    } satisfies BudgetCard;
  }).filter((budget): budget is BudgetCard => Boolean(budget));
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

  for (const group of transactions) {
    const splits = group.attributes?.transactions;
    if (!Array.isArray(splits)) {
      continue;
    }

    for (const split of splits) {
      const transaction = split as Record<string, unknown>;
      const category = stringValue(transaction.category_name);
      const budget = stringValue(transaction.budget_name);
      const tags = Array.isArray(transaction.tags) ? transaction.tags.map(String) : [];
      const reviewMatch = /review|uncategor/i.test(`${category} ${budget} ${tags.join(' ')}`);
      if (!reviewMatch) {
        continue;
      }

      const amount = numberValue(transaction.amount);
      const payee = stringValue(transaction.destination_name) || stringValue(transaction.description) || 'Review transaction';
      items.push({
        id: stringValue(transaction.transaction_journal_id) || `${group.id}-${items.length}`,
        source: stringValue(transaction.source_name) || 'Firefly',
        payee,
        amount,
        ageDays: ageDays(stringValue(transaction.date)),
        reason: category ? `Category is ${category}` : 'Missing review category',
        suggestion: 'Decide category, budget, tags, and rule in Firefly',
        severity: Math.abs(amount) > 100 ? 'risk' : 'watch',
        fireflyGroupId: group.id,
      });
    }
  }

  if (items.length > 0) {
    data.reviewItems = items.slice(0, 12);
  }
}

function ageDays(rawDate: string) {
  const date = rawDate ? new Date(rawDate) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
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
