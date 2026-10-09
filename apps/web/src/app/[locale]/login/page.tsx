'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Ship, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageSelector, ThemeSelector } from '@/components/preferences/preferences';
import { PageLoader } from '@/components/ui/loading';

export default function LoginPage() {
  const { status, login } = useAuth();
  const router = useRouter();
  const t = useTranslations('login');
  const ui = useTranslations('workspaceUi');
  const common = useTranslations('common');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!email.trim() || !password) {
      setError(t('enterCredentials'));
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/dashboard');
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? ui('invalidCredentials')
          : err instanceof ApiError && err.status === 429
            ? ui('tooManyAttempts')
            : ui('serviceUnavailableDescription')
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <main className="flex min-h-dvh bg-background">
      <section
        className="relative hidden min-h-dvh w-[46%] flex-col justify-between overflow-hidden bg-brand-950 p-10 text-white lg:flex xl:p-14"
        aria-label={ui('workspace')}
      >
        <Image
          src="/images/hero-port-dusk.jpg"
          alt=""
          fill
          sizes="46vw"
          className="object-cover opacity-40"
          priority
        />
        <div className="absolute inset-0 bg-brand-950/50" />
        <Link
          href="/"
          className="relative flex w-fit items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-300"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-brass-300/40 text-brass-300">
            <Ship className="h-6 w-6" aria-hidden />
          </span>
          <span className="text-xl font-semibold">
            Duna Shipping<span className="text-brass-300">.</span>
          </span>
        </Link>
        <div className="relative max-w-lg py-16">
          <p className="mb-5 text-sm font-medium text-brass-300">{ui('operationsLabel')}</p>
          <h2 className="text-4xl font-semibold leading-tight xl:text-5xl">
            {ui('loginHeadline')}
          </h2>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-brand-200">
            {ui('loginStory')}
          </p>
        </div>
        <p className="relative flex items-center gap-2 text-xs text-brand-200">
          <ShieldCheck className="h-4 w-4 text-brass-300" aria-hidden />
          {t('restricted')}
        </p>
      </section>
      <section className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
            {ui('backToWebsite')}
          </Link>
          <div className="flex items-center">
            <LanguageSelector />
            <ThemeSelector />
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[400px] animate-fade-in-up">
            <div className="mb-8">
              <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border bg-card text-primary shadow-sm">
                <Ship className="h-6 w-6" aria-hidden />
              </span>
              <p className="mb-2 text-xs font-semibold text-primary">{ui('welcomeBack')}</p>
              <h1 className="text-3xl font-semibold">{t('heading')}</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t('description')}
              </p>
            </div>
            {status === 'loading' || status === 'authenticated' ? (
              <PageLoader
                label={status === 'authenticated' ? ui('openingWorkspace') : common('loading')}
              />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('email')}</Label>
                  <Input
                    id="email"
                    name="email"
                    dir="ltr"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    className="h-12"
                    aria-describedby={error ? 'login-error' : undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t('password')}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 pe-12"
                      aria-describedby={error ? 'login-error' : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute end-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>
                {(error || status === 'unavailable') && (
                  <div
                    id="login-error"
                    role="alert"
                    className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{error ?? ui('serviceUnavailableDescription')}</span>
                  </div>
                )}
                <Button type="submit" className="h-12 w-full justify-between" loading={submitting}>
                  {submitting ? common('signingIn') : t('title')}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
                </Button>
                <p className="flex items-start gap-2 pt-2 text-xs leading-relaxed text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
                  {t('restricted')}
                </p>
              </form>
            )}
          </div>
        </div>
        <footer className="px-6 py-6 text-center text-xs text-muted-foreground">
          Duna Shipping · {ui('operationsLabel')}
        </footer>
      </section>
    </main>
  );
}
