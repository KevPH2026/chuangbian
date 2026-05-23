import { head, list, put } from "@vercel/blob";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { detectAction, getRolePreset, normalizeCaption } from "./chuangbianPrompt.js";
import staticRecoveredGallery from "./staticRecoveredGallery.js";

const INDEX_PATH = "chuangbian/gallery-index.json";
const IMAGE_PREFIX = "chuangbian/images";
const THUMBNAIL_MAX_LENGTH = 90_000;
const OUTPUT_IMAGE_SIZE = 240;

export const CATEGORY_ORDER = ["all", "question", "money", "work", "love", "ai", "default", "opossum-original", "recovery"];

export const CATEGORY_LABELS = {
  all: "全部",
  question: "疑惑",
  money: "穷鬼",
  work: "打工",
  love: "恋爱",
  ai: "AI",
  default: "认命",
  "opossum-original": "原图负鼠",
  recovery: "大家的窗边"
};

const memoryStore = {
  items: []
};

export function buildCombo({ text, role, variant = "" }) {
  const caption = normalizeCaption(text);
  const rolePreset = getRolePreset(role);
  const rawKey = `${rolePreset.id}:${caption}:${String(variant || "").trim()}`;
  return {
    caption,
    role: rolePreset.id,
    roleName: rolePreset.name,
    comboKey: createHash("sha256").update(rawKey).digest("hex").slice(0, 20)
  };
}

export function hashGalleryVariant(value) {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);
}

export function getCategoryForMeta(meta) {
  const action = meta?.action || detectAction(meta?.caption || "").id;
  return CATEGORY_LABELS[action] ? action : "default";
}

export function getCategoryName(category) {
  return CATEGORY_LABELS[category] || CATEGORY_LABELS.default;
}

export async function getGalleryItems() {
  const index = await readIndex();
  return index.items;
}

export function toPublicGalleryItem(item, viewerId = "") {
  if (!item) {
    return item;
  }

  const { creatorEmailHash: _creatorEmailHash, creatorId: _creatorId, model: _model, prompt: _prompt, ...publicItem } = item;
  return {
    ...publicItem,
    creatorName: item.creatorName || "无名受害者",
    owned: Boolean(viewerId && item.creatorId && item.creatorId === viewerId)
  };
}

export function toPublicGalleryItems(items, viewerId = "") {
  return Array.isArray(items) ? items.map((item) => toPublicGalleryItem(item, viewerId)) : [];
}

export async function findGalleryItem(comboKey) {
  const index = await readIndex();
  return index.items.find((item) => item.comboKey === comboKey) || null;
}

export async function markGalleryItemUsed(comboKey) {
  const index = await readIndex();
  const item = index.items.find((entry) => entry.comboKey === comboKey);
  if (!item) {
    return null;
  }

  item.uses = Number(item.uses || 0) + 1;
  item.lastUsedAt = new Date().toISOString();
  await writeIndex(index);
  return item;
}

export async function saveGeneratedImage({
  image,
  model,
  meta,
  prompt,
  combo: inputCombo,
  creatorId = "",
  creatorName = "",
  creatorEmailHash = ""
}) {
  const combo = inputCombo || buildCombo({ text: meta?.caption, role: meta?.role });
  const existing = await findGalleryItem(combo.comboKey);
  if (existing) {
    return existing;
  }

  const imageBlob = await uploadGeneratedImage(combo.comboKey, image);
  const category = getCategoryForMeta(meta);
  const now = new Date().toISOString();
  const item = {
    id: combo.comboKey,
    comboKey: combo.comboKey,
    caption: combo.caption,
    role: combo.role,
    roleName: meta?.roleName || combo.roleName,
    action: meta?.action || category,
    actionName: meta?.actionName || getCategoryName(category),
    category,
    categoryName: getCategoryName(category),
    creatorId,
    creatorName: creatorName || "无名受害者",
    creatorEmailHash,
    model,
    imageUrl: imageBlob.url,
    downloadUrl: imageBlob.downloadUrl || imageBlob.url,
    thumbnail: imageBlob.url,
    promptVersion: prompt ? "2026-05-21-simple-meme" : "2026-05-21",
    createdAt: now,
    lastUsedAt: now,
    uses: 1
  };

  const index = await readIndex();
  index.items = [item, ...index.items.filter((entry) => entry.comboKey !== item.comboKey)];
  await writeIndex(index);
  return item;
}

export async function updateGalleryThumbnail({ comboKey, thumbnail }) {
  const cleanKey = String(comboKey || "").trim();
  const cleanThumbnail = String(thumbnail || "").trim();
  if (!cleanKey || !cleanThumbnail.startsWith("data:image/")) {
    throw new Error("Invalid thumbnail payload");
  }

  const index = await readIndex();
  const item = index.items.find((entry) => entry.comboKey === cleanKey);
  if (!item) {
    return null;
  }

  item.thumbnail = cleanThumbnail.slice(0, THUMBNAIL_MAX_LENGTH);
  item.thumbnailUpdatedAt = new Date().toISOString();
  await writeIndex(index);
  return item;
}

export function getGalleryCategories(items) {
  const counts = new Map();
  for (const item of items) {
    counts.set(item.category, (counts.get(item.category) || 0) + 1);
  }

  return CATEGORY_ORDER.filter((id) => id === "all" || counts.has(id)).map((id) => ({
    id,
    name: getCategoryName(id),
    count: id === "all" ? items.length : counts.get(id) || 0
  }));
}

async function uploadGeneratedImage(comboKey, image) {
  if (!hasBlobToken()) {
    return { url: image, downloadUrl: image };
  }

  const { buffer, contentType, extension } = await imageToBuffer(image);
  return put(`${IMAGE_PREFIX}/${comboKey}.${extension}`, buffer, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
    ...blobAuthOptions()
  });
}

export async function compressImageForMemeDataUrl(image) {
  const { buffer, contentType } = await imageToBuffer(image);
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

async function imageToBuffer(image) {
  const source = String(image || "");
  if (source.startsWith("data:image/")) {
    const match = source.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      throw new Error("Invalid image data");
    }

    return compressForMeme(Buffer.from(match[2], "base64"));
  }

  if (!/^https?:\/\//.test(source)) {
    throw new Error("Invalid image URL");
  }

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error("生成图片下载失败，无法写入图库。");
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const arrayBuffer = await response.arrayBuffer();
  return compressForMeme(Buffer.from(arrayBuffer), contentType);
}

async function compressForMeme(buffer) {
  const output = await sharp(buffer, { animated: false })
    .resize({
      width: OUTPUT_IMAGE_SIZE,
      height: OUTPUT_IMAGE_SIZE,
      fit: "inside",
      withoutEnlargement: true
    })
    .png({
      compressionLevel: 9,
      quality: 70
    })
    .toBuffer();

  return {
    buffer: output,
    contentType: "image/png",
    extension: "png"
  };
}

async function readIndex() {
  if (!hasBlobToken()) {
    return memoryStore;
  }

  try {
    const metadata = await head(INDEX_PATH, { ...blobAuthOptions() });
    const response = await fetch(`${metadata.url}?ts=${Date.now()}`, {
      cache: "no-store",
      headers: blobAuthHeader()
    });
    if (!response.ok) {
      return buildRecoveryIndex();
    }

    const index = await response.json();
    return normalizeIndex(index);
  } catch (error) {
    if (isBlobNotFound(error)) {
      return { items: [] };
    }
    if (isSuspendedBlobError(error)) {
      return buildRecoveryIndex();
    }
    throw error;
  }
}

async function buildRecoveryIndex() {
  const staticItems = normalizeStaticRecoveredItems();

  try {
    const recoveryItems = [];
    let cursor;
    do {
      const page = await list({
        prefix: IMAGE_PREFIX,
        limit: 1000,
        cursor,
        ...blobAuthOptions()
      });
      recoveryItems.push(...page.blobs);
      cursor = page.cursor;
    } while (cursor);

    const staticKeys = new Set(staticItems.map((item) => item.comboKey));
    const blockedItems = recoveryItems
        .filter((blob) => /\.(png|jpe?g|webp)$/i.test(blob.pathname || ""))
        .filter((blob) => {
          const comboKey = String(blob.pathname || "").split("/").pop()?.replace(/\.[^.]+$/, "");
          return comboKey && !staticKeys.has(comboKey);
        })
        .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))
        .map((blob, index) => {
          const comboKey = String(blob.pathname || "").split("/").pop()?.replace(/\.[^.]+$/, "") || `recovery-${index}`;
          return {
            id: comboKey,
            comboKey,
            caption: `窗边现场 ${index + 1}`,
            role: "recovery",
            roleName: "路过角色",
            action: "recovery",
            actionName: "Blob 暂停中",
            category: "recovery",
            categoryName: getCategoryName("recovery"),
            creatorName: "无名受害者",
            downloadUrl: blob.url,
            imageUrl: blob.url,
            thumbnail: "",
            blobSize: Number(blob.size || 0),
            blocked: true,
            createdAt: blob.uploadedAt || "",
            lastUsedAt: blob.uploadedAt || "",
            uses: 1
          };
        });

    return normalizeIndex({
      items: [...staticItems, ...blockedItems]
    });
  } catch {
    return normalizeIndex({ items: staticItems });
  }
}

function normalizeStaticRecoveredItems() {
  return Array.isArray(staticRecoveredGallery) ? staticRecoveredGallery : [];
}

async function writeIndex(index) {
  const nextIndex = normalizeIndex(index);
  if (!hasBlobToken()) {
    memoryStore.items = nextIndex.items;
    return nextIndex;
  }

  await put(INDEX_PATH, JSON.stringify(nextIndex), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
    ...blobAuthOptions()
  });

  return nextIndex;
}

function normalizeIndex(index) {
  const items = Array.isArray(index?.items) ? index.items : [];
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    items: items
      .filter((item) => item?.comboKey && item?.imageUrl)
      .map((item) => {
        const category = CATEGORY_LABELS[item.category] ? item.category : getCategoryForMeta(item);
        return {
          ...item,
          id: item.id || item.comboKey,
          category,
          categoryName: getCategoryName(category),
          thumbnail: item.thumbnail || item.imageUrl,
          downloadUrl: item.downloadUrl || item.imageUrl,
          uses: Number(item.uses || 1)
        };
      })
  };
}

function hasBlobToken() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
      (process.env.VERCEL_OIDC_TOKEN?.trim() && process.env.BLOB_STORE_ID?.trim())
  );
}

function blobAuthOptions() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token ? { token } : {};
}

function blobAuthHeader() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token ? { authorization: `Bearer ${token}` } : {};
}

function isBlobNotFound(error) {
  const message = String(error?.message || error || "");
  return error?.name === "BlobNotFoundError" || /not found|does not exist|404/i.test(message);
}

function isSuspendedBlobError(error) {
  return /suspended|store is blocked|forbidden/i.test(String(error?.message || error || ""));
}
