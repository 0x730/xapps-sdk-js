import type { HostBootstrapConsumeJti, HostSessionStore } from "./options.js";

export type RedisLikeClient = {
  set: (...args: unknown[]) => unknown | Promise<unknown>;
  get: (key: string) => unknown | Promise<unknown>;
  del: (...keys: string[]) => unknown | Promise<unknown>;
  eval?: (...args: unknown[]) => unknown | Promise<unknown>;
};

export type RedisHostBootstrapReplayConsumerConfig = {
  client?: RedisLikeClient | null;
  keyPrefix?: string | null;
  fallbackTtlSeconds?: number;
  graceSeconds?: number;
};

export type RedisHostSessionStoreConfig = {
  client?: RedisLikeClient | null;
  keyPrefix?: string | null;
  graceSeconds?: number;
};

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function normalizePrefix(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .replace(/:+$/, "");
  return normalized || "xapps:host";
}

function normalizePositiveInteger(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const normalized = Math.floor(numeric);
  return normalized > 0 ? normalized : fallback;
}

function isRedisWriteOk(value: unknown) {
  if (value === true || value === 1) return true;
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  return normalized === "OK";
}

function asString(value: unknown) {
  return value == null ? "" : String(value);
}

function buildBootstrapReplayKey(prefix: string, jti: string) {
  return `${prefix}:bootstrap:jti:${jti}`;
}

function buildSessionStateKey(prefix: string, jti: string) {
  return `${prefix}:session:state:${jti}`;
}

function buildSessionRevokedKey(prefix: string, jti: string) {
  return `${prefix}:session:revoked:${jti}`;
}

const TOUCH_SESSION_STATE_LUA = `
if redis.call("GET", KEYS[2]) then
  redis.call("DEL", KEYS[1])
  return 0
end
local raw = redis.call("GET", KEYS[1])
if (not raw) or raw == "" then
  return 0
end
local ok, state = pcall(cjson.decode, raw)
if (not ok) or type(state) ~= "table" then
  redis.call("DEL", KEYS[1])
  return 0
end
local now = tonumber(ARGV[1]) or 0
local idle_ttl = tonumber(ARGV[2]) or 0
local grace = tonumber(ARGV[3]) or 0
local absolute_expires_at = tonumber(state.absoluteExpiresAt or 0) or 0
local idle_expires_at = tonumber(state.idleExpiresAt or 0) or 0
if absolute_expires_at <= now or idle_expires_at <= now then
  redis.call("DEL", KEYS[1])
  return 0
end
state.idleExpiresAt = math.min(absolute_expires_at, now + idle_ttl)
local ttl = math.max(1, (absolute_expires_at - now) + grace)
redis.call("SET", KEYS[1], cjson.encode(state), "EX", ttl)
if redis.call("GET", KEYS[2]) then
  redis.call("DEL", KEYS[1])
  return 0
end
return 1
`;

const REVOKE_SESSION_STATE_LUA = `
local exp = tonumber(ARGV[1]) or 0
local now = tonumber(ARGV[2]) or 0
local grace = tonumber(ARGV[3]) or 0
local fallback_ttl = tonumber(ARGV[4]) or 1800
local ttl = math.max(1, ((exp > now) and (exp - now) or fallback_ttl) + grace)
redis.call("SET", KEYS[1], tostring(exp), "EX", ttl)
redis.call("DEL", KEYS[2])
return 1
`;

async function redisSetWithEx(
  client: RedisLikeClient,
  key: string,
  value: string,
  ttlSeconds: number,
) {
  try {
    const result = await client.set(key, value, { EX: ttlSeconds });
    if (result === undefined || result === null) return true;
    return isRedisWriteOk(result);
  } catch {
    const result = await client.set(key, value, "EX", ttlSeconds);
    if (result === undefined || result === null) return true;
    return isRedisWriteOk(result);
  }
}

async function redisSetWithNxEx(
  client: RedisLikeClient,
  key: string,
  value: string,
  ttlSeconds: number,
) {
  try {
    const result = await client.set(key, value, { NX: true, EX: ttlSeconds });
    return isRedisWriteOk(result);
  } catch {
    const result = await client.set(key, value, "EX", ttlSeconds, "NX");
    return isRedisWriteOk(result);
  }
}

function isRedisEvalSuccess(value: unknown) {
  if (value === true) return true;
  if (Number.isFinite(Number(value)) && Number(value) === 1) return true;
  return (
    String(value || "")
      .trim()
      .toUpperCase() === "OK"
  );
}

async function redisEval(
  client: RedisLikeClient,
  script: string,
  keys: string[],
  args: Array<string | number>,
) {
  const evalFn = typeof client.eval === "function" ? client.eval.bind(client) : null;
  if (!evalFn) {
    throw new Error("Redis eval is not supported by the configured client");
  }
  const normalizedArgs = args.map((entry) => String(entry));
  let lastError: unknown = null;
  try {
    return await evalFn(script, { keys, arguments: normalizedArgs });
  } catch (error) {
    lastError = error;
  }
  try {
    return await evalFn(script, keys.length, ...keys, ...normalizedArgs);
  } catch (error) {
    lastError = error;
  }
  try {
    return await evalFn(script, [...keys, ...normalizedArgs], keys.length);
  } catch (error) {
    lastError = error;
  }
  throw lastError ?? new Error("Redis eval failed");
}

export function createRedisHostBootstrapReplayConsumer(
  config: RedisHostBootstrapReplayConsumerConfig = {},
) {
  const client = config.client || null;
  const keyPrefix = normalizePrefix(config.keyPrefix);
  const fallbackTtlSeconds = normalizePositiveInteger(config.fallbackTtlSeconds, 300);
  const graceSeconds = normalizePositiveInteger(config.graceSeconds, 60);

  return async (input: Parameters<HostBootstrapConsumeJti>[0]) => {
    const jti = asString(input?.jti).trim();
    if (!client || !jti) return false;
    const now = nowSeconds();
    const exp = Number.isFinite(Number(input?.exp)) ? Math.floor(Number(input?.exp)) : 0;
    const ttlSeconds = Math.max(1, (exp > now ? exp - now : fallbackTtlSeconds) + graceSeconds);
    return await redisSetWithNxEx(
      client,
      buildBootstrapReplayKey(keyPrefix, jti),
      String(exp),
      ttlSeconds,
    );
  };
}

export function createRedisHostSessionStore(
  config: RedisHostSessionStoreConfig = {},
): HostSessionStore {
  const client = config.client || null;
  const keyPrefix = normalizePrefix(config.keyPrefix);
  const graceSeconds = normalizePositiveInteger(config.graceSeconds, 60);

  return {
    async activate(input: Parameters<NonNullable<HostSessionStore["activate"]>>[0]) {
      const jti = asString(input?.jti).trim();
      const idleTtlSeconds = normalizePositiveInteger(input?.idleTtlSeconds, 0);
      const exp = Number.isFinite(Number(input?.exp)) ? Math.floor(Number(input?.exp)) : 0;
      if (!client || !jti || idleTtlSeconds <= 0 || exp <= 0) return false;
      const now = nowSeconds();
      const idleExpiresAt = Math.min(exp, now + idleTtlSeconds);
      const ttlSeconds = Math.max(1, exp - now + graceSeconds);
      const payload = JSON.stringify({
        subjectId: asString(input?.subjectId).trim() || null,
        absoluteExpiresAt: exp,
        idleExpiresAt,
      });
      return await redisSetWithEx(
        client,
        buildSessionStateKey(keyPrefix, jti),
        payload,
        ttlSeconds,
      );
    },
    async touch(input: Parameters<NonNullable<HostSessionStore["touch"]>>[0]) {
      const jti = asString(input?.jti).trim();
      const idleTtlSeconds = normalizePositiveInteger(input?.idleTtlSeconds, 0);
      if (!client || !jti || idleTtlSeconds <= 0) return false;
      const stateKey = buildSessionStateKey(keyPrefix, jti);
      const revokedKey = buildSessionRevokedKey(keyPrefix, jti);
      try {
        const result = await redisEval(
          client,
          TOUCH_SESSION_STATE_LUA,
          [stateKey, revokedKey],
          [nowSeconds(), idleTtlSeconds, graceSeconds],
        );
        return isRedisEvalSuccess(result);
      } catch {
        if (asString(await client.get(revokedKey)).trim()) {
          await client.del(stateKey);
          return false;
        }
        const stateRaw = asString(await client.get(stateKey)).trim();
        if (!stateRaw) return false;
        let state: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(stateRaw);
          state =
            parsed && typeof parsed === "object" && !Array.isArray(parsed)
              ? (parsed as Record<string, unknown>)
              : {};
        } catch {
          await client.del(stateKey);
          return false;
        }
        const now = nowSeconds();
        const absoluteExpiresAt = Number.isFinite(Number(state.absoluteExpiresAt))
          ? Math.floor(Number(state.absoluteExpiresAt))
          : 0;
        const currentIdleExpiresAt = Number.isFinite(Number(state.idleExpiresAt))
          ? Math.floor(Number(state.idleExpiresAt))
          : 0;
        if (absoluteExpiresAt <= now || currentIdleExpiresAt <= now) {
          await client.del(stateKey);
          return false;
        }
        const idleExpiresAt = Math.min(absoluteExpiresAt, now + idleTtlSeconds);
        const ttlSeconds = Math.max(1, absoluteExpiresAt - now + graceSeconds);
        const payload = JSON.stringify({
          subjectId: asString(state.subjectId).trim() || null,
          absoluteExpiresAt,
          idleExpiresAt,
        });
        if (asString(await client.get(revokedKey)).trim()) {
          await client.del(stateKey);
          return false;
        }
        const touched = await redisSetWithEx(client, stateKey, payload, ttlSeconds);
        if (!touched) return false;
        if (asString(await client.get(revokedKey)).trim()) {
          await client.del(stateKey);
          return false;
        }
        return true;
      }
    },
    async isRevoked(input: Parameters<NonNullable<HostSessionStore["isRevoked"]>>[0]) {
      const jti = asString(input?.jti).trim();
      if (!client || !jti) return false;
      const value = await client.get(buildSessionRevokedKey(keyPrefix, jti));
      return asString(value).trim() !== "";
    },
    async revoke(input: Parameters<NonNullable<HostSessionStore["revoke"]>>[0]) {
      const jti = asString(input?.jti).trim();
      if (!client || !jti) return false;
      const now = nowSeconds();
      const exp = Number.isFinite(Number(input?.exp)) ? Math.floor(Number(input?.exp)) : 0;
      const revokedKey = buildSessionRevokedKey(keyPrefix, jti);
      const stateKey = buildSessionStateKey(keyPrefix, jti);
      try {
        const result = await redisEval(
          client,
          REVOKE_SESSION_STATE_LUA,
          [revokedKey, stateKey],
          [exp, now, graceSeconds, 1800],
        );
        return isRedisEvalSuccess(result);
      } catch {
        const ttlSeconds = Math.max(1, (exp > now ? exp - now : 1800) + graceSeconds);
        const revoked = await redisSetWithEx(client, revokedKey, String(exp), ttlSeconds);
        await client.del(stateKey);
        return revoked;
      }
    },
  };
}
