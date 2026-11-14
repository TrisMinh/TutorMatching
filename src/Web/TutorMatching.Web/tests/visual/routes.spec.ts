import { expect, test, type Page } from '@playwright/test';

async function expectHealthyVisualSurface(page: Page) {
  await page.waitForLoadState('networkidle');
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - window.innerWidth,
    document: document.documentElement.scrollWidth - window.innerWidth,
  }));
  expect(overflow.body).toBeLessThanOrEqual(0);
  expect(overflow.document).toBeLessThanOrEqual(0);

  const brokenImages = await page.locator('img').evaluateAll((images) =>
    images
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.getAttribute('src')),
  );
  expect(brokenImages).toEqual([]);
}

test('desktop auth composition keeps its exact two-panel surface', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/auth/sign-in');

  await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();
  await expect(page.locator('.auth-showcase')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Tutor helping a student learn' })).toBeVisible();
  const typography = await page.evaluate(async () => {
    await document.fonts.ready;
    const [regular, medium, semiBold, bold] = await Promise.all([
      document.fonts.load('400 16px "Gilroy Regular"'),
      document.fonts.load('500 16px "Gilroy Medium"'),
      document.fonts.load('600 24px "Gilroy SemiBold"'),
      document.fonts.load('700 24px "Gilroy SemiBold"'),
    ]);
    const heading = document.querySelector('h1');
    return {
      loadedFaces: [regular.length, medium.length, semiBold.length, bold.length],
      headingFamily: heading ? getComputedStyle(heading).fontFamily : '',
    };
  });
  expect(typography).toEqual({
    loadedFaces: [1, 1, 1, 1],
    headingFamily: '"Gilroy SemiBold", "Avenir Next", Arial, sans-serif',
  });
  await expectHealthyVisualSurface(page);
});

test('wide desktop centers the 1440 Figma canvas without shifting the form', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto('/auth/sign-in');

  expect(await page.locator('.auth-page').boundingBox()).toEqual({ x: 240, y: 0, width: 1440, height: 900 });
  expect(await page.locator('.auth-entry__content').boundingBox()).toMatchObject({ x: 385, width: 430 });
  await expectHealthyVisualSurface(page);
});

test('student dashboard restores the original weekly calendar and interactions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/student/dashboard');

  await expect(page.getByRole('heading', { name: 'My Schedule' })).toBeVisible();
  const calendarBox = await page.locator('.legacy-calendar').boundingBox();
  expect(calendarBox?.width).toBeCloseTo(820, 1);
  expect(calendarBox?.height).toBeCloseTo(455, 1);
  await expect(page.locator('.legacy-event')).toHaveCount(4);
  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(page.getByText('09 – 15 March')).toBeVisible();
  await page.getByRole('tab', { name: 'Webinar' }).click();
  await expect(page.getByRole('tab', { name: 'Webinar' })).toHaveAttribute('aria-selected', 'true');
  await expectHealthyVisualSurface(page);
});

test('mobile student search uses the Figma bottom navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/student/find-tutors');

  await expect(page.getByRole('heading').filter({ hasText: 'Find tutors' })).toBeVisible();
  await expect(page.locator('.student-sidebar')).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Mobile student navigation' })).toBeVisible();
  await expectHealthyVisualSurface(page);
});

test('tablet tutor dashboard remains complete and overflow-free', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/tutor/dashboard');

  await expect(page.getByRole('heading', { name: 'Welcome back, Minh Anh' })).toBeVisible();
  await expect(page.getByText('Tutor mode')).toBeVisible();
  await expectHealthyVisualSurface(page);
});

test('shared state preserves the original 480 by 360 Figma geometry', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 360 });
  await page.goto('/states/booking-success');

  await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible();
  await expect(page.locator('.state-card')).toHaveCSS('width', '420px');
  await expect(page.locator('.state-card')).toHaveCSS('height', '300px');
  await expect(page.locator('.state-card')).toHaveCSS('border-radius', '16px');

  const box = await page.locator('.state-card').boundingBox();
  expect(box).toEqual({ x: 30, y: 30, width: 420, height: 300 });
  await expectHealthyVisualSurface(page);
});

test('small-phone, tablet, and landscape breakpoints remain stable', async ({ page }) => {
  const viewports = [
    { path: '/auth/sign-in', width: 375, height: 667 },
    { path: '/student/dashboard', width: 768, height: 1024 },
    { path: '/tutor/schedule', width: 844, height: 390 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(viewport.path);
    await expect(page.locator('main').first()).toBeVisible();
    await expectHealthyVisualSurface(page);
  }
});

test('motion system animates route content and carousel changes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/auth/sign-in');

  const pageMotion = await page.locator('.auth-entry__content').evaluate((element) => {
    const style = getComputedStyle(element);
    return { name: style.animationName, duration: style.animationDuration };
  });
  expect(pageMotion).toEqual({ name: 'tm-page-enter', duration: '0.32s' });

  const image = page.getByRole('img', { name: 'Tutor helping a student learn' });
  const previousSource = await image.getAttribute('src');
  await page.getByRole('button', { name: 'Next slide' }).click();
  await expect(image).not.toHaveAttribute('src', previousSource ?? '');
  await expect(image).toHaveCSS('animation-name', 'tm-image-enter');
});

test('reduced motion presents the final state without animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tutor/dashboard');

  await expect(page.locator('.student-content')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.tutor-stats article').first()).toHaveCSS('animation-name', 'none');
  await expect(page.getByRole('heading', { name: 'Welcome back, Minh Anh' })).toBeVisible();
});

test('sidebar navigation uses a native view transition when supported', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/student/dashboard');
  const supportsViewTransitions = await page.evaluate(() => {
    const documentWithTransitions = document as Document & {
      startViewTransition?: (update: () => void | Promise<void>) => unknown;
    };
    const nativeTransition = documentWithTransitions.startViewTransition?.bind(document);
    if (!nativeTransition) return false;
    (window as Window & { __tmViewTransitions?: number }).__tmViewTransitions = 0;
    Object.defineProperty(documentWithTransitions, 'startViewTransition', {
      configurable: true,
      value: (update: () => void | Promise<void>) => {
        const instrumentedWindow = window as Window & { __tmViewTransitions?: number };
        instrumentedWindow.__tmViewTransitions = (instrumentedWindow.__tmViewTransitions ?? 0) + 1;
        return nativeTransition(update);
      },
    });
    return true;
  });

  await page.getByRole('link', { name: 'My bookings' }).click();

  await expect(page).toHaveURL(/\/student\/bookings$/);
  await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible();
  if (supportsViewTransitions) {
    expect(await page.evaluate(() => (window as Window & { __tmViewTransitions?: number }).__tmViewTransitions ?? 0)).toBeGreaterThan(0);
  }
});
