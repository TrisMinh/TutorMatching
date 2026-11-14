export type AccountRole = 'Student' | 'Tutor';

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAtUtc?: string;
  refreshTokenExpiresAtUtc?: string;
  tokenType?: string;
  role?: AccountRole;
  email?: string;
};

export type AuthSessionRepository = {
  load(): AuthSession | undefined;
  save(session: AuthSession, persistent?: boolean): void;
  clear(): void;
};

export type ProblemDetails = {
  title?: string;
  detail?: string;
  status?: number;
  code?: string;
  errors?: Record<string, string[]>;
  error?: string;
};

export class GatewayError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly errors?: Record<string, string[]>;

  constructor(status: number, problem: ProblemDetails = {}) {
    super(problem.detail || problem.error || problem.title || `Gateway request failed with status ${status}.`);
    this.name = 'GatewayError';
    this.status = status;
    this.code = problem.code;
    this.errors = problem.errors;
  }
}

export type AuthUser = {
  userId: string;
  email: string;
  role: AccountRole;
};

export type Subject = { id: string; code: string; name: string };
export type TutorSubject = { subjectId: string; proficiencyLevel: string | number };
export type AvailabilityWindow = { startAtUtc: string; endAtUtc: string };
export type TutorProfile = {
  id: string;
  displayName: string;
  bio: string;
  experienceYears: number;
  avatarUrl?: string | null;
  subjects: TutorSubject[];
  availability: AvailabilityWindow[];
};
export type TutorSearchResponse = {
  items: TutorProfile[];
  page: number;
  pageSize: number;
  total: number;
};
export type StudentProfile = {
  id: string;
  userId: string;
  displayName: string;
  educationLevel: string | number;
  learningGoal: string;
  timezone: string;
  status: string;
  version: number;
  interests: Array<{ subjectId: string; priority: number }>;
};
export type Booking = {
  id: string;
  studentId: string;
  tutorId: string;
  subjectId: string;
  startAtUtc: string;
  endAtUtc: string;
  status: string;
  confirmedAtUtc?: string | null;
  cancelledAtUtc?: string | null;
};
export type BookingHold = { holdId: string; holdToken: string; expiresAtUtc: string };
export type NotificationItem = {
  id: string;
  bookingId?: string | null;
  type: string;
  title: string;
  body: string;
  status: 'Unread' | 'Read' | string;
  createdAtUtc: string;
  readAtUtc?: string | null;
};
export type NotificationPage = {
  items: NotificationItem[];
  page: number;
  pageSize: number;
  total: number;
};

type GatewayClientOptions = {
  baseUrl: string;
  fetcher?: typeof fetch;
  session: AuthSessionRepository;
};

export class GatewayClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly session: AuthSessionRepository;
  private refreshInFlight?: Promise<AuthSession | undefined>;

  constructor({ baseUrl, fetcher = globalThis.fetch.bind(globalThis), session }: GatewayClientOptions) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetcher = fetcher;
    this.session = session;
  }

  async register(input: { email: string; password: string; role: AccountRole }) {
    return this.request<{ id: string; email: string; role: AccountRole; status: string }>(
      '/api/v1/auth/register',
      { method: 'POST', body: JSON.stringify(input) },
      false,
    );
  }

  async login(input: { email: string; password: string }, persistent = false) {
    const tokens = await this.request<AuthSession>(
      '/api/v1/auth/login',
      { method: 'POST', body: JSON.stringify(input) },
      false,
    );
    this.session.save(tokens, persistent);
    try {
      const user = await this.getCurrentUser();
      const session = { ...tokens, role: user.role, email: user.email };
      this.session.save(session, persistent);
      return { tokens: session, user };
    } catch (error) {
      this.session.clear();
      throw error;
    }
  }

  async logout() {
    const current = this.session.load();
    try {
      if (current?.refreshToken) {
        await this.request<void>(
          '/api/v1/auth/revoke',
          { method: 'POST', body: JSON.stringify({ refreshToken: current.refreshToken }) },
          false,
        );
      }
    } finally {
      this.session.clear();
    }
  }

  getCurrentUser() {
    return this.request<AuthUser>('/api/v1/users/me');
  }

  listSubjects() {
    return this.request<Subject[]>('/api/v1/subjects', {}, false);
  }

  searchTutors(subjectId?: string, page = 1, pageSize = 20) {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (subjectId) query.set('subjectId', subjectId);
    return this.request<TutorSearchResponse>(`/api/v1/tutors?${query}`, {}, false);
  }

  getTutor(id: string) {
    return this.request<TutorProfile>(`/api/v1/tutors/${id}`, {}, false);
  }

  getStudentProfile() {
    return this.request<StudentProfile>('/api/v1/students/me');
  }

  saveStudentProfile(input: {
    displayName: string;
    educationLevel: number;
    learningGoal: string;
    timezone: string;
  }) {
    return this.request<Pick<StudentProfile, 'id' | 'userId' | 'displayName' | 'version'>>(
      '/api/v1/students/me',
      { method: 'PUT', body: JSON.stringify(input) },
    );
  }

  saveStudentInterests(input: Array<{ subjectId: string; priority: number }>) {
    return this.request<void>('/api/v1/students/me/interests', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  saveTutorProfile(input: {
    displayName: string;
    bio: string;
    experienceYears: number;
    avatarUrl?: string | null;
  }) {
    return this.request<{ id: string; userId: string; displayName: string; version: number }>(
      '/api/v1/tutors/me',
      { method: 'PUT', body: JSON.stringify(input) },
    );
  }

  saveTutorSubjects(input: Array<{ subjectId: string; proficiencyLevel: number }>) {
    return this.request<void>('/api/v1/tutors/me/subjects', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  saveTutorAvailability(input: AvailabilityWindow[]) {
    return this.request<void>('/api/v1/tutors/me/availability', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  listBookings() {
    return this.request<Booking[]>('/api/v1/bookings');
  }

  createBookingHold(input: { tutorId: string; subjectId: string; startAtUtc: string }) {
    return this.request<BookingHold>('/api/v1/bookings/holds', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  confirmBooking(input: { holdId: string; holdToken: string }) {
    return this.request<Booking>('/api/v1/bookings', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  cancelBooking(bookingId: string, reasonCode: string) {
    const query = new URLSearchParams({ reasonCode });
    return this.request<void>(`/api/v1/bookings/${bookingId}?${query}`, { method: 'DELETE' });
  }

  listNotifications(status?: 'Unread' | 'Read') {
    const query = new URLSearchParams({ page: '1', pageSize: '100' });
    if (status) query.set('status', status);
    return this.request<NotificationPage>(`/api/v1/notifications?${query}`);
  }

  markNotificationRead(id: string) {
    return this.request<void>(`/api/v1/notifications/${id}/read`, { method: 'PUT' });
  }

  private async request<T>(path: string, init: RequestInit = {}, authenticated = true, retry = true): Promise<T> {
    const response = await this.send(path, init, authenticated);
    if (response.status === 401 && authenticated && retry && this.session.load()?.refreshToken) {
      const refreshed = await this.refreshSession();
      if (refreshed) return this.request<T>(path, init, authenticated, false);
    }
    if (!response.ok) throw await this.toError(response);
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

  private send(path: string, init: RequestInit, authenticated: boolean) {
    const token = authenticated ? this.session.load()?.accessToken : undefined;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string> | undefined),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    return this.fetcher(`${this.baseUrl}${path}`, { ...init, headers });
  }

  private refreshSession() {
    this.refreshInFlight ??= this.performRefresh().finally(() => { this.refreshInFlight = undefined; });
    return this.refreshInFlight;
  }

  private async performRefresh() {
    const current = this.session.load();
    if (!current?.refreshToken) return undefined;
    const response = await this.send('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    }, false);
    if (!response.ok) {
      this.session.clear();
      return undefined;
    }
    const refreshed = await response.json() as AuthSession;
    const session = { ...refreshed, role: current.role, email: current.email };
    this.session.save(session);
    return session;
  }

  private async toError(response: Response) {
    let problem: ProblemDetails = {};
    try {
      problem = await response.json() as ProblemDetails;
    } catch {
      problem = { title: response.statusText };
    }
    return new GatewayError(response.status, problem);
  }
}
