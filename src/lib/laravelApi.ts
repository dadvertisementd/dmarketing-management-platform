const API_URL =
  import.meta.env.VITE_LARAVEL_API_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8011' : window.location.origin);

export type UserRole = 'admin' | 'manager' | 'worker' | 'client';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'completed';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ProjectStatus = 'briefing' | 'in_progress' | 'active' | 'on_hold' | 'completed';
export type SocialStatus =
  | 'draft'
  | 'review'
  | 'pending_agency_approval'
  | 'pending_client_review'
  | 'needs_revision'
  | 'approved'
  | 'scheduled'
  | 'published';

export interface LaravelUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  title?: string | null;
  weekly_capacity?: number;
  is_active?: boolean;
  avatar_color?: string | null;
}

export interface Client {
  id: number;
  portal_user_id?: number | null;
  name: string;
  industry?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface Project {
  id: number;
  client_id: number;
  manager_id?: number | null;
  users?: Pick<LaravelUser, 'id' | 'name' | 'email' | 'role' | 'title' | 'avatar_color'>[];
  name: string;
  type?: string | null;
  status: ProjectStatus;
  progress: number;
  starts_at?: string | null;
  ends_at?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TaskAttachment {
  id: number;
  task_id: number;
  uploaded_by?: number | null;
  name: string;
  mime_type?: string | null;
  size: number;
  created_at?: string;
}

export interface TaskSubtask {
  id: number;
  task_id: number;
  created_by?: number | null;
  completed_by?: number | null;
  title: string;
  is_completed: boolean;
  completed_at?: string | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface TaskComment {
  id: number;
  task_id: number;
  user_id?: number | null;
  body: string;
  user?: Pick<LaravelUser, 'id' | 'name' | 'email' | 'role' | 'title' | 'avatar_color'> | null;
  created_at?: string;
  updated_at?: string;
}

export interface Task {
  id: number;
  project_id?: number | null;
  client_id?: number | null;
  assigned_to?: number | null;
  created_by?: number | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at?: string | null;
  completed_at?: string | null;
  attachments?: TaskAttachment[];
  subtasks?: TaskSubtask[];
  comments?: TaskComment[];
  created_at?: string;
  updated_at?: string;
}

export interface SocialPost {
  id: number;
  project_id?: number | null;
  client_id: number;
  owner_id?: number | null;
  platform: string;
  title: string;
  content?: string | null;
  status: SocialStatus;
  scheduled_at?: string | null;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type PostingCheckStatus = 'pending' | 'posted' | 'missed' | 'skipped';
export type PostingTrackerStatus = 'not_planned' | PostingCheckStatus;

export interface PostingTrackerDay {
  day_of_week: number;
  date: string;
  label: string;
  planned: boolean;
  required_posts: number;
  published_count: number;
  manual_status?: PostingCheckStatus | null;
  note?: string | null;
  status: PostingTrackerStatus;
}

export interface PostingTrackerClient extends Client {
  schedule_days: number[];
  days: PostingTrackerDay[];
}

export interface PostingTrackerResponse {
  week_start: string;
  week_end: string;
  days: Array<{
    day_of_week: number;
    date: string;
    label: string;
  }>;
  clients: PostingTrackerClient[];
}

export interface ChatMessage {
  id: number;
  project_id?: number | null;
  client_id?: number | null;
  user_id: number;
  user?: Pick<LaravelUser, 'id' | 'name' | 'email' | 'role' | 'title' | 'avatar_color'> | null;
  message: string;
  created_at?: string;
  updated_at?: string;
}

export interface SharedFile {
  id: number;
  project_id?: number | null;
  client_id: number;
  uploaded_by?: number | null;
  name: string;
  category: string;
  mime_type?: string | null;
  size: number;
  created_at?: string;
}

export interface DashboardSummary {
  stats: {
    activeProjects: number;
    openTasks: number;
    completedTasks: number;
    scheduledPosts: number;
  };
  upcomingTasks: Task[];
}

export interface TeamPerformance extends LaravelUser {
  completed_tasks: number;
  open_tasks: number;
}

export interface ProjectWorkspace {
  projects: Project[];
  clients: Client[];
  tasks: Task[];
  team: LaravelUser[];
}

const inFlightGetRequests = new Map<string, Promise<unknown>>();

function xsrfToken(): string | undefined {
  const cookie = document.cookie
    .split('; ')
    .find((value) => value.startsWith('XSRF-TOKEN='));

  return cookie ? decodeURIComponent(cookie.split('=')[1]) : undefined;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method?.toUpperCase() || 'GET';
  if (method === 'GET' && inFlightGetRequests.has(path)) {
    return inFlightGetRequests.get(path) as Promise<T>;
  }

  const promise = performRequest<T>(path, init);

  if (method === 'GET') {
    inFlightGetRequests.set(path, promise);
    promise.finally(() => inFlightGetRequests.delete(path));
  }

  return promise;
}

async function performRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = xsrfToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { 'X-XSRF-TOKEN': token } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    const validation = error.errors ? Object.values(error.errors).flat().join(' ') : '';
    throw new Error(validation || error.message || 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export function apiTaskStatus(status: string): TaskStatus {
  if (status === 'in-progress') return 'in_progress';
  if (status === 'done') return 'completed';
  return status as TaskStatus;
}

export function uiTaskStatus(status?: string | null): string {
  if (!status) return 'todo';
  if (status === 'in_progress') return 'in-progress';
  if (status === 'completed') return 'done';
  return status;
}

export function apiTaskPriority(priority: string): TaskPriority {
  return priority === 'medium' ? 'normal' : priority as TaskPriority;
}

export function uiTaskPriority(priority?: string | null): string {
  if (!priority) return 'medium';
  return priority === 'normal' ? 'medium' : priority;
}

export function apiStatus(value: string): string {
  return value.replaceAll('-', '_');
}

export function uiStatus(value: string): string {
  return value.replaceAll('_', '-');
}

export function downloadUrl(fileId: number | string): string {
  return `${API_URL}/api/files/${fileId}/download`;
}

export async function fetchSharedFileBlob(fileId: number | string): Promise<Blob> {
  const response = await fetch(downloadUrl(fileId), {
    credentials: 'include',
    headers: { Accept: '*/*' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Download failed' }));
    throw new Error(error.message || 'Download failed');
  }

  return response.blob();
}

export async function downloadSharedFile(file: Pick<SharedFile, 'id' | 'name'>): Promise<void> {
  const blob = await fetchSharedFileBlob(file.id);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = file.name;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function taskAttachmentDownloadUrl(taskId: number | string, attachmentId: number | string): string {
  return `${API_URL}/api/tasks/${taskId}/attachments/${attachmentId}/download`;
}

function taskFormData(payload: Partial<Task> & { title: string; priority: TaskPriority }, attachments: File[]): FormData {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (value === null || value === undefined || key === 'attachments') {
      return;
    }

    formData.append(key, String(value));
  });

  attachments.forEach((file) => formData.append('attachments[]', file));

  return formData;
}

export const laravelApi = {
  apiUrl: API_URL,

  async login(email: string, password: string) {
    await fetch(`${API_URL}/sanctum/csrf-cookie`, { credentials: 'include' });
    return request<{ user: LaravelUser }>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  logout: () => request<{ message: string }>('/logout', { method: 'POST' }),
  me: () => request<{ user: LaravelUser }>('/api/me'),
  dashboard: () => request<DashboardSummary>('/api/dashboard'),
  clients: () => request<Client[]>('/api/clients'),
  teamMembers: () => request<LaravelUser[]>('/api/team-members'),
  projects: () => request<Project[]>('/api/projects'),
  projectWorkspace: () => request<ProjectWorkspace>('/api/projects-workspace'),
  tasks: () => request<Task[]>('/api/tasks'),
  socialPosts: () => request<SocialPost[]>('/api/social-posts'),
  postingTracker: (weekStart?: string) =>
    request<PostingTrackerResponse>(`/api/posting-tracker${weekStart ? `?week_start=${encodeURIComponent(weekStart)}` : ''}`),
  files: () => request<SharedFile[]>('/api/files'),
  downloadFile: downloadSharedFile,
  fetchFileBlob: fetchSharedFileBlob,
  notifications: () => request<any[]>('/api/notifications'),
  teamPerformance: () => request<TeamPerformance[]>('/api/reports/team-performance'),
  integrations: () => request<any[]>('/api/integrations'),

  createUser: (payload: Partial<LaravelUser> & { password: string }) =>
    request<LaravelUser>('/api/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateUser: (id: number | string, payload: Partial<LaravelUser> & { password?: string }) =>
    request<LaravelUser>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteUser: (id: number | string) =>
    request<{ message: string }>(`/api/users/${id}`, { method: 'DELETE' }),

  createClient: (payload: Partial<Client> & { name: string }) =>
    request<Client>('/api/clients', { method: 'POST', body: JSON.stringify(payload) }),
  updateClient: (id: number | string, payload: Partial<Client>) =>
    request<Client>(`/api/clients/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteClient: (id: number | string) =>
    request<{ message: string }>(`/api/clients/${id}`, { method: 'DELETE' }),

  createProject: (payload: Partial<Project> & { name: string; client_id: number; member_ids?: number[] }) =>
    request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(payload) }),
  updateProject: (id: number | string, payload: Partial<Project> & { member_ids?: number[] }) =>
    request<Project>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteProject: (id: number | string) =>
    request<{ message: string }>(`/api/projects/${id}`, { method: 'DELETE' }),

  createTask: (payload: Partial<Task> & { title: string; priority: TaskPriority }, attachments: File[] = []) =>
    request<Task>('/api/tasks', {
      method: 'POST',
      body: attachments.length > 0 ? taskFormData(payload, attachments) : JSON.stringify(payload),
    }),
  updateTask: (id: number | string, payload: Partial<Task>) =>
    request<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteTask: (id: number | string) =>
    request<{ message: string }>(`/api/tasks/${id}`, { method: 'DELETE' }),
  uploadTaskAttachments: (taskId: number | string, attachments: File[]) => {
    const formData = new FormData();
    attachments.forEach((file) => formData.append('attachments[]', file));
    return request<TaskAttachment[]>(`/api/tasks/${taskId}/attachments`, { method: 'POST', body: formData });
  },
  deleteTaskAttachment: (taskId: number | string, attachmentId: number | string) =>
    request<{ message: string }>(`/api/tasks/${taskId}/attachments/${attachmentId}`, { method: 'DELETE' }),
  createTaskSubtask: (taskId: number | string, payload: { title: string }) =>
    request<TaskSubtask>(`/api/tasks/${taskId}/subtasks`, { method: 'POST', body: JSON.stringify(payload) }),
  updateTaskSubtask: (taskId: number | string, subtaskId: number | string, payload: Partial<Pick<TaskSubtask, 'title' | 'is_completed'>>) =>
    request<TaskSubtask>(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteTaskSubtask: (taskId: number | string, subtaskId: number | string) =>
    request<{ message: string }>(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'DELETE' }),
  createTaskComment: (taskId: number | string, payload: { body: string }) =>
    request<TaskComment>(`/api/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify(payload) }),

  createSocialPost: (payload: Partial<SocialPost> & { title: string; client_id: number; platform: string; status: SocialStatus }) =>
    request<SocialPost>('/api/social-posts', { method: 'POST', body: JSON.stringify(payload) }),
  updateSocialPost: (id: number | string, payload: Partial<SocialPost>) =>
    request<SocialPost>(`/api/social-posts/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteSocialPost: (id: number | string) =>
    request<{ message: string }>(`/api/social-posts/${id}`, { method: 'DELETE' }),
  updatePostingSchedule: (clientId: number | string, days: Array<{ day_of_week: number; required_posts?: number }>) =>
    request(`/api/clients/${clientId}/posting-schedule`, { method: 'PUT', body: JSON.stringify({ days }) }),
  markPostingCheck: (clientId: number | string, payload: { post_date: string; status: PostingCheckStatus; note?: string }) =>
    request(`/api/clients/${clientId}/posting-check`, { method: 'PUT', body: JSON.stringify(payload) }),

  createChatMessage: (payload: { message: string; client_id?: number; project_id?: number }) =>
    request<ChatMessage>('/api/chat-messages', { method: 'POST', body: JSON.stringify(payload) }),
  uploadFile: (payload: { file: File; client_id: number; project_id?: number; category?: string }) => {
    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('client_id', String(payload.client_id));
    if (payload.project_id) formData.append('project_id', String(payload.project_id));
    if (payload.category) formData.append('category', payload.category);
    return request<SharedFile>('/api/files', { method: 'POST', body: formData });
  },
  deleteFile: (id: number | string) =>
    request<{ message: string }>(`/api/files/${id}`, { method: 'DELETE' }),
};
