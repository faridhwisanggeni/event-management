'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarRange, MapPin, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

import { eventsApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreateEventDialog } from '@/components/create-event-dialog';

export default function EventsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsApi.list(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground">Browse upcoming events and manage attendees.</p>
        </div>
        <CreateEventDialog />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading events…
        </div>
      )}

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="flex items-center gap-3 py-6 text-sm text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load events: {(error as Error).message}</span>
            <Button size="sm" variant="outline" onClick={() => refetch()} className="ml-auto">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {data && data.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <CalendarRange className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No events yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first event to start onboarding attendees.
            </p>
          </CardContent>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((event) => (
            <Card key={event.id} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="line-clamp-2">{event.title}</CardTitle>
                <CardDescription className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {event.location}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarRange className="h-4 w-4" />
                  <span>
                    {format(new Date(event.startsAt), 'd MMM yyyy, HH:mm')} –{' '}
                    {format(new Date(event.endsAt), 'HH:mm')}
                  </span>
                </div>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`/events/${event.id}`}>
                    View attendees
                    <ArrowRight className="ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
