/**
 * Database Layer
 *
 * Singleton Prisma instance for database access.
 * This is the only place where the Prisma client is instantiated.
 *
 * Rule: All database queries must go through repositories in lib/repositories/,
 * NOT directly from UI components.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

/**
 * Reuse connection pool in development
 */
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? process.env.PRISMA_LOG_QUERIES === 'true'
          ? ['query', 'error', 'warn']
          : ['error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
