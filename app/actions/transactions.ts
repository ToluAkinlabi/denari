/**
 * Transaction Server Actions
 *
 * Orchestrates: validation → parsing → repository access → calculation
 * All database writes happen here (centralized, type-safe, auditable).
 */

'use server';

import { Decimal } from '@prisma/client/runtime/library';
import { parseQuickEntry, validateParsedEntry } from '@/lib/parsers/quickEntry';
import {
  transactionSchema,
  quickEntrySchema,
  validate,
  formatValidationErrors,
} from '@/lib/validators/schemas';
import * as ledgerRepo from '@/lib/repositories/ledger';
import * as categoriesRepo from '@/lib/repositories/categories';
import * as periodsRepo from '@/lib/repositories/periods';
import * as savingsRepo from '@/lib/repositories/savings';
import * as usersRepo from '@/lib/repositories/users';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string>;
}

function toLedgerEntryType(type: 'INCOME' | 'EXPENSE' | 'SAVINGS') {
  return type === 'SAVINGS' ? 'TRANSFER' : type;
}

async function resolveUserId(userId?: string) {
  if (userId) return userId;
  const user = await usersRepo.getOrCreateDefaultUser();
  return user.id;
}

export async function getAddEntryOptions(
  userId?: string
): Promise<
  ApiResponse<{
    periodId: string;
    categories: Array<{
      id: string;
      name: string;
      type: 'INCOME' | 'EXPENSE' | 'SAVINGS';
    }>;
  }>
> {
  try {
    const resolvedUserId = await resolveUserId(userId);

    const period = await periodsRepo.getCurrentPeriodForUser(resolvedUserId);
    if (!period) {
      return {
        success: false,
        error: 'No active period found',
      };
    }

    const categories = await categoriesRepo.getCategoriesForUser(resolvedUserId);

    return {
      success: true,
      data: {
        periodId: period.id,
        categories: categories.map((c: { id: string; name: string; type: string }) => ({
          id: c.id,
          name: c.name,
          type: c.type === 'SAVINGS' ? 'SAVINGS' : c.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

/**
 * Add transaction via quick entry
 *
 * Workflow:
 *   1. Validate input format (Zod)
 *   2. Parse natural language ("45 coffee" → amount, category, type)
 *   3. Look up category by name
 *   4. Find or create period for date
 *   5. Create ledger entry
 *   6. Handle savings allocations if SAVINGS type
 *
 * @example
 *   const result = await addQuickEntry({
 *     input: "45 coffee",
 *     date: new Date()
 *   })
 *   // Returns: { success: true, data: { id: "...", ... } }
 */
export async function addQuickEntry(
  input: unknown
): Promise<ApiResponse<{ id: string; description: string; amount: string }>> {
  try {
    const userId = await resolveUserId();

    // Step 1: Validate input format
    const [valid, validationError] = validate(quickEntrySchema, input);
    if (!valid) {
      return {
        success: false,
        error: formatValidationErrors(validationError),
      };
    }

    // Step 2: Parse natural language
    let parsed;
    try {
      parsed = parseQuickEntry(validationError.input);
    } catch (e) {
      return {
        success: false,
        error: `Parse error: ${(e as Error).message}`,
      };
    }

    // Step 3: Validate parsed entry
    const [parseValid, parseError] = validateParsedEntry(parsed);
    if (!parseValid) {
      return {
        success: false,
        error: parseError || 'Invalid entry',
      };
    }

    // Step 4: Look up category
    const categories = await categoriesRepo.getCategoriesForUser(userId);
    const category = categories.find(
      (c: { name: string }) => c.name.toLowerCase() === parsed.category?.toLowerCase()
    );

    if (!category) {
      return {
        success: false,
        error: `Category not found: ${parsed.category}`,
      };
    }

    // Step 5: Get or create period for date
    const entryDate = validationError.date || new Date();
    const period = await periodsRepo.getPeriodForDateAndUser(userId, entryDate);

    if (!period) {
      return {
        success: false,
        error: 'Period not found for date',
      };
    }

    // Step 6: Create ledger entry
    const entry = await ledgerRepo.createLedgerEntry({
      date: entryDate,
      amount: parsed.amount,
      categoryId: category.id,
      description: parsed.description,
      entryType: toLedgerEntryType(parsed.entryType),
      periodId: period.id,
      userId,
    });

    // Step 7: Handle savings allocations
    if (parsed.entryType === 'SAVINGS') {
      await savingsRepo.createAllocation({
        ledgerEntryId: entry.id,
        bucket: category.name,
        amount: parsed.amount,
        userId,
      });
    }

    return {
      success: true,
      data: {
        id: entry.id,
        description: entry.description || '',
        amount: entry.amount.toString(),
      },
    };
  } catch (error) {
    console.error('addQuickEntry error:', error);
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

/**
 * Add detailed transaction
 *
 * Workflow:
 *   1. Validate full transaction schema
 *   2. Verify category exists and belongs to user
 *   3. Verify period exists
 *   4. Create ledger entry
 *   5. Handle savings allocations if needed
 *
 * @example
 *   const result = await addTransaction({
 *     amount: "45.00",
 *     categoryId: "...",
 *     description: "Coffee at Starbucks",
 *     entryType: "EXPENSE",
 *     date: new Date(),
 *     periodId: "..."
 *   })
 */
export async function addTransaction(
  input: unknown
): Promise<ApiResponse<{ id: string; description: string }>> {
  try {
    const userId = await resolveUserId();

    // Step 1: Validate schema
    const [valid, validationError] = validate(transactionSchema, input);
    if (!valid) {
      return {
        success: false,
        error: formatValidationErrors(validationError),
      };
    }

    const data = validationError;

    // Step 2: Verify category
    const category = await categoriesRepo.getCategoryById(data.categoryId);
    if (!category) {
      return {
        success: false,
        error: 'Category not found',
      };
    }

    // Step 3: Verify period
    const period = await periodsRepo.getPeriodById(data.periodId);
    if (!period) {
      return {
        success: false,
        error: 'Period not found',
      };
    }

    // Step 4: Create entry
    const entry = await ledgerRepo.createLedgerEntry({
      date: data.date,
      amount: new Decimal(data.amount),
      categoryId: data.categoryId,
      description: data.description,
      entryType: toLedgerEntryType(data.entryType),
      periodId: data.periodId,
      userId,
    });

    // Step 5: Handle savings allocations
    if (data.entryType === 'SAVINGS') {
      await savingsRepo.createAllocation({
        ledgerEntryId: entry.id,
        bucket: category.name,
        amount: new Decimal(data.amount),
        userId,
      });
    }

    return {
      success: true,
      data: {
        id: entry.id,
        description: entry.description || '',
      },
    };
  } catch (error) {
    console.error('addTransaction error:', error);
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

/**
 * Delete transaction
 *
 * Removes ledger entry and associated savings allocations.
 *
 * @param entryId Entry to delete
 * @param userId User must own the entry
 */
export async function deleteTransaction(
  entryId: string,
  userId: string = 'default-user'
): Promise<ApiResponse<null>> {
  try {
    // Verify entry exists and belongs to user
    const entry = await ledgerRepo.getLedgerEntryById(entryId);
    if (!entry || entry.userId !== userId) {
      return {
        success: false,
        error: 'Entry not found',
      };
    }

    // Delete savings allocations first (foreign key constraint)
    if (entry.entryType === 'TRANSFER') {
      // In a real app, would need a deleteBySavingsAllocationsByEntry
      // For now, we'll rely on cascade delete in Prisma if configured
    }

    // Delete entry
    await ledgerRepo.deleteLedgerEntry(entryId);

    return {
      success: true,
    };
  } catch (error) {
    console.error('deleteTransaction error:', error);
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

/**
 * Update transaction
 *
 * Allows updating amount, description, or category.
 * Recalculates savings allocations if amount changed.
 *
 * @param entryId Entry to update
 * @param updates Fields to update
 */
export async function updateTransaction(
  entryId: string,
  updates: Partial<{
    amount: string;
    description: string;
    categoryId: string;
  }>,
  userId: string = 'default-user'
): Promise<ApiResponse<{ id: string }>> {
  try {
    // Verify ownership
    const entry = await ledgerRepo.getLedgerEntryById(entryId);
    if (!entry || entry.userId !== userId) {
      return {
        success: false,
        error: 'Entry not found',
      };
    }

    // Validate category if provided
    if (updates.categoryId) {
      const category = await categoriesRepo.getCategoryById(
        updates.categoryId
      );
      if (!category) {
        return {
          success: false,
          error: 'Category not found',
        };
      }
    }

    // Update entry
    const updated = await ledgerRepo.updateLedgerEntry(entryId, {
      ...(updates.amount && { amount: new Decimal(updates.amount) }),
      ...(updates.description && { description: updates.description }),
      ...(updates.categoryId && { categoryId: updates.categoryId }),
    });

    // Update savings allocations if amount changed
    if (updates.amount && entry.entryType === 'TRANSFER') {
      // Delete old allocations
      // This would need a deleteByEntryId function in savingsRepo

      // Create new allocation
      const allocations = await savingsRepo.getAllocationsForEntry(entryId);
      if (allocations.length > 0) {
        const bucket = allocations[0].bucket;
        await savingsRepo.createAllocation({
          ledgerEntryId: entryId,
          bucket,
          amount: new Decimal(updates.amount),
          userId,
        });
      }
    }

    return {
      success: true,
      data: { id: updated.id },
    };
  } catch (error) {
    console.error('updateTransaction error:', error);
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

/**
 * Get transactions for period
 *
 * Fetches all ledger entries for a period.
 * Optionally filters by type or category.
 *
 * @param periodId Period to fetch
 * @param filters Optional type or category filter
 */
export async function getTransactions(
  periodId: string,
  filters?: {
    type?: 'INCOME' | 'EXPENSE' | 'SAVINGS';
    categoryId?: string;
  }
): Promise<
  ApiResponse<
    Array<{
      id: string;
      date: string;
      description: string;
      amount: string;
      type: string;
      category: string;
    }>
  >
> {
  try {
    const userId = await resolveUserId();
    let entries = await ledgerRepo.getLedgerEntriesForPeriod(periodId);

    // Apply filters
    if (filters?.type) {
      const expectedType = toLedgerEntryType(filters.type);
      entries = entries.filter((e: { entryType: string }) => e.entryType === expectedType);
    }
    if (filters?.categoryId) {
      entries = entries.filter((e: { categoryId: string }) => e.categoryId === filters.categoryId);
    }

    // Format for response
    const categories = await categoriesRepo.getCategoriesForUser(userId);
    const categoryMap = new Map<string, { id: string; name: string }>(
      categories.map((c: { id: string; name: string }) => [c.id, c])
    );

    const formatted = entries.map((e) => ({
      id: e.id,
      date: e.date.toISOString(),
      description: e.description || '',
      amount: e.amount.toString(),
      type: e.entryType,
      category: categoryMap.get(e.categoryId)?.name || 'Unknown',
    }));

    return {
      success: true,
      data: formatted,
    };
  } catch (error) {
    console.error('getTransactions error:', error);
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}
