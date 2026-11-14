import {resilientFetch} from './resilientFetch';
export type AccountPreferences = {emailReminders:boolean;inAppNotifications:boolean;enrollmentAlerts:boolean;profileVisible:boolean;cancellationNoticeHours:number;version:number};
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
export type Course = {status?:'Open'|'Closed'|'Cancelled';version?:number;cancellationReason?:string|null;cancelledAtUtc?:string|null;id:string;title:string;tutorId:string;instructor:string;image:string;category:string;description:string;capacity:number;enrolled:number;sessions:Array<{id:string;startAtUtc:string;endAtUtc:string}>};
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
export type AvailableTutor = Omit<TutorProfile, 'availability'> & {
  availableSlots: AvailabilityWindow[];
};
export type AvailableTutorSearchResponse = {
  items: AvailableTutor[];
  page: number;
  pageSize: number;
  total: number;
  generatedAtUtc: string;
  partial: boolean;
};
export type StudentProfile = {
  avatarUrl?: string | null;
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
  cancellationNoticeHours?:number;
  cancellationDeadlineUtc?:string;
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
export type BookingHold = { cancellationNoticeHours?:number; cancellationDeadlineUtc?:string; holdId: string; holdToken: string; expiresAtUtc: string };
export type NotificationItem = {
  courseId?: string;
  className?: string;
  startAtUtc?: string | null;
  actorName?: string;
  avatarUrl?: string | null;
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
  partial?: boolean;
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

  withdrawCourse(id:string) {return this.request<void>(`/api/v1/courses/${encodeURIComponent(id)}/enrollments/me`,{method:'DELETE'});}
  changeCourseStatus(id:string,status:'Open'|'Closed'|'Cancelled',version:number,reason?:string) {return this.request<{status:string;version:number}>(`/api/v1/courses/${encodeURIComponent(id)}/status`,{method:'PUT',body:JSON.stringify({status,version,reason})});}
  getSettings() { return this.request<AccountPreferences>('/api/v1/users/me/settings'); }
  saveSettings(settings:AccountPreferences) { return this.request<AccountPreferences>('/api/v1/users/me/settings',{method:'PUT',body:JSON.stringify(settings)}); }
  forgotPassword(email:string) { return this.request<void>('/api/v1/auth/forgot-password',{method:'POST',body:JSON.stringify({email})},false); }
  resetPassword(token:string,password:string) { return this.request<void>('/api/v1/auth/reset-password',{method:'POST',body:JSON.stringify({token,password})},false); }
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

  listCourses() { return this.request<Course[]>('/api/v1/courses', {}, false); }
  listMyCourses() { return this.request<Course[]>('/api/v1/courses/mine'); }
  getCourse(id:string) { return this.request<Course>(`/api/v1/courses/${encodeURIComponent(id)}`,{},false); }
  enrollCourse(id:string) { return this.request<{enrolled:boolean}>(`/api/v1/courses/${encodeURIComponent(id)}/enrollments`,{method:'POST'}); }

  searchTutors(subjectId?: string, page = 1, pageSize = 20) {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (subjectId) query.set('subjectId', subjectId);
    return this.request<TutorSearchResponse>(`/api/v1/tutors?${query}`, {}, false);
  }

  searchAvailableTutors(input: { subjectId: string; date: string; timezone: string; page?: number; pageSize?: number }) {
    const query = new URLSearchParams({
      subjectId: input.subjectId,
      date: input.date,
      timezone: input.timezone,
      page: String(input.page ?? 1),
      pageSize: String(input.pageSize ?? 20),
    });
    return this.request<AvailableTutorSearchResponse>(`/api/v1/search/available-tutors?${query}`);
  }

  getTutor(id: string) {
    return this.request<TutorProfile>(`/api/v1/tutors/${id}`, {}, false);
  }
  getMyTutorProfile() { return this.request<TutorProfile>('/api/v1/tutors/me'); }

  getStudentProfile() {
    return this.request<StudentProfile>('/api/v1/students/me');
  }

  saveStudentProfile(input: {
    avatarUrl?: string;
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
  getBookingDetails(id:string) { return this.request<{booking:Booking;studentName:string|null;studentAvatarUrl?:string|null}>(`/api/v1/bookings/${encodeURIComponent(id)}`); }
  getBookingStudentProfile(id:string) {return this.request<{id:string;displayName:string;avatarUrl?:string|null;educationLevel?:string;learningGoal?:string;timezone:string}>(`/api/v1/bookings/${encodeURIComponent(id)}/student-profile`);}

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

  async listNotifications(status?: 'Unread' | 'Read') {
    const query = new URLSearchParams({ page: '1', pageSize: '100' });
    if (status) query.set('status', status);
    const tutor=this.session.load()?.role==='Tutor';
    const sources=await Promise.allSettled([
      this.request<NotificationPage>(`/api/v1/notifications?${query}`),
      this.request<NotificationItem[]>('/api/v1/courses/lifecycle-notifications'),
      ...(tutor?[this.request<NotificationItem[]>('/api/v1/courses/enrollment-notifications')]:[])
    ]);
    if(sources.every(s=>s.status==='rejected'))throw (sources[0] as PromiseRejectedResult).reason;
    const existing=sources[0];
    const page=existing.status==='fulfilled'?existing.value as NotificationPage:{items:[],total:0,page:1,pageSize:100};
    const notices=sources.slice(1).flatMap(source=>source.status==='fulfilled'?source.value as NotificationItem[]:[]).filter(n=>!status||n.status===status);
    return this.presentNotifications({...page,partial:sources.some(s=>s.status==='rejected'),total:page.total+notices.length,items:[...page.items,...notices].sort((a,b)=>b.createdAtUtc.localeCompare(a.createdAtUtc)).slice(0,100)});
  }

  private async presentNotifications(page:NotificationPage):Promise<NotificationPage>{
    if(!page.items.some(n=>n.bookingId))return page;
    const metadata=await Promise.allSettled([this.listBookings(),this.listSubjects()]);
    if(metadata[0].status==='rejected'||metadata[1].status==='rejected')return {...page,partial:true};
    const bookings=metadata[0].value;const subjects=metadata[1].value;const tutor=this.session.load()?.role==='Tutor';
    const relevant=bookings.filter(b=>page.items.some(n=>n.bookingId===b.id));
    const people=new Map<string,{name?:string;avatar?:string|null}>();
    const unique=[...new Map(relevant.map(b=>[tutor?b.studentId:b.tutorId,b])).values()];
    let partial=!!page.partial;
    for(let i=0;i<unique.length;i+=6)await Promise.all(unique.slice(i,i+6).map(async b=>{
      try{if(tutor){const detail=await this.getBookingDetails(b.id);people.set(b.studentId,{name:detail.studentName??undefined,avatar:detail.studentAvatarUrl});}
        else{const profile=await this.getTutor(b.tutorId);people.set(b.tutorId,{name:profile.displayName,avatar:profile.avatarUrl});}}
      catch{partial=true;}
    }));
    return {...page,partial,items:page.items.map(item=>{
      const booking=bookings.find(b=>b.id===item.bookingId);if(!booking)return item;
      const person=people.get(tutor?booking.studentId:booking.tutorId);
      return {...item,className:subjects.find(s=>s.id===booking.subjectId)?.name??'Private lesson',startAtUtc:booking.startAtUtc,actorName:person?.name,avatarUrl:person?.avatar};
    })};
  }

  markNotificationRead(id: string) {
    if(id.startsWith('course-lifecycle:'))return this.request<void>(`/api/v1/courses/lifecycle-notifications/${encodeURIComponent(id.slice(17))}/read`,{method:'PUT'});
    if(id.startsWith('enrollment:'))return this.request<void>(`/api/v1/courses/enrollment-notifications/${encodeURIComponent(id.slice(11))}/read`,{method:'PUT'});
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
    const method=(init.method??'GET').toUpperCase();
    const repeatable=method==='GET'||method==='HEAD'
      ||(method==='POST'&&(path==='/api/v1/bookings'||/^\/api\/v1\/courses\/[^/]+\/enrollments$/.test(path)))
      ||(method==='DELETE'&&/^\/api\/v1\/bookings\/[^/?]+\?/.test(path))
      ||(method==='PUT'&&/\/read$/.test(path))
      ||(method==='DELETE'&&/^\/api\/v1\/courses\/[^/]+\/enrollments\/me$/.test(path));
    return resilientFetch(this.fetcher,`${this.baseUrl}${path}`, { ...init, headers },{repeatable});
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
