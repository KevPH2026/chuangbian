import { head, put } from "@vercel/blob";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { cleanCreatorEmail, cleanCreatorName, cleanViewerId } from "./quotaStore.js";

const PROFILE_PATH = "chuangbian/profile-index.json";
const PROFILE_IMAGE_PREFIX = "chuangbian/profiles";
const PROFILE_IMAGE_SIZE = 320;

const memoryProfiles = {
  items: []
};

export async function getUserProfiles(limit = 120) {
  const index = await readProfileIndex();
  return sortProfiles(index.items).slice(0, limit).map(toAdminProfile);
}

export async function saveUserProfileUpload({ avatarImage = "", ip = "", referralCode = "", userAgent = "", userEmail = "", userName = "", viewerId = "" }) {
  const cleanAvatar = cleanAvatarImage(avatarImage);
  const email = cleanCreatorEmail(userEmail);
  const name = cleanCreatorName(userName);
  const emailHash = email ? hashValue(email.toLowerCase()) : "";
  const cleanViewer = cleanViewerId(viewerId);
  const stableViewerId = emailHash ? `user_${emailHash.slice(0, 24)}` : cleanViewer || `anon_${hashValue(ip || "local").slice(0, 24)}`;
  const profileId = stableViewerId;
  const avatarHash = hashValue(cleanAvatar).slice(0, 20);
  const avatarBlob = await uploadProfileImage(profileId, avatarHash, cleanAvatar);
  const now = new Date().toISOString();
  const index = await readProfileIndex();
  const existing = index.items.find((item) => item.id === profileId);
  const previousHash = existing?.avatarHash || "";
  const nextItem = {
    ...(existing || {}),
    id: profileId,
    avatarHash,
    avatarUrl: avatarBlob.url,
    clientViewerIds: mergeLimited(existing?.clientViewerIds, cleanViewer && cleanViewer !== profileId ? cleanViewer : ""),
    createdAt: existing?.createdAt || now,
    emailHash,
    lastIpHash: ip ? hashValue(ip).slice(0, 16) : existing?.lastIpHash || "",
    maskedEmail: maskEmail(email),
    name,
    referralCode: cleanReferralCode(referralCode) || existing?.referralCode || "",
    updatedAt: now,
    uploadCount: Number(existing?.uploadCount || 0) + (previousHash === avatarHash ? 0 : 1),
    userAgent: String(userAgent || "").slice(0, 180),
    viewerHash: hashValue(profileId).slice(0, 16)
  };

  index.items = [nextItem, ...index.items.filter((item) => item.id !== profileId)].slice(0, 600);
  await writeProfileIndex(index);
  return toPublicProfile(nextItem);
}

function toPublicProfile(item) {
  return {
    avatarUrl: item.avatarUrl,
    maskedEmail: item.maskedEmail,
    name: item.name || "无名受害者",
    updatedAt: item.updatedAt,
    uploadCount: Number(item.uploadCount || 0),
    viewerId: item.id
  };
}

function toAdminProfile(item) {
  const normalized = normalizeProfile(item);
  return {
    avatarUrl: normalized.avatarUrl,
    clientViewerCount: normalized.clientViewerIds.length,
    createdAt: normalized.createdAt,
    emailHash: normalized.emailHash ? normalized.emailHash.slice(0, 12) : "",
    lastIpHash: normalized.lastIpHash || "",
    maskedEmail: normalized.maskedEmail || "没留邮箱",
    name: normalized.name || "无名受害者",
    referralCode: normalized.referralCode || "",
    updatedAt: normalized.updatedAt,
    uploadCount: Number(normalized.uploadCount || 0),
    userAgent: normalized.userAgent || "",
    viewerHash: normalized.viewerHash || hashValue(normalized.id).slice(0, 16)
  };
}

async function uploadProfileImage(profileId, avatarHash, avatarImage) {
  if (!hasBlobToken()) {
    return { url: avatarImage };
  }

  const { buffer, contentType, extension } = await imageToProfileBuffer(avatarImage);
  return put(`${PROFILE_IMAGE_PREFIX}/${hashValue(profileId).slice(0, 20)}-${avatarHash}.${extension}`, buffer, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
    contentType,
    ...blobAuthOptions()
  });
}

async function imageToProfileBuffer(image) {
  const source = String(image || "");
  const match = source.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("头像图片格式不对，请重新上传。");
  }

  const output = await sharp(Buffer.from(match[2], "base64"), { animated: false })
    .resize({
      width: PROFILE_IMAGE_SIZE,
      height: PROFILE_IMAGE_SIZE,
      fit: "cover",
      position: "centre"
    })
    .jpeg({
      mozjpeg: true,
      quality: 78
    })
    .toBuffer();

  return {
    buffer: output,
    contentType: "image/jpeg",
    extension: "jpg"
  };
}

async function readProfileIndex() {
  if (!hasBlobToken()) {
    return normalizeProfileIndex(memoryProfiles);
  }

  try {
    const metadata = await head(PROFILE_PATH, { ...blobAuthOptions() });
    const response = await fetch(`${metadata.url}?ts=${Date.now()}`, {
      cache: "no-store",
      headers: blobAuthHeader()
    });
    if (!response.ok) {
      return { items: [] };
    }
    return normalizeProfileIndex(await response.json());
  } catch {
    return { items: [] };
  }
}

async function writeProfileIndex(index) {
  const normalized = normalizeProfileIndex(index);
  memoryProfiles.items = normalized.items;
  if (!hasBlobToken()) {
    return normalized;
  }

  await put(PROFILE_PATH, JSON.stringify(normalized, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/json",
    ...blobAuthOptions()
  });
  return normalized;
}

function normalizeProfileIndex(index) {
  return {
    items: Array.isArray(index?.items) ? index.items.filter((item) => item?.id && item?.avatarUrl).map(normalizeProfile) : [],
    updatedAt: new Date().toISOString(),
    version: 1
  };
}

function normalizeProfile(item) {
  return {
    ...item,
    avatarHash: String(item?.avatarHash || ""),
    avatarUrl: String(item?.avatarUrl || ""),
    clientViewerIds: Array.isArray(item?.clientViewerIds) ? item.clientViewerIds.filter(Boolean).slice(0, 10) : [],
    createdAt: item?.createdAt || new Date().toISOString(),
    emailHash: String(item?.emailHash || ""),
    id: String(item?.id || ""),
    lastIpHash: String(item?.lastIpHash || ""),
    maskedEmail: String(item?.maskedEmail || ""),
    name: String(item?.name || "无名受害者").slice(0, 18),
    referralCode: String(item?.referralCode || ""),
    updatedAt: item?.updatedAt || item?.createdAt || new Date().toISOString(),
    uploadCount: Number(item?.uploadCount || 0),
    userAgent: String(item?.userAgent || "").slice(0, 180),
    viewerHash: String(item?.viewerHash || "")
  };
}

function sortProfiles(items) {
  return [...items].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
}

function cleanAvatarImage(value) {
  const image = String(value || "").trim();
  if (!image.startsWith("data:image/")) {
    const error = new Error("请上传图片格式的头像。");
    error.status = 400;
    throw error;
  }
  if (image.length > 2_500_000) {
    const error = new Error("头像图片太大，请换一张更小的头像。");
    error.status = 413;
    throw error;
  }
  return image;
}

function cleanReferralCode(value) {
  const code = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{6,120}$/.test(code) ? code : "";
}

function mergeLimited(existing, value) {
  return [...new Set([...(Array.isArray(existing) ? existing : []), value].filter(Boolean))].slice(-10);
}

function maskEmail(email) {
  if (!email) {
    return "";
  }

  const [name, domain] = email.split("@");
  if (!name || !domain) {
    return "";
  }
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"*".repeat(Math.max(2, Math.min(6, name.length - visible.length)))}@${domain}`;
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
