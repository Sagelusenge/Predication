import type { ApiEnvelope, Sermon, Testimonial, User } from '../types';

const API_URL = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers
    }
  });

  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message ?? payload?.message ?? 'Une erreur est survenue.',
      response.status,
      payload?.error?.code
    );
  }
  return payload as T;
}

export const api = {
  async appConfig() {
    return request<ApiEnvelope<{ settings: Record<string, unknown>; latestSermons: Sermon[] }>>('/app-config');
  },
  async sermons(query = '') {
    return request<ApiEnvelope<Sermon[]>>(`/sermons${query ? `?${query}` : ''}`);
  },
  async sermon(slug: string) {
    return request<ApiEnvelope<Sermon>>(`/sermons/${encodeURIComponent(slug)}`);
  },
  async testimonials() {
    const response = await request<ApiEnvelope<Array<Testimonial & { quote?: string; authorRole?: string }>>>('/testimonials');
    return {
      ...response,
      data: response.data.map((item) => ({
        ...item,
        content: item.content ?? item.quote ?? '',
        authorLocation: item.authorLocation ?? item.authorRole?.replace(/^Depuis\s+/i, '') ?? null
      }))
    };
  },
  async contact(body: { fullName: string; email: string; subject: string; message: string }) {
    return request<ApiEnvelope<{ id: string }>>('/contact', { method: 'POST', body: JSON.stringify(body) });
  },
  async login(email: string, password: string) {
    return request<ApiEnvelope<{ user: User }>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },
  async forgotPassword(email: string) {
    return request<{ success: boolean; message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },
  async resetPassword(token: string, password: string) {
    return request<{ success: boolean; message: string }>('/auth/reset-password', {
      method: 'POST', body: JSON.stringify({ token, password })
    });
  },
  async acceptInvitation(token: string, password: string) {
    return request<{ success: boolean; message: string }>('/auth/accept-invitation', {
      method: 'POST', body: JSON.stringify({ token, password })
    });
  },
  async likeStatus(id: string) {
    return request<ApiEnvelope<{ liked: boolean; likeCount: number }>>(`/sermons/${id}/like`);
  },
  async toggleLike(id: string) {
    return request<ApiEnvelope<{ liked: boolean; likeCount: number }>>(`/sermons/${id}/like`, { method: 'POST' });
  },
  async recordEvent(id: string, eventType: 'play_start' | 'progress' | 'complete' | 'download' | 'share', secondsListened = 0) {
    return request<{ success: boolean }>(`/sermons/${id}/events`, {
      method: 'POST',
      body: JSON.stringify({ eventType, secondsListened, metadata: {} })
    });
  },
  async submitTestimonial(body: { authorName: string; authorLocation?: string; quote: string; consent: true }) {
    return request<ApiEnvelope<{ id: string }>>('/testimonials', { method: 'POST', body: JSON.stringify(body) });
  },
  async me() {
    return request<ApiEnvelope<User>>('/auth/me');
  },
  async logout() {
    return request<void>('/auth/logout', { method: 'POST' });
  },
  async dashboard() {
    return request<ApiEnvelope<Record<string, unknown>>>('/admin/dashboard');
  },
  async adminSermons(query = 'page=1&limit=20') {
    return request<ApiEnvelope<Array<Record<string, unknown>>>>(`/admin/sermons?${query}`);
  },
  async adminPreachers() {
    return request<ApiEnvelope<Array<{ id: string; displayName: string }>>>('/admin/preachers');
  },
  async adminCategories() {
    return request<ApiEnvelope<Array<{ id: string; name: string }>>>('/admin/categories');
  },
  async uploadMedia(kind: 'audio' | 'image', file: File) {
    const form = new FormData();
    form.append('file', file);
    return request<ApiEnvelope<{ id: string; processingStatus: string }>>(`/admin/media/${kind}`, {
      method: 'POST',
      body: form
    });
  },
  async createSermon(body: Record<string, unknown>) {
    return request<ApiEnvelope<Record<string, unknown>>>('/admin/sermons', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },
  async publishSermon(id: string) {
    return request<{ success: boolean; message: string }>(`/admin/sermons/${id}/publish`, { method: 'POST' });
  },
  async archiveSermon(id: string) {
    return request<{ success: boolean; message: string }>(`/admin/sermons/${id}/archive`, { method: 'POST' });
  },
  async duplicateSermon(id: string) {
    return request<ApiEnvelope<Record<string, unknown>>>(`/admin/sermons/${id}/duplicate`, { method: 'POST' });
  },
  async deleteSermon(id: string) {
    return request<void>(`/admin/sermons/${id}?confirm=true`, { method: 'DELETE' });
  },
  async adminMedia(query = 'page=1&limit=50') {
    return request<ApiEnvelope<Array<Record<string, unknown>>>>(`/admin/media?${query}`);
  },
  async requeueMedia(id: string) {
    return request<ApiEnvelope<{ jobId: string }>>(`/admin/media/${id}/requeue`, { method: 'POST' });
  },
  async deleteMedia(id: string) {
    return request<void>(`/admin/media/${id}`, { method: 'DELETE' });
  },
  async adminTestimonials() {
    return request<ApiEnvelope<Array<Record<string, unknown>>>>('/admin/testimonials');
  },
  async updateTestimonial(id: string, body: Record<string, unknown>) {
    return request<ApiEnvelope<Record<string, unknown>>>(`/admin/testimonials/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  },
  async deleteTestimonial(id: string) {
    return request<void>(`/admin/testimonials/${id}?confirm=true`, { method: 'DELETE' });
  },
  async sermonStatistics() {
    return request<ApiEnvelope<Array<Record<string, unknown>>>>('/admin/statistics/sermons');
  },
  async adminUsers() {
    return request<ApiEnvelope<Array<Record<string, unknown>>>>('/admin/users?page=1&limit=50');
  },
  async inviteUser(body: { email: string; firstName: string; lastName: string; roleCode: string }) {
    return request<ApiEnvelope<Record<string, unknown>>>('/admin/users/invite', { method: 'POST', body: JSON.stringify(body) });
  },
  async deactivateUser(id: string) {
    return request<{ success: boolean; message: string }>(`/admin/users/${id}/deactivate`, { method: 'POST' });
  },
  async adminSettings() {
    return request<ApiEnvelope<Array<Record<string, unknown>>>>('/admin/settings');
  },
  async saveSetting(key: string, body: { settingGroup: string; value: unknown; description?: string; isPublic: boolean }) {
    return request<ApiEnvelope<Record<string, unknown>>>(`/admin/settings/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(body) });
  }
};
