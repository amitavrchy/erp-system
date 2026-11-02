'use client';
import { ErrorState } from '@/components/ui';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <ErrorState message="Something interrupted this page. Your saved work is safe." retry={reset} />
  );
}
