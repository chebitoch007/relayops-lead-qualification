import { PageShell, BrandMark } from '@/components/sections/page-shell';
import { LeadCaptureForm } from '@/components/forms/lead-capture-form';

export default function HomePage() {
  return (
    <PageShell>
      <BrandMark />

      <div className="mt-10 sm:mt-14">
        <p className="font-mono-label text-xs text-primary-bright">LEAD QUALIFICATION INTAKE</p>
        <h1 className="font-display mt-3 text-3xl font-bold text-foreground sm:text-4xl">
          Tell us about your agency.
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          We&apos;ll route you to a discovery call automatically if it&apos;s a fit — no back-and-forth,
          no waiting on a human to read your inbox.
        </p>
      </div>

      <div className="mt-9">
        <LeadCaptureForm />
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground/70">
        Your details are reviewed by an automated qualification system and a member of our team.
      </p>
    </PageShell>
  );
}
