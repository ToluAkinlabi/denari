'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function AddFab() {
  const pathname = usePathname();
  if (pathname === '/add') return null;

  return (
    <Link
      href="/add"
      className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-sky-500 hover:bg-sky-400 active:bg-sky-600 flex items-center justify-center shadow-lg transition-colors"
      aria-label="Add entry"
    >
      <Plus size={28} className="text-white" />
    </Link>
  );
}
