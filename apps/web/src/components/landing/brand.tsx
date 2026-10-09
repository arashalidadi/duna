import { cn } from '@/lib/utils';

/**
 * Duna Shipping brand mark: a vessel's bow riding over two waterlines, drawn as
 * a single geometric glyph inside a navy tile. Used at three sizes — `sm` in the
 * header, `lg` in the hero, and bare (no tile) where a tile would be redundant.
 */
export function BrandMark({
  className,
  tone = 'navy',
}: {
  className?: string;
  /** `navy` = solid navy tile (light backgrounds), `light` = translucent tile for dark backgrounds. */
  tone?: 'navy' | 'light';
}) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-[0.7rem] ring-1',
        tone === 'navy'
          ? 'bg-brand-900 text-white ring-brand-900/20'
          : 'bg-white/10 text-white ring-white/20 backdrop-blur',
        className
      )}
    >
      <svg viewBox="0 0 32 32" className="h-[62%] w-[62%]" aria-hidden="true" focusable="false">
        {/* bow / hull */}
        <path
          d="M16 5.5 27 24H5L16 5.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
        {/* keel line */}
        <path d="M11.4 20.2h9.2" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        {/* waterlines */}
        <path
          d="M3.4 27.4c1.9 0 2.9-1.3 4.8-1.3s2.9 1.3 4.8 1.3 2.9-1.3 4.8-1.3 2.9 1.3 4.8 1.3"
          fill="none"
          stroke="hsl(var(--brass-400))"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/** Brand mark + wordmark lockup, with an optional descriptor line. */
export function BrandLockup({
  brand,
  descriptor,
  tone = 'navy',
  className,
  markClassName,
}: {
  brand: string;
  descriptor?: string;
  tone?: 'navy' | 'light';
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark tone={tone} className={cn('h-9 w-9', markClassName)} />
      <span className="flex min-w-0 flex-col leading-none">
        <span
          className={cn(
            'truncate text-[0.95rem] font-semibold tracking-tight',
            tone === 'navy' ? 'text-brand-900' : 'text-white'
          )}
        >
          {brand}
        </span>
        {descriptor ? (
          <span
            className={cn(
              'mt-1 truncate text-[0.625rem] font-medium uppercase tracking-[0.16em] rtl:tracking-normal',
              tone === 'navy' ? 'text-brand-500' : 'text-brand-300'
            )}
          >
            {descriptor}
          </span>
        ) : null}
      </span>
    </span>
  );
}
