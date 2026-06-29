import Link from 'next/link';
import { CheckCircle2, ArrowRight, CalendarCheck } from 'lucide-react';
import { PageShell, BrandMark } from '@/components/sections/page-shell';
import { Button } from '@/components/ui/button';

interface SuccessPageProps {
  searchParams: { status?: string; bookingUrl?: string };
}

function getCopy(status: string | undefined) {
  if (status === 'qualified') {
    return {
      eyebrow: 'STATUS: QUALIFIED',
      heading: 'You\u2019re a strong fit \u2014 let\u2019s get you on the calendar.',
      body: 'Based on what you shared, this looks like exactly the kind of agency we help. Grab a time below and we\u2019ll come prepared with specifics, not a generic pitch.',
    };
  }

  // maybe_qualified, not_qualified, or missing/unknown status all get the
  // same deliberately open framing — we don't want the page itself to
  // editorialize a "soft no" before a human has had a chance to look.
  return {
    eyebrow: 'STATUS: RECEIVED',
    heading: 'Got it \u2014 we\u2019re reviewing your details now.',
    body: 'We\u2019re reviewing your details and will be in touch shortly with next steps. If it\u2019s a fit, you\u2019ll get a link to book a discovery call directly.',
  };
}

export default function SuccessPage({ searchParams }: SuccessPageProps) {
  const { status, bookingUrl } = searchParams;
  const copy = getCopy(status);

  return (
    <PageShell>
      <BrandMark />

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <div aria-hidden className="absolute inset-0 rounded-full bg-success/20 blur-md" />
          <CheckCircle2 className="relative h-8 w-8 text-success" />
        </div>

        <p className="font-mono-label mt-6 text-xs text-primary-bright">{copy.eyebrow}</p>
        <h1 className="font-display mt-3 max-w-md text-2xl font-bold text-foreground sm:text-3xl">
          {copy.heading}
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground sm:text-base">
          {copy.body}
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          {bookingUrl && (
            <Button asChild size="lg">
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
                <CalendarCheck className="h-4 w-4" />
                Book your discovery call
              </a>
            </Button>
          )}
          <Button asChild variant={bookingUrl ? 'outline' : 'default'} size="lg">
            <Link href="/">
              Submit another response
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
