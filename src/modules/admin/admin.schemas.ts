import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination.js';

const nullableUuid = z.uuid().nullable().optional();
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const adminListSchema = paginationSchema.extend({
  search: z.string().trim().max(150).optional(),
  status: z.string().trim().max(40).optional(),
});

export const dashboardRangeSchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export const preacherCreateSchema = z.object({
  displayName: z.string().trim().min(2).max(180),
  title: optionalText(120),
  biography: optionalText(20_000),
  churchName: optionalText(180),
  photoMediaId: nullableUuid,
  isPrimary: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export const preacherUpdateSchema = preacherCreateSchema.partial();

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(150).optional(),
  description: optionalText(5_000),
  displayOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
});
export const categoryUpdateSchema = categoryCreateSchema.partial();

export const seriesCreateSchema = z.object({
  title: z.string().trim().min(2).max(180),
  slug: z.string().trim().max(200).optional(),
  description: optionalText(20_000),
  coverMediaId: nullableUuid,
  startDate: z.iso.date().nullable().optional(),
  endDate: z.iso.date().nullable().optional(),
  isActive: z.boolean().default(true),
});
export const seriesUpdateSchema = seriesCreateSchema.partial();

export const tagCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(100).optional(),
});
export const tagUpdateSchema = tagCreateSchema.partial();

export const sermonCreateSchema = z.object({
  title: z.string().trim().min(3).max(220),
  slug: z.string().trim().max(240).optional(),
  excerpt: optionalText(500),
  description: optionalText(100_000),
  scriptureReference: optionalText(255),
  preacherId: z.uuid(),
  categoryId: nullableUuid,
  seriesId: nullableUuid,
  audioMediaId: nullableUuid,
  coverMediaId: nullableUuid,
  preachedOn: z.iso.date().default(() => new Date().toISOString().slice(0, 10)),
  isFeatured: z.boolean().default(false),
  allowDownload: z.boolean().default(true),
  publishWhenReady: z.boolean().default(false),
  tagIds: z.array(z.uuid()).max(30).default([]),
});
export const sermonUpdateSchema = sermonCreateSchema.partial();

export const scheduleSchema = z.object({
  publishAt: z.iso.datetime({ offset: true }),
});

export const pageCreateSchema = z.object({
  slug: z.string().trim().max(160).optional(),
  title: z.string().trim().min(2).max(220),
  navigationLabel: optionalText(100),
  content: z.record(z.string(), z.unknown()).default({}),
  metaTitle: optionalText(255),
  metaDescription: optionalText(500),
  coverMediaId: nullableUuid,
  displayOrder: z.number().int().min(0).max(10_000).default(0),
  showInNavigation: z.boolean().default(true),
});
export const pageUpdateSchema = pageCreateSchema.partial();

export const testimonialCreateSchema = z.object({
  authorName: z.string().trim().min(2).max(150),
  authorRole: optionalText(150),
  quote: z.string().trim().min(5).max(5_000),
  photoMediaId: nullableUuid,
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  displayOrder: z.number().int().min(0).max(10_000).default(0),
});
export const testimonialUpdateSchema = testimonialCreateSchema.partial();

export const messageStatusSchema = z.object({
  status: z.enum(['unread', 'read', 'replied', 'archived', 'spam']),
  assignedTo: nullableUuid,
});

export const settingSchema = z.object({
  settingGroup: z.string().trim().min(1).max(80).default('general'),
  value: z.unknown(),
  description: optionalText(5_000),
  isPublic: z.boolean().default(false),
});

export const createUserSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  roleCode: z.enum(['super_admin', 'administrator', 'editor', 'analyst']),
  password: z
    .string()
    .min(10, 'Le mot de passe doit contenir au moins 10 caractères.')
    .max(200)
    .regex(/[A-Z]/, 'Une majuscule est requise.')
    .regex(/[a-z]/, 'Une minuscule est requise.')
    .regex(/[0-9]/, 'Un chiffre est requis.'),
});

export const rolesSchema = z.object({
  roleCodes: z.array(z.enum(['super_admin', 'administrator', 'editor', 'analyst'])).min(1).max(4),
});

export const userUpdateSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()).optional(),
  firstName: z.string().trim().min(2).max(100).optional(),
  lastName: z.string().trim().min(2).max(100).optional(),
  locale: z.string().trim().min(2).max(10).optional(),
  timezone: z.string().trim().min(3).max(100).optional(),
});

export const confirmDeleteSchema = z.object({
  confirm: z.literal('true'),
});
