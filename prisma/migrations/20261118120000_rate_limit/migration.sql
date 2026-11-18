-- Request counters for rate limiting the public forms and endpoints (src/lib/rate-limit.ts).
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");
