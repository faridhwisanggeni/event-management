import type {
  ApiError,
  Attendee,
  ConciergeTurnResponse,
  Event,
  Paginated,
  Role,
} from './types';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';

export class ApiRequestError extends Error {
  status: number;
  payload: ApiError | null;
  constructor(message: string, status: number, payload: ApiError | null) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    let payload: ApiError | null = null;
    try {
      payload = (await res.json()) as ApiError;
    } catch {
      payload = null;
    }
    const msg = Array.isArray(payload?.message)
      ? payload?.message.join(', ')
      : (payload?.message ?? res.statusText);
    throw new ApiRequestError(msg ?? 'Request failed', res.status, payload);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface CreateEventInput {
  title: string;
  location: string;
  startsAt: string;
  endsAt: string;
}

export const eventsApi = {
  list: () => request<Event[]>('/events'),
  get: (id: string) => request<Event>(`/events/${id}`),
  create: (input: CreateEventInput) =>
    request<Event>('/events', { method: 'POST', body: JSON.stringify(input) }),
};

export interface CreateAttendeeInput {
  name: string;
  headline?: string;
  bio?: string;
  company?: string;
  roleId?: string;
  skills?: string[];
  lookingFor?: string;
  openToChat?: boolean;
}

export interface ListAttendeesParams {
  page?: number;
  pageSize?: number;
  roleId?: string;
  skills?: string[];
}

export const attendeesApi = {
  list: (eventId: string, params: ListAttendeesParams = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params.roleId) qs.set('roleId', params.roleId);
    if (params.skills && params.skills.length > 0)
      qs.set('skills', params.skills.join(','));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<Paginated<Attendee>>(`/events/${eventId}/attendees${suffix}`);
  },
  create: (eventId: string, input: CreateAttendeeInput) =>
    request<Attendee>(`/events/${eventId}/attendees`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};

export const rolesApi = {
  list: () => request<Role[]>('/roles'),
};

export const adminApi = {
  backfillEmbeddings: (eventId: string) =>
    request<{ attempted: number; updated: number }>(
      `/events/${eventId}/attendees/backfill-embeddings`,
      { method: 'POST' },
    ),
};

export interface ConciergeFeedback {
  id: string;
  rating: number;
  notes: string | null;
}

export const conciergeApi = {
  send: (eventId: string, attendeeId: string, message: string) =>
    request<ConciergeTurnResponse>(`/events/${eventId}/concierge/messages`, {
      method: 'POST',
      body: JSON.stringify({ attendee_id: attendeeId, message }),
    }),
  sendFeedback: (
    eventId: string,
    messageId: string,
    rating: number,
    notes?: string,
  ) =>
    request<ConciergeFeedback>(
      `/events/${eventId}/concierge/messages/${messageId}/feedback`,
      {
        method: 'POST',
        body: JSON.stringify(notes ? { rating, notes } : { rating }),
      },
    ),
};
