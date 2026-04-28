'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, UserPlus } from 'lucide-react';

import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/attendees/register', label: 'Register', icon: UserPlus },
  { href: '/attendees/concierge', label: 'Concierge Chat', icon: Sparkles },
];

export default function AttendeesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="lg:w-56 lg:shrink-0">
        <div className="space-y-1">
          <h2 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Attendees
          </h2>
          <nav className="space-y-1">
            {ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
