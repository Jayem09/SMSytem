import { test, expect } from '@playwright/test';

// Regression test for Analytics Q&A path.
// Ensures clicking a question renders an answer after the 1.0.9 fix and does not regress.
test.describe('Analytics Q&A Regression', () => {
  test('Clicking a QA question renders its answer (regression test for 1.0.9 fix)', async ({ page }) => {
    // Navigate to Analytics page
    await page.goto('/analytics');

    // Ensure QA section is present
    const questionSelector = '[data-testid="qa-question"]';
    await page.waitForSelector(questionSelector);

    // Intercept the API call for Q&A and provide a mocked successful payload
    const apiEndpoint = '**/api/analytics/qna';
    await page.route(apiEndpoint, async (route) => {
      const mockBody = {
        question: 'What is the metric for active users?',
        // The 1.0.9 fix makes answer extraction more robust, ensure we return a string
        answer: 'Active users are counted as unique logins within 24 hours.'
      };
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockBody)
      });
    });

    // Click the first QA question
    const firstQuestion = page.locator(questionSelector).first();
    await firstQuestion.click();

    // Wait for the API call and verify we received an answer
    const response = await page.waitForResponse((resp) => resp.url().includes('/api/analytics/qna') && resp.status() === 200);
    const data = await response.json();
    expect(data).toHaveProperty('answer');

    // Verify the answer is rendered in the UI
    const answerSelector = '[data-testid="qa-answer"]';
    await expect(page.locator(answerSelector)).toBeVisible();
    await expect(page.locator(answerSelector)).toHaveText(data.answer);
  });
});
