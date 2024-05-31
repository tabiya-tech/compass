import { test, expect } from "@playwright/test";

test.describe('Home page', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the page before each test
    await page.goto('https://compass-frontend-dev-418218-6a5e4c1.storage.googleapis.com/newUI/index.html');
  });

  test('should have the correct title', async ({ page }) => {
    // Expect the page title to contain a specific substring
    await expect(page).toHaveTitle("Compass by Tabiya");
  });

  test('should display the welcome heading', async ({ page }) => {
    // Expect the heading to be visible
    await expect(page.getByRole('heading', { name: 'Welcome to Tabiya Compass!' })).toBeVisible();
  });

});