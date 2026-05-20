import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  // Global timeout — soak test overrides internally via test.setTimeout()
  timeout: 10 * 60 * 1000,
  use: {
    headless: true,
    baseURL: 'http://localhost:3000',
    launchOptions: {
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        '--no-sandbox',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
    timeout: 30_000,
  },
  outputDir: 'test-results',
})
