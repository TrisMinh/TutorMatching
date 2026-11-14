import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/live',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: process.env.TUTORMATCHING_WEB_URL ?? 'http://127.0.0.1:3000',
    channel: 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
