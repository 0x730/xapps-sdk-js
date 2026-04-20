import fs from "node:fs/promises";
import path from "node:path";
import type { HostBootstrapConsumeJti, HostSessionStore } from "./options.js";

export type FileHostBootstrapReplayConsumerConfig = {
  replayFile?: string | null;
  fallbackTtlSeconds?: number;
  lockTimeoutMs?: number;
};

export type FileHostSessionStoreConfig = {
  stateFile?: string | null;
  revocationsFile?: string | null;
  lockTimeoutMs?: number;
};

type JsonRecord = Record<string, unknown>;

const fileStateQueues = new Map<string, Promise<void>>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireFileStateLock(resolvedFilePath: string, timeoutMs = 5000) {
  const lockPath = `${resolvedFilePath}.lock`;
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  const startedAt = Date.now();
  while (true) {
    try {
      const handle = await fs.open(lockPath, "wx");
      return async () => {
        await handle.close().catch(() => {});
        await fs.unlink(lockPath).catch(() => {});
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException | null)?.code !== "EEXIST") {
        throw error;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error(`Unable to lock host state file: ${resolvedFilePath}`);
      }
      await sleep(25);
    }
  }
}

async function runWithFileStateQueue<T>(
  filePath: string,
  lockTimeoutMs: number,
  work: (resolvedFilePath: string) => Promise<T>,
) {
  const resolvedFilePath = String(filePath || "").trim();
  if (!resolvedFilePath) {
    return await work("");
  }
  const previous = fileStateQueues.get(resolvedFilePath) || Promise.resolve();
  let releaseCurrent: (() => void) | null = null;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  fileStateQueues.set(
    resolvedFilePath,
    previous.then(() => current),
  );
  await previous;
  let releaseLock: null | (() => Promise<void>) = null;
  try {
    releaseLock = await acquireFileStateLock(resolvedFilePath, lockTimeoutMs);
    return await work(resolvedFilePath);
  } finally {
    if (releaseLock) {
      await releaseLock();
    }
    releaseCurrent?.();
    if (fileStateQueues.get(resolvedFilePath) === current) {
      fileStateQueues.delete(resolvedFilePath);
    }
  }
}

async function readJsonRecord(filePath: string) {
  const resolvedFilePath = String(filePath || "").trim();
  if (!resolvedFilePath) return {};
  await fs.mkdir(path.dirname(resolvedFilePath), { recursive: true });
  try {
    const raw = await fs.readFile(resolvedFilePath, "utf8");
    if (!raw.trim()) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonRecord)
      : {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") {
      return {};
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid host state file JSON: ${resolvedFilePath}`);
    }
    throw error;
  }
}

async function writeJsonRecord(filePath: string, state: JsonRecord) {
  const resolvedFilePath = String(filePath || "").trim();
  if (!resolvedFilePath) return;
  await fs.mkdir(path.dirname(resolvedFilePath), { recursive: true });
  const tempFilePath = `${resolvedFilePath}.tmp`;
  await fs.writeFile(tempFilePath, JSON.stringify(state, null, 2));
  await fs.rename(tempFilePath, resolvedFilePath);
}

function pruneRevokedJtiState(current: JsonRecord, now: number) {
  return Object.fromEntries(
    Object.entries(current).filter(([, expiresAt]) => Number(expiresAt) > now),
  );
}

function pruneSessionStateByAbsoluteTtl(current: JsonRecord, now: number) {
  return Object.fromEntries(
    Object.entries(current).filter(
      ([, value]) => Number((value as JsonRecord | null)?.absoluteExpiresAt || 0) > now,
    ),
  );
}

export function createFileHostBootstrapReplayConsumer(
  config: FileHostBootstrapReplayConsumerConfig = {},
) {
  const replayFile = String(config.replayFile || "").trim();
  const fallbackTtlSeconds =
    Number(config.fallbackTtlSeconds) > 0 ? Math.floor(Number(config.fallbackTtlSeconds)) : 300;
  const lockTimeoutMs =
    Number(config.lockTimeoutMs) > 0 ? Math.floor(Number(config.lockTimeoutMs)) : 5000;

  return async (input: Parameters<HostBootstrapConsumeJti>[0]) => {
    const jti = String(input?.jti || "").trim();
    if (!replayFile || !jti) return false;
    return await runWithFileStateQueue(replayFile, lockTimeoutMs, async () => {
      const now = Math.floor(Date.now() / 1000);
      const current = await readJsonRecord(replayFile);
      const next = pruneRevokedJtiState(current, now);
      if (Number(next[jti] || 0) > now) {
        return false;
      }
      const exp = Number.isFinite(Number(input?.exp)) ? Math.floor(Number(input.exp)) : 0;
      next[jti] = exp > now ? exp : now + fallbackTtlSeconds;
      await writeJsonRecord(replayFile, next);
      return true;
    });
  };
}

export function createFileHostSessionStore(
  config: FileHostSessionStoreConfig = {},
): HostSessionStore {
  const stateFile = String(config.stateFile || "").trim();
  const revocationsFile = String(config.revocationsFile || "").trim();
  const lockTimeoutMs =
    Number(config.lockTimeoutMs) > 0 ? Math.floor(Number(config.lockTimeoutMs)) : 5000;

  return {
    async activate(input: Parameters<NonNullable<HostSessionStore["activate"]>>[0]) {
      const jti = String(input?.jti || "").trim();
      const idleTtlSeconds =
        Number(input?.idleTtlSeconds) > 0 ? Math.floor(Number(input.idleTtlSeconds)) : 0;
      const exp = Number.isFinite(Number(input?.exp)) ? Math.floor(Number(input.exp)) : 0;
      if (!stateFile || !jti || idleTtlSeconds <= 0 || exp <= 0) return false;
      return await runWithFileStateQueue(stateFile, lockTimeoutMs, async () => {
        const now = Math.floor(Date.now() / 1000);
        const current = await readJsonRecord(stateFile);
        const next = pruneSessionStateByAbsoluteTtl(current, now);
        next[jti] = {
          subjectId: String(input?.subjectId || "").trim() || null,
          absoluteExpiresAt: exp,
          idleExpiresAt: Math.min(exp, now + idleTtlSeconds),
        };
        await writeJsonRecord(stateFile, next);
        return true;
      });
    },
    async touch(input: Parameters<NonNullable<HostSessionStore["touch"]>>[0]) {
      const jti = String(input?.jti || "").trim();
      const idleTtlSeconds =
        Number(input?.idleTtlSeconds) > 0 ? Math.floor(Number(input.idleTtlSeconds)) : 0;
      if (!stateFile || !jti || idleTtlSeconds <= 0) return false;
      return await runWithFileStateQueue(stateFile, lockTimeoutMs, async () => {
        const now = Math.floor(Date.now() / 1000);
        const current = await readJsonRecord(stateFile);
        const next: JsonRecord = {};
        for (const [entryJti, value] of Object.entries(current)) {
          const absoluteExpiresAt = Number((value as JsonRecord | null)?.absoluteExpiresAt || 0);
          const idleExpiresAt = Number((value as JsonRecord | null)?.idleExpiresAt || 0);
          if (absoluteExpiresAt > now && idleExpiresAt > now) {
            next[entryJti] = value;
          }
        }
        const entry = next[jti];
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          if (Object.keys(next).length !== Object.keys(current).length) {
            await writeJsonRecord(stateFile, next);
          }
          return false;
        }
        next[jti] = {
          ...entry,
          idleExpiresAt: Math.min(
            Number((entry as JsonRecord).absoluteExpiresAt || 0),
            now + idleTtlSeconds,
          ),
        };
        await writeJsonRecord(stateFile, next);
        return true;
      });
    },
    async isRevoked(input: Parameters<NonNullable<HostSessionStore["isRevoked"]>>[0]) {
      const jti = String(input?.jti || "").trim();
      if (!revocationsFile || !jti) return false;
      return await runWithFileStateQueue(revocationsFile, lockTimeoutMs, async () => {
        const now = Math.floor(Date.now() / 1000);
        const current = await readJsonRecord(revocationsFile);
        const next = pruneRevokedJtiState(current, now);
        if (Object.keys(next).length !== Object.keys(current).length) {
          await writeJsonRecord(revocationsFile, next);
        }
        return Number(next[jti] || 0) > now;
      });
    },
    async revoke(input: Parameters<NonNullable<HostSessionStore["revoke"]>>[0]) {
      const jti = String(input?.jti || "").trim();
      if (!revocationsFile || !jti) return false;
      return await runWithFileStateQueue(revocationsFile, lockTimeoutMs, async () => {
        const now = Math.floor(Date.now() / 1000);
        const current = await readJsonRecord(revocationsFile);
        const next = pruneRevokedJtiState(current, now);
        const exp = Number.isFinite(Number(input?.exp)) ? Math.floor(Number(input.exp)) : 0;
        next[jti] = exp > now ? exp : now + 1800;
        await writeJsonRecord(revocationsFile, next);
        return true;
      });
    },
  };
}
