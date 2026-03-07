/**
 * User Repository
 *
 * Database access layer for users.
 * For this single-user app, mostly for user initialization.
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

/**
 * Get or create default user
 * For personal use, we use a single "Default User"
 */
export async function getOrCreateDefaultUser() {
  const existingUser = await prisma.user.findFirst({
    where: { name: 'Default User' },
  });

  if (existingUser) return existingUser;

  return prisma.user.create({
    data: {
      name: 'Personal',
    },
  });
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
