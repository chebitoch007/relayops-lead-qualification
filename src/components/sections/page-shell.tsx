import type { ReactNode } from 'react';

/**
 * Shared page chrome: dark canvas, subtle radial glow behind the content,
 * centered column. Used by both the lead-capture page and the success
 * page so the two states feel like one continuous system.
 */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[800px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/20 blur-[120px]"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-14 sm:px-6 sm:py-20">
        {children}
      </div>
    </main>
  );
}

export function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-primary">
        <span className="h-2 w-2 rounded-full bg-primary-foreground" />
      </span>
      <span className="font-mono-label text-xs text-muted-foreground">RELAYOPS</span>
    </div>
  );
}
