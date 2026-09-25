// Test-only endpoints used by the Playwright/live-server tests to create
// fixtures without going through signup or email verification. They 404
// unless LINKLY_ENABLE_TEST_API=true, and never work in production.
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import type { CreateTestUser } from "wasp/server/api";
import { createProviderId, createUser, sanitizeAndSerializeProviderData } from "wasp/server/auth";

function testApiEnabled(): boolean {
  return process.env.LINKLY_ENABLE_TEST_API === "true" && process.env.NODE_ENV !== "production";
}

export const createTestUser: CreateTestUser = async (req: Request, res: Response) => {
  if (!testApiEnabled()) {
    res.status(404).json({ error: { code: "not_found", message: "Not found." } });
    return;
  }
  const email = (typeof req.body?.email === "string" && req.body.email) || `user-${randomUUID()}@example.com`;
  const password = (typeof req.body?.password === "string" && req.body.password) || "test-password-123";

  const providerData = await sanitizeAndSerializeProviderData<"email">({
    hashedPassword: password,
    isEmailVerified: true,
    emailVerificationSentAt: null,
    passwordResetSentAt: null,
  });
  const user = await createUser(createProviderId("email", email), providerData, {});
  res.json({ userId: user.id, email, password });
};
