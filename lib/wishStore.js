import { head, put } from "@vercel/blob";
import { createHash } from "node:crypto";
import { readBlobJson } from "./blobRead.js";
import { isGithubStorageEnabled, readGithubJson, writeGithubJson } from "./githubStorage.js";

const WISH_PATH = "chuangbian/wish-index.json";
const memoryWishStore = {
  items: []
};

export async function getWishItems(limit = 200) {
  const index = await readWishIndex();
  return sortWishItems(index.items).slice(0, limit).map(toAdminWish);
}

export async function getPublicWishes({ voterKey = "", limit = 80 } = {}) {
  const index = await readWishIndex();
  const voterHash = buildVoterHash(voterKey);
  return sortWishItems(index.items).slice(0, limit).map((item) => toPublicWish(item, voterHash));
}

export async function saveWish({ email = "", name = "", text = "", viewerId = "" }) {
  const wishText = cleanWishText(text);
  if (!wishText) {
    const error = new Error("先许个愿，别空手套窗边。");
    error.status = 400;
    throw error;
  }

  const now = new Date().toISOString();
  const item = {
    id: hashValue(`${viewerId}:${wishText}:${now}`).slice(0, 20),
    createdAt: now,
    emailHash: email ? hashValue(email.toLowerCase()) : "",
    name: cleanName(name),
    text: wishText,
    viewerHash: cleanViewerId(viewerId) ? hashValue(cleanViewerId(viewerId)) : "",
    voterHashes: [],
    votes: 0
  };

  const index = await readWishIndex();
  index.items = [item, ...index.items].slice(0, 500);
  await writeWishIndex(index);
  return toPublicWish(item);
}

export async function voteWish({ id = "", voterKey = "" }) {
  const wishId = String(id || "").trim();
  const voterHash = buildVoterHash(voterKey);
  if (!wishId) {
    const error = new Error("你要给哪个愿望 +1？窗边没看懂。");
    error.status = 400;
    throw error;
  }
  if (!voterHash) {
    const error = new Error("这次 +1 没有留下指纹，窗边不敢记。");
    error.status = 400;
    throw error;
  }

  const index = await readWishIndex();
  const item = index.items.find((entry) => entry.id === wishId);
  if (!item) {
    const error = new Error("这个愿望找不到了，可能已经站太久风化了。");
    error.status = 404;
    throw error;
  }

  const normalized = normalizeWishItem(item);
  const alreadyVoted = normalized.voterHashes.includes(voterHash);
  if (!alreadyVoted) {
    normalized.voterHashes = [voterHash, ...normalized.voterHashes].slice(0, 5000);
    normalized.votes = normalized.voterHashes.length;
    normalized.lastVotedAt = new Date().toISOString();
    Object.assign(item, normalized);
    await writeWishIndex(index);
  }

  return {
    item: toPublicWish(normalized, voterHash),
    voted: !alreadyVoted
  };
}

function toPublicWish(item, voterHash = "") {
  const normalized = normalizeWishItem(item);
  return {
    createdAt: normalized.createdAt,
    hasVoted: Boolean(voterHash && normalized.voterHashes.includes(voterHash)),
    id: normalized.id,
    name: normalized.name,
    text: normalized.text,
    voteCount: normalized.votes
  };
}

function toAdminWish(item) {
  const normalized = normalizeWishItem(item);
  return {
    createdAt: normalized.createdAt,
    hasEmail: Boolean(normalized.emailHash),
    id: normalized.id,
    lastVotedAt: normalized.lastVotedAt,
    name: normalized.name || "匿名许愿怪",
    text: normalized.text || "",
    viewerHash: normalized.viewerHash ? String(normalized.viewerHash).slice(0, 12) : "",
    voteCount: normalized.votes
  };
}

function cleanWishText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 180);
}

function cleanName(value) {
  return String(value || "").trim().slice(0, 18) || "匿名许愿怪";
}

function cleanViewerId(value) {
  const viewerId = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{6,90}$/.test(viewerId) ? viewerId : "";
}

async function readWishIndex() {
  if (isGithubStorageEnabled()) {
    return normalizeWishIndex((await readGithubJson(WISH_PATH)) || memoryWishStore);
  }

  if (!hasBlobToken()) {
    return normalizeWishIndex(memoryWishStore);
  }

  try {
    const metadata = await head(WISH_PATH, { ...blobAuthOptions() });
    const index = await readBlobJson(metadata.url, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return normalizeWishIndex(index);
  } catch (error) {
    if (error?.code === "BLOB_STORE_SUSPENDED") {
      throw error;
    }
    return { items: [] };
  }
}

async function writeWishIndex(index) {
  const normalized = normalizeWishIndex(index);
  memoryWishStore.items = normalized.items;
  if (isGithubStorageEnabled()) {
    await writeGithubJson(WISH_PATH, normalized);
    return;
  }

  if (!hasBlobToken()) {
    return;
  }

  await put(WISH_PATH, JSON.stringify(normalized, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    ...blobAuthOptions()
  });
}

function normalizeWishIndex(index) {
  return {
    items: Array.isArray(index?.items) ? index.items.filter((item) => item?.id && item?.text).map(normalizeWishItem) : []
  };
}

function normalizeWishItem(item) {
  const voterHashes = Array.isArray(item?.voterHashes)
    ? [...new Set(item.voterHashes.map((value) => String(value || "").trim()).filter(Boolean))]
    : [];
  return {
    ...item,
    createdAt: item?.createdAt || new Date().toISOString(),
    id: String(item?.id || "").trim(),
    name: cleanName(item?.name),
    text: cleanWishText(item?.text),
    voterHashes,
    votes: Math.max(Number(item?.votes || 0), voterHashes.length)
  };
}

function sortWishItems(items) {
  return [...items].sort((a, b) => {
    const left = normalizeWishItem(a);
    const right = normalizeWishItem(b);
    return right.votes - left.votes || new Date(right.createdAt) - new Date(left.createdAt);
  });
}

function buildVoterHash(value) {
  const voterKey = String(value || "").trim();
  return voterKey ? hashValue(`wish-voter:${voterKey}`) : "";
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
