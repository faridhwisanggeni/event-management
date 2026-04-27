'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, CalendarRange, Loader2, MapPin, Search, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { eventsApi, attendeesApi } from '@/lib/api';
import { ATTENDEE_ROLES, roleLabel } from '@/lib/roles';
import type { AttendeeRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RegisterAttendeeDialog } from '@/components/register-attendee-dialog';

const PAGE_SIZE = 10;

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<AttendeeRole | undefined>(undefined);
  const [skillsInput, setSkillsInput] = useState('');
  const [appliedSkills, setAppliedSkills] = useState<string[]>([]);

  const eventQuery = useQuery({
    queryKey: ['event', id],
    queryFn: () => eventsApi.get(id),
    enabled: !!id,
  });

  const attendeesQuery = useQuery({
    queryKey: ['attendees', id, { page, role, skills: appliedSkills }],
    queryFn: () =>
      attendeesApi.list(id, { page, pageSize: PAGE_SIZE, role, skills: appliedSkills }),
    enabled: !!id,
    placeholderData: (prev) => prev,
  });

  const onApplySkills = () => {
    const skills = skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setAppliedSkills(skills);
    setPage(1);
  };

  const onClearFilters = () => {
    setRole(undefined);
    setSkillsInput('');
    setAppliedSkills([]);
    setPage(1);
  };

  const totalPages = attendeesQuery.data?.meta.totalPages ?? 1;
  const total = attendeesQuery.data?.meta.total ?? 0;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/events">
          <ArrowLeft />
          Back to events
        </Link>
      </Button>

      {eventQuery.isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading event…
        </div>
      )}

      {eventQuery.data && (
        <Card>
          <CardContent className="space-y-3 py-6">
            <h1 className="text-2xl font-bold tracking-tight">{eventQuery.data.title}</h1>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {eventQuery.data.location}
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarRange className="h-4 w-4" />
                {format(new Date(eventQuery.data.startsAt), 'd MMM yyyy, HH:mm')} –{' '}
                {format(new Date(eventQuery.data.endsAt), 'HH:mm')}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {total} attendee{total === 1 ? '' : 's'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-end">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Filter by role</Label>
            <Select
              value={role ?? 'ALL'}
              onValueChange={(v) => {
                setRole(v === 'ALL' ? undefined : (v as AttendeeRole));
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All roles</SelectItem>
                {ATTENDEE_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Filter by skills (comma-separated)</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="ai, nestjs, founder"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onApplySkills()}
                />
              </div>
              <Button onClick={onApplySkills} variant="secondary">
                Apply
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(role || appliedSkills.length > 0) && (
            <Button variant="ghost" onClick={onClearFilters} size="sm">
              <X />
              Clear
            </Button>
          )}
          <RegisterAttendeeDialog eventId={id} />
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Skills</TableHead>
              <TableHead>Looking for</TableHead>
              <TableHead className="text-right">Open to chat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendeesQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            )}

            {attendeesQuery.data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No attendees match the current filters.
                </TableCell>
              </TableRow>
            )}

            {attendeesQuery.data?.data.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="font-medium">{a.name}</div>
                  {a.headline && (
                    <div className="text-xs text-muted-foreground">{a.headline}</div>
                  )}
                </TableCell>
                <TableCell>
                  {a.role ? <Badge variant="secondary">{roleLabel(a.role)}</Badge> : '—'}
                </TableCell>
                <TableCell>{a.company ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {a.skills.length === 0 && <span className="text-muted-foreground">—</span>}
                    {a.skills.slice(0, 4).map((s) => (
                      <Badge key={s} variant="outline" className="font-normal">
                        {s}
                      </Badge>
                    ))}
                    {a.skills.length > 4 && (
                      <span className="text-xs text-muted-foreground">
                        +{a.skills.length - 4}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="max-w-xs">
                  <span className="line-clamp-2 text-sm">{a.lookingFor ?? '—'}</span>
                </TableCell>
                <TableCell className="text-right">
                  {a.openToChat ? (
                    <Badge>Yes</Badge>
                  ) : (
                    <Badge variant="outline">No</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages} · {total} total
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || attendeesQuery.isFetching}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || attendeesQuery.isFetching}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
