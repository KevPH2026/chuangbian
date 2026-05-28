import { head, put } from "@vercel/blob";
import { createHash } from "node:crypto";

const QUOTA_PATH = "chuangbian/quota-index.json";
const FREE_LIMIT = 2;
const GUEST_AVATAR_LIMIT = 1;
const REGISTERED_LIMIT = 4;
const REFERRAL_BONUS = 5;

const memoryQuota = {
  ips: {},
  referralCodes: {},
  referralClaims: {},
  viewers: {}
};

export function getClientIp(req) {
  const forwarded = getHeader(req, "x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return getHeader(req, "x-real-ip") || req?.socket?.remoteAddress || "local";
}

export async function getQuotaStatus(input) {
  const normalized = normalizeQuotaInput(input);
  const index = await readQuotaIndex();
  const { ipRecord, viewer } = touchQuotaRecords(index, normalized);
  if (normalized.registered) {
    syncRegisteredUsage(viewer, ipRecord);
  }
  return buildQuotaStatus({ ipRecord, normalized, viewer });
}

export async function getQuotaOverview(limit = 80) {
  const index = await readQuotaIndex();
  const viewers = Object.values(index.viewers || {});
  const ips = Object.values(index.ips || {});
  const registeredViewers = viewers.filter((viewer) => Boolean(viewer.registeredAt));
  const totalRegisteredUsed = viewers.reduce((total, viewer) => total + Number(viewer.registeredUsed || 0), 0);
  const totalAnonymousUsed = ips.reduce((total, record) => total + Number(record.used || 0), 0);
  const totalBonus = viewers.reduce((total, viewer) => total + Number(viewer.bonus || 0), 0);
  const totalInvited = viewers.reduce((total, viewer) => total + Number(viewer.invitedCount || 0), 0);

  return {
    stats: {
      anonymousUsed: totalAnonymousUsed,
      bonus: totalBonus,
      invited: totalInvited,
      ipCount: ips.length,
      referralClaims: Object.keys(index.referralClaims || {}).length,
      registeredUsed: totalRegisteredUsed,
      registeredViewers: registeredViewers.length,
      viewerCount: viewers.length
    },
    viewers: viewers
      .map(toAdminViewer)
      .sort((a, b) => new Date(b.lastSeenAt || b.createdAt || 0) - new Date(a.lastSeenAt || a.createdAt || 0))
      .slice(0, limit)
  };
}

export async function consumeQuota(input) {
  const normalized = normalizeQuotaInput(input);
  const index = await readQuotaIndex();
  const { ipRecord, viewer } = touchQuotaRecords(index, normalized);
  if (normalized.registered) {
    syncRegisteredUsage(viewer, ipRecord);
  }

  const status = buildQuotaStatus({ ipRecord, normalized, viewer });
  if (status.remaining <= 0) {
    const error = new Error(
      status.registered
        ? "今天的窗边额度用完了。拉一个新受害者来用，就给你加 5 张。"
        : "未注册 IP 额度用完了。注册昵称和邮箱后额外获得 2 张。"
    );
    error.status = 429;
    error.quota = status;
    throw error;
  }

  if (normalized.guestAvatar && status.guestAvatarRemaining <= 0) {
    const error = new Error("游客用自己照片只能生成 1 次。登录后可以继续管理自己的形象。");
    error.status = 429;
    error.quota = status;
    throw error;
  }

  if (normalized.registered) {
    viewer.registeredUsed = Number(viewer.registeredUsed || 0) + 1;
  } else {
    ipRecord.used = Number(ipRecord.used || 0) + 1;
    if (normalized.guestAvatar) {
      ipRecord.guestAvatarUsed = Number(ipRecord.guestAvatarUsed || 0) + 1;
    }
  }

  applyReferralAward(index, normalized, viewer);
  viewer.lastGeneratedAt = new Date().toISOString();
  await writeQuotaIndex(index);
  return buildQuotaStatus({ ipRecord, normalized, viewer });
}

export function cleanViewerId(value) {
  const viewerId = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{6,90}$/.test(viewerId) ? viewerId : "";
}

export function cleanReferralCode(value) {
  const code = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{6,90}$/.test(code) ? code : "";
}

export function cleanCreatorName(value) {
  const creatorName = String(value || "").trim().slice(0, 18);
  return creatorName || "无名受害者";
}

export function cleanCreatorEmail(value) {
  const email = String(value || "").trim().slice(0, 120);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function applyReferralAward(index, normalized, viewer) {
  if (viewer.firstGeneratedAt) {
    return;
  }

  viewer.firstGeneratedAt = new Date().toISOString();
  const inviteeKeys = getReferralClaimKeys(normalized);
  if (!normalized.referredBy || inviteeKeys.some((key) => index.referralClaims[key])) {
    return;
  }

  const referrerId = resolveReferrerId(index, normalized.referredBy);
  if (!referrerId || referrerId === viewer.id) {
    return;
  }

  const referrer = ensureViewer(index, referrerId);
  referrer.bonus = Number(referrer.bonus || 0) + REFERRAL_BONUS;
  referrer.invitedCount = Number(referrer.invitedCount || 0) + 1;
  referrer.lastReferralAt = new Date().toISOString();
  for (const key of inviteeKeys) {
    index.referralClaims[key] = normalized.referredBy;
  }
}

function buildQuotaStatus({ ipRecord, normalized, viewer }) {
  const bonus = Number(viewer.bonus || 0);
  const used = normalized.registered ? Number(viewer.registeredUsed || 0) : Number(ipRecord.used || 0);
  const baseLimit = normalized.registered ? REGISTERED_LIMIT : FREE_LIMIT;
  const limit = baseLimit + bonus;
  const guestAvatarLimit = normalized.registered ? 0 : GUEST_AVATAR_LIMIT;
  const guestAvatarUsed = normalized.registered ? 0 : Number(ipRecord.guestAvatarUsed || 0);
  return {
    baseLimit,
    bonus,
    guestAvatarLimit,
    guestAvatarRemaining: Math.max(0, guestAvatarLimit - guestAvatarUsed),
    guestAvatarUsed,
    invitedCount: Number(viewer.invitedCount || 0),
    limit,
    referralCode: viewer.referralCode,
    registered: normalized.registered,
    remaining: Math.max(0, limit - used),
    used,
    viewerId: viewer.id
  };
}

function syncRegisteredUsage(viewer, ipRecord) {
  if (viewer.registeredAt) {
    return;
  }

  viewer.registeredAt = new Date().toISOString();
  viewer.registeredUsed = Math.max(Number(viewer.registeredUsed || 0), Number(ipRecord.used || 0));
}

function touchQuotaRecords(index, normalized) {
  const ipRecord = ensureIpRecord(index, normalized.ipHash);
  const viewer = ensureViewer(index, normalized.viewerId || `anon_${normalized.ipHash}`, normalized.referralCode);
  if (normalized.registered) {
    normalizeRegisteredReferralCode(viewer);
    mergeGuestIdentityIntoRegisteredViewer(index, viewer, normalized);
    viewer.emailHash = normalized.emailHash;
    viewer.name = normalized.name;
    if (normalized.clientViewerId && normalized.clientViewerId !== viewer.id) {
      viewer.clientViewerIds = [...new Set([...(Array.isArray(viewer.clientViewerIds) ? viewer.clientViewerIds : []), normalized.clientViewerId])].slice(-8);
    }
  }
  if (normalized.referralCode && normalized.referralCode !== viewer.referralCode) {
    viewer.referralAliases = [...new Set([...(Array.isArray(viewer.referralAliases) ? viewer.referralAliases : []), normalized.referralCode])].slice(-8);
    index.referralCodes[normalized.referralCode] = viewer.id;
  }
  index.referralCodes[viewer.referralCode] = viewer.id;
  viewer.lastSeenAt = new Date().toISOString();
  return { ipRecord, viewer };
}

function ensureIpRecord(index, ipHash) {
  index.ips[ipHash] ||= {
    id: ipHash,
    guestAvatarUsed: 0,
    used: 0,
    createdAt: new Date().toISOString()
  };
  return index.ips[ipHash];
}

function ensureViewer(index, viewerId, preferredReferralCode = "") {
  index.viewers[viewerId] ||= {
    id: viewerId,
    bonus: 0,
    createdAt: new Date().toISOString(),
    invitedCount: 0,
    referralCode: viewerId.startsWith("user_") ? getDefaultReferralCode(viewerId) : cleanReferralCode(preferredReferralCode) || getDefaultReferralCode(viewerId),
    registeredUsed: 0
  };
  index.referralCodes[index.viewers[viewerId].referralCode] = viewerId;
  return index.viewers[viewerId];
}

function normalizeRegisteredReferralCode(viewer) {
  const stableCode = getDefaultReferralCode(viewer.id);
  if (viewer.referralCode && viewer.referralCode !== stableCode) {
    viewer.referralAliases = [...new Set([...(Array.isArray(viewer.referralAliases) ? viewer.referralAliases : []), viewer.referralCode])].slice(-8);
  }
  viewer.referralCode = stableCode;
}

function mergeGuestIdentityIntoRegisteredViewer(index, viewer, normalized) {
  const guestIds = [
    normalized.clientViewerId,
    `anon_${normalized.ipHash}`
  ].filter((id) => id && id !== viewer.id);

  for (const guestId of guestIds) {
    const guest = index.viewers[guestId];
    if (!guest || guest.mergedInto === viewer.id) {
      continue;
    }

    if (!guest.mergedInto) {
      viewer.bonus = Number(viewer.bonus || 0) + Number(guest.bonus || 0);
      viewer.invitedCount = Number(viewer.invitedCount || 0) + Number(guest.invitedCount || 0);
      viewer.firstGeneratedAt ||= guest.firstGeneratedAt;
      viewer.lastGeneratedAt ||= guest.lastGeneratedAt;
      viewer.lastReferralAt ||= guest.lastReferralAt;
      guest.bonus = 0;
      guest.invitedCount = 0;
    }

    const aliases = [guest.referralCode, ...(Array.isArray(guest.referralAliases) ? guest.referralAliases : [])].filter(Boolean);
    if (aliases.length) {
      viewer.referralAliases = [...new Set([...(Array.isArray(viewer.referralAliases) ? viewer.referralAliases : []), ...aliases])].slice(-12);
      for (const alias of aliases) {
        index.referralCodes[alias] = viewer.id;
      }
    }

    guest.mergedInto = viewer.id;
    guest.mergedAt = new Date().toISOString();
  }
}

function resolveReferrerId(index, referredBy) {
  const code = cleanReferralCode(referredBy);
  if (!code) {
    return "";
  }

  const mappedId = index.referralCodes[code] || parseViewerReferralCode(code);
  if (!mappedId) {
    return "";
  }

  const mappedViewer = ensureViewer(index, mappedId);
  return mappedViewer.mergedInto || mappedViewer.id;
}

function parseViewerReferralCode(code) {
  if (!code.startsWith("rv_")) {
    return "";
  }

  return cleanViewerId(code.slice(3));
}

function toAdminViewer(viewer) {
  return {
    bonus: Number(viewer.bonus || 0),
    createdAt: viewer.createdAt || "",
    idHash: hashValue(viewer.id).slice(0, 12),
    invitedCount: Number(viewer.invitedCount || 0),
    lastGeneratedAt: viewer.lastGeneratedAt || "",
    lastReferralAt: viewer.lastReferralAt || "",
    lastSeenAt: viewer.lastSeenAt || "",
    referralCode: viewer.referralCode || "",
    registered: Boolean(viewer.registeredAt),
    registeredAt: viewer.registeredAt || "",
    registeredUsed: Number(viewer.registeredUsed || 0)
  };
}

function normalizeQuotaInput(input) {
  const clientViewerId = cleanViewerId(input?.viewerId);
  const referralCode = cleanReferralCode(input?.referralCode);
  const referredBy = cleanReferralCode(input?.referredBy);
  const email = cleanCreatorEmail(input?.userEmail);
  const name = cleanCreatorName(input?.userName);
  const ipHash = hashValue(input?.ip || "local");
  const registered = Boolean(email && name !== "无名受害者");
  const emailHash = email ? hashValue(email.toLowerCase()) : "";
  const accountViewerId = emailHash ? `user_${emailHash.slice(0, 24)}` : "";
  return {
    clientViewerId,
    emailHash,
    guestAvatar: Boolean(input?.guestAvatar && !registered),
    ipHash,
    name,
    referralCode,
    referredBy,
    registered,
    viewerId: registered ? accountViewerId : clientViewerId
  };
}

function getReferralClaimKeys(normalized) {
  const identityKeys = [
    normalized.viewerId ? `viewer:${normalized.viewerId}` : "",
    normalized.emailHash ? `email:${normalized.emailHash}` : "",
    normalized.clientViewerId ? `client:${normalized.clientViewerId}` : ""
  ].filter(Boolean);

  return identityKeys.length ? identityKeys : [`ip:${normalized.ipHash}`];
}

async function readQuotaIndex() {
  if (!hasBlobToken()) {
    return memoryQuota;
  }

  try {
    const metadata = await head(QUOTA_PATH, { ...blobAuthOptions() });
    const response = await fetch(`${metadata.url}?ts=${Date.now()}`, {
      cache: "no-store",
      headers: blobAuthHeader()
    });
    if (!response.ok) {
      return createEmptyIndex();
    }

    return normalizeIndex(await response.json());
  } catch {
    return createEmptyIndex();
  }
}

async function writeQuotaIndex(index) {
  const normalized = normalizeIndex(index);
  memoryQuota.ips = normalized.ips;
  memoryQuota.referralClaims = normalized.referralClaims;
  memoryQuota.referralCodes = normalized.referralCodes;
  memoryQuota.viewers = normalized.viewers;
  if (!hasBlobToken()) {
    return;
  }

  await put(QUOTA_PATH, JSON.stringify(normalized, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    ...blobAuthOptions()
  });
}

function normalizeIndex(index) {
  return {
    ips: index?.ips && typeof index.ips === "object" ? index.ips : {},
    referralClaims: index?.referralClaims && typeof index.referralClaims === "object" ? index.referralClaims : {},
    referralCodes: index?.referralCodes && typeof index.referralCodes === "object" ? index.referralCodes : {},
    viewers: index?.viewers && typeof index.viewers === "object" ? index.viewers : {}
  };
}

function createEmptyIndex() {
  return {
    ips: {},
    referralClaims: {},
    referralCodes: {},
    viewers: {}
  };
}

function hashValue(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function getDefaultReferralCode(viewerId) {
  return `r_${hashValue(viewerId).slice(0, 12)}`;
}

function getHeader(req, name) {
  const value = req?.headers?.[name] || req?.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : String(value || "").trim();
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
