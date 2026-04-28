'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { eventsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ConciergeChat } from '@/components/concierge-chat';

export default function ConciergePage() {
  const { id: eventId } = useParams<{ id: string }>();

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventsApi.get(eventId),
    enabled: !!eventId,
  });

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/events/${eventId}`}>
          <ArrowLeft />
          Back to event
        </Link>
      </Button>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Sparkles className="h-6 w-6 text-primary" />
          AI Networking Concierge
        </h1>
        <p className="text-sm text-muted-foreground">
          {eventQuery.data?.title ?? 'Loading event…'} · find people worth meeting and get a draft intro.
        </p>
      </div>

      <ConciergeChat eventId={eventId} />
    </div>
  );
}
