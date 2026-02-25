import { redis } from "../config/redis.js";

export const acquireLock = async (key, ttlSeconds = 5) => {
  return await redis.set(key, "locked", {
    nx: true,
    ex: ttlSeconds,
  });
};

export const releaseLock = async (key) => {
  await redis.del(key);
};
