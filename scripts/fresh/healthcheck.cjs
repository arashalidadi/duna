'use strict';

const service = process.argv[2];
const url =
  service === 'api'
    ? 'http://127.0.0.1:3101/api/v1/health'
    : service === 'web'
      ? 'http://127.0.0.1:3000/fa/login'
      : null;
if (!url) process.exit(2);
(async () => {
  const response = await fetch(url, { signal: AbortSignal.timeout(4500) });
  if (!response.ok) process.exit(1);
  if (service === 'api') {
    const body = await response.json();
    if (body?.data?.database?.status !== 'up') process.exit(1);
  } else if (!(response.headers.get('content-type') || '').includes('text/html')) {
    process.exit(1);
  }
})().catch(() => process.exit(1));
