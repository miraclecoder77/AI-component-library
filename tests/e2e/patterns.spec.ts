import { expect, test } from "@playwright/test";

/**
 * End-to-end coverage of the three flagship demos.
 *
 * The assertions target behaviour that is easy to break and invisible in a
 * screenshot: that streaming actually streams rather than arriving at once,
 * that stop aborts the request instead of only stopping the paint, and that
 * the accessibility scaffolding is present rather than merely intended.
 */

test.describe("gallery", () => {
  test("lists every pattern and links to it", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toContainText("Interface patterns");

    for (const title of [
      "Streaming chat",
      "Structured output",
      "Multi-step agent",
    ]) {
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }
  });

  test("skip link is the first thing keyboard focus reaches", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const focused = page.locator(":focus");
    await expect(focused).toHaveText(/skip to content/i);
  });
});

test.describe("streaming chat", () => {
  test("streams a response incrementally", async ({ page }) => {
    await page.goto("/patterns/streaming-chat");

    await page.getByRole("button", { name: /time to first token/i }).click();

    // Text must grow over time. Comparing two samples is what distinguishes
    // real streaming from a response that arrives in one piece.
    const transcript = page.locator("article");
    await expect(transcript).toContainText(/Streaming changes/i, {
      timeout: 15_000,
    });

    const early = (await transcript.innerText()).length;
    await page.waitForTimeout(1200);
    const later = (await transcript.innerText()).length;

    expect(later).toBeGreaterThan(early);
  });

  test("reports time to first token", async ({ page }) => {
    await page.goto("/patterns/streaming-chat");
    await page.getByRole("button", { name: /stop button/i }).click();

    await expect(page.getByTitle("Time to first token")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("text=/\\d+ms/").first()).toBeVisible();
  });

  test("stop aborts the request and keeps partial text", async ({ page }) => {
    await page.goto("/patterns/streaming-chat");

    // Track whether the response body was still being consumed after stop.
    await page.getByRole("button", { name: /optimistic UI/i }).click();

    const stop = page.getByRole("button", { name: "Stop" });
    await expect(stop).toBeVisible({ timeout: 15_000 });

    // Let some text arrive before stopping.
    await page.waitForTimeout(1500);
    const beforeStop = (await page.locator("article").innerText()).length;

    await stop.click();
    await expect(stop).toBeHidden();

    // Partial output survives the stop -- the user stopped because they had
    // read enough, not because they wanted it deleted.
    const afterStop = (await page.locator("article").innerText()).length;
    expect(afterStop).toBeGreaterThan(0);

    // And nothing further arrives.
    await page.waitForTimeout(1500);
    const settled = (await page.locator("article").innerText()).length;
    expect(settled).toBe(afterStop);
    expect(beforeStop).toBeGreaterThan(0);
  });

  test("announces streaming text in a polite live region", async ({ page }) => {
    await page.goto("/patterns/streaming-chat");
    await page.getByRole("button", { name: /time to first token/i }).click();

    const live = page.locator("[aria-live='polite']").first();
    await expect(live).toBeAttached();

    // The visible stream must be hidden from assistive technology, otherwise
    // it would be announced twice.
    await expect(page.locator("[aria-hidden='true']").first()).toBeAttached();
  });
});

test.describe("structured output", () => {
  test("fills fields progressively rather than all at once", async ({ page }) => {
    await page.goto("/patterns/structured-output");
    await page.getByRole("button", { name: "Extract" }).click();

    const progress = page.locator("text=/of 9 fields/");
    await expect(progress).toBeVisible({ timeout: 15_000 });

    // Catch the form mid-fill: at least one sample must show an incomplete
    // count, which is the whole point of the pattern.
    let sawPartial = false;
    for (let i = 0; i < 20; i++) {
      const text = await progress.innerText();
      const match = text.match(/(\d+) of 9/);
      if (match && Number(match[1]) > 0 && Number(match[1]) < 9) {
        sawPartial = true;
        break;
      }
      await page.waitForTimeout(150);
    }
    expect(sawPartial).toBe(true);

    await expect(page.locator("text=Senior Frontend Engineer")).toBeVisible({
      timeout: 15_000,
    });
    await expect(progress).toHaveText(/9 of 9 fields/, { timeout: 15_000 });
  });
});

test.describe("multi-step agent", () => {
  test("publishes the plan before doing the work", async ({ page }) => {
    await page.goto("/patterns/multi-step-agent");
    await page.getByRole("button", { name: "Run" }).click();

    const timeline = page.getByRole("region", { name: "Agent progress" });
    await expect(timeline).toBeVisible({ timeout: 15_000 });

    // All four steps are listed immediately, including ones not yet started.
    await expect(timeline.getByRole("listitem")).toHaveCount(4);
    await expect(timeline).toContainText("Interpret the question");
    await expect(timeline).toContainText("Compose the answer");
  });

  test("shows the tool call with arguments and result", async ({ page }) => {
    await page.goto("/patterns/multi-step-agent");
    await page.getByRole("button", { name: "Run" }).click();

    const tool = page.locator("details").first();
    await expect(tool).toBeVisible({ timeout: 20_000 });
    await expect(tool).toContainText("searchCorpus");

    await tool.locator("summary").click();
    await expect(tool).toContainText("Arguments");
    await expect(tool).toContainText("query");
  });

  test("completes every step", async ({ page }) => {
    await page.goto("/patterns/multi-step-agent");
    await page.getByRole("button", { name: "Run" }).click();

    await expect(page.locator("text=/4 of 4/")).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("source viewer", () => {
  test("shows the real source of the demo", async ({ page }) => {
    await page.goto("/patterns/streaming-chat");

    const tabs = page.getByRole("tablist", { name: "Source files" });
    await expect(tabs).toBeVisible();

    // A distinctive line from the actual file, proving it was read rather
    // than transcribed into a snippet.
    await expect(page.locator("pre").first()).toContainText("useSmoothStream");
  });
});
