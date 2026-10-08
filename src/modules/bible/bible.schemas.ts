import { z } from 'zod';

const translationCode = z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/);
const bookCode = z.string().trim().toUpperCase().regex(/^[1-3A-Z]{3}$/);
const positiveSmallInteger = z.coerce.number().int().min(1).max(999);

export const bibleTranslationSchema = z.object({
  translation: translationCode,
});

export const bibleChapterSchema = z.object({
  translation: translationCode,
  book: bookCode,
  chapter: positiveSmallInteger,
});

export const bibleSearchSchema = z.object({
  translation: translationCode.default('fraLSG'),
  q: z.string().trim().min(2).max(120),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const featuredBiblePassageSchema = z.object({
  translationCode,
  bookCode,
  chapter: positiveSmallInteger,
  verseStart: positiveSmallInteger,
  verseEnd: positiveSmallInteger,
}).refine((value) => value.verseEnd >= value.verseStart, {
  message: 'Le dernier verset doit être supérieur ou égal au premier.',
  path: ['verseEnd'],
});

