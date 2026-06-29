'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Send } from 'lucide-react';
import {
  CRM_OPTIONS,
  MONTHLY_LEAD_VOLUME_BANDS,
  MONTHLY_REVENUE_BANDS,
  TEAM_SIZE_BANDS,
  type CrmOption,
  type MonthlyRevenueBand,
} from '@/types';
import { leadFormSchema, type LeadFormSchema } from '@/lib/validation/lead-schema';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldError } from '@/components/ui/field-error';
import { Alert } from '@/components/ui/alert';
import { SignalRail } from '@/components/ui/signal-rail';

/**
 * Display labels for enum values whose raw form (snake_case bands) isn't
 * what a prospect should read. MONTHLY_LEAD_VOLUME_BANDS and
 * TEAM_SIZE_BANDS are intentionally not mapped — their raw values
 * ("11-50", "4-10") are already readable, per the design brief.
 *
 * These maps are presentation-only and live here, not in
 * src/lib/validation or src/types — those stay the single source of
 * truth for the *values*; this file only decides how to *display* them.
 */
const REVENUE_LABELS: Record<MonthlyRevenueBand, string> = {
  under_10k: 'Under $10k',
  '10k_50k': '$10k – $50k',
  '50k_150k': '$50k – $150k',
  '150k_500k': '$150k – $500k',
  '500k_plus': '$500k+',
  prefer_not_to_say: 'Prefer not to say',
};

const CRM_LABELS: Record<CrmOption, string> = {
  none: 'No CRM',
  spreadsheet: 'Spreadsheet (Excel/Sheets)',
  hubspot: 'HubSpot',
  gohighlevel: 'GoHighLevel',
  pipedrive: 'Pipedrive',
  salesforce: 'Salesforce',
  airtable: 'Airtable',
  other: 'Other',
};

const REQUIRED_FIELDS = [
  'name',
  'email',
  'phone',
  'company',
  'website',
  'monthlyLeadVolume',
  'teamSize',
  'monthlyRevenue',
  'existingCrm',
  'biggestChallenge',
] as const satisfies readonly (keyof LeadFormSchema)[];

interface ApiErrorBody {
  error?: string;
  issues?: Record<string, string[] | undefined>;
}

export function LeadCaptureForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormSchema>({
    resolver: zodResolver(leadFormSchema),
    mode: 'onBlur',
    defaultValues: { additionalNotes: '' },
  });

  const watched = watch();
  const completion = React.useMemo(() => {
    const filled = REQUIRED_FIELDS.filter((field) => {
      const value = watched[field];
      return typeof value === 'string' && value.trim().length > 0;
    }).length;
    return (filled / REQUIRED_FIELDS.length) * 100;
  }, [watched]);

  async function onSubmit(values: LeadFormSchema) {
    setSubmitError(null);

    let response: Response;
    try {
      response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
    } catch {
      setSubmitError('Could not reach the server. Check your connection and try again.');
      return;
    }

    if (!response.ok) {
      let body: ApiErrorBody = {};
      try {
        body = await response.json();
      } catch {
        // Non-JSON error body — fall through to the generic message below.
      }
      setSubmitError(body.error ?? 'Something went wrong submitting your details. Please try again.');
      return;
    }

    const data = (await response.json()) as { leadId: string; status: string; bookingUrl?: string };
    const params = new URLSearchParams({ status: data.status });
    if (data.bookingUrl) params.set('bookingUrl', data.bookingUrl);
    router.push(`/success?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full" noValidate>
      <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_0_1px_rgba(47,111,240,0.06)] sm:p-8">
        <SignalRail value={completion} />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              autoComplete="name"
              className="mt-1.5"
              aria-invalid={!!errors.name}
              {...register('name')}
            />
            <FieldError message={errors.name?.message} />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              className="mt-1.5"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            <FieldError message={errors.email?.message} />
          </div>

          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              className="mt-1.5"
              aria-invalid={!!errors.phone}
              {...register('phone')}
            />
            <FieldError message={errors.phone?.message} />
          </div>

          <div>
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              autoComplete="organization"
              className="mt-1.5"
              aria-invalid={!!errors.company}
              {...register('company')}
            />
            <FieldError message={errors.company?.message} />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              placeholder="youragency.com"
              className="mt-1.5"
              aria-invalid={!!errors.website}
              {...register('website')}
            />
            <FieldError message={errors.website?.message} />
          </div>

          <div>
            <Label htmlFor="monthlyLeadVolume">Monthly Lead Volume</Label>
            <Controller
              name="monthlyLeadVolume"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="monthlyLeadVolume" className="mt-1.5" aria-invalid={!!errors.monthlyLeadVolume}>
                    <SelectValue placeholder="Select a range" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHLY_LEAD_VOLUME_BANDS.map((band) => (
                      <SelectItem key={band} value={band}>
                        {band}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.monthlyLeadVolume?.message} />
          </div>

          <div>
            <Label htmlFor="teamSize">Team Size</Label>
            <Controller
              name="teamSize"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="teamSize" className="mt-1.5" aria-invalid={!!errors.teamSize}>
                    <SelectValue placeholder="Select a range" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_SIZE_BANDS.map((band) => (
                      <SelectItem key={band} value={band}>
                        {band}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.teamSize?.message} />
          </div>

          <div>
            <Label htmlFor="monthlyRevenue">Monthly Revenue</Label>
            <Controller
              name="monthlyRevenue"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="monthlyRevenue" className="mt-1.5" aria-invalid={!!errors.monthlyRevenue}>
                    <SelectValue placeholder="Select a range" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHLY_REVENUE_BANDS.map((band) => (
                      <SelectItem key={band} value={band}>
                        {REVENUE_LABELS[band]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.monthlyRevenue?.message} />
          </div>

          <div>
            <Label htmlFor="existingCrm">Existing CRM</Label>
            <Controller
              name="existingCrm"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="existingCrm" className="mt-1.5" aria-invalid={!!errors.existingCrm}>
                    <SelectValue placeholder="Select one" />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {CRM_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.existingCrm?.message} />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="biggestChallenge">Biggest Operational Challenge</Label>
            <Textarea
              id="biggestChallenge"
              rows={4}
              placeholder="What's slowing your team down right now?"
              className="mt-1.5"
              aria-invalid={!!errors.biggestChallenge}
              {...register('biggestChallenge')}
            />
            <FieldError message={errors.biggestChallenge?.message} />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="additionalNotes">Additional Notes (optional)</Label>
            <Textarea
              id="additionalNotes"
              rows={3}
              placeholder="Anything else we should know?"
              className="mt-1.5"
              aria-invalid={!!errors.additionalNotes}
              {...register('additionalNotes')}
            />
            <FieldError message={errors.additionalNotes?.message} />
          </div>
        </div>

        {submitError && (
          <div className="mt-6">
            <Alert variant="destructive">{submitError}</Alert>
          </div>
        )}

        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-7 w-full sm:w-auto">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Evaluating your details…
            </>
          ) : (
            <>
              Get my strategy call
              <Send className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
