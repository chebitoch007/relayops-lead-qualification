import type { Metadata } from 'next';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/500.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Get Your Free Strategy Call | RelayOps',
  description:
    'Tell us about your agency and our qualification system will route you to the right next step — instantly.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      style={
        {
          '--font-inter': 'Inter, system-ui, sans-serif',
          '--font-mono': "'JetBrains Mono', ui-monospace, monospace",
        } as React.CSSProperties
      }
    >
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
