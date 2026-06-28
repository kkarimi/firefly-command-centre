import {
  fireflyGet,
  fireflyPut,
  fireflyToken,
  loadCollection,
  type FireflyResource,
  type FireflySingle,
  type FireflySplit,
} from './fireflyClient';
import { reviewReason } from './dashboard';

export type FireflyCategoryOption = {
  id: string;
  name: string;
};

export type CategoryFixResult = {
  categoryName?: string;
  message: string;
  ok: boolean;
  resolved?: boolean;
};

type TransactionCategoryUpdateInput = {
  categoryId: string;
  confirmed: boolean;
  groupId: string;
  transactionJournalId: string;
};

type TransactionCategoryUpdateBodyInput = {
  category: FireflyCategoryOption;
  group: FireflyResource;
  transactionJournalId: string;
};

const splitUpdateKeys = [
  'transaction_journal_id',
  'type',
  'date',
  'amount',
  'description',
  'order',
  'currency_id',
  'currency_code',
  'foreign_amount',
  'foreign_currency_id',
  'foreign_currency_code',
  'budget_id',
  'category_id',
  'category_name',
  'source_id',
  'source_name',
  'source_iban',
  'destination_id',
  'destination_name',
  'destination_iban',
  'reconciled',
  'bill_id',
  'bill_name',
  'tags',
  'notes',
  'internal_reference',
  'external_id',
  'external_url',
  'sepa_cc',
  'sepa_ct_op',
  'sepa_ct_id',
  'sepa_db',
  'sepa_country',
  'sepa_ep',
  'sepa_ci',
  'sepa_batch_id',
  'interest_date',
  'book_date',
  'process_date',
  'due_date',
  'payment_date',
  'invoice_date',
] as const;

export async function loadFireflyCategoryOptions() {
  const token = fireflyToken();
  if (!token) {
    return [];
  }

  return categoryOptionsFromResources(await loadCollection(token, '/categories', { limit: '200' }));
}

export async function updateTransactionCategory({
  categoryId,
  confirmed,
  groupId,
  transactionJournalId,
}: TransactionCategoryUpdateInput): Promise<CategoryFixResult> {
  if (!confirmed) {
    return { message: 'Confirm the Firefly write before saving.', ok: false };
  }

  if (!transactionJournalId) {
    return { message: 'Firefly did not return the split ID needed for this save.', ok: false };
  }

  const token = fireflyToken();
  if (!token) {
    return { message: 'Firefly token is not available on this server.', ok: false };
  }

  try {
    const category = categoryOptionsFromResources(await loadCollection(token, '/categories', { limit: '200' })).find(
      (option) => option.id === categoryId,
    );
    if (!category) {
      return { message: 'Choose an existing Firefly category.', ok: false };
    }

    const group = await loadTransactionGroup(token, groupId);
    const targetSplit = transactionSplits(group).find((split) => stringValue(split.transaction_journal_id) === transactionJournalId);
    if (targetSplit && splitUsesCategory({ category, split: targetSplit })) {
      return { categoryName: category.name, message: 'Choose a category that differs from the current Firefly category.', ok: false };
    }

    const body = buildTransactionCategoryUpdateBody({ category, group, transactionJournalId });
    await fireflyPut<FireflySingle<FireflyResource>>(token, `/transactions/${encodeURIComponent(groupId)}`, body);

    const updatedGroup = await loadTransactionGroup(token, groupId);
    const updatedSplit = transactionSplits(updatedGroup).find((split) => stringValue(split.transaction_journal_id) === transactionJournalId);
    const updatedCategoryId = stringValue(updatedSplit?.category_id);
    const updatedCategoryName = stringValue(updatedSplit?.category_name);
    const resolved = updatedSplit ? !reviewReason(updatedSplit) : false;

    if (updatedCategoryId !== category.id && updatedCategoryName.toLowerCase() !== category.name.toLowerCase()) {
      return {
        categoryName: category.name,
        message: 'Firefly accepted the save, but the category did not match on refresh.',
        ok: false,
        resolved,
      };
    }

    return {
      categoryName: category.name,
      message: resolved ? 'Category saved and the review warning is resolved.' : 'Category saved. This row still needs another fix.',
      ok: true,
      resolved,
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : 'Firefly did not save the category.',
      ok: false,
    };
  }
}

export function categoryOptionsFromResources(resources: FireflyResource[]) {
  return resources
    .map((resource) => ({
      id: resource.id,
      name: stringValue(resource.attributes?.name),
    }))
    .filter((category): category is FireflyCategoryOption => Boolean(category.id && category.name))
    .sort((left, right) => left.name.localeCompare(right.name, 'en-GB'));
}

export function splitUsesCategory({ category, split }: { category: FireflyCategoryOption; split: FireflySplit }) {
  const categoryId = stringValue(split.category_id);
  const categoryName = stringValue(split.category_name);
  return categoryId === category.id || categoryName.toLowerCase() === category.name.toLowerCase();
}

export function buildTransactionCategoryUpdateBody({
  category,
  group,
  transactionJournalId,
}: TransactionCategoryUpdateBodyInput) {
  const splits = transactionSplits(group);
  if (splits.length === 0) {
    throw new Error('Transaction group has no editable splits.');
  }

  if (!splits.some((split) => stringValue(split.transaction_journal_id) === transactionJournalId)) {
    throw new Error('Review split is no longer present in Firefly.');
  }

  return {
    apply_rules: false,
    fire_webhooks: true,
    group_title: stringValue(group.attributes?.group_title) || null,
    transactions: splits.map((split) => transactionSplitUpdatePayload({ category, split, transactionJournalId })),
  };
}

async function loadTransactionGroup(token: string, groupId: string) {
  const response = await fireflyGet<FireflySingle<FireflyResource>>(token, `/transactions/${encodeURIComponent(groupId)}`);
  return response.data;
}

function transactionSplitUpdatePayload({
  category,
  split,
  transactionJournalId,
}: {
  category: FireflyCategoryOption;
  split: FireflySplit;
  transactionJournalId: string;
}) {
  const payload: Record<string, unknown> = {};
  for (const key of splitUpdateKeys) {
    if (split[key] !== undefined) {
      payload[key] = split[key];
    }
  }

  if (stringValue(split.transaction_journal_id) === transactionJournalId) {
    payload.category_id = category.id;
    payload.category_name = category.name;
  }

  return payload;
}

function transactionSplits(group: FireflyResource) {
  const splits = group.attributes?.transactions;
  return Array.isArray(splits) ? (splits as FireflySplit[]) : [];
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
