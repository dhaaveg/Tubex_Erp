import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'EOT Couplings ERP | Precision Tubulars & Casing System',
  description: 'Enterprise ERP for OCTG and industrial pipe manufacturing with strict relational integrity, cutting yield math, and full provenance traceability.',
  icons: {
    icon: '/app-icon.png',
    shortcut: '/favicon.ico',
    apple: '/app-icon.png',
  },
};

const THEME_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('eot_theme');
    var theme = stored === 'light' ? 'light' : 'dark';
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(theme);
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  } catch (e) {
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.style.colorScheme = 'dark';
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen antialiased overflow-x-hidden transition-colors duration-150">
        <Suspense fallback={null}>
          <AuthProvider>
            <ThemeProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </ThemeProvider>
          </AuthProvider>
        </Suspense>
      </body>
    </html>
  );
}

