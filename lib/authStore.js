import { head, put } from "@vercel/blob";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { saveUserProfileUpload } from "./profileStore.js";
import { cleanCreatorEmail, cleanCreatorName, cleanReferralCode, cleanViewerId } from "./quotaStore.js";

const AUTH_PATH = "chuangbian/auth-index.json";
const CODE_TTL_MS = 10 * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;
const AUTH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const memoryAuth = {
  codes: {}
};

export async function sendLoginCode({ email = "", name = "", ip = "", userAgent = "" }) {
  const cleanEmail = requireEmail(email);
  const cleanName = requireName(name);
  const now = Date.now();
  const index = await readAuthIndex();
  const emailHash = hashValue(cleanEmail.toLowerCase());
  const existing = index.codes[emailHash];

  if (existing?.sentAt && now - Number(existing.sentAt || 0) < SEND_COOLDOWN_MS) {
    const error = new Error("验证码刚发过，先别把邮箱当门铃按。");
    error.status = 429;
    throw error;
  }

  const code = String(randomInt(100000, 1000000));
  await sendVerificationEmail({ code, email: cleanEmail, name: cleanName });

  index.codes[emailHash] = {
    attempts: 0,
    codeHash: signValue(`${cleanEmail.toLowerCase()}:${code}`),
    emailHash,
    expiresAt: now + CODE_TTL_MS,
    ipHash: hashValue(ip || "local").slice(0, 16),
    name: cleanName,
    sentAt: now,
    userAgent: String(userAgent || "").slice(0, 180)
  };
  await writeAuthIndex(index);

  return {
    expiresIn: Math.round(CODE_TTL_MS / 1000),
    maskedEmail: maskEmail(cleanEmail)
  };
}

export async function verifyLoginCode({
  code = "",
  email = "",
  ip = "",
  name = "",
  referralCode = "",
  userAgent = "",
  viewerId = ""
}) {
  const cleanEmail = requireEmail(email);
  const cleanName = requireName(name);
  const cleanCode = String(code || "").trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    const error = new Error("验证码是 6 位数字，别整抽象的。");
    error.status = 400;
    throw error;
  }

  const index = await readAuthIndex();
  const emailHash = hashValue(cleanEmail.toLowerCase());
  const record = index.codes[emailHash];
  if (!record || Number(record.expiresAt || 0) < Date.now()) {
    delete index.codes[emailHash];
    await writeAuthIndex(index);
    const error = new Error("验证码过期了，重新发一个。");
    error.status = 400;
    throw error;
  }

  if (Number(record.attempts || 0) >= 6) {
    delete index.codes[emailHash];
    await writeAuthIndex(index);
    const error = new Error("试太多次了，验证码当场辞职。重新发一个吧。");
    error.status = 429;
    throw error;
  }

  const expected = String(record.codeHash || "");
  const actual = signValue(`${cleanEmail.toLowerCase()}:${cleanCode}`);
  if (!safeEqual(expected, actual)) {
    record.attempts = Number(record.attempts || 0) + 1;
    await writeAuthIndex(index);
    const error = new Error("验证码不对。窗边没有这么好骗。");
    error.status = 400;
    throw error;
  }

  delete index.codes[emailHash];
  await writeAuthIndex(index);

  const profile = await saveUserProfileUpload({
    avatarImage: "",
    ip,
    referralCode: cleanReferralCode(referralCode),
    userAgent,
    userEmail: cleanEmail,
    userName: cleanName,
    viewerId: cleanViewerId(viewerId)
  });
  const auth = {
    email: cleanEmail,
    expiresAt: Date.now() + AUTH_TTL_MS,
    issuedAt: Date.now(),
    maskedEmail: profile.maskedEmail || maskEmail(cleanEmail),
    name: profile.name || cleanName,
    viewerId: profile.viewerId
  };

  return {
    profile: {
      ...profile,
      email: cleanEmail,
      maskedEmail: auth.maskedEmail
    },
    token: signAuthToken(auth)
  };
}

export function verifyAuthToken(token) {
  const raw = String(token || "").trim();
  const [payloadPart, signature] = raw.split(".");
  if (!payloadPart || !signature) {
    return null;
  }

  const expected = signValue(payloadPart);
  if (!safeEqual(expected, signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    if (!payload?.viewerId || !payload?.email || Number(payload.expiresAt || 0) < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function signAuthToken(payload) {
  const payloadPart = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadPart}.${signValue(payloadPart)}`;
}

async function sendVerificationEmail({ code, email, name }) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.EMAIL_FROM || "").trim();
  if (!apiKey || !from) {
    const error = new Error("邮箱登录还没接好线。先用游客模式生成，站长配好发信服务后就能收验证码。");
    error.code = "EMAIL_NOT_CONFIGURED";
    error.status = 500;
    throw error;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      subject: "窗边 Meme 登录验证码",
      text: `你的窗边验证码是：${code}。10 分钟内有效。不是你本人就不用管，可能有人精神状态到了窗边。`,
      to: [email],
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a"><h2>窗边 Meme</h2><p>${escapeHtml(
        name
      )}，你的登录验证码：</p><p style="font-size:28px;font-weight:800;letter-spacing:4px">${code}</p><p>10 分钟内有效。不是你本人就不用管。</p></div>`
    })
  });

  if (!response.ok) {
    const data = await response.json().catch(async () => ({ message: await response.text() }));
    const error = new Error(data?.message || data?.error?.message || "验证码邮件发送失败。");
    error.status = response.status;
    throw error;
  }
}

async function readAuthIndex() {
  if (!hasBlobToken()) {
    return normalizeAuthIndex(memoryAuth);
  }

  try {
    const metadata = await head(AUTH_PATH, { ...blobAuthOptions() });
    const response = await fetch(`${metadata.url}?ts=${Date.now()}`, {
      cache: "no-store",
      headers: blobAuthHeader()
    });
    if (!response.ok) {
      return { codes: {} };
    }
    return normalizeAuthIndex(await response.json());
  } catch {
    return { codes: {} };
  }
}

async function writeAuthIndex(index) {
  const normalized = normalizeAuthIndex(index);
  memoryAuth.codes = normalized.codes;
  if (!hasBlobToken()) {
    return normalized;
  }

  await put(AUTH_PATH, JSON.stringify(normalized, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
    contentType: "application/json",
    ...blobAuthOptions()
  });
  return normalized;
}

function normalizeAuthIndex(index) {
  const codes = {};
  const now = Date.now();
  for (const [key, record] of Object.entries(index?.codes || {})) {
    if (record?.codeHash && Number(record.expiresAt || 0) > now) {
      codes[key] = {
        ...record,
        attempts: Number(record.attempts || 0),
        expiresAt: Number(record.expiresAt || 0),
        sentAt: Number(record.sentAt || 0)
      };
    }
  }
  return { codes, updatedAt: new Date().toISOString(), version: 1 };
}

function requireEmail(value) {
  const email = cleanCreatorEmail(value);
  if (!email) {
    const error = new Error("填个能收验证码的邮箱。");
    error.status = 400;
    throw error;
  }
  return email;
}

function requireName(value) {
  const name = cleanCreatorName(value);
  if (name === "无名受害者") {
    const error = new Error("昵称也填一下，不然窗边不知道怎么称呼你。");
    error.status = 400;
    throw error;
  }
  return name;
}

function signValue(value) {
  return createHmac("sha256", getSecret()).update(String(value || "")).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getSecret() {
  return String(process.env.CONFIG_ENCRYPTION_KEY || process.env.ADMIN_TOKEN || process.env.BLOB_READ_WRITE_TOKEN || "local-dev-secret").trim();
}

function hashValue(value) {
  return createHmac("sha256", getSecret()).update(String(value || "")).digest("hex");
}

function maskEmail(email) {
  const [name, domain] = String(email || "").split("@");
  if (!name || !domain) {
    return "";
  }
  return `${name.slice(0, 2)}${"*".repeat(Math.max(2, Math.min(6, name.length - 2)))}@${domain}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
