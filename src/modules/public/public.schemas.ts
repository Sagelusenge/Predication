import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination.js';

export const sermonListSchema = paginationSchema.extend({
  search: z.string().trim().max(150).optional(),
  category: z.string().trim().max(150).optional(),
  series: z.string().trim().max(200).optional(),
  preacher: z.uuid().optional(),
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  featured: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  sort: z.enum(['newest', 'oldest', 'popular']).default('newest'),
});

export const slugSchema = z.object({ slug: z.string().trim().min(1).max(240) });
export const idSchema = z.object({ id: z.uuid() });

export const contactSchema = z.object({
  fullName: z.string().trim().min(2).max(180),
  email: z.email().transform((value) => value.trim().toLowerCase()),
  phone: z.string().trim().max(40).optional(),
  subject: z.string().trim().min(3).max(220),
  message: z.string().trim().min(10).max(10_000),
});

export const publicTestimonialSchema = z.object({
  authorName: z.string().trim().min(2).max(150),
  authorLocation: z.string().trim().max(120).optional(),
  quote: z.string().trim().min(10).max(5_000),
  consent: z.literal(true),
});

export const eventSchema = z.object({
  eventType: z.enum(['play_start', 'progress', 'complete', 'download', 'share']),
  sessionIdentifier: z.string().trim().min(8).max(128).optional(),
  secondsListened: z.number().int().min(0).max(86_400).default(0),
  progressPercent: z.number().min(0).max(100).optional(),
  deviceType: z.enum(['mobile', 'tablet', 'desktop', 'tv', 'other']).optional(),
  referrer: z.string().url().max(2_000).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
