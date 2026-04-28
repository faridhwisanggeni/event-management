'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';

import { eventsApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConciergeChat } from '@/components/concierge-chat';

export default function CrossEventConciergePage() {
  const [eventId, setEventId] = useState<string | undefined>(undefined);
  const eventsQuery = useQuery({ queryKey: ['events'], queryFn: () => eventsApi.list() });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Sparkles className="h-6 w-6 text-primary" />
          AI Networking Concierge
        </h1>
        <p className="text-sm text-muted-foreground">
          Pick an event, then chat as one of its attendees to get ranked matches.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pick an event</CardTitle>
          <CardDescription>
            The concierge runs per-event — only attendees of the selected event are searchable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label className="text-xs">Event</Label>
            <Select value={eventId ?? ''} onValueChange={(v) => setEventId(v)}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    eventsQuery.isLoading ? 'Loading events…' : 'Pick an event'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(eventsQuery.data ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.title}
                    {e.location ? ` — ${e.location}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {eventId ? (
        <ConciergeChat key={eventId} eventId={eventId} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Select an event above to start a concierge session.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
