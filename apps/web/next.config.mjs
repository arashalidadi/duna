import createNextIntlPlugin from 'next-intl/plugin';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@shipping/shared'],
  // Phase 12's independent verification must not overwrite the live Next output.
  ...(process.env.PHASE12_NEXT_ISOLATED_BUILD === '1' ? { distDir: 'build' } : {}),
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);