import { redis } from "../config/redis.js";
import crypto from "crypto";

export const acquireLock = async (key, ttlSeconds = 10) => {
  const token = crypto.randomUUID();

  const result = await redis.set(key, token, {
    nx: true,
    ex: ttlSeconds,
  });
  if (!result) return null;

  return token;
};

export const releaseLock = async (key, token) => {
  const script = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  else
    return 0
  end
`;
  await redis.eval(script, [key], [token]);
};
