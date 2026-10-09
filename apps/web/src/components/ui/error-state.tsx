import { useTranslations } from 'next-intl';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  const t = useTranslations('workspaceUi');
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-lg border bg-card px-6 py-12 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title ?? t('errorTitle')}</h3>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {message ?? t('errorDescription')}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          {t('retry')}
        </Button>
      )}
    </div>
  );
}
