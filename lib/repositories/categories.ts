/**
 * Category Repository
 *
 * Database access layer for categories.
 * Centralizes all Prisma queries related to categories.
 *
 * Rule: Never query categories directly in UI components.
 * Always use these functions.
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

/**
 * Get all categories for a user
 */
export async function getCategoriesForUser(userId: string) {
  return prisma.category.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  });
}

/**
 * Get category by ID
 */
export async function getCategoryById(id: string) {
  return prisma.category.findUnique({
    where: { id },
  });
}

/**
 * Get category by name and user
 */
export async function getCategoryByName(userId: string, name: string) {
  return prisma.category.findFirst({
    where: { userId, name },
  });
}

/**
 * Get categories grouped by type
 */
export async function getCategoriesGrouped(userId: string) {
  const categories = await getCategoriesForUser(userId);
  type CategoryRecord = (typeof categories)[number];

  const grouped = new Map<string, typeof categories>();

  categories.forEach((cat: CategoryRecord) => {
    if (!grouped.has(cat.group)) {
      grouped.set(cat.group, []);
    }
    grouped.get(cat.group)!.push(cat);
  });

  return grouped;
}

/**
 * Get all income categories
 */
export async function getIncomeCategories(userId: string) {
  return prisma.category.findMany({
    where: { userId, type: 'INCOME' },
  });
}

/**
 * Get all expense categories
 */
export async function getExpenseCategories(userId: string) {
  return prisma.category.findMany({
    where: { userId, countsAsExpense: true },
  });
}

/**
 * Get all savings categories
 */
export async function getSavingsCategories(userId: string) {
  return prisma.category.findMany({
    where: { userId, countsAsSavings: true },
  });
}

/**
 * Create a new category
 */
export async function createCategory(data: {
  userId: string;
  name: string;
  type: Prisma.CategoryUncheckedCreateInput['type'];
  group: Prisma.CategoryUncheckedCreateInput['group'];
  color: string;
  countsAsExpense: boolean;
  countsAsSavings: boolean;
  icon?: string;
}) {
  return prisma.category.create({
    data,
  });
}
