import crypto from "node:crypto";
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
type FileLockMetadata = {
  ownerId: string;
  pid: number;
  bootId: string;
  acquiredAt: number;
  updatedAt: number;
};

const fileStateQueues = new Map<string, Promise<void>>();
const processLockOwnerNonce =
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");
let bootIdPromise: Promise<string> | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProcessAlive(pid: unknown) {
  const normalizedPid = Number(pid);
  if (!Number.isInteger(normalizedPid) || normalizedPid <= 0) return false;
  try {
    process.kill(normalizedPid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException | null)?.code === "EPERM";
  }
}

async function resolveCurrentBootId() {
  if (!bootIdPromise) {
    bootIdPromise = fs
      .readFile("/proc/sys/kernel/random/boot_id", "utf8")
      .then((raw) => String(raw || "").trim())
      .catch(() => "");
  }
  return bootIdPromise;
}

async function readFileLockMetadata(lockPath: string) {
  const [raw, stats] = await Promise.all([
    fs.readFile(lockPath, "utf8").catch(() => ""),
    fs.stat(lockPath).catch(() => null),
  ]);
  if (!raw.trim()) {
    return {
      ownerId: "",
      pid: 0,
      bootId: "",
      acquiredAt: 0,
      updatedAt: 0,
      fileMtimeMs: Number(stats?.mtimeMs || 0),
    };
  }
  try {
    const parsed = JSON.parse(raw);
    const metadata =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    return {
      ownerId: String(metadata.ownerId || "").trim(),
      pid: Number.isFinite(Number(metadata.pid)) ? Math.floor(Number(metadata.pid)) : 0,
      bootId: String(metadata.bootId || "").trim(),
      acquiredAt: Number.isFinite(Number(metadata.acquiredAt))
        ? Math.floor(Number(metadata.acquiredAt))
        : 0,
      updatedAt: Number.isFinite(Number(metadata.updatedAt))
        ? Math.floor(Number(metadata.updatedAt))
        : 0,
      fileMtimeMs: Number(stats?.mtimeMs || 0),
    };
  } catch {
    return {
      ownerId: "",
      pid: 0,
      bootId: "",
      acquiredAt: 0,
      updatedAt: 0,
      fileMtimeMs: Number(stats?.mtimeMs || 0),
    };
  }
}

async function canStealFileLock(lockPath: string, staleLockAgeMs: number, currentBootId: string) {
  const metadata = await readFileLockMetadata(lockPath);
  const now = Date.now();
  const lastUpdatedMs =
    metadata.updatedAt > 0
      ? metadata.updatedAt
      : metadata.acquiredAt > 0
        ? metadata.acquiredAt
        : metadata.fileMtimeMs;
  if (!lastUpdatedMs) return true;
  if (now - lastUpdatedMs < staleLockAgeMs) return false;
  const sameBoot = Boolean(currentBootId && metadata.bootId && currentBootId === metadata.bootId);
  if (sameBoot && isProcessAlive(metadata.pid)) {
    return false;
  }
  return true;
}

async function acquireFileStateLock(resolvedFilePath: string, timeoutMs = 5000) {
  const lockPath = `${resolvedFilePath}.lock`;
  await fs.mkdir(path.dirname(lockPath), { recursive: true, mode: 0o700 });
  const startedAt = Date.now();
  const staleLockAgeMs = Math.max(timeoutMs * 2, 5000);
  const bootId = await resolveCurrentBootId();
  const ownerId = `${process.pid}:${bootId || "unknown"}:${processLockOwnerNonce}`;
  while (true) {
    try {
      const handle = await fs.open(lockPath, "wx", 0o600);
      const now = Date.now();
      const metadata: FileLockMetadata = {
        ownerId,
        pid: process.pid,
        bootId,
        acquiredAt: now,
        updatedAt: now,
      };
      await handle.writeFile(JSON.stringify(metadata, null, 2));
      await handle.sync().catch(() => {});
      let released = false;
      const heartbeatMs = Math.max(250, Math.floor(timeoutMs / 2));
      const heartbeatTimer = setInterval(async () => {
        if (released) return;
        metadata.updatedAt = Date.now();
        try {
          await handle.truncate(0);
          await handle.writeFile(JSON.stringify(metadata, null, 2));
          await handle.sync();
        } catch {
          // Best-effort heartbeat only.
        }
      }, heartbeatMs);
      heartbeatTimer.unref?.();
      return async () => {
        released = true;
        clearInterval(heartbeatTimer);
        await handle.close().catch(() => {});
        await fs.unlink(lockPath).catch(() => {});
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException | null)?.code !== "EEXIST") {
        throw error;
      }
      if (await canStealFileLock(lockPath, staleLockAgeMs, bootId)) {
        await fs.unlink(lockPath).catch(() => {});
        continue;
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
  await fs.mkdir(path.dirname(resolvedFilePath), { recursive: true, mode: 0o700 });
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
  await fs.mkdir(path.dirname(resolvedFilePath), { recursive: true, mode: 0o700 });
  const tempFilePath = `${resolvedFilePath}.tmp`;
  await fs.writeFile(tempFilePath, JSON.stringify(state, null, 2), { mode: 0o600 });
  await fs.rename(tempFilePath, resolvedFilePath);
  await fs.chmod(resolvedFilePath, 0o600).catch(() => {});
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
      const revoked = await runWithFileStateQueue(revocationsFile, lockTimeoutMs, async () => {
        const now = Math.floor(Date.now() / 1000);
        const current = await readJsonRecord(revocationsFile);
        const next = pruneRevokedJtiState(current, now);
        const exp = Number.isFinite(Number(input?.exp)) ? Math.floor(Number(input.exp)) : 0;
        next[jti] = exp > now ? exp : now + 1800;
        await writeJsonRecord(revocationsFile, next);
        return true;
      });
      if (revoked && stateFile) {
        await runWithFileStateQueue(stateFile, lockTimeoutMs, async () => {
          const now = Math.floor(Date.now() / 1000);
          const current = await readJsonRecord(stateFile);
          const next = pruneSessionStateByAbsoluteTtl(current, now);
          if (Object.prototype.hasOwnProperty.call(next, jti)) {
            delete next[jti];
            await writeJsonRecord(stateFile, next);
          } else if (Object.keys(next).length !== Object.keys(current).length) {
            await writeJsonRecord(stateFile, next);
          }
        });
      }
      return revoked;
    },
  };
}
