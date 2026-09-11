import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/** Locale-aware navigation APIs — use these instead of next/link & next/navigation inside pages. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
