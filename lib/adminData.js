import { timingSafeEqual } from "node:crypto";
import { getGalleryCategories, getGalleryItems } from "./galleryStore.js";
import { getPublicModelConfig } from "./modelConfigStore.js";
import { getUserProfiles } from "./profileStore.js";
import { getQuotaOverview } from "./quotaStore.js";
import { getWishItems } from "./wishStore.js";

export async function getAdminDashboard() {
  const [galleryItems, modelConfig, profiles, wishes, quota] = await Promise.all([
    getGalleryItems(),
    getPublicModelConfig(),
    getUserProfiles(120),
    getWishItems(120),
    getQuotaOverview(80)
  ]);
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const totalUses = galleryItems.reduce((total, item) => total + Number(item.uses || 0), 0);
  const todayImages = galleryItems.filter((item) => String(item.createdAt || "").startsWith(todayKey)).length;
  const activeToday = galleryItems.filter((item) => String(item.lastUsedAt || "").startsWith(todayKey)).length;
  const avatarUploads = profiles.reduce((total, item) => total + Number(item.uploadCount || 0), 0);

  return {
    generatedAt: now.toISOString(),
    summary: {
      activeToday,
      avatarUploads,
      galleryCount: galleryItems.length,
      profileCount: profiles.length,
      todayImages,
      totalUses,
      wishCount: wishes.length,
      registeredViewers: quota.stats.registeredViewers,
      viewerCount: quota.stats.viewerCount
    },
    breakdowns: {
      categories: getGalleryCategories(galleryItems).filter((category) => category.id !== "all"),
      roles: countBy(galleryItems, "roleName"),
      actions: countBy(galleryItems, "actionName")
    },
    gallery: galleryItems.slice(0, 120).map(toAdminGalleryItem),
    modelConfig,
    profiles,
    quota,
    wishes
  };
}

export function assertAdminAccess(req) {
  const expected = getAdminToken();
  if (!expected) {
    if (!process.env.VERCEL && process.env.NODE_ENV !== "production") {
      return;
    }
    const error = new Error("后台口令还没配置。先在 Vercel 环境变量里设置 ADMIN_TOKEN。");
    error.status = 503;
    throw error;
  }

  const provided = getProvidedToken(req);
  if (!tokensMatch(provided, expected)) {
    const error = new Error("后台口令不对。窗边现在拒绝交出小本本。");
    error.status = 401;
    throw error;
  }
}

function toAdminGalleryItem(item) {
  return {
    actionName: item.actionName || item.categoryName || "窗边",
    caption: item.caption || "",
    category: item.category || "default",
    categoryName: item.categoryName || "认命",
    comboKey: item.comboKey || item.id,
    createdAt: item.createdAt || "",
    creatorName: item.creatorName || "无名受害者",
    downloadUrl: item.downloadUrl || item.imageUrl,
    id: item.id || item.comboKey,
    imageUrl: item.imageUrl,
    lastUsedAt: item.lastUsedAt || "",
    roleName: item.roleName || "窗边人",
    thumbnail: item.thumbnail || item.imageUrl,
    uses: Number(item.uses || 0)
  };
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) {
    const name = item?.[key] || "未知";
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function getAdminToken() {
  return String(process.env.ADMIN_TOKEN || process.env.ADMIN_PASSWORD || "").trim();
}

function getProvidedToken(req) {
  const headerToken = getHeader(req, "x-admin-token");
  if (headerToken) {
    return headerToken;
  }

  const authorization = getHeader(req, "authorization");
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  try {
    const url = new URL(req?.url || "", "http://localhost");
    return url.searchParams.get("token") || "";
  } catch {
    return "";
  }
}

function getHeader(req, name) {
  const value = req?.headers?.[name] || req?.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : String(value || "").trim();
}

function tokensMatch(provided, expected) {
  const left = Buffer.from(String(provided || ""));
  const right = Buffer.from(String(expected || ""));
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}
