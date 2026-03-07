/**
 * Validation Schemas
 *
 * Zod schemas for all form inputs and API requests.
 * Centralized validation layer to prevent invalid data reaching the database.
 */

import { z } from 'zod';

const idSchema = z.string().min(1, 'Invalid ID');

/**
 * Decimal validator
 *
 * Validates string or number input as currency (2 decimal places).
 */
const decimalSchema = z
  .union([z.string(), z.number()])
  .refine(
    (val) => {
      const str = val.toString();
      return /^\d+(\.\d{1,2})?$/.test(str);
    },
    { message: 'Invalid currency format (max 2 decimals)' }
  )
  .transform((val) => val.toString());

/**
 * Positive currency validator
 */
const positiveCurrencySchema = decimalSchema.refine(
  (val) => {
    const num = parseFloat(val);
    return num > 0;
  },
  { message: 'Amount must be positive' }
);

/**
 * Quick Entry Schema
 *
 * Validates natural language financial entry input.
 * Format: "[amount] [description/category]"
 */
export const quickEntrySchema = z.object({
  input: z
    .string()
    .min(1, 'Entry cannot be empty')
    .max(200, 'Entry is too long')
    .refine(
      (val) => /^\d+/.test(val),
      'Entry must start with an amount'
    ),
  date: z.date().optional(),
  categoryOverride: z.string().optional(),
});

export type QuickEntryInput = z.infer<typeof quickEntrySchema>;

/**
 * Transaction Entry Schema
 *
 * Validates a complete transaction (ledger entry).
 */
export const transactionSchema = z.object({
  amount: positiveCurrencySchema,
  categoryId: idSchema,
  description: z
    .string()
    .min(1, 'Description required')
    .max(200, 'Description too long'),
  entryType: z.enum(['INCOME', 'EXPENSE', 'SAVINGS']),
  date: z
    .date()
    .refine(
      (d) => d <= new Date(),
      'Cannot create transactions for future dates'
    ),
  periodId: idSchema.optional(),
  tags: z.array(z.string()).max(5, 'Too many tags').optional(),
  notes: z.string().max(500, 'Notes too long').optional(),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

/**
 * Summary Entry Schema
 *
 * Validates a summary ledger entry for hybrid input model.
 * Used when user provides total for a category instead of individual transactions.
 */
export const summaryEntrySchema = z.object({
  amount: positiveCurrencySchema,
  categoryId: idSchema,
  description: z
    .string()
    .min(1, 'Description required')
    .max(200, 'Description too long'),
  date: z
    .date()
    .refine(
      (d) => d <= new Date(),
      'Cannot create transactions for future dates'
    ),
  periodId: idSchema.optional(),
  notes: z.string().max(500, 'Notes too long').optional(),
});

export type SummaryEntryInput = z.infer<typeof summaryEntrySchema>;

/**
 * Bulk Transaction Schema
 *
 * Validates multiple transactions at once.
 * Used for bulk entry or import.
 */
export const bulkTransactionSchema = z.object({
  transactions: z.array(transactionSchema).min(1).max(100),
  overwriteExisting: z.boolean().default(false),
});

export type BulkTransactionInput = z.infer<typeof bulkTransactionSchema>;

/**
 * Backlog Import Schema
 *
 * Accepts historical rows from pasted spreadsheet data.
 */
export const backlogImportSchema = z.object({
  rows: z
    .array(
      z.object({
        date: z.date(),
        amount: positiveCurrencySchema,
        categoryName: z.string().min(1).max(100),
        entryType: z.enum(['INCOME', 'EXPENSE', 'SAVINGS']).optional(),
        description: z.string().max(200).optional(),
        note: z.string().max(1000).optional(),
      })
    )
    .min(1)
    .max(1000),
});

export type BacklogImportInput = z.infer<typeof backlogImportSchema>;

/**
 * Savings Allocation Schema
 *
 * Validates savings allocation entry.
 */
export const savingsAllocationSchema = z.object({
  entryId: idSchema,
  bucket: z
    .string()
    .min(1, 'Bucket name required')
    .max(50, 'Bucket name too long'),
  amount: positiveCurrencySchema,
  notes: z.string().max(200).optional(),
});

export type SavingsAllocationInput = z.infer<typeof savingsAllocationSchema>;

/**
 * Period Reconciliation Schema
 *
 * Validates period reconciliation entry.
 */
export const reconciliationSchema = z.object({
  periodId: idSchema,
  actualCash: positiveCurrencySchema,
  notes: z.string().max(500).optional(),
  entryToBalance: z
    .object({
      description: z.string().optional(),
      amount: positiveCurrencySchema,
    })
    .optional(),
});

export type ReconciliationInput = z.infer<typeof reconciliationSchema>;

/**
 * Period Opening Cash Schema
 *
 * Validates period opening cash input.
 */
export const periodOpeningCashSchema = z.object({
  periodId: idSchema,
  openingCash: positiveCurrencySchema,
});

export type PeriodOpeningCashInput = z.infer<typeof periodOpeningCashSchema>;

/**
 * Update Category Schema
 *
 * Validates category updates.
 */
export const updateCategorySchema = z.object({
  categoryId: idSchema,
  name: z.string().min(1).max(50).optional(),
  countsAsExpense: z.boolean().optional(),
  countsAsSavings: z.boolean().optional(),
  emoji: z
    .string()
    .length(1, 'Emoji must be single character')
    .optional(),
});

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

/**
 * Create Category Schema
 *
 * Validates category creation.
 */
export const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Category name required')
    .max(50, 'Category name too long'),
  type: z.enum(['INCOME', 'EXPENSE', 'SAVINGS']),
  emoji: z.string().length(1, 'Emoji must be single character').optional(),
  countsAsExpense: z.boolean().default(false),
  countsAsSavings: z.boolean().default(false),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

/**
 * Note Entry Schema
 *
 * Validates note creation/update.
 */
export const noteSchema = z.object({
  content: z
    .string()
    .min(1, 'Note cannot be empty')
    .max(1000, 'Note too long'),
  entryId: idSchema.optional(),
  periodId: idSchema.optional(),
});

export type NoteInput = z.infer<typeof noteSchema>;

/**
 * Dashboard Query Schema
 *
 * Validates dashboard data request parameters.
 */
export const dashboardQuerySchema = z.object({
  periodId: idSchema.optional(),
  compareTo: z.enum(['PREVIOUS', 'AVERAGE']).default('PREVIOUS'),
  includeProjection: z.boolean().default(true),
});

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;

/**
 * Report Query Schema
 *
 * Validates report generation parameters.
 */
export const reportQuerySchema = z.object({
  type: z.enum(['CATEGORY_BREAKDOWN', 'TREND', 'SAVINGS_RATE', 'FORECAST']),
  periods: z.number().min(1).max(52).default(13),
  groupBy: z.enum(['CATEGORY', 'WEEK', 'CUSTOM']).optional(),
});

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;

/**
 * Settings Update Schema
 *
 * Validates user settings updates.
 */
export const settingsSchema = z.object({
  savingsTarget: positiveCurrencySchema.optional(),
  spendingTarget: positiveCurrencySchema.optional(),
  reconciliationTolerance: decimalSchema.optional(),
  defaultCurrency: z.string().length(3).default('USD'),
  biweeklyStartDate: z.date().optional(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

/**
 * Search Query Schema
 *
 * Validates search/filter parameters.
 */
export const searchSchema = z.object({
  query: z.string().max(100),
  type: z.enum(['TRANSACTION', 'CATEGORY', 'NOTE']).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  categoryId: idSchema.optional(),
  minAmount: decimalSchema.optional(),
  maxAmount: decimalSchema.optional(),
});

export type SearchInput = z.infer<typeof searchSchema>;

/**
 * Validation helper
 *
 * Validates input against schema and returns [valid, data/errors]
 *
 * @example
 *   const [valid, result] = validate(quickEntrySchema, { input: "45 coffee" });
 *   if (!valid) console.error(result); // ZodError
 *   if (valid) console.log(result);     // Validated data
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): [true, T] | [false, z.ZodError] {
  const result = schema.safeParse(data);
  if (result.success) {
    return [true, result.data];
  }
  return [false, result.error];
}

/**
 * Format validation errors for display
 *
 * Converts Zod errors to user-friendly messages.
 *
 * @example
 *   const [valid, errors] = validate(schema, data);
 *   if (!valid) {
 *     console.log(formatValidationErrors(errors));
 *     // "amount: Invalid currency format"
 *     // "categoryId: Invalid UUID"
 *   }
 */
export function formatValidationErrors(error: z.ZodError): string {
  return error.errors
    .map((e) => {
      const field = e.path.join('.');
      return `${field}: ${e.message}`;
    })
    .join('\n');
}
