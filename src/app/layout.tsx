import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'EOT Couplings ERP | Precision Tubulars & Casing System',
  description: 'Enterprise ERP for OCTG and industrial pipe manufacturing with strict relational integrity, cutting yield math, and full provenance traceability.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased overflow-x-hidden">
        <Suspense fallback={null}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </Suspense>
      </body>
    </html>
  );
}

