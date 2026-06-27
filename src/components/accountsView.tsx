import { Banknote, GitBranch, Landmark, PiggyBank, WalletCards, type LucideIcon } from 'lucide-react';
import type { Account } from '../data/fixtures';
import { formatMoney } from '../lib/money';
import { EmptyState, Metric, toneClass, ViewHeading } from './uiPrimitives';

export function AccountsView({ groups }: { groups: Record<string, Account[]> }) {
  const budgetableCash = sumAccounts(groups.budgetableCash);
  const netWorth = Object.values(groups).flat().reduce((sum, account) => sum + account.balance, 0);
  const flagged = Object.values(groups)
    .flat()
    .filter((account) => account.tone === 'watch').length;

  return (
    <div className="view-stack">
      <ViewHeading icon={Landmark} title="Accounts" meta={`Cash accounts ${formatMoney(budgetableCash)}`} />
      <section className="split-summary">
        <Metric label="Budgetable cash" value={formatMoney(budgetableCash)} tone="ok" />
        <Metric label="Net position" value={formatMoney(netWorth)} tone="neutral" />
        <Metric label="Needs review" value={`${flagged} flagged`} tone={flagged > 0 ? 'watch' : 'ok'} />
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

  return (
    <article className="account-group">
      <header>
        <div>
          <Icon size={18} aria-hidden="true" />
          <h3>{title}</h3>
        </div>
        <strong>{formatMoney(total)}</strong>
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
