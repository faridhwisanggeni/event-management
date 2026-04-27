export interface Event {
  id: string;
  title: string;
  location: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
}

export type AttendeeRole =
  | 'BACKEND_DEVELOPER'
  | 'FRONTEND_DEVELOPER'
  | 'FULLSTACK_DEVELOPER'
  | 'PROJECT_MANAGER'
  | 'PRODUCT_OWNER'
  | 'CHIEF_TECHNOLOGY_OFFICER'
  | 'HEAD_OF_ENGINEERING'
  | 'ENGINEERING_MANAGER'
  | 'DATABASE_ADMINISTRATOR'
  | 'DEVOPS'
  | 'DEVSECOPS'
  | 'NETWORK_ENGINEERING';

export interface Attendee {
  id: string;
  eventId: string;
  name: string;
  headline: string | null;
  bio: string | null;
  company: string | null;
  role: AttendeeRole | null;
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

export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
  requestId?: string;
}
