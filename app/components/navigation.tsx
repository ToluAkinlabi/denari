'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  List,
  Settings,
  TrendingUp,
  CalendarRange,
} from 'lucide-react';

export function Navigation() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  const navItems = [
    { href: '/', icon: Home, label: 'Dashboard', mobile: true },
    { href: '/transactions', icon: List, label: 'Transactions', mobile: true },
    { href: '/reports', icon: TrendingUp, label: 'Reports', mobile: true },
    { href: '/periods', icon: CalendarRange, label: 'Periods', mobile: true },
    { href: '/settings', icon: Settings, label: 'Settings', mobile: true },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#232323] border-t border-[#3a3a3a] shadow-lg">
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
