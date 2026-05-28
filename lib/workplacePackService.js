import { verifyAuthToken } from "./authStore.js";
import { buildCombo, getCategoryForMeta, getCategoryName, hashGalleryVariant, saveGeneratedImage, splitImageGridToDataUrls, toPublicGalleryItem } from "./galleryStore.js";
import { generateImage } from "./imageProvider.js";
import { getRuntimeModelConfig } from "./modelConfigStore.js";
import { cleanCreatorEmail, cleanCreatorName, cleanReferralCode, cleanViewerId, consumeQuota, getClientIp, getQuotaStatus } from "./quotaStore.js";
import { buildWorkplacePackPrompt, normalizeWorkplacePackCaptions, WORKPLACE_PACK_COUNT } from "./workplacePack.js";

export async function createWorkplacePack({ body = {}, env = process.env, req }) {
  const auth = verifyAuthToken(body.authToken);
  if (!auth) {
    throwHttpError(401, "职场包只支持登录后使用。先邮箱验证码登录。");
  }

  const avatarImage = cleanAvatarImage(body.avatarImage);
  if (!avatarImage) {
    throwHttpError(400, "先上传自己的形象，再生成 9 宫格职场包。");
  }

  const captions = normalizeWorkplacePackCaptions(body.captions || body.texts || body.text);
  if (captions.length !== WORKPLACE_PACK_COUNT) {
    throwHttpError(400, "职场包需要 9 句文案，一行一句。也可以点摇骰子随机。");
  }

  const creatorId = cleanViewerId(auth.viewerId);
  const creatorName = cleanCreatorName(auth.name);
  const creatorEmail = cleanCreatorEmail(auth.email);
  const creatorEmailHash = creatorEmail ? hashGalleryVariant(creatorEmail.toLowerCase()) : "";
  const quotaInput = {
    ip: getClientIp(req),
    referralCode: cleanReferralCode(body.referralCode),
    referredBy: cleanReferralCode(body.referredBy),
    userEmail: creatorEmail,
    userName: creatorName,
    viewerId: creatorId
  };
  const quotaPreview = await getQuotaStatus(quotaInput);
  if (quotaPreview.remaining <= 0) {
    const error = new Error("今天的窗边额度用完了。拉一个新受害者来用，就给你加 5 张。");
    error.status = 429;
    error.quota = quotaPreview;
    throw error;
  }

  const runtimeModel = await getRuntimeModelConfig({
    env,
    requestedQuality: body.quality || "low",
    requestedSize: body.size || "1024x1024"
  });
  if (!runtimeModel.apiKey) {
    throwHttpError(500, "生图模型 Key 还没配置。可以在后台模型配置里填 Key，或在部署环境变量里设置 OPENAI_API_KEY。");
  }

  const prompt = buildWorkplacePackPrompt({ captions, userName: creatorName });
  const sheetImage = await generateImage({
    apiKey: runtimeModel.apiKey,
    baseURL: runtimeModel.baseURL,
    model: runtimeModel.model,
    prompt,
    quality: runtimeModel.quality,
    referenceImage: avatarImage,
    size: runtimeModel.size
  });
  const tiles = await splitImageGridToDataUrls(sheetImage, 3, 3);
  const category = "work";
  const avatarVariant = hashGalleryVariant(avatarImage);
  const packId = hashGalleryVariant(`${avatarVariant}:${captions.join("|")}:${Date.now()}`);
  const metaItems = captions.map((caption) => ({
    action: category,
    actionName: "职场包",
    caption,
    category,
    categoryName: getCategoryName(category),
    role: "avatar",
    roleName: "我的头像",
    userName: creatorName
  }));

  const items = [];
  let storageWarning = "";
  for (let index = 0; index < tiles.length; index += 1) {
    const meta = metaItems[index];
    const combo = buildCombo({
      role: meta.role,
      text: meta.caption,
      variant: `${avatarVariant}:workplace-pack:${packId}:${index}`
    });

    try {
      const item = await saveGeneratedImage({
        combo,
        creatorEmailHash,
        creatorId: quotaPreview.viewerId || creatorId,
        creatorName,
        image: tiles[index],
        meta,
        model: runtimeModel.model,
        prompt
      });
      items.push(item);
    } catch (error) {
      if (!isSuspendedStorageError(error)) {
        throw error;
      }
      storageWarning = "图库存储暂时被暂停，本次先直接返回 9 张图。";
      items.push({
        id: combo.comboKey,
        comboKey: combo.comboKey,
        caption: combo.caption,
        role: meta.role,
        roleName: meta.roleName,
        action: meta.action,
        actionName: meta.actionName,
        category: getCategoryForMeta(meta),
        categoryName: getCategoryName(getCategoryForMeta(meta)),
        creatorId: quotaPreview.viewerId || creatorId,
        creatorName,
        downloadUrl: tiles[index],
        imageUrl: tiles[index],
        thumbnail: tiles[index],
        uses: 1
      });
    }
  }

  const quota = await consumeQuota(quotaInput).catch(() => quotaPreview);
  return {
    captions,
    count: items.length,
    items: items.map((item) => toPublicGalleryItem(item, quotaPreview.viewerId || creatorId)),
    quota,
    sheetImage,
    warning: storageWarning
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
    throwHttpError(413, "头像图片太大，请换一张更小的头像。");
  }
  return image;
}

function isSuspendedStorageError(error) {
  return /suspended|store is blocked|forbidden/i.test(String(error?.message || error || ""));
}

function throwHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
