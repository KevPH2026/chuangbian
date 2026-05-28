import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { assertAdminAccess, getAdminDashboard } from "./lib/adminData.js";
import { sendLoginCode, verifyAuthToken, verifyLoginCode } from "./lib/authStore.js";
import { buildChuangbianPrompt, normalizeCaption } from "./lib/chuangbianPrompt.js";
import {
  buildCombo,
  findGalleryItem,
  getCategoryForMeta,
  getCategoryName,
  getGalleryCategories,
  getGalleryItems,
  hashGalleryVariant,
  markGalleryItemUsed,
  saveGeneratedImage,
  toPublicGalleryItem,
  toPublicGalleryItems,
  updateGalleryThumbnail
} from "./lib/galleryStore.js";
import { generateImage } from "./lib/imageProvider.js";
import { getTodayMemeMetrics, trackTodayMemeVisit } from "./lib/metricsStore.js";
import { getRuntimeModelConfig, saveModelConfig } from "./lib/modelConfigStore.js";
import { saveUserProfileUpload } from "./lib/profileStore.js";
import {
  cleanCreatorEmail,
  cleanCreatorName,
  cleanReferralCode,
  cleanViewerId,
  consumeQuota,
  getClientIp,
  getQuotaStatus
} from "./lib/quotaStore.js";
import { getPublicWishes, saveWish, voteWish } from "./lib/wishStore.js";
import { createWorkplacePack } from "./lib/workplacePackService.js";

function imageApiPlugin(env) {
  return {
    name: "chuangbian-image-api",
    configureServer(server) {
      server.middlewares.use("/api/gallery", async (req, res) => {
        try {
          if (req.method === "GET") {
            const items = await getGalleryItems();
            const viewerId = getViewerId(req.url);
            const publicItems = toPublicGalleryItems(items, viewerId);
            sendJson(res, 200, { items: publicItems, categories: getGalleryCategories(publicItems) });
            return;
          }

          if (req.method === "POST" || req.method === "PATCH") {
            const body = await readJson(req);
            await updateGalleryThumbnail(body);
            const items = await getGalleryItems();
            const publicItems = toPublicGalleryItems(items, cleanViewerId(body.viewerId));
            sendJson(res, 200, { items: publicItems, categories: getGalleryCategories(publicItems) });
            return;
          }

          if (req.method === "DELETE") {
            sendJson(res, 402, { error: "生图免费，删图 9.9，请转账。为什么收钱，因为没做删除功能。" });
            return;
          }

          sendJson(res, 405, { error: "Only GET, POST, PATCH and DELETE are supported" });
        } catch (error) {
          server.config.logger.error(error);
          sendJson(res, error?.status || 500, { error: error?.message || "Gallery request failed" });
        }
      });

      server.middlewares.use("/api/admin", async (req, res) => {
        if (!["GET", "POST"].includes(req.method)) {
          sendJson(res, 405, { error: "Only GET and POST are supported" });
          return;
        }

        try {
          assertAdminAccess(req);
          if (req.method === "POST") {
            const body = await readJson(req);
            if (body.action === "model-config") {
              const modelConfig = await saveModelConfig(body.modelConfig || {});
              const dashboard = await getAdminDashboard();
              sendJson(res, 200, { ...dashboard, modelConfig });
              return;
            }
            sendJson(res, 400, { error: "后台没看懂这个保存动作。" });
            return;
          }

          const dashboard = await getAdminDashboard();
          sendJson(res, 200, dashboard);
        } catch (error) {
          server.config.logger.error(error);
          sendJson(res, error?.status || 500, { error: error?.message || "Admin request failed" });
        }
      });

      server.middlewares.use("/api/profiles", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Only POST is supported" });
          return;
        }

        try {
          const body = await readJson(req);
          const auth = verifyAuthToken(body.authToken);
          if (!auth) {
            sendJson(res, 401, { error: "先邮箱验证码登录，再上传自己的窗边替身。" });
            return;
          }
          const profile = await saveUserProfileUpload({
            avatarImage: body.avatarImage,
            ip: getClientIp(req),
            referralCode: body.referralCode,
            userAgent: getHeader(req, "user-agent"),
            userEmail: auth.email,
            userName: auth.name,
            viewerId: auth.viewerId
          });
          sendJson(res, 200, { ok: true, profile });
        } catch (error) {
          server.config.logger.error(error);
          sendJson(res, error?.status || 500, { error: error?.message || "Profile upload failed" });
        }
      });

      server.middlewares.use("/api/auth", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Only POST is supported" });
          return;
        }

        try {
          const body = await readJson(req);
          const action = String(body.action || "").trim();
          if (action === "send") {
            const result = await sendLoginCode({
              email: body.email,
              ip: getClientIp(req),
              name: body.name,
              userAgent: getHeader(req, "user-agent")
            });
            sendJson(res, 200, { ok: true, ...result });
            return;
          }

          if (action === "verify") {
            const result = await verifyLoginCode({
              code: body.code,
              email: body.email,
              ip: getClientIp(req),
              loginTicket: body.loginTicket,
              name: body.name,
              referralCode: body.referralCode,
              userAgent: getHeader(req, "user-agent"),
              viewerId: body.viewerId
            });
            sendJson(res, 200, { ok: true, ...result });
            return;
          }

          sendJson(res, 400, { error: "Unknown auth action" });
        } catch (error) {
          server.config.logger.error(error);
          sendJson(res, error?.status || 500, { error: error?.message || "Auth request failed" });
        }
      });

      server.middlewares.use("/api/metrics", async (req, res) => {
        try {
          if (req.method === "GET") {
            const metrics = await getTodayMemeMetrics();
            sendJson(res, 200, { metrics });
            return;
          }

          if (req.method === "POST") {
            const body = await readJson(req);
            const metrics = await trackTodayMemeVisit({
              ip: getClientIp(req),
              userAgent: getHeader(req, "user-agent"),
              viewerId: body.viewerId
            });
            sendJson(res, 200, { metrics });
            return;
          }

          sendJson(res, 405, { error: "Only GET and POST are supported" });
        } catch (error) {
          server.config.logger.error(error);
          sendJson(res, error?.status || 500, { error: error?.message || "Metrics request failed" });
        }
      });

      server.middlewares.use("/api/wishes", async (req, res) => {
        try {
          if (req.method === "GET") {
            const items = await getPublicWishes({ voterKey: getClientIp(req) });
            sendJson(res, 200, { items });
            return;
          }

          const body = await readJson(req);
          if (req.method === "POST") {
            const auth = verifyAuthToken(body.authToken);
            const wish = await saveWish({
              email: auth ? cleanCreatorEmail(auth.email) : "",
              name: auth ? cleanCreatorName(auth.name) : cleanCreatorName(body.userName),
              text: body.text,
              viewerId: auth?.viewerId ? cleanViewerId(auth.viewerId) : cleanViewerId(body.viewerId)
            });
            const items = await getPublicWishes({ voterKey: getClientIp(req) });
            sendJson(res, 200, { ok: true, items, wish });
            return;
          }

          if (req.method === "PATCH") {
            const result = await voteWish({
              id: body.id,
              voterKey: getClientIp(req)
            });
            const items = await getPublicWishes({ voterKey: getClientIp(req) });
            sendJson(res, 200, { ok: true, items, ...result });
            return;
          }

          sendJson(res, 405, { error: "Only GET, POST and PATCH are supported" });
        } catch (error) {
          server.config.logger.error(error);
          sendJson(res, error?.status || 500, { error: error?.message || "Wish request failed" });
        }
      });

      server.middlewares.use("/api/workplace-pack", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Only POST is supported" });
          return;
        }

        try {
          const body = await readJson(req);
          const result = await createWorkplacePack({ body, env: { ...env, ...process.env }, req });
          sendJson(res, 200, result);
        } catch (error) {
          server.config.logger.error(error);
          sendJson(res, error?.status || 500, {
            error: error?.message || "Workplace pack generation failed",
            quota: error?.quota
          });
        }
      });

      server.middlewares.use("/api/quota", async (req, res) => {
        if (req.method !== "GET") {
          sendJson(res, 405, { error: "Only GET is supported" });
          return;
        }

        try {
          const url = new URL(req.url || "", "http://localhost");
          const auth = verifyAuthToken(url.searchParams.get("authToken"));
          const quota = await getQuotaStatus({
            ip: getClientIp(req),
            referralCode: cleanReferralCode(url.searchParams.get("referralCode")),
            userEmail: auth ? cleanCreatorEmail(auth.email) : "",
            userName: auth ? cleanCreatorName(auth.name) : "",
            viewerId: auth?.viewerId ? cleanViewerId(auth.viewerId) : cleanViewerId(url.searchParams.get("viewerId"))
          });
          sendJson(res, 200, { quota });
        } catch (error) {
          server.config.logger.error(error);
          sendJson(res, error?.status || 500, { error: error?.message || "Quota request failed" });
        }
      });

      server.middlewares.use("/api/generate", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Only POST is supported" });
          return;
        }

        try {
          const body = await readJson(req);
          const text = normalizeCaption(body.text);
          if (!text) {
            sendJson(res, 400, { error: "先输入一句窗边时刻。" });
            return;
          }

          const avatarImage = cleanAvatarImage(body.avatarImage);
          const auth = verifyAuthToken(body.authToken);
          const wantsAvatar = body.role === "avatar";
          const hasAvatar = wantsAvatar && Boolean(avatarImage);
          const guestAvatar = wantsAvatar && !auth;
          const creatorId = auth?.viewerId ? cleanViewerId(auth.viewerId) : cleanViewerId(body.creatorId);
          const creatorName = auth ? cleanCreatorName(auth.name) : "无名受害者";
          const creatorEmail = auth ? cleanCreatorEmail(auth.email) : "";
          const creatorEmailHash = creatorEmail ? hashGalleryVariant(creatorEmail.toLowerCase()) : "";
          const quotaInput = {
            guestAvatar,
            ip: getClientIp(req),
            referralCode: cleanReferralCode(body.referralCode),
            referredBy: cleanReferralCode(body.referredBy),
            userEmail: creatorEmail,
            userName: creatorName,
            viewerId: creatorId
          };
          const quotaPreview = await getQuotaStatus(quotaInput);
          const effectiveCreatorId = quotaPreview.viewerId || creatorId;
          if (quotaPreview.remaining <= 0) {
            const error = new Error(
              quotaPreview.registered
                ? "今天的窗边额度用完了。拉一个新受害者来用，就给你加 5 张。"
                : "未注册 IP 额度用完了。注册昵称和邮箱后额外获得 2 张。"
            );
            error.status = 429;
            error.quota = quotaPreview;
            throw error;
          }

          if (guestAvatar && quotaPreview.guestAvatarRemaining <= 0) {
            const error = new Error("游客用自己照片只能生成 1 次。登录后可以继续管理自己的形象。");
            error.status = 429;
            error.quota = quotaPreview;
            throw error;
          }
          if (wantsAvatar && !hasAvatar) {
            sendJson(res, 400, { error: "选择“我的头像”前，先上传一张自己的形象。", quota: quotaPreview });
            return;
          }

          const avatarVariant = hasAvatar ? hashGalleryVariant(avatarImage) : "";
          const { prompt, meta } = buildChuangbianPrompt({
            text,
            role: body.role,
            hasAvatar,
            userName: creatorName
          });
          const combo = buildCombo({ text, role: meta.role, variant: avatarVariant });
          const cached = await findGalleryItem(combo.comboKey);

          if (cached) {
            const item = (await markGalleryItemUsed(combo.comboKey)) || cached;
            const quota = await consumeQuota(quotaInput);
            sendJson(res, 200, {
              image: item.imageUrl,
              cached: true,
              comboKey: item.comboKey,
              item: toPublicGalleryItem(item, effectiveCreatorId),
              meta: metaFromItem(item),
              quota
            });
            return;
          }

          const runtimeModel = await getRuntimeModelConfig({
            env: { ...env, ...process.env },
            requestedQuality: body.quality || "",
            requestedSize: body.size || ""
          });
          if (!runtimeModel.apiKey) {
            sendJson(res, 500, { error: "生图模型 Key 还没配置。可以在后台模型配置里填 Key，或在本地环境变量里设置 OPENAI_API_KEY。" });
            return;
          }

          const image = await generateImage({
            apiKey: runtimeModel.apiKey,
            baseURL: runtimeModel.baseURL,
            model: runtimeModel.model,
            prompt,
            size: runtimeModel.size,
            quality: runtimeModel.quality,
            referenceImage: hasAvatar ? avatarImage : ""
          });

          let item;
          let storageWarning = "";
          try {
            item = await saveGeneratedImage({ image, model: runtimeModel.model, meta, prompt, combo, creatorId: effectiveCreatorId, creatorName, creatorEmailHash });
          } catch (storageError) {
            if (!isSuspendedStorageError(storageError)) {
              throw storageError;
            }
            storageWarning = "图库存储暂时被暂停，本次先直接返回图片。";
            item = {
              id: combo.comboKey,
              comboKey: combo.comboKey,
              caption: combo.caption,
              role: meta.role,
              roleName: meta.roleName,
              action: meta.action,
              actionName: meta.actionName,
              category: getCategoryForMeta(meta),
              categoryName: getCategoryName(getCategoryForMeta(meta)),
              creatorId: effectiveCreatorId,
              creatorName,
              imageUrl: image,
              downloadUrl: image,
              thumbnail: image,
              uses: 1
            };
          }
          const category = getCategoryForMeta(meta);
          const quota = await consumeQuota(quotaInput).catch(() => quotaPreview);
          sendJson(res, 200, {
            image: item.imageUrl,
            cached: false,
            comboKey: item.comboKey,
            item: toPublicGalleryItem(item, effectiveCreatorId),
            meta: { ...meta, category, categoryName: getCategoryName(category) },
            quota,
            warning: storageWarning
          });
        } catch (error) {
          server.config.logger.error(error);
          sendJson(res, error?.status || 500, { error: error?.message || "Image generation failed", quota: error?.quota });
        }
      });
    }
  };
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function getHeader(req, name) {
  const value = req?.headers?.[name] || req?.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : String(value || "").trim();
}

function metaFromItem(item) {
  return {
    role: item.role,
    roleName: item.roleName,
    action: item.action,
    actionName: item.actionName,
    category: item.category,
    categoryName: item.categoryName,
    caption: item.caption
  };
}

function cleanAvatarImage(value) {
  const image = String(value || "").trim();
  if (!image) {
    return "";
  }
  if (!image.startsWith("data:image/")) {
    return "";
  }
  if (image.length > 2_500_000) {
    const error = new Error("头像图片太大，请换一张更小的头像。");
    error.status = 413;
    throw error;
  }
  return image;
}

function getViewerId(url) {
  try {
    const requestUrl = new URL(url || "", "http://localhost");
    return cleanViewerId(requestUrl.searchParams.get("viewerId"));
  } catch {
    return "";
  }
}

function isSuspendedStorageError(error) {
  return /suspended|store is blocked|forbidden/i.test(String(error?.message || error || ""));
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const useMemoryStorage = process.env.CHUANGBIAN_STORAGE === "memory";
  for (const key of [
    "ADMIN_PASSWORD",
    "ADMIN_TOKEN",
    "BLOB_READ_WRITE_TOKEN",
    "CONFIG_ENCRYPTION_KEY",
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "OPENAI_IMAGE_MODEL",
    "OPENAI_IMAGE_QUALITY",
    "OPENAI_IMAGE_SIZE",
    "EMAIL_FROM",
    "RESEND_API_KEY",
    "VERCEL_OIDC_TOKEN"
  ]) {
    if (useMemoryStorage && ["BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN"].includes(key)) {
      continue;
    }
    if (!process.env[key] && env[key]) {
      process.env[key] = env[key];
    }
  }

  return {
    plugins: [react(), imageApiPlugin(env)],
    server: {
      host: "0.0.0.0"
    }
  };
});
