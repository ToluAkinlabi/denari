'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DenariMark } from './denari-mark';
import {
  Home,
  List,
  Settings,
  PieChart,
  CalendarRange,
} from 'lucide-react';

export function Navigation() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  const navItems = [
    { href: '/', icon: Home, label: 'Dashboard', mobile: true },
    { href: '/transactions', icon: List, label: 'Transactions', mobile: true },
    { href: '/raf', icon: PieChart, label: 'RAF', mobile: true },
    { href: '/periods', icon: CalendarRange, label: 'Periods', mobile: true },
    { href: '/settings', icon: Settings, label: 'Settings', mobile: true },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-800/90 bg-slate-950/95 shadow-[0_-12px_40px_-24px_rgba(15,23,42,0.95)] backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-x-0 -top-5 flex justify-center">
        <div className="rounded-full border border-slate-700/80 bg-slate-950/95 px-2 py-1 shadow-lg">
          <DenariMark markClassName="h-8 w-8 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-5 max-w-screen-sm mx-auto">
        {navItems.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={`flex items-center justify-center py-4 px-2 mx-1 my-2 rounded-xl transition-all duration-200 ${
              isActive(href)
                ? 'nav-tab-active scale-105'
                : 'text-gray-400 hover:text-gray-100'
            }`}
            title={label}
          >
            <Icon size={22} />
          </Link>
        ))}
      </div>
    </nav>
  );
}
