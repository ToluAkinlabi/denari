'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  List,
  PlusCircle,
  Settings,
  TrendingUp,
  FlaskConical,
} from 'lucide-react';

export function Navigation() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  const navItems = [
    { href: '/', icon: Home, label: 'Dashboard', mobile: true },
    { href: '/transactions', icon: List, label: 'Transactions', mobile: true },
    { href: '/add', icon: PlusCircle, label: 'Add', mobile: true },
    { href: '/reports', icon: TrendingUp, label: 'Reports', mobile: true },
    { href: '/scenarios', icon: FlaskConical, label: 'Scenarios', mobile: true },
    { href: '/settings', icon: Settings, label: 'Settings', mobile: true },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-lg">
      <div className="grid grid-cols-6 max-w-screen-sm mx-auto">
        {navItems.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center py-3 px-2 transition-colors duration-200 ${
              isActive(href)
                ? 'text-sky-500'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
            title={label}
          >
            <Icon size={24} />
            <span className="text-xs mt-1 font-medium">{label.split('')[0]}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
