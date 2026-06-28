import { Banknote, GitBranch, Landmark, PiggyBank, WalletCards, type LucideIcon } from 'lucide-react';
import type { Account, DashboardData, Tone } from '../data/fixtures';
import { formatMoney } from '../lib/money';
import { EmptyState, Metric, toneClass, ViewHeading } from './uiPrimitives';

export function AccountsView({
  activeSpend,
  cash,
  groups,
  period,
}: {
  activeSpend: number;
  cash: DashboardData['cash'];
  groups: Record<string, Account[]>;
  period: DashboardData['period'];
}) {
  const budgetableCash = sumAccounts(groups.budgetableCash);
  const liabilities = sumAccounts(groups.creditAndLiabilities);
  const netWorth = Object.values(groups).flat().reduce((sum, account) => sum + account.balance, 0);
  const totalExposure = Object.values(groups)
    .flat()
    .reduce((sum, account) => sum + Math.abs(account.balance), 0);
  const flaggedAccounts = Object.values(groups)
    .flat()
    .filter((account) => account.tone === 'watch');
  const flaggedTotal = flaggedAccounts.reduce((sum, account) => sum + Math.abs(account.balance), 0);
  const committedCash = Math.max(0, cash.committedUntilMonthEnd);
  const cashAfterCommitments = budgetableCash - committedCash;
  const committedPercent = budgetableCash > 0 ? Math.min(100, Math.max(0, (committedCash / budgetableCash) * 100)) : 0;
  const coverageTone: Tone = cashAfterCommitments < 0 ? 'risk' : committedPercent >= 75 ? 'watch' : 'ok';
  const runwayDays = cashRunwayDays({ activeSpend, cashAfterCommitments, daysElapsed: period.daysElapsed });
  const debtCover = accountDebtCover({ budgetableCash, liabilities });

  return (
    <div className="view-stack">
      <ViewHeading icon={Landmark} title="Accounts" meta={`Cash accounts ${formatMoney(budgetableCash)}`} />
      <section className="split-summary accounts-summary">
        <Metric label="Budgetable cash" value={formatMoney(budgetableCash)} tone="ok" />
        <Metric label="Liabilities" value={formatMoney(liabilities)} tone={liabilities < 0 ? 'watch' : 'ok'} />
        <Metric label="Net position" value={formatMoney(netWorth)} tone="neutral" />
        <Metric
          label="Needs review"
          value={formatFlaggedSummary({ count: flaggedAccounts.length, total: flaggedTotal })}
          tone={flaggedAccounts.length > 0 ? 'watch' : 'ok'}
        />
      </section>
      <section className={`cash-coverage ${toneClass(coverageTone)}`} aria-label={`Cash coverage. ${debtCover.detail}`}>
        <header>
          <div>
            <h3>Cash coverage</h3>
            <p>Known obligations reserved against cash accounts</p>
          </div>
          <strong>{formatMoney(cashAfterCommitments)}</strong>
        </header>
        <span className="cash-coverage-track" aria-hidden="true">
          <span style={{ width: `${committedPercent}%` }} />
        </span>
        <div className="cash-coverage-foot">
          <span>
            Reserved {formatMoney(committedCash, true)} ({Math.round(committedPercent)}%)
          </span>
          <span>Free after bills {formatMoney(cashAfterCommitments, true)}</span>
          <span>{formatRunwayDays(runwayDays)}</span>
          <span title={debtCover.detail}>{debtCover.label}</span>
        </div>
      </section>
      <div className="map-grid">
        <AccountGroup
          title="Cash accounts"
          icon={PiggyBank}
          accounts={groups.budgetableCash}
          totalExposure={totalExposure}
        />
        <AccountGroup
          title="Credit and liabilities"
          icon={WalletCards}
          accounts={groups.creditAndLiabilities}
          totalExposure={totalExposure}
        />
        <AccountGroup
          title="Wealth and manual assets"
          icon={Banknote}
          accounts={groups.wealth}
          totalExposure={totalExposure}
        />
        <AccountGroup
          title="Excluded and accounting"
          icon={GitBranch}
          accounts={groups.excluded}
          totalExposure={totalExposure}
        />
      </div>
    </div>
  );
}

function AccountGroup({
  title,
  icon: Icon,
  accounts,
  totalExposure,
}: {
  title: string;
  icon: LucideIcon;
  accounts: Account[];
  totalExposure: number;
}) {
  const total = sumAccounts(accounts);
  const exposure = sumAccountExposure(accounts);
  const flaggedCount = flaggedAccountCount(accounts);
  const flaggedTotal = flaggedAccountTotal(accounts);
  const visibleAccounts = prioritySortedAccounts(accounts);

  return (
    <article className="account-group">
      <header>
        <div className="account-group-title">
          <Icon size={18} aria-hidden="true" />
          <h3>{title}</h3>
        </div>
        <div className="account-group-summary">
          <strong>{formatMoney(total)}</strong>
          <span className={flaggedCount > 0 ? toneClass('watch') : toneClass('ok')}>
            {formatGroupSummary({ count: flaggedCount, exposure, flaggedTotal, totalExposure })}
          </span>
        </div>
      </header>
      <div className="account-list">
        {accounts.length === 0 ? (
          <EmptyState title="No live accounts" detail="No matching Firefly accounts were returned for this group." compact />
        ) : (
          visibleAccounts.map((account) => (
            <div className="account-row" key={account.name}>
              <div>
                <strong>{account.name}</strong>
                <span>{account.kind}</span>
              </div>
              <div>
                <strong>{formatMoney(account.balance)}</strong>
                <span className={toneClass(account.tone)}>{account.freshness}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function sumAccounts(accounts: Account[]) {
  return accounts.reduce((sum, account) => sum + account.balance, 0);
}

function cashRunwayDays({
  activeSpend,
  cashAfterCommitments,
  daysElapsed,
}: {
  activeSpend: number;
  cashAfterCommitments: number;
  daysElapsed: number;
}) {
  if (activeSpend <= 0 || cashAfterCommitments <= 0 || daysElapsed <= 0) {
    return null;
  }

  return Math.floor(cashAfterCommitments / (activeSpend / daysElapsed));
}

function formatRunwayDays(days: number | null) {
  return days === null ? 'Runway n/a' : `Runway ${days}d at this pace`;
}

function accountDebtCover({ budgetableCash, liabilities }: { budgetableCash: number; liabilities: number }) {
  const liabilityExposure = Math.abs(Math.min(0, liabilities));

  if (liabilityExposure <= 0) {
    return {
      label: 'Debt cover clear',
      detail: 'No credit or liability exposure found.',
    };
  }

  const coverPercent = Math.round((Math.max(0, budgetableCash) / liabilityExposure) * 100);
  const cashAfterDebt = budgetableCash - liabilityExposure;

  return {
    label: `Debt cover ${coverPercent}%`,
    detail: `Cash after liabilities ${formatMoney(cashAfterDebt)}.`,
  };
}

function formatFlaggedSummary({ count, total }: { count: number; total: number }) {
  if (count === 0) {
    return 'Clear';
  }

  return `${count} / ${formatMoney(total, true)}`;
}

function sumAccountExposure(accounts: Account[]) {
  return accounts.reduce((sum, account) => sum + Math.abs(account.balance), 0);
}

function flaggedAccountCount(accounts: Account[]) {
  return accounts.filter((account) => account.tone === 'watch').length;
}

function flaggedAccountTotal(accounts: Account[]) {
  return accounts.filter((account) => account.tone === 'watch').reduce((sum, account) => sum + Math.abs(account.balance), 0);
}

function prioritySortedAccounts(accounts: Account[]) {
  return [...accounts].sort((left, right) => {
    const toneDelta = accountToneRank[left.tone] - accountToneRank[right.tone];
    if (toneDelta !== 0) {
      return toneDelta;
    }

    return Math.abs(right.balance) - Math.abs(left.balance);
  });
}

function formatGroupSummary({
  count,
  exposure,
  flaggedTotal,
  totalExposure,
}: {
  count: number;
  exposure: number;
  flaggedTotal: number;
  totalExposure: number;
}) {
  const share = totalExposure > 0 ? Math.round((exposure / totalExposure) * 100) : 0;
  const flagged = count === 0 ? 'Clear' : `${count} flagged / ${formatMoney(flaggedTotal, true)}`;
  return `${share}% of map / ${flagged}`;
}

const accountToneRank: Record<Tone, number> = {
  risk: 0,
  watch: 1,
  ok: 2,
  neutral: 3,
};
