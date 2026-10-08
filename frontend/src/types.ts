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

export type BibleTranslation = {
  id?: string;
  code: string;
  languageCode: string;
  languageName: string;
  title: string;
  abbreviation: string;
  sourceUrl: string;
  licenseName: string;
  copyrightNotice?: string | null;
  attribution: string;
  textDirection?: 'ltr' | 'rtl';
  isActive?: boolean;
  isComplete: boolean;
  verseCount: number;
  importedAt?: string | null;
};

export type BibleBook = {
  code: string;
  name: string;
  shortName: string;
  canonicalOrder: number;
  testament: 'old' | 'new';
  chapterCount: number;
};

export type BibleVerse = {
  verseStart: number;
  verseEnd: number;
  text: string;
};

export type BibleChapter = {
  translation: BibleTranslation;
  book: BibleBook;
  chapter: number;
  verses: BibleVerse[];
};

export type FeaturedBiblePassage = {
  translation: BibleTranslation;
  book: Pick<BibleBook, 'code' | 'name' | 'testament'>;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  reference: string;
  text: string;
  verses: BibleVerse[];
};

export type BibleSearchResult = {
  bookCode: string;
  bookName: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  verseText: string;
};

export type HomeValue = {
  title: string;
  description: string;
};

export type HomePageContent = {
  contentVersion?: string;
  hero: {
    eyebrow: string;
    title: string;
    highlight?: string;
    subtitle: string;
    primaryAction: string;
    secondaryAction: string;
    noteTitle: string;
    note: string;
    quote: string;
  };
  values: {
    eyebrow: string;
    title: string;
    introduction: string;
    items: HomeValue[];
  };
  latest: { eyebrow: string; title: string };
  scripture: { quote: string; reference: string };
  testimonials: { eyebrow: string; title: string };
  featured: { eyebrow: string; title: string; description: string };
  contact: { title: string; subtitle: string; action: string };
};

export type HomeAppConfig = {
  settings: Record<string, unknown>;
  latestSermons: Sermon[];
  testimonials: Testimonial[];
  page: {
    id: string;
    title: string;
    content: HomePageContent;
    coverUrl?: string | null;
  } | null;
  statistics: {
    publishedSermons: number;
    totalDurationSeconds: number;
    totalPlays: number;
    totalLikes: number;
  };
  primaryPreacher: {
    id: string;
    displayName: string;
    title?: string | null;
    biography?: string | null;
    churchName?: string | null;
    photoUrl?: string | null;
  } | null;
  featuredBibleVerse: FeaturedBiblePassage | null;
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
