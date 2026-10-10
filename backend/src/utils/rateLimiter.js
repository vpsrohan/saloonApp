import { redis } from "../config/redis.js";

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 10;

export const rateLimiter = async (req, res, next) => {
  try {
    const key = `rate_limit:chat:${req.ip}`;

    const currentCount = await redis.incr(key);

    if (currentCount === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    if (currentCount > MAX_REQUESTS) {
      return res.status(429).json({
        message: "Too many requests. Please try again later.",
      });
    }

    next();
  } catch (error) {
    console.error("Rate limiter error:", error);

    // Don't take the entire chat service down
    // if Redis itself has a problem.
    next();
  }
};
