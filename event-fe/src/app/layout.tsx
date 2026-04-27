import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { Calendar } from 'lucide-react';

import './globals.css';
import { Providers } from './providers';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Event Management',
  description: 'Conference networking platform — events & attendees',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={cn('min-h-screen bg-background font-sans antialiased', inter.variable)}>
        <Providers>
          <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container flex h-16 items-center justify-between">
                <Link href="/events" className="flex items-center gap-2 font-semibold">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Calendar className="h-4 w-4" />
                  </span>
                  <span className="text-lg tracking-tight">Event Management</span>
                </Link>
                <nav className="flex items-center gap-1 text-sm">
                  <Link
                    href="/events"
                    className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Events
                  </Link>
                </nav>
              </div>
            </header>
            <main className="container flex-1 py-8">{children}</main>
            <footer className="border-t py-6 text-center text-sm text-muted-foreground">
              Phase 1 — Event &amp; Attendee management
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
