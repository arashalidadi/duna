'use client';
import { ErrorState } from '@/components/ui/error-state';
/** A recoverable page-level failure must never remove the surrounding navigation. */
export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState onRetry={reset} />;
}
