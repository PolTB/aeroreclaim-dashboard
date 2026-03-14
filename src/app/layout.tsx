import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AeroReclaim Mission Control',
  description: 'Mission Control dashboard for the AeroReclaim project',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
