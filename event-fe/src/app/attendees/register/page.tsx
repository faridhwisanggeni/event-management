'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { attendeesApi, eventsApi } from '@/lib/api';
import { useRoles } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const schema = z.object({
  eventId: z.string().uuid({ message: 'Pick an event' }),
  name: z.string().min(1, 'Required').max(120),
  headline: z.string().max(200).optional(),
  bio: z.string().max(4000).optional(),
  company: z.string().max(120).optional(),
  roleId: z.string().uuid().optional().or(z.literal('')),
  skills: z.string().optional(),
  lookingFor: z.string().max(2000).optional(),
  openToChat: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

const EMPTY_FORM: FormValues = {
  eventId: '',
  name: '',
  headline: '',
  bio: '',
  company: '',
  roleId: '',
  skills: '',
  lookingFor: '',
  openToChat: true,
};

export default function RegisterAttendeePage() {
  const queryClient = useQueryClient();
  const eventsQuery = useQuery({ queryKey: ['events'], queryFn: () => eventsApi.list() });
  const rolesQuery = useRoles();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    form.reset(EMPTY_FORM);
  }, [form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      attendeesApi.create(values.eventId, {
        name: values.name,
        headline: values.headline || undefined,
        bio: values.bio || undefined,
        company: values.company || undefined,
        roleId: values.roleId || undefined,
        skills: values.skills
          ? values.skills.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
        lookingFor: values.lookingFor || undefined,
        openToChat: values.openToChat,
      }),
    onSuccess: (a, vars) => {
      toast.success(`${a.name} registered`);
      queryClient.invalidateQueries({ queryKey: ['attendees', vars.eventId] });
      form.reset(EMPTY_FORM);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          Register attendee
        </CardTitle>
        <CardDescription>
          Pick the event you’re joining and fill in your profile. Role is dynamic from the API.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
          autoComplete="off"
        >
          <div className="space-y-2">
            <Label>Event *</Label>
            <Controller
              control={form.control}
              name="eventId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
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
              )}
            />
            {form.formState.errors.eventId && (
              <p className="text-xs text-destructive">{form.formState.errors.eventId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Asani Suryana"
                autoComplete="off"
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                placeholder="Acme Inc"
                autoComplete="off"
                {...form.register('company')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              placeholder="Senior Backend Engineer @ Acme"
              autoComplete="off"
              {...form.register('headline')}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Controller
                control={form.control}
                name="roleId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          rolesQuery.isLoading ? 'Loading roles…' : 'Select a role'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(rolesQuery.data ?? []).map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skills">Skills (comma-separated)</Label>
              <Input
                id="skills"
                placeholder="nestjs, postgres, ai"
                autoComplete="off"
                {...form.register('skills')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              rows={3}
              placeholder="Short professional bio..."
              autoComplete="off"
              {...form.register('bio')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lookingFor">Looking for</Label>
            <Textarea
              id="lookingFor"
              rows={2}
              placeholder="What you hope to find at this event..."
              autoComplete="off"
              {...form.register('lookingFor')}
            />
          </div>

          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="openToChat"
              render={({ field }) => (
                <Checkbox
                  id="openToChat"
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(Boolean(v))}
                />
              )}
            />
            <Label htmlFor="openToChat" className="cursor-pointer">
              Open to being contacted by other attendees
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset(EMPTY_FORM)}
              disabled={mutation.isPending}
            >
              Reset
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Register
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
