import assert from "node:assert/strict";
import { test } from "node:test";
import { SlidingWindowLimiter, clientKey } from "../lib/rate-limit.ts";

/**
 * The limiter exists to keep our own requests under Gemini's ceiling, so the
 * properties that matter are that it stops at the limit, reports a usable
 * retry hint, and lets requests through again once the window slides.
 */

test("allows requests up to the limit", () => {
  const limiter = new SlidingWindowLimiter(3, 60_000);

  assert.equal(limiter.check("a").ok, true);
  assert.equal(limiter.check("a").ok, true);

  const third = limiter.check("a");
  assert.equal(third.ok, true);
  assert.equal(third.remaining, 0);
});

test("blocks past the limit and reports a retry delay", () => {
  const limiter = new SlidingWindowLimiter(2, 60_000);
  limiter.check("a");
  limiter.check("a");

  const blocked = limiter.check("a");
  assert.equal(blocked.ok, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterS > 0, "retryAfterS should be positive");
  assert.ok(blocked.retryAfterS <= 60, "retryAfterS should be within the window");
});

test("keys are independent", () => {
  const limiter = new SlidingWindowLimiter(1, 60_000);

  assert.equal(limiter.check("a").ok, true);
  assert.equal(limiter.check("a").ok, false);
  // A different visitor is unaffected by the first one's usage.
  assert.equal(limiter.check("b").ok, true);
});

test("lets requests through again once the window slides", async () => {
  const limiter = new SlidingWindowLimiter(1, 120);
  assert.equal(limiter.check("a").ok, true);
  assert.equal(limiter.check("a").ok, false);

  await new Promise((resolve) => setTimeout(resolve, 160));

  assert.equal(limiter.check("a").ok, true, "window should have slid");
});

test("clientKey prefers the leftmost forwarded address", () => {
  const request = new Request("http://localhost/api/chat", {
    headers: { "x-forwarded-for": "203.0.113.5, 70.41.3.18" },
  });
  assert.equal(clientKey(request), "203.0.113.5");
});

test("clientKey falls back when no forwarding header is present", () => {
  const request = new Request("http://localhost/api/chat");
  assert.equal(clientKey(request), "unknown");
});
