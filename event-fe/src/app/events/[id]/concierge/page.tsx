'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  User as UserIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

import { adminApi, attendeesApi, conciergeApi, eventsApi } from '@/lib/api';
import type { ConciergeMatch } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  matches?: ConciergeMatch[] | null;
  /** Last submitted rating, if any. 5 = thumbs up, 1 = thumbs down. */
  rating?: 1 | 5;
}

const SUGGESTED_PROMPTS = [
  'Find me an AI cofounder with LLM experience',
  'I want to meet backend engineers interested in B2B SaaS',
  'Who here is open to mentor a first-time founder?',
];

export default function ConciergePage() {
  const { id: eventId } = useParams<{ id: string }>();
  const [askerId, setAskerId] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch event + attendees for context.
  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventsApi.get(eventId),
    enabled: !!eventId,
  });

  // Pull a generous page so the picker shows everyone for small events.
  const attendeesQuery = useQuery({
    queryKey: ['attendees', eventId, { page: 1, pageSize: 100 }],
    queryFn: () => attendeesApi.list(eventId, { page: 1, pageSize: 100 }),
    enabled: !!eventId,
  });

  // Reset chat when the asker changes — each attendee gets a fresh thread
  // (the backend already separates sessions by (event, attendee), so this
  // just keeps the UI honest about whose perspective we're showing).
  useEffect(() => {
    setMessages([]);
  }, [askerId]);

  // Always scroll to the bottom when messages arrive.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const backfill = useMutation({
    mutationFn: () => adminApi.backfillEmbeddings(eventId),
    onSuccess: (res) =>
      toast.success(
        res.attempted === 0
          ? 'All attendees already have embeddings'
          : `Rebuilt ${res.updated}/${res.attempted} embedding${res.attempted === 1 ? '' : 's'}`,
      ),
    onError: (err: Error) => toast.error(err.message),
  });

  const mutation = useMutation({
    mutationFn: (message: string) => {
      if (!askerId) throw new Error('Pick an attendee first');
      return conciergeApi.send(eventId, askerId, message);
    },
    onSuccess: (res) => {
      setMessages((prev) => [
        ...prev,
        {
          id: res.message_id,
          role: 'assistant',
          content: res.reply,
          matches: res.matches ?? null,
        },
      ]);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      // Roll back the optimistic user message so the input isn't lost.
      setMessages((prev) => prev.slice(0, -1));
    },
  });

  const onSend = (text: string) => {
    const value = text.trim();
    if (!value || !askerId || mutation.isPending) return;
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: 'user', content: value },
    ]);
    setDraft('');
    mutation.mutate(value);
  };

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/events/${eventId}`}>
          <ArrowLeft />
          Back to event
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Networking Concierge
          </h1>
          <p className="text-sm text-muted-foreground">
            {eventQuery.data?.title ?? 'Loading event…'} · find people worth meeting and get a draft intro.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={backfill.isPending}
          onClick={() => backfill.mutate()}
          title="Re-embed attendees missing a vector (e.g. registered before OPENAI_API_KEY was set)"
        >
          {backfill.isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-4 w-4" />
          )}
          Rebuild embeddings
        </Button>
      </div>

      {/* Asker picker — required so the agent knows whose perspective to take. */}
      <Card>
        <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">You are…</Label>
            <Select value={askerId ?? ''} onValueChange={(v) => setAskerId(v)}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    attendeesQuery.isLoading
                      ? 'Loading attendees…'
                      : 'Pick the attendee asking'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(attendeesQuery.data?.data ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    {a.headline ? ` — ${a.headline}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {askerId && (
            <Button variant="ghost" size="sm" onClick={() => setAskerId(undefined)}>
              Switch
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Chat panel */}
      <Card className="flex h-[60vh] flex-col">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <EmptyState
              disabled={!askerId || mutation.isPending}
              onPick={(p) => onSend(p)}
            />
          )}

          {messages.map((m) =>
            m.role === 'user' ? (
              <UserBubble key={m.id} text={m.content} />
            ) : (
              <AssistantBubble
                key={m.id}
                eventId={eventId}
                messageId={m.id}
                text={m.content}
                matches={m.matches ?? null}
                initialRating={m.rating}
                onRated={(rating) =>
                  setMessages((prev) =>
                    prev.map((x) => (x.id === m.id ? { ...x, rating } : x)),
                  )
                }
              />
            ),
          )}

          {mutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Concierge is searching, scoring, and drafting…
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t p-3">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSend(draft);
            }}
          >
            <Textarea
              placeholder={
                askerId
                  ? 'Describe who you want to meet…'
                  : 'Pick an attendee above to start chatting'
              }
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend(draft);
                }
              }}
              disabled={!askerId || mutation.isPending}
              rows={2}
              className="min-h-[44px] resize-none"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!askerId || !draft.trim() || mutation.isPending}
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

function EmptyState({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (text: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Bot className="h-6 w-6 text-primary" />
      </div>
      <div className="max-w-md space-y-1">
        <p className="font-medium">Ask the concierge to find people for you.</p>
        <p className="text-sm text-muted-foreground">
          The agent searches attendees semantically, scores how well they match
          your intent, and drafts a short intro you can copy.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTED_PROMPTS.map((p) => (
          <Button
            key={p}
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onPick(p)}
          >
            {p}
          </Button>
        ))}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end gap-2">
      <div className="max-w-[80%] rounded-lg rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground whitespace-pre-wrap">
        {text}
      </div>
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
        <UserIcon className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

function AssistantBubble({
  eventId,
  messageId,
  text,
  matches,
  initialRating,
  onRated,
}: {
  eventId: string;
  messageId: string;
  text: string;
  matches: ConciergeMatch[] | null;
  initialRating?: 1 | 5;
  onRated: (rating: 1 | 5) => void;
}) {
  // Local-only message (e.g. the LLM-offline stub) starts with a `local-`
  // prefix; the BE has no row to attach feedback to, so we hide the buttons.
  const canRate = !messageId.startsWith('local-');
  return (
    <div className="flex gap-2">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="max-w-[85%] flex-1 space-y-3">
        <div className="rounded-lg rounded-tl-sm bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
          {text || <span className="italic text-muted-foreground">(no reply text)</span>}
        </div>
        {matches && matches.length > 0 && (
          <div className="space-y-2">
            {matches.map((m) => (
              <MatchCard key={m.candidate.id} match={m} />
            ))}
          </div>
        )}
        {canRate && (
          <FeedbackBar
            eventId={eventId}
            messageId={messageId}
            initialRating={initialRating}
            onRated={onRated}
          />
        )}
      </div>
    </div>
  );
}

function FeedbackBar({
  eventId,
  messageId,
  initialRating,
  onRated,
}: {
  eventId: string;
  messageId: string;
  initialRating?: 1 | 5;
  onRated: (rating: 1 | 5) => void;
}) {
  const [current, setCurrent] = useState<1 | 5 | undefined>(initialRating);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');

  const submit = useMutation({
    mutationFn: ({ rating, notes }: { rating: 1 | 5; notes?: string }) =>
      conciergeApi.sendFeedback(eventId, messageId, rating, notes),
    onSuccess: (_res, vars) => {
      setCurrent(vars.rating);
      onRated(vars.rating);
      if (vars.notes) {
        setShowNotes(false);
        setNotes('');
        toast.success('Thanks — feedback saved with note');
      } else {
        toast.success('Thanks for the feedback');
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col gap-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <span>Was this helpful?</span>
        <Button
          size="sm"
          variant={current === 5 ? 'secondary' : 'ghost'}
          className="h-7 px-2"
          disabled={submit.isPending}
          onClick={() => submit.mutate({ rating: 5 })}
          aria-label="Thumbs up"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant={current === 1 ? 'secondary' : 'ghost'}
          className="h-7 px-2"
          disabled={submit.isPending}
          onClick={() => submit.mutate({ rating: 1 })}
          aria-label="Thumbs down"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          disabled={submit.isPending || !current}
          onClick={() => setShowNotes((v) => !v)}
          title={current ? 'Add a note' : 'Pick a rating first'}
        >
          {showNotes ? 'Hide note' : 'Add note'}
        </Button>
        {current && !submit.isPending && <Check className="h-3.5 w-3.5 text-emerald-600" />}
        {submit.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      </div>
      {showNotes && current && (
        <div className="flex items-end gap-2">
          <Textarea
            rows={2}
            placeholder="What could be better?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[44px] resize-none text-sm"
          />
          <Button
            size="sm"
            disabled={!notes.trim() || submit.isPending}
            onClick={() => submit.mutate({ rating: current, notes: notes.trim() })}
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

function MatchCard({ match }: { match: ConciergeMatch }) {
  const { candidate, score, rationale, shared_ground, draft_intro } = match;
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Intro copied');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-medium leading-tight">
              {candidate.name ?? candidate.id}
            </div>
            {candidate.headline && (
              <div className="text-xs text-muted-foreground">{candidate.headline}</div>
            )}
          </div>
          <Badge variant="secondary" className="shrink-0">
            {score}/100
          </Badge>
        </div>

        {(candidate.role || candidate.company) && (
          <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
            {candidate.role && <span>{candidate.role}</span>}
            {candidate.role && candidate.company && <span>·</span>}
            {candidate.company && <span>{candidate.company}</span>}
          </div>
        )}

        {rationale && (
          <p className="text-sm text-muted-foreground">{rationale}</p>
        )}

        {shared_ground?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {shared_ground.map((tag) => (
              <Badge key={tag} variant="outline" className="font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {draft_intro && (
          <div className="rounded-md border bg-background p-2 text-sm">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Draft intro
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy(draft_intro)}
                className="h-7 px-2 text-xs"
              >
                <Copy className="mr-1 h-3 w-3" />
                Copy
              </Button>
            </div>
            <p className="whitespace-pre-wrap text-sm">{draft_intro}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
