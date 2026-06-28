import { Banknote, GitBranch, Landmark, PiggyBank, WalletCards, type LucideIcon } from 'lucide-react';
import type { Account, DashboardData, Tone } from '../data/fixtures';
import { formatMoney } from '../lib/money';
import { EmptyState, Metric, toneClass, ViewHeading } from './uiPrimitives';

export function AccountsView({ cash, groups }: { cash: DashboardData['cash']; groups: Record<string, Account[]> }) {
  const budgetableCash = sumAccounts(groups.budgetableCash);
  const liabilities = sumAccounts(groups.creditAndLiabilities);
  const netWorth = Object.values(groups).flat().reduce((sum, account) => sum + account.balance, 0);
  const flagged = Object.values(groups)
    .flat()
    .filter((account) => account.tone === 'watch').length;
  const committedCash = Math.max(0, cash.committedUntilMonthEnd);
  const cashAfterCommitments = budgetableCash - committedCash;
  const committedPercent = budgetableCash > 0 ? Math.min(100, Math.max(0, (committedCash / budgetableCash) * 100)) : 0;
  const coverageTone: Tone = cashAfterCommitments < 0 ? 'risk' : committedPercent >= 75 ? 'watch' : 'ok';

  return (
    <div className="view-stack">
      <ViewHeading icon={Landmark} title="Accounts" meta={`Cash accounts ${formatMoney(budgetableCash)}`} />
      <section className="split-summary accounts-summary">
        <Metric label="Budgetable cash" value={formatMoney(budgetableCash)} tone="ok" />
        <Metric label="Liabilities" value={formatMoney(liabilities)} tone={liabilities < 0 ? 'watch' : 'ok'} />
        <Metric label="Net position" value={formatMoney(netWorth)} tone="neutral" />
        <Metric label="Needs review" value={`${flagged} flagged`} tone={flagged > 0 ? 'watch' : 'ok'} />
      </section>
      <section className={`cash-coverage ${toneClass(coverageTone)}`} aria-label="Cash coverage">
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
        </div>
      </section>
      <div className="map-grid">
        <AccountGroup title="Cash accounts" icon={PiggyBank} accounts={groups.budgetableCash} />
        <AccountGroup title="Credit and liabilities" icon={WalletCards} accounts={groups.creditAndLiabilities} />
        <AccountGroup title="Wealth and manual assets" icon={Banknote} accounts={groups.wealth} />
        <AccountGroup title="Excluded and accounting" icon={GitBranch} accounts={groups.excluded} />
      </div>
    </div>
  );
}

function AccountGroup({ title, icon: Icon, accounts }: { title: string; icon: LucideIcon; accounts: Account[] }) {
  const total = sumAccounts(accounts);
  const flaggedCount = flaggedAccountCount(accounts);
  const flaggedTotal = flaggedAccountTotal(accounts);

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
            {formatFlaggedSummary({ count: flaggedCount, total: flaggedTotal })}
          </span>
        </div>
      </header>
      <div className="account-list">
        {accounts.length === 0 ? (
          <EmptyState title="No live accounts" detail="No matching Firefly accounts were returned for this group." compact />
        ) : (
          accounts.map((account) => (
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

function flaggedAccountCount(accounts: Account[]) {
  return accounts.filter((account) => account.tone === 'watch').length;
}

function flaggedAccountTotal(accounts: Account[]) {
  return accounts.filter((account) => account.tone === 'watch').reduce((sum, account) => sum + Math.abs(account.balance), 0);
}

function formatFlaggedSummary({ count, total }: { count: number; total: number }) {
  return count === 0 ? 'Clear' : `${count} flagged / ${formatMoney(total, true)}`;
}
