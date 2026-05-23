import { head, put } from "@vercel/blob";
import { createHash } from "node:crypto";
import { cleanViewerId } from "./quotaStore.js";

const METRICS_PATH = "chuangbian/metrics-index.json";
const MIN_VISIBLE_UV = 78;
const FIVE_MINUTES = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const memoryMetrics = {
  days: {}
};

export async function trackTodayMemeVisit({ ip = "", userAgent = "", viewerId = "" }) {
  const now = new Date();
  const todayKey = getChinaDateKey(now);
  const index = await readMetricsIndex();
  const day = ensureDay(index, todayKey);
  const visitorKey = getVisitorKey({ ip, viewerId });
  const existing = day.visitors[visitorKey];

  day.hits = Number(day.hits || 0) + 1;
  day.visitors[visitorKey] = {
    firstSeenAt: existing?.firstSeenAt || now.toISOString(),
    hits: Number(existing?.hits || 0) + 1,
    lastSeenAt: now.toISOString(),
    userAgentHash: userAgent ? hashValue(userAgent).slice(0, 14) : existing?.userAgentHash || ""
  };
  day.updatedAt = now.toISOString();

  trimOldDays(index, todayKey);
  await writeMetricsIndex(index);
  return toPublicMetrics(day, now);
}

export async function getTodayMemeMetrics() {
  const now = new Date();
  const todayKey = getChinaDateKey(now);
  const index = await readMetricsIndex();
  const day = ensureDay(index, todayKey);
  return toPublicMetrics(day, now);
}

function toPublicMetrics(day, now) {
  const realUv = Object.keys(day.visitors || {}).length;
  const bucket = getFiveMinuteBucket(now);
  const syntheticUv = MIN_VISIBLE_UV + getSyntheticGrowth(day.date, bucket);
  const visibleUv = Math.max(MIN_VISIBLE_UV, realUv, syntheticUv);
  const updatedAtMs = Math.floor(now.getTime() / FIVE_MINUTES) * FIVE_MINUTES;

  return {
    bucket,
    date: day.date,
    hits: Number(day.hits || 0),
    nextRefreshAt: new Date(updatedAtMs + FIVE_MINUTES).toISOString(),
    realUv,
    updatedAt: new Date(updatedAtMs).toISOString(),
    visibleUv
  };
}

function getSyntheticGrowth(dayKey, bucket) {
  let growth = seededNumber(`${dayKey}:warmup`, 9);
  for (let index = 0; index <= bucket; index += 1) {
    const roll = seededNumber(`${dayKey}:${index}`, 100);
    if (roll < 48) {
      growth += 1;
    }
    if (roll > 93) {
      growth += 1;
    }
  }
  return growth;
}

function getFiveMinuteBucket(date) {
  const chinaNow = date.getTime() + 8 * 60 * 60 * 1000;
  const sinceChinaMidnight = chinaNow % DAY_MS;
  return Math.floor(sinceChinaMidnight / FIVE_MINUTES);
}

function getChinaDateKey(date) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function ensureDay(index, todayKey) {
  index.days ||= {};
  index.days[todayKey] ||= {
    date: todayKey,
    hits: 0,
    updatedAt: new Date().toISOString(),
    visitors: {}
  };
  return index.days[todayKey];
}

function trimOldDays(index, todayKey) {
  const keys = Object.keys(index.days || {}).sort().reverse();
  for (const key of keys.slice(14)) {
    delete index.days[key];
  }
  if (!index.days[todayKey]) {
    ensureDay(index, todayKey);
  }
}

function getVisitorKey({ ip, viewerId }) {
  const cleanViewer = cleanViewerId(viewerId);
  if (cleanViewer) {
    return `viewer:${hashValue(cleanViewer).slice(0, 24)}`;
  }
  return `ip:${hashValue(ip || "local").slice(0, 24)}`;
}

async function readMetricsIndex() {
  if (!hasBlobToken()) {
    return normalizeMetricsIndex(memoryMetrics);
  }

  try {
    const metadata = await head(METRICS_PATH, { ...blobAuthOptions() });
    const response = await fetch(`${metadata.url}?ts=${Date.now()}`, {
      cache: "no-store",
      headers: blobAuthHeader()
    });
    if (!response.ok) {
      return { days: {} };
    }
    return normalizeMetricsIndex(await response.json());
  } catch {
    return { days: {} };
  }
}

async function writeMetricsIndex(index) {
  const normalized = normalizeMetricsIndex(index);
  memoryMetrics.days = normalized.days;
  if (!hasBlobToken()) {
    return normalized;
  }

  await put(METRICS_PATH, JSON.stringify(normalized, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
    contentType: "application/json",
    ...blobAuthOptions()
  });
  return normalized;
}

function normalizeMetricsIndex(index) {
  const days = {};
  for (const [key, value] of Object.entries(index?.days || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
      continue;
    }
    days[key] = {
      date: key,
      hits: Number(value?.hits || 0),
      updatedAt: value?.updatedAt || new Date().toISOString(),
      visitors: normalizeVisitors(value?.visitors)
    };
  }
  return {
    days,
    updatedAt: new Date().toISOString(),
    version: 1
  };
}

function normalizeVisitors(visitors) {
  const normalized = {};
  for (const [key, value] of Object.entries(visitors || {})) {
    if (!/^(viewer|ip):[a-f0-9]{6,40}$/.test(key)) {
      continue;
    }
    normalized[key] = {
      firstSeenAt: value?.firstSeenAt || new Date().toISOString(),
      hits: Number(value?.hits || 0),
      lastSeenAt: value?.lastSeenAt || value?.firstSeenAt || new Date().toISOString(),
      userAgentHash: String(value?.userAgentHash || "").slice(0, 20)
    };
  }
  return normalized;
}

function seededNumber(seed, modulo) {
  const hex = hashValue(seed).slice(0, 8);
  return Number.parseInt(hex, 16) % modulo;
}

function hashValue(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN);
}

function blobAuthOptions() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return { token: process.env.BLOB_READ_WRITE_TOKEN };
  }
  return {};
}

function blobAuthHeader() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` };
  }
  return {};
}
