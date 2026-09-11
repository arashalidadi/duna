'use client';

import { Search, Bell, Menu, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/button';

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth();
  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:px-6">
      {onMenuClick && (
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
      )}

      {/* Workspace / active context */}
      <div className="hidden items-center gap-2 md:flex">
        <span className="micro-label text-muted-foreground">Workspace</span>
        <span className="text-sm font-medium text-foreground">Foundation</span>
      </div>

      {/* Global search */}
      <div className="relative hidden max-w-xs flex-1 sm:flex lg:max-w-sm">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="text"
          placeholder="Search…"
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications (coming soon)"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          <span
            className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive"
            aria-hidden="true"
          />
        </Button>
        <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <div className="flex items-center gap-2 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            {initials}
          </div>
          <div className="hidden text-left sm:block">
            <div className="text-xs font-medium leading-tight text-foreground">
              {user?.fullName || 'Signed in'}
            </div>
            <div className="flex items-center gap-1 text-[10px] leading-tight text-muted-foreground">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-success"
                aria-hidden="true"
              />
              Active
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => logout()}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  );
}
