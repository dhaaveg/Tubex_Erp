import ErpShell from '@/components/ErpShell';
import { VALID_MODULES } from '@/lib/routes';
import { redirect } from 'next/navigation';

export function generateStaticParams() {
  return Object.keys(VALID_MODULES)
    .filter((mod) => mod !== 'user-management')
    .map((mod) => ({ module: mod }));
}

interface PageProps {
  params: { module: string };
}

export default function ModulePage({ params }: PageProps) {
  const modKey = (params.module || '').toLowerCase();
  const tab = VALID_MODULES[modKey];

  if (!tab) {
    redirect('/');
  }

  return <ErpShell initialTab={tab} />;
}
