import { expect, test } from '@playwright/test';

test('student can register, sign in, log out, and cannot reopen a protected route', async ({ page }) => {
  const email = `student.e2e.${Date.now()}@example.com`;
  const password = 'TutorMatching!123';

  await page.goto('/auth/choose-role');
  await page.getByRole('button', { name: 'Continue as Student', exact: true }).click();
  await page.getByLabel('Full name').fill('Live E2E Student');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Good morning, Minh' })).toBeVisible();
  await page.goto('/student/complete-profile');
  await page.getByRole('button', { name: 'Save & continue' }).click();
  await expect(page.getByRole('heading').filter({ hasText: 'Find the right tutor' })).toBeVisible();
  const availabilityResponse = page.waitForResponse((response) => response.url().includes('/api/v1/search/available-tutors'));
  await page.getByRole('button', { name: 'Available today' }).click();
  expect((await availabilityResponse).status()).toBe(200);

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();

  await page.goto('/student/dashboard');
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();
});
