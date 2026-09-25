export interface RateLimiterOptions {
  readonly windowMs: number;
  readonly maxRequests: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetTime: number;
}

export class InMemoryRateLimiter {
  private readonly hits = new Map<string, { count: number; resetTime: number }>();

  constructor(private readonly options: RateLimiterOptions = { windowMs: 60_000, maxRequests: 100 }) {}

  consume(key: string): RateLimitResult {
    const now = Date.now();
    const entry = this.hits.get(key);

    if (!entry || now > entry.resetTime) {
      const resetTime = now + this.options.windowMs;
      this.hits.set(key, { count: 1, resetTime });
      return {
        allowed: true,
        remaining: this.options.maxRequests - 1,
        resetTime,
      };
    }

    if (entry.count >= this.options.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    entry.count += 1;
    return {
      allowed: true,
      remaining: this.options.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  clear(): void {
    this.hits.clear();
  }
}
