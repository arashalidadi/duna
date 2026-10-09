import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
// Network fixtures exist ONLY in this test runner, never in the shipped application.
// These tests verify UI contracts; they are not a substitute for real database/auth integration tests.
const root = path.resolve(__dirname, '../../src/app/[locale]/(dashboard)');
const routes = fs
  .readdirSync(root)
  .filter((name) => fs.existsSync(path.join(root, name, 'page.tsx')));
const permissions = Array.from(
  new Set([
    ...routes.flatMap((route) => {
      const source = fs.readFileSync(path.join(root, route, 'page.tsx'), 'utf8');
      return Array.from(source.matchAll(/hasPermission\('([^']+)'\)/g)).map((m) => m[1]);
    }),
    ...Array.from(
      fs
        .readFileSync(path.resolve(__dirname, '../../src/lib/navigation/nav.ts'), 'utf8')
        .matchAll(/requiredPermission: '([^']+)'/g)
    ).map((m) => m[1]),
  ])
);
const empty = { data: [], meta: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } };
const user = {
  id: 'ui-test-user',
  email: 'operator@example.test',
  fullName: 'UI Test Operator',
  roles: [],
  isActive: true,
  portalCustomerId: null,
};
async function session(page: Page) {
  await page.addInitScript(() => localStorage.setItem('shipping_access_token', 'ui-test-token'));
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace('/api/v1', '');
    let data: unknown = empty;
    if (endpoint === '/auth/me') data = { user, permissions };
    else if (endpoint === '/health')
      data = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: { status: 'up' },
        app: { version: 'test', environment: 'test', uptimeSeconds: 3600 },
      };
    else if (endpoint === '/portal/me')
      data = {
        customer: null,
        summary: {
          bookingsTotal: 0,
          bookingsPending: 0,
          approvedManifests: 0,
          balanceDue: 0,
          currencyCode: 'USD',
        },
      };
    else if (/\/(active|all|modules|ports)$/.test(endpoint) && endpoint !== '/ports') data = [];
    else if (endpoint.includes('next-numbers')) data = [];
    await route.fulfill({ json: { success: true, data } });
  });
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true
  );
}
for (const locale of ['en', 'fa', 'ar']) {
  test(`${locale}: every dashboard route renders an empty state without runtime errors`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await session(page);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (
        msg.type() === 'error' &&
        /MISSING_MESSAGE|FORMATTING_ERROR|INVALID_MESSAGE/.test(msg.text())
      )
        errors.push(msg.text());
    });
    for (const route of routes) {
      await page.goto(`/${locale}/${route}`);
      await expect(page.locator('#workspace-main')).toBeVisible();
      await expect(page.locator('#workspace-main h1'), route).toBeVisible();
      await page.waitForTimeout(120);
      await noOverflow(page);
    }
    expect(errors).toEqual([]);
  });
  test(`${locale}: modal typing, focus containment, mobile drawer and theme`, async ({ page }) => {
    await session(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/${locale}/customers`);
    const create = page.locator('#workspace-main button').first();
    await create.click();
    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    await dialog.locator('#cust-code').pressSequentially('TEST-123');
    await dialog.locator('#cust-name').click();
    await dialog.locator('#cust-name').pressSequentially('Continuous typing works');
    await expect(dialog.locator('#cust-name')).toHaveValue('Continuous typing works');
    await expect(dialog.locator('#cust-name')).toBeFocused();
    await dialog.locator('#cust-phone').click();
    await dialog.locator('#cust-phone').pressSequentially('+971501234567');
    await expect(dialog.locator('#cust-phone')).toHaveValue('+971501234567');
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(create).toBeFocused();
    const collapse = page.locator('aside button[aria-expanded]').last();
    await collapse.click();
    await expect(page.locator('aside')).toHaveCSS('width', '76px');
    await collapse.click();
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page);
    await page.locator('header button.lg\\:hidden').click();
    const drawer = page.locator('dialog[open]');
    await expect(drawer).toBeVisible();
    expect(await drawer.getAttribute('data-side')).toBe(locale === 'en' ? 'left' : 'right');
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await page.locator('header button[aria-haspopup="menu"]').last().click();
    await page.locator('[role="menuitemradio"]').nth(1).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await noOverflow(page);
    await page.setViewportSize({ width: 768, height: 800 });
    await noOverflow(page);
  });
}
test('login is accessible, handles API outage and keeps password toggle in tab order', async ({
  page,
}) => {
  await page.goto('/en/login');
  await page.getByLabel('Email', { exact: true }).fill('operator@example.test');
  await page.getByLabel('Password', { exact: true }).pressSequentially('test-only-password');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.locator('#password')).toHaveAttribute('type', 'text');
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      status: 502,
      json: { success: false, error: { statusCode: 502, message: 'API service unavailable' } },
    })
  );
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.locator('main [role="alert"]')).toContainText('API service');
  await page.setViewportSize({ width: 320, height: 568 });
  await noOverflow(page);
});
test('language menu preserves route, query and fragment', async ({ page }) => {
  await page.goto('/en/login?context=test#form');
  await page.getByRole('button', { name: 'Language', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'العربية' }).click();
  await expect(page).toHaveURL(/\/ar\/login\?context=test#form/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});
test('an unavailable API does not erase an existing session or leave a spinner forever', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('shipping_access_token', 'ui-test-token');
    localStorage.setItem('shipping_refresh_token', 'ui-test-refresh');
  });
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 502,
      json: { success: false, error: { statusCode: 502, message: 'Unavailable' } },
    })
  );
  await page.goto('/en/dashboard');
  await expect(page.locator('main [role="alert"]')).toContainText('Service unavailable');
  expect(await page.evaluate(() => localStorage.getItem('shipping_refresh_token'))).toBe(
    'ui-test-refresh'
  );
});

for (const locale of ['en', 'fa', 'ar']) {
  test(`${locale}: creation dialogs support continuous typing at phone width`, async ({ page }) => {
    test.setTimeout(180000);
    await session(page);
    await page.setViewportSize({ width: 390, height: 740 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /MISSING_MESSAGE|FORMATTING_ERROR/.test(message.text()))
        errors.push(message.text().split('\n')[0]);
    });
    for (const route of [
      'customers',
      'shippers',
      'consignees',
      'agents',
      'cargo',
      'ports',
      'yards',
      'vessels',
      'voyages',
      'inspections',
      'actual-loading',
      'load-lists',
      'users',
      'roles',
      'invoices',
      'bills',
      'manifest',
      'jobs',
      'letters',
      'quotations',
      'proformas',
      'employees',
      'salary-records',
      'vouchers',
    ]) {
      await page.goto(`/${locale}/${route}`);
      await expect(page.locator('#workspace-main h1'), route).toBeVisible();
      const create = page
        .locator('#workspace-main button')
        .filter({ has: page.locator('svg.lucide-plus') })
        .first();
      await expect(create, `${route}: creation control`).toBeVisible();
      await create.click();
      const dialog = page.locator('dialog[open]').last();
      await expect(dialog, route).toBeVisible();
      const inputs = dialog.locator(
        'input:not([type]), input[type="text"], input[type="email"], input[type="password"], textarea'
      );
      for (const input of await inputs.all()) {
        if (!(await input.isVisible()) || !(await input.isEditable())) continue;
        await input.fill('');
        const maxLength = Number(await input.getAttribute('maxlength')) || 10;
        const value = '1234567890'.slice(0, Math.min(10, maxLength));
        await input.pressSequentially(value);
        await expect(input, `${route}: typing`).toHaveValue(value);
        await expect(input).toBeFocused();
      }
      await noOverflow(page);
      const box = await dialog.boundingBox();
      expect(box?.width).toBeLessThanOrEqual(390);
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog[open]')).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
}

for (const locale of ['en', 'fa', 'ar']) {
  test(`${locale}: preference menus are operable without a pointer`, async ({ page }) => {
    await page.goto(`/${locale}/login`);
    const triggers = page.locator('button[aria-haspopup="menu"]');
    for (const trigger of await triggers.all()) {
      await trigger.focus();
      await page.keyboard.press('ArrowDown');
      const options = page.getByRole('menuitemradio');
      await expect(options.first()).toBeFocused();
      await page.keyboard.press('End');
      await expect(options.last()).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(options.first()).toBeFocused();
      await page.keyboard.press('Home');
      await expect(options.first()).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      await expect(options).toHaveCount(0);
      await page.keyboard.press('ArrowUp');
      await expect(options.last()).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(options).toHaveCount(0);
    }
  });

  test(`${locale}: admin chooses the reset password; populated user table fits mobile`, async ({
    page,
  }) => {
    await session(page);
    await page.route('**/api/v1/users?*', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            data: [{ ...user, lastLoginAt: '2026-10-09T09:00:00Z' }],
            meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
          },
        },
      })
    );
    let sent: unknown;
    await page.route('**/api/v1/users/ui-test-user/reset-password', async (route) => {
      sent = route.request().postDataJSON();
      await route.fulfill({ json: { success: true, data: { reset: true } } });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${locale}/users`);
    const table = page.locator('[role="region"]').filter({ has: page.locator('table') });
    await expect(table).toHaveAttribute('tabindex', '0');
    await noOverflow(page);
    const reset = page.locator('button').filter({ has: page.locator('svg.lucide-key-round') });
    await reset.click();
    const dialog = page.locator('dialog[open]');
    const input = dialog.locator('#reset-password');
    const submit = dialog.locator('footer button').last();
    await expect(input).toHaveAttribute('maxlength', '128');
    await input.pressSequentially('short');
    await expect(submit).toBeDisabled();
    expect(sent).toBeUndefined();
    await input.fill('');
    await input.pressSequentially('test-only-chosen-password');
    await expect(input).toBeFocused();
    await submit.click();
    await expect(dialog).toHaveCount(0);
    expect(sent).toEqual({ newPassword: 'test-only-chosen-password' });
    await reset.click();
    await expect(input).toHaveValue('');
  });
}

test('permission-filtered navigation and actions do not expose admin controls', async ({
  page,
}) => {
  await session(page);
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      json: { success: true, data: { user, permissions: [] } },
    })
  );
  await page.goto('/en/dashboard');
  await expect(page.locator('#workspace-main')).toContainText('No modules are assigned');
  await expect(page.locator('aside a[href$="/users"]')).toHaveCount(0);
  await page.goto('/en/users');
  await expect(page.locator('#workspace-main h1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New user', exact: true })).toHaveCount(0);
});

test('rejected refresh clears tokens and redirects', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('shipping_access_token', 'expired-ui-test-token');
    localStorage.setItem('shipping_refresh_token', 'expired-ui-test-refresh');
  });
  let refreshCount = 0;
  await page.route('**/api/v1/auth/**', async (route) => {
    if (route.request().url().endsWith('/refresh')) refreshCount++;
    await route.fulfill({
      status: 401,
      json: {
        success: false,
        error: {
          statusCode: 401,
          message: 'Unauthorized',
        },
      },
    });
  });
  await page.goto('/en/dashboard');
  await expect(page).toHaveURL(/\/en\/login$/);
  expect(refreshCount).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('shipping_access_token'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('shipping_refresh_token'))).toBeNull();
});

test('a rotated session restores normally with only one refresh request', async ({ page }) => {
  await session(page);
  await page.addInitScript(() => localStorage.setItem('shipping_refresh_token', 'ui-test-refresh'));
  await page.route('**/api/v1/auth/me', async (route) => {
    if (route.request().headers().authorization === 'Bearer rotated-ui-test-token') {
      await route.fulfill({ json: { success: true, data: { user, permissions } } });
    } else {
      await route.fulfill({
        status: 401,
        json: { success: false, error: { statusCode: 401, message: 'Unauthorized' } },
      });
    }
  });
  let refreshCount = 0;
  await page.route('**/api/v1/auth/refresh', async (route) => {
    refreshCount++;
    await route.fulfill({
      json: {
        success: true,
        data: {
          accessToken: 'rotated-ui-test-token',
          refreshToken: 'rotated-ui-test-refresh',
        },
      },
    });
  });
  await page.goto('/en/dashboard');
  await expect(page.locator('#workspace-main h1')).toBeVisible();
  expect(refreshCount).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('shipping_refresh_token'))).toBe(
    'rotated-ui-test-refresh'
  );
});

test('system theme follows device changes and an explicit preference overrides them', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/en/login');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Light', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'System', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem('duna-theme'))).toBe('system');
});
