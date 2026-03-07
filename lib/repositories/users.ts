/**
 * User Repository
 *
 * Database access layer for users.
 * For this single-user app, mostly for user initialization.
 */

import { prisma } from '@/lib/db';

/**
 * Get or create default user
 * For personal use, we use a single "Default User"
 */
export async function getOrCreateDefaultUser() {
  // Prefer the seeded single-user account.
  const personalUser = await prisma.user.findFirst({
    where: { name: 'Personal' },
    orderBy: { createdAt: 'asc' },
  });

  if (personalUser) return personalUser;

  // Support legacy naming if present.
  const legacyUser = await prisma.user.findFirst({
    where: { name: 'Default User' },
    orderBy: { createdAt: 'asc' },
  });

  if (legacyUser) return legacyUser;

  // If names were changed, pick the first user that already has financial data.
  const userWithData = await prisma.user.findFirst({
    where: {
      categories: { some: {} },
      periods: { some: {} },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (userWithData) return userWithData;

  // Fallback to any existing user to avoid creating duplicates unnecessarily.
  const anyUser = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  if (anyUser) return anyUser;

  return prisma.user.create({
    data: {
      name: 'Personal',
    },
  });
}

/**
 * Resolve a user id for server actions.
 * Uses explicit user id when provided, otherwise falls back to single app user.
 */
export async function resolveUserId(userId?: string) {
  if (userId) return userId;
  const user = await getOrCreateDefaultUser();
  return user.id;
}

/**
 * Get user by ID
 */
export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
  });
}

/**
 * Get all users (future: multi-user support)
 */
export async function getAllUsers() {
  return prisma.user.findMany();
}
