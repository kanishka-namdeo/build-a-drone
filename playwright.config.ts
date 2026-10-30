import { defineConfig, devices } from '@playwright/test';

/**
 * Drone Lab end-to-end test configuration.
 *
 * The webServer builds the app once and serves the production bundle with
 * `vite preview` on http://localhost:4173. tests/e2e/ holds the specs.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  use: {
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
