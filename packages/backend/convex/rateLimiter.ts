import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";

import { components } from "./_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
	// Auth: 10 failed login attempts per hour per user
	failedLogins: { kind: "token bucket", rate: 10, period: HOUR },

	// API: 60 requests per minute per user
	apiRequests: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 10 },

	// Global: 100 sign-ups per hour
	signUp: { kind: "fixed window", rate: 100, period: HOUR },
});
