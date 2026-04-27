export interface Event {
  id: string;
  title: string;
  location: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Attendee {
  id: string;
  eventId: string;
  name: string;
  headline: string | null;
  bio: string | null;
  company: string | null;
  roleId: string | null;
  /** Included when the endpoint joins the Role relation. */
  role?: Role | null;
  skills: string[];
  lookingFor: string | null;
  openToChat: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ConciergeCandidate {
  id: string;
  name?: string;
  headline?: string | null;
  company?: string | null;
  role?: string | null;
  skills?: string[];
  lookingFor?: string | null;
  similarity?: number | null;
}

export interface ConciergeMatch {
  candidate: ConciergeCandidate;
  score: number;
  rationale: string;
  shared_ground: string[];
  draft_intro: string | null;
}

export interface ConciergeTurnResponse {
  session_id: string;
  message_id: string;
  reply: string;
  matches: ConciergeMatch[] | null;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
  requestId?: string;
}
