'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { eventsApi } from '@/lib/api';

const schema = z
  .object({
    title: z.string().min(3, 'Min 3 characters').max(200),
    location: z.string().min(1, 'Required').max(200),
    startsAt: z.string().min(1, 'Required'),
    endsAt: z.string().min(1, 'Required'),
  })
  .refine((d) => new Date(d.endsAt) > new Date(d.startsAt), {
    message: 'End time must be after start time',
    path: ['endsAt'],
  });

type FormValues = z.infer<typeof schema>;

export function CreateEventDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', location: '', startsAt: '', endsAt: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      eventsApi.create({
        title: values.title,
        location: values.location,
        startsAt: new Date(values.startsAt).toISOString(),
        endsAt: new Date(values.endsAt).toISOString(),
      }),
    onSuccess: (event) => {
      toast.success(`Event "${event.title}" created`);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      form.reset();
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1" />
          Create Event
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create event</DialogTitle>
          <DialogDescription>Add a new event to the platform.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="AI Summit Jakarta" {...form.register('title')} />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="Jakarta Convention Center"
              {...form.register('location')}
            />
            {form.formState.errors.location && (
              <p className="text-xs text-destructive">{form.formState.errors.location.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="startsAt">Starts at</Label>
              <Input id="startsAt" type="datetime-local" {...form.register('startsAt')} />
              {form.formState.errors.startsAt && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.startsAt.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endsAt">Ends at</Label>
              <Input id="endsAt" type="datetime-local" {...form.register('endsAt')} />
              {form.formState.errors.endsAt && (
                <p className="text-xs text-destructive">{form.formState.errors.endsAt.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-1 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
