import { test, expect, type Page } from '@playwright/test';

// Browser fixtures are isolated from the API/DB; never exercise a real audit export here.
async function auditSession(
  page: Page,
  permissions: string[],
  primaryAdmin = false,
  exportStatus = 200
) {
  const requests: string[] = [];
  const actor = {
    id: 'ui-audit-user',
    email: 'operator@example.test',
    fullName: 'Audit Operator',
    roles: [],
    isActive: true,
    portalCustomerId: null,
    isPrimaryAdmin: primaryAdmin,
  };
  await page.addInitScript(() => localStorage.setItem('shipping_access_token', 'ui-audit-token'));
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace('/api/v1', '');
    requests.push(endpoint + url.search);
    if (endpoint === '/auth/me') {
      await route.fulfill({ json: { success: true, data: { user: actor, permissions } } });
    } else if (endpoint === '/audit') {
      await route.fulfill({
        json: {
          success: true,
          data: {
            items: [
              {
                id: 'log-1',
                timestamp: '2026-10-16T09:00:00Z',
                action: 'role:create',
                actorEmail: 'owner@example.test',
                entityType: 'Role',
                entityId: 'role-1',
                beforeData: null,
                afterData: { code: 'TEST' },
                metadata: null,
              },
            ],
            total: 1,
          },
        },
      });
    } else if (endpoint === '/audit/export') {
      if (exportStatus === 404) {
        await route.fulfill({
          status: 404,
          json: { success: false, error: { statusCode: 404, message: 'Not Found' } },
        });
      } else {
        const more = url.searchParams.get('offset') === '0';
        await route.fulfill({
          status: 200,
          body: 'id,action\r\nlog-1,role:create\r\n',
          headers: {
            'content-type': 'text/csv; charset=utf-8',
            'x-audit-export-has-more': String(more),
            ...(more ? { 'x-audit-export-next-offset': '500' } : {}),
          },
        });
      }
    } else {
      await route.fulfill({ json: { success: true, data: {} } });
    }
  });
  return requests;
}

test('primary owner sees Audit navigation with implicit authority and explicitly downloads paged CSV', async ({
  page,
}) => {
  const requests = await auditSession(page, [], true);
  await page.goto('/en/audit');
  await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible();
  await expect(page.locator('main').getByText('role:create')).toBeVisible();
  await expect(page.locator('aside a[href="/en/audit"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Download first CSV page' })).toBeVisible();
  expect(requests.filter((r) => r.startsWith('/audit/export'))).toHaveLength(0);
  await page.getByLabel('Export from').fill('2026-10-16T08:00');
  await page.getByLabel('Export to').fill('2026-10-16T10:00');
  const first = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download first CSV page' }).click();
  expect((await first).suggestedFilename()).toBe('audit-2026-10-16-2026-10-16-0.csv');
  await expect(page.getByText('More rows are available.')).toBeVisible();
  const next = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download next CSV page' }).click();
  expect((await next).suggestedFilename()).toBe('audit-2026-10-16-2026-10-16-500.csv');
  await expect(page.getByText('No more rows in this window.')).toBeVisible();
  expect(requests.filter((r) => r.startsWith('/audit/export'))).toHaveLength(2);
  expect(
    requests
      .filter((r) => r.startsWith('/audit/export'))
      .map((r) => new URLSearchParams(r.split('?')[1]).get('offset'))
  ).toEqual(['0', '500']);
});

test('ordinary audit reader can browse but cannot see export; no read means no menu or fetch', async ({
  page,
}) => {
  const requests = await auditSession(page, ['audit:read']);
  await page.goto('/fa/audit');
  await expect(page.getByRole('heading', { name: 'سوابق ممیزی' })).toBeVisible();
  await expect(page.getByText('role:create')).toBeVisible();
  await expect(page.locator('aside a[href="/fa/audit"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /CSV/ })).toHaveCount(0);
  expect(requests.filter((r) => r.startsWith('/audit/export'))).toHaveLength(0);
});

test('ordinary user with both explicitly assigned audit permissions may export', async ({ page }) => {
  const requests = await auditSession(page, ['audit:read', 'audit:export']);
  await page.goto('/en/audit');
  await expect(page.getByRole('button', { name: 'Download first CSV page' })).toBeVisible();
  expect(requests.filter((r) => r.startsWith('/audit/export'))).toHaveLength(0);
});

test('Arabic Audit page renders in RTL without a page-level horizontal overflow', async ({
  page,
}) => {
  await auditSession(page, ['audit:read']);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/ar/audit');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'سجل التدقيق' })).toBeVisible();
  await expect(page.getByText('role:create')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true
  );
});

test('ordinary user without audit:read cannot access the direct URL even with export alone', async ({
  page,
}) => {
  const requests = await auditSession(page, ['audit:export']);
  await page.goto('/en/audit');
  await expect(page.getByText('You need audit:read to view this audit trail.')).toBeVisible();
  await expect(page.locator('aside a[href="/en/audit"]')).toHaveCount(0);
  expect(requests.filter((r) => r.startsWith('/audit'))).toHaveLength(0);
});

test('Audit browse empty shape shows an empty state without a CSV request', async ({ page }) => {
  const requests = await auditSession(page, ['audit:read']);
  await page.route(/\/api\/v1\/audit\?/, async (route) => {
    await route.fulfill({ json: { success: true, data: { items: [], total: 0 } } });
  });
  await page.goto('/en/audit');
  await expect(page.getByText('No audit events found')).toBeVisible();
  expect(requests.filter((r) => r.startsWith('/audit/export'))).toHaveLength(0);
});

test('API export 404 is reported as a route gap, never as a successful denial or CSV', async ({
  page,
}) => {
  await auditSession(page, [], true, 404);
  await page.goto('/en/audit');
  await page.getByLabel('Export from').fill('2026-10-16T08:00');
  await page.getByLabel('Export to').fill('2026-10-16T10:00');
  await page.getByRole('button', { name: 'Download first CSV page' }).click();
  await expect(page.locator('#workspace-main p[role="alert"]')).toContainText(
    '404; this is not a permission denial'
  );
});
