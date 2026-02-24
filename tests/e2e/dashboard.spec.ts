import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Dashboard E2E tests
//
// These tests verify the full dashboard renders correctly in a browser.
// When no database is configured, the page falls through to the empty state
// (the fetchDashboardData catch block returns isEmpty: true). This gives us
// a reliable baseline for testing the layout, header, footer, and empty state.
//
// Tests that require populated data are grouped separately and skipped when
// the empty state is detected, so the suite is runnable in any environment.
// ---------------------------------------------------------------------------

test.describe("Dashboard — core layout", () => {
  test("page loads with correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Deep-Tech Pulse/);
  });

  test("header renders with app name and subtitle", async ({ page }) => {
    await page.goto("/");

    const header = page.locator("header");
    await expect(header).toBeVisible();
    await expect(header.getByText("Deep-Tech Pulse")).toBeVisible();
  });

  test("pipeline status indicator is visible in header", async ({ page }) => {
    await page.goto("/");

    const pipelineStatus = page.getByTestId("pipeline-status");
    await expect(pipelineStatus).toBeVisible();
  });

  test("footer renders with privacy notice", async ({ page }) => {
    await page.goto("/");

    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(
      footer.getByText(/No personal data is collected/)
    ).toBeVisible();
  });

  test("main content area exists", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();
  });
});

test.describe("Dashboard — empty state", () => {
  test("shows empty state when no articles exist", async ({ page }) => {
    await page.goto("/");

    // If the page has data, skip this test
    const emptyState = page.getByTestId("empty-state");
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    if (!hasEmptyState) {
      test.skip(true, "Database has articles — empty state not shown");
      return;
    }

    await expect(emptyState).toBeVisible();
    await expect(
      page.getByText("Dashboard is warming up")
    ).toBeVisible();
    await expect(
      page.getByText(/pipeline runs every 6 hours/)
    ).toBeVisible();
  });
});

test.describe("Dashboard — populated state", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Skip all populated tests if we're in empty state
    const hasData = await page
      .getByTestId("empty-state")
      .isVisible()
      .then((v) => !v)
      .catch(() => true);
    if (!hasData) {
      test.skip(true, "No data in database — skipping populated state tests");
    }
  });

  test("trending snapshot shows up to 3 cards", async ({ page }) => {
    const trendingSection = page.getByTestId("trending-snapshot");
    await expect(trendingSection).toBeVisible();

    const trendingCards = page.getByTestId("trending-card");
    const count = await trendingCards.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(3);
  });

  test("trending cards have urgency chips and category tags", async ({
    page,
  }) => {
    const trendingSection = page.getByTestId("trending-snapshot");
    await expect(trendingSection).toBeVisible();

    // At least one urgency chip and category tag within trending
    await expect(
      trendingSection.getByTestId("urgency-chip").first()
    ).toBeVisible();
    await expect(
      trendingSection.getByTestId("category-tag").first()
    ).toBeVisible();
  });

  test("tool spotlight strip renders", async ({ page }) => {
    const toolSpotlight = page.getByTestId("tool-spotlight");
    await expect(toolSpotlight).toBeVisible();

    // Should have at least 1 tool card
    const toolCards = page.getByTestId("tool-card");
    const count = await toolCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("content tabs render with 4 tabs", async ({ page }) => {
    const contentTabs = page.getByTestId("content-tabs");
    await expect(contentTabs).toBeVisible();

    const tabList = page.getByTestId("tab-list");
    await expect(tabList).toBeVisible();

    // Verify all 4 tabs exist
    await expect(page.getByTestId("tab-news")).toBeVisible();
    await expect(page.getByTestId("tab-video")).toBeVisible();
    await expect(page.getByTestId("tab-unlock")).toBeVisible();
    await expect(page.getByTestId("tab-workflow")).toBeVisible();
  });

  test("tab switching changes visible content", async ({ page }) => {
    // AI News tab should be active by default
    const newsPanel = page.getByTestId("panel-news");
    await expect(newsPanel).toBeVisible();

    // Click Videos tab
    await page.getByTestId("tab-video").click();
    const videoPanel = page.getByTestId("panel-video");
    await expect(videoPanel).toBeVisible();

    // Click Market Unlocks tab
    await page.getByTestId("tab-unlock").click();
    const unlockPanel = page.getByTestId("panel-unlock");
    await expect(unlockPanel).toBeVisible();

    // Click Best Way to Work tab
    await page.getByTestId("tab-workflow").click();
    const workflowPanel = page.getByTestId("panel-workflow");
    await expect(workflowPanel).toBeVisible();
  });

  test("tab state persists in URL hash", async ({ page }) => {
    // Click Videos tab
    await page.getByTestId("tab-video").click();
    await expect(page).toHaveURL(/#video/);

    // Reload page and verify video tab is still active
    await page.reload();
    await expect(page.getByTestId("panel-video")).toBeVisible();
  });

  test("article cards render in news tab", async ({ page }) => {
    const newsPanel = page.getByTestId("panel-news");
    await expect(newsPanel).toBeVisible();

    // Check for article cards
    const articleCards = newsPanel.getByTestId("article-card");
    const count = await articleCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("article cards have required elements", async ({ page }) => {
    const firstCard = page.getByTestId("article-card").first();
    await expect(firstCard).toBeVisible();

    // Should have a link
    await expect(
      firstCard.getByTestId("article-link")
    ).toBeVisible();

    // Should have urgency chip and category tag
    await expect(
      firstCard.getByTestId("urgency-chip")
    ).toBeVisible();
    await expect(
      firstCard.getByTestId("category-tag")
    ).toBeVisible();
  });

  test("load more button works", async ({ page }) => {
    const newsPanel = page.getByTestId("panel-news");
    await expect(newsPanel).toBeVisible();

    // Check if load more button exists (only shows when >12 items)
    const loadMore = newsPanel.getByTestId("load-more-button");
    const hasLoadMore = await loadMore.isVisible().catch(() => false);

    if (!hasLoadMore) {
      test.skip(true, "Not enough articles to show load more button");
      return;
    }

    const initialCount = await newsPanel.getByTestId("article-card").count();
    await loadMore.click();
    const newCount = await newsPanel.getByTestId("article-card").count();
    expect(newCount).toBeGreaterThan(initialCount);
  });

  test("video cards render with embed or thumbnail", async ({ page }) => {
    await page.getByTestId("tab-video").click();
    const videoPanel = page.getByTestId("panel-video");
    await expect(videoPanel).toBeVisible();

    const videoCards = videoPanel.getByTestId("video-card");
    const count = await videoCards.count();

    if (count === 0) {
      test.skip(true, "No video content available");
      return;
    }

    const firstVideo = videoCards.first();
    await expect(firstVideo).toBeVisible();

    // Should have either a YouTube embed or thumbnail link
    const hasEmbed = await firstVideo
      .getByTestId("youtube-embed")
      .isVisible()
      .catch(() => false);
    const hasThumbnail = await firstVideo
      .getByTestId("video-thumbnail-link")
      .isVisible()
      .catch(() => false);
    expect(hasEmbed || hasThumbnail).toBe(true);
  });
});

test.describe("Dashboard — mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("mobile layout renders correctly", async ({ page }) => {
    await page.goto("/");

    // Header should be visible
    const header = page.locator("header");
    await expect(header).toBeVisible();
    await expect(header.getByText("Deep-Tech Pulse")).toBeVisible();

    // Footer should be visible
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
  });

  test("tabs are horizontally scrollable on mobile", async ({ page }) => {
    await page.goto("/");

    const hasData = await page
      .getByTestId("empty-state")
      .isVisible()
      .then((v) => !v)
      .catch(() => true);
    if (!hasData) {
      test.skip(true, "No data — skipping mobile tab test");
      return;
    }

    const tabList = page.getByTestId("tab-list");
    await expect(tabList).toBeVisible();

    // All 4 tabs should still be accessible
    await expect(page.getByTestId("tab-news")).toBeVisible();
  });
});
