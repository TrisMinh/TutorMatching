import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/live',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: process.env.TUTORMATCHING_WEB_URL ?? 'http://127.0.0.1:3000',
    channel: 'chrome',
    headless: true,
    // Local HTTPS browser tests may explicitly pin only this development server key.
    // Strict CA/hostname verification is separately exercised by verify-security.mjs.
    launchOptions: { args: process.env.TUTORMATCHING_LOCAL_CERT_SPKI ? [`--ignore-certificate-errors-spki-list=${process.env.TUTORMATCHING_LOCAL_CERT_SPKI}`] : [] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
