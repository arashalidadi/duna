import { expect, test, type Page } from '@playwright/test';

// Browser-only network fixtures: no API/database connection or fixture cleanup.
// These test the Slice 4 presentation, not Slice 5's real-DB isolation requirement.
const at = '2026-10-13T09:00:00.000Z';
const emptyMeta = { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };
const user = {
  id: 'agent-test-user', email: 'agent@example.test', fullName: 'Test Agent',
  isActive: true, roles: [], lastLoginAt: null, passwordChangedAt: null,
};

const bill = {
  id: 'bill-a', billNumber: 'BOL-PORT-A', voyageId: 'voyage-a', destinationPortId: 'port-a',
  status: 'APPROVED', billType: 'HOUSE', vesselName: 'Vessel A', dateOfIssue: at, createdAt: at,
  hasActiveRelease: true,
  activeRelease: { id: 'release-a', docNumber: 'RO-PORT-A', releaseDate: at, paymentState: 'PARTIAL' },
};
const cancelledBill = {
  ...bill, id: 'bill-b', billNumber: 'BOL-PORT-B', status: 'CANCELLED',
  hasActiveRelease: false, activeRelease: null,
};
const releasedOrder = {
  id: 'release-a', docNumber: 'RO-PORT-A', billOfLadingId: 'bill-a',
  status: 'ISSUED', paymentState: 'PARTIAL', releaseDate: at, cancelledAt: null,
  billOfLading: { id: 'bill-a', billNumber: 'BOL-PORT-A', destinationPortId: 'port-a', status: 'APPROVED' },
};
const cancelledOrder = {
  id: 'release-cancelled', docNumber: 'RO-CANCELLED', billOfLadingId: 'bill-b',
  status: 'CANCELLED', paymentState: null, releaseDate: at, cancelledAt: at,
  billOfLading: { id: 'bill-b', billNumber: 'BOL-PORT-B', destinationPortId: 'port-a', status: 'CANCELLED' },
};

type MockPortal = {
  customerOnly?: boolean;
  noActiveDestinations?: boolean;
  requested: string[];
};

async function mockPortal(page: Page, state: MockPortal) {
  await page.addInitScript(() => localStorage.setItem('shipping_access_token', 'ui-test-token'));
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace('/api/v1', '');
    state.requested.push(endpoint + url.search);

    if (endpoint === '/portal/me' && !state.customerOnly) {
      await route.fulfill({ status: 403, json: { success: false, error: { statusCode: 403, message: 'No Customer link' } } });
      return;
    }

    let data: unknown = [];
    if (endpoint === '/auth/me') data = { user, permissions: ['portal:access'] };
    else if (endpoint === '/portal/me') data = {
      customer: { id: 'customer-1', code: 'C-1', name: 'Customer', email: null, phone: null, type: null },
      summary: { bookingsTotal: 0, bookingsPending: 0, approvedManifests: 0, balanceDue: 0, currencyCode: 'USD' },
    };
    else if (endpoint === '/portal/bills-of-lading') {
      const reason = state.customerOnly ? 'CUSTOMER_ONLY' : state.noActiveDestinations ? 'NO_ACTIVE_DESTINATIONS' : null;
      data = reason
        ? { data: [], meta: emptyMeta, emptyState: { reason } }
        : { data: [bill, cancelledBill], meta: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 }, emptyState: null };
    } else if (endpoint === '/portal/release-orders') {
      data = state.customerOnly
        ? { data: [], meta: emptyMeta, emptyState: { reason: 'CUSTOMER_ONLY' } }
        : { data: [releasedOrder, cancelledOrder], meta: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 }, emptyState: null };
    } else if (endpoint === '/portal/bl-labels') {
      data = state.customerOnly
        ? { data: [], emptyState: { reason: 'CUSTOMER_ONLY' } }
        : { data: [{ code: 'APPROVED', label: 'Configured APPROVED', sortOrder: 2 }], emptyState: null };
    } else if (endpoint === '/portal/bookings' || endpoint === '/portal/shipments') {
      data = { data: [], meta: emptyMeta };
    } else if (endpoint === '/health') {
      data = { status: 'ok', database: { status: 'up' }, app: { version: 'test', environment: 'test', uptimeSeconds: 1 } };
    }
    await route.fulfill({ json: { success: true, data } });
  });
}

test('agent-only account opens B/L and release tabs without a Customer profile or staff endpoints', async ({ page }) => {
  const state: MockPortal = { requested: [] };
  await mockPortal(page, state);
  await page.goto('/en/portal');

  await expect(page.getByRole('button', { name: 'Bills of Lading' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('BOL-PORT-A')).toBeVisible();
  await expect(page.getByText('BOL-PORT-B')).toBeVisible();
  await expect(page.getByText('Configured APPROVED')).toBeVisible();
  await expect(page.getByText('RO-PORT-A')).toBeVisible();
  await expect(page.getByText('No active Release Order')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bookings' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Release Orders' }).click();
  await expect(page.getByText('RO-CANCELLED')).toBeVisible();
  await expect(page.getByText('Not recorded')).toBeVisible();
  await expect(page.getByText('Partial payment')).toBeVisible();
  expect(state.requested).toContain('/portal/bills-of-lading?page=1&pageSize=20');
  expect(state.requested).toContain('/portal/release-orders?page=1&pageSize=20');
  expect(state.requested.filter((path) => /[?&](agentId|destinationPortId)=/.test(path))).toEqual([]);
  expect(state.requested.filter((path) => path.startsWith('/bills') || path.startsWith('/release-orders'))).toEqual([]);
});

for (const { locale, title } of [
  { locale: 'fa', title: 'اسناد نماینده در دسترس نیست' },
  { locale: 'ar', title: 'مستندات الوكيل غير متاحة' },
]) {
  test(`${locale}: customer-only account sees the explicit reason in both document tabs`, async ({ page }) => {
    await mockPortal(page, { customerOnly: true, requested: [] });
    await page.goto(`/${locale}/portal`);
    await page.locator('#workspace-main button[aria-pressed]').filter({ hasText: locale === 'fa' ? 'بارنامه‌ها' : 'بوليصات الشحن' }).click();
    await expect(page.getByText(title)).toBeVisible();
    await page.locator('#workspace-main button[aria-pressed]').filter({ hasText: locale === 'fa' ? 'مجوزهای ترخیص' : 'أوامر الإفراج' }).click();
    await expect(page.getByText(title)).toBeVisible();
  });
}

test('no-active-destinations reason is shown, then refresh reads the newly scoped response', async ({ page }) => {
  const state: MockPortal = { noActiveDestinations: true, requested: [] };
  await mockPortal(page, state);
  await page.goto('/en/portal');
  await expect(page.getByText('No active destinations')).toBeVisible();
  const before = state.requested.filter((path) => path.startsWith('/portal/bills-of-lading?')).length;
  state.noActiveDestinations = false;
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByText('BOL-PORT-A')).toBeVisible();
  expect(state.requested.filter((path) => path.startsWith('/portal/bills-of-lading?')).length).toBeGreaterThan(before);
});
