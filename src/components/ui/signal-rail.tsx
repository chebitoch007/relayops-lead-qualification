'use client';

/**
 * Signature element: a thin "signal" meter across the top of the form
 * card that fills in electric blue as required fields are completed —
 * framed as pipeline-completion telemetry rather than a generic progress
 * bar, fitting an automation product. The percentage is real (driven by
 * actual field completion), not decorative.
 */
export function SignalRail({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono-label text-[11px] text-muted-foreground">SIGNAL</span>
        <span className="font-mono-label text-[11px] text-primary-bright">{Math.round(clamped)}%</span>
      </div>
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary-bright transition-[width] duration-300 ease-out"
          style={{ width: `${clamped}%` }}
          role="progressbar"
          aria-valuenow={Math.round(clamped)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Form completion"
        />
      </div>
    </div>
  );
}
