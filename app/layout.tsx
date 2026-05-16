import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'veb².com',
  description: 'Landing page for veb2.com',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#050505] text-white selection:bg-white/20 selection:text-white" style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif" }} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
