import { z } from 'zod';
import {
  CRM_OPTIONS,
  MONTHLY_LEAD_VOLUME_BANDS,
  MONTHLY_REVENUE_BANDS,
  TEAM_SIZE_BANDS,
} from '@/types';

/**
 * Single source of truth for lead-form validation. Imported by:
 * - the frontend form via @hookform/resolvers/zod
 * - the /api/leads route handler, so a request that bypasses the UI
 *   (curl, n8n, a future mobile client) gets identical validation.
 */
export const leadFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(100),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z
    .string()
    .trim()
    .min(7, 'Enter a valid phone number')
    .max(20)
    .regex(/^[\d+\-() .]+$/, 'Phone number contains invalid characters'),
  company: z.string().trim().min(2, 'Enter your company name').max(100),
  website: z
    .string()
    .trim()
    .min(1, 'Enter your website')
    .transform((val) => (val.startsWith('http') ? val : `https://${val}`))
    .pipe(z.string().url('Enter a valid website URL')),
  monthlyLeadVolume: z.enum(MONTHLY_LEAD_VOLUME_BANDS, {
    errorMap: () => ({ message: 'Select your monthly lead volume' }),
  }),
  teamSize: z.enum(TEAM_SIZE_BANDS, {
    errorMap: () => ({ message: 'Select your team size' }),
  }),
  monthlyRevenue: z.enum(MONTHLY_REVENUE_BANDS, {
    errorMap: () => ({ message: 'Select your monthly revenue' }),
  }),
  existingCrm: z.enum(CRM_OPTIONS, {
    errorMap: () => ({ message: 'Select your current CRM' }),
  }),
  biggestChallenge: z
    .string()
    .trim()
    .min(10, 'Tell us a bit more (at least 10 characters)')
    .max(1000, 'Keep this under 1000 characters'),
  additionalNotes: z.string().trim().max(1000, 'Keep this under 1000 characters').optional().or(z.literal('')),
});

export type LeadFormSchema = z.infer<typeof leadFormSchema>;
