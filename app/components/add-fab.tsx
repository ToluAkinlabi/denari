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
      className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#1d4ed8,#0f766e)] text-white shadow-[0_16px_36px_-18px_rgba(15,23,42,0.9)] ring-1 ring-amber-200/40 transition-all hover:scale-[1.03] hover:brightness-110 active:scale-95"
      aria-label="Add entry"
    >
      <Plus size={28} className="text-white" />
    </Link>
  );
}
