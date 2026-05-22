import { head, put } from "@vercel/blob";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const MODEL_CONFIG_PATH = "chuangbian/model-config.json";

export const MODEL_PRESETS = [
  {
    id: "tokenrouter-gpt-image-2",
    name: "TokenRouter / GPT Image",
    baseURL: "https://api.tokenrouter.com/v1",
    model: "openai/gpt-5.4-image-2",
    size: "256x256",
    quality: "low"
  },
  {
    id: "openai-gpt-image-2",
    name: "OpenAI / gpt-image-2",
    baseURL: "https://api.openai.com/v1",
    model: "gpt-image-2",
    size: "256x256",
    quality: "low"
  },
  {
    id: "openai-gpt-image-1",
    name: "OpenAI / gpt-image-1",
    baseURL: "https://api.openai.com/v1",
    model: "gpt-image-1",
    size: "512x512",
    quality: "low"
  },
  {
    id: "openai-dall-e-3",
    name: "OpenAI / DALL·E 3",
    baseURL: "https://api.openai.com/v1",
    model: "dall-e-3",
    size: "1024x1024",
    quality: "standard"
  },
  {
    id: "custom-openai-compatible",
    name: "自定义 OpenAI 兼容",
    baseURL: "",
    model: "",
    size: "256x256",
    quality: "low"
  }
];

const DEFAULT_MODEL_CONFIG = {
  enabled: false,
  presetId: "tokenrouter-gpt-image-2",
  baseURL: "https://api.tokenrouter.com/v1",
  model: "openai/gpt-5.4-image-2",
  size: "256x256",
  quality: "low"
};

const memoryModelConfig = {
  item: null
};

export function getModelPresets() {
  return MODEL_PRESETS.map((preset) => ({ ...preset }));
}

export async function getPublicModelConfig(env = process.env) {
  const stored = await readModelConfig();
  const normalized = normalizeModelConfig(stored);
  const envKey = String(env.OPENAI_API_KEY || "").trim();
  const storedKey = decryptApiKey(normalized.apiKeyEncrypted);
  const active = normalized.enabled ? normalized : envModelConfig(env);
  const activeKey = normalized.enabled ? storedKey : envKey;

  return {
    ...publicFields(active),
    apiKeyHint: normalized.enabled ? normalized.apiKeyHint || maskSecret(storedKey) : maskSecret(envKey),
    hasApiKey: Boolean(activeKey),
    keySource: normalized.enabled ? (storedKey ? "后台加密配置" : "后台未填 Key") : envKey ? "环境变量" : "未配置",
    presets: getModelPresets(),
    savedEnabled: normalized.enabled
  };
}

export async function getRuntimeModelConfig({ env = process.env, requestedQuality = "", requestedSize = "" } = {}) {
  const stored = await readModelConfig();
  const normalized = normalizeModelConfig(stored);
  if (normalized.enabled) {
    const apiKey = decryptApiKey(normalized.apiKeyEncrypted);
    return {
      apiKey,
      baseURL: normalized.baseURL,
      model: normalized.model,
      quality: normalized.quality || requestedQuality || "low",
      size: normalized.size || requestedSize || "256x256",
      source: "admin"
    };
  }

  return {
    apiKey: String(env.OPENAI_API_KEY || "").trim(),
    baseURL: String(env.OPENAI_BASE_URL || "").trim(),
    model: String(env.OPENAI_IMAGE_MODEL || "gpt-image-2").trim(),
    quality: requestedQuality || String(env.OPENAI_IMAGE_QUALITY || "low").trim(),
    size: requestedSize || String(env.OPENAI_IMAGE_SIZE || "256x256").trim(),
    source: "env"
  };
}

export async function saveModelConfig(input = {}) {
  const current = normalizeModelConfig(await readModelConfig());
  const next = normalizeModelConfig({
    ...current,
    baseURL: input.baseURL,
    enabled: Boolean(input.enabled),
    model: input.model,
    presetId: input.presetId,
    quality: input.quality,
    size: input.size,
    updatedAt: new Date().toISOString()
  });

  const cleanKey = cleanApiKey(input.apiKey);
  if (cleanKey) {
    next.apiKeyEncrypted = encryptApiKey(cleanKey);
    next.apiKeyHint = maskSecret(cleanKey);
  } else {
    next.apiKeyEncrypted = current.apiKeyEncrypted || "";
    next.apiKeyHint = current.apiKeyHint || "";
  }

  await writeModelConfig(next);
  return getPublicModelConfig();
}

function envModelConfig(env) {
  return {
    ...DEFAULT_MODEL_CONFIG,
    baseURL: String(env.OPENAI_BASE_URL || DEFAULT_MODEL_CONFIG.baseURL).trim(),
    enabled: false,
    model: String(env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL_CONFIG.model).trim(),
    quality: String(env.OPENAI_IMAGE_QUALITY || DEFAULT_MODEL_CONFIG.quality).trim(),
    size: String(env.OPENAI_IMAGE_SIZE || DEFAULT_MODEL_CONFIG.size).trim()
  };
}

function publicFields(config) {
  return {
    baseURL: config.baseURL || "",
    enabled: Boolean(config.enabled),
    model: config.model || "",
    presetId: config.presetId || DEFAULT_MODEL_CONFIG.presetId,
    quality: config.quality || DEFAULT_MODEL_CONFIG.quality,
    size: config.size || DEFAULT_MODEL_CONFIG.size,
    updatedAt: config.updatedAt || ""
  };
}

async function readModelConfig() {
  if (!hasBlobToken()) {
    return memoryModelConfig.item;
  }

  try {
    const metadata = await head(MODEL_CONFIG_PATH, { ...blobAuthOptions() });
    const response = await fetch(`${metadata.url}?ts=${Date.now()}`, {
      cache: "no-store",
      headers: blobAuthHeader()
    });
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch {
    return null;
  }
}

async function writeModelConfig(config) {
  const normalized = normalizeModelConfig(config);
  memoryModelConfig.item = normalized;
  if (!hasBlobToken()) {
    return normalized;
  }

  await put(MODEL_CONFIG_PATH, JSON.stringify(normalized, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/json",
    ...blobAuthOptions()
  });
  return normalized;
}

function normalizeModelConfig(config) {
  return {
    ...DEFAULT_MODEL_CONFIG,
    apiKeyEncrypted: String(config?.apiKeyEncrypted || ""),
    apiKeyHint: String(config?.apiKeyHint || ""),
    baseURL: cleanBaseURL(config?.baseURL) || DEFAULT_MODEL_CONFIG.baseURL,
    enabled: Boolean(config?.enabled),
    model: cleanModel(config?.model) || DEFAULT_MODEL_CONFIG.model,
    presetId: cleanPresetId(config?.presetId) || DEFAULT_MODEL_CONFIG.presetId,
    quality: cleanQuality(config?.quality) || DEFAULT_MODEL_CONFIG.quality,
    size: cleanSize(config?.size) || DEFAULT_MODEL_CONFIG.size,
    updatedAt: String(config?.updatedAt || "")
  };
}

function encryptApiKey(apiKey) {
  const secret = getEncryptionSecret();
  if (!secret || !apiKey) {
    return "";
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptApiKey(value) {
  const encrypted = String(value || "");
  const secret = getEncryptionSecret();
  if (!encrypted || !secret || !encrypted.startsWith("v1.")) {
    return "";
  }

  try {
    const [, iv, tag, payload] = encrypted.split(".");
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(payload, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

function deriveKey(secret) {
  return createHash("sha256").update(String(secret || "")).digest();
}

function getEncryptionSecret() {
  return String(process.env.CONFIG_ENCRYPTION_KEY || process.env.ADMIN_TOKEN || process.env.ADMIN_PASSWORD || process.env.BLOB_READ_WRITE_TOKEN || "").trim();
}

function cleanApiKey(value) {
  return String(value || "").trim().slice(0, 400);
}

function cleanBaseURL(value) {
  const url = String(value || "").trim().replace(/\/$/, "").slice(0, 180);
  if (!url) {
    return "";
  }
  return /^https?:\/\//i.test(url) ? url : "";
}

function cleanModel(value) {
  return String(value || "").trim().slice(0, 120);
}

function cleanPresetId(value) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

function cleanQuality(value) {
  const quality = String(value || "").trim().toLowerCase();
  return ["auto", "low", "medium", "high", "standard", "hd"].includes(quality) ? quality : "";
}

function cleanSize(value) {
  const size = String(value || "").trim();
  return /^\d{2,4}x\d{2,4}$/.test(size) ? size : "";
}

function maskSecret(secret) {
  const value = String(secret || "");
  if (!value) {
    return "";
  }
  if (value.length <= 10) {
    return `${value.slice(0, 2)}***${value.slice(-2)}`;
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
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
