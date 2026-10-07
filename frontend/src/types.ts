export type Sermon = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  description?: string | null;
  scriptureReference?: string | null;
  preachedOn: string;
  durationSeconds?: number | null;
  coverUrl?: string | null;
  audioUrl?: string | null;
  preacherName?: string | null;
  categoryName?: string | null;
  seriesTitle?: string | null;
  playCount?: number;
  likeCount?: number;
  isLiked?: boolean;
  isFeatured?: boolean;
  related?: Sermon[];
};

export type Testimonial = {
  id: string;
  authorName: string;
  authorLocation?: string | null;
  content: string;
  photoUrl?: string | null;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
  meta?: { page: number; limit: number; total: number; totalPages: number };
};

export type User = {
  userId?: string;
  id?: string;
  displayName?: string;
  email?: string;
  role?: string;
};
