/**
 * Notes Repository
 *
 * Database access layer for notes.
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

/**
 * Get notes for a period
 */
export async function getNotesForPeriod(periodId: string) {
  return prisma.note.findMany({
    where: { periodId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get notes for a ledger entry
 */
export async function getNotesForEntry(ledgerEntryId: string) {
  return prisma.note.findMany({
    where: { ledgerEntryId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Create note
 */
export async function createNote(
  data: Prisma.NoteCreateInput | Prisma.NoteUncheckedCreateInput
) {
  return prisma.note.create({
    data,
  });
}

/**
 * Update note
 */
export async function updateNote(id: string, content: string) {
  return prisma.note.update({
    where: { id },
    data: { content },
  });
}

/**
 * Delete note
 */
export async function deleteNote(id: string) {
  return prisma.note.delete({
    where: { id },
  });
}
