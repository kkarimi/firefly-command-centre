import { describe, expect, it } from 'vitest';
import { buildTransactionCategoryUpdateBody, categoryOptionsFromResources } from './fireflyActions';
import type { FireflyResource } from './fireflyClient';

describe('Firefly transaction category actions', () => {
  it('sorts existing category options by name', () => {
    expect(
      categoryOptionsFromResources([
        categoryResource({ id: '2', name: 'Travel & Holidays' }),
        categoryResource({ id: '1', name: 'Groceries' }),
        categoryResource({ id: '3', name: '' }),
      ]),
    ).toEqual([
      { id: '1', name: 'Groceries' },
      { id: '2', name: 'Travel & Holidays' },
    ]);
  });

  it('updates only the selected split category in the transaction update payload', () => {
    const body = buildTransactionCategoryUpdateBody({
      category: { id: '9', name: 'Travel & Holidays' },
      group: {
        id: '304',
        attributes: {
          group_title: 'Trip import',
          transactions: [
            {
              transaction_journal_id: '700',
              type: 'withdrawal',
              date: '2026-06-17T00:00:00+00:00',
              amount: '184.20',
              description: 'Unknown card presentment',
              source_id: '1',
              destination_id: '5',
              category_id: '',
              category_name: '',
              tags: ['statement-review'],
              currency_symbol: '£',
            },
            {
              transaction_journal_id: '701',
              type: 'withdrawal',
              date: '2026-06-17T00:00:00+00:00',
              amount: '12.00',
              description: 'Known row',
              source_id: '1',
              destination_id: '6',
              category_id: '4',
              category_name: 'Eating Out',
            },
          ],
        },
      },
      transactionJournalId: '700',
    });

    expect(body).toEqual({
      apply_rules: false,
      fire_webhooks: true,
      group_title: 'Trip import',
      transactions: [
        {
          transaction_journal_id: '700',
          type: 'withdrawal',
          date: '2026-06-17T00:00:00+00:00',
          amount: '184.20',
          description: 'Unknown card presentment',
          source_id: '1',
          destination_id: '5',
          category_id: '9',
          category_name: 'Travel & Holidays',
          tags: ['statement-review'],
        },
        {
          transaction_journal_id: '701',
          type: 'withdrawal',
          date: '2026-06-17T00:00:00+00:00',
          amount: '12.00',
          description: 'Known row',
          source_id: '1',
          destination_id: '6',
          category_id: '4',
          category_name: 'Eating Out',
        },
      ],
    });
  });

  it('rejects a transaction update when the review split is missing', () => {
    expect(() =>
      buildTransactionCategoryUpdateBody({
        category: { id: '9', name: 'Travel & Holidays' },
        group: { id: '304', attributes: { transactions: [{ transaction_journal_id: '701' }] } },
        transactionJournalId: '700',
      }),
    ).toThrow('Review split is no longer present in Firefly.');
  });
});

function categoryResource({ id, name }: { id: string; name: string }): FireflyResource {
  return {
    id,
    attributes: { name },
  };
}
