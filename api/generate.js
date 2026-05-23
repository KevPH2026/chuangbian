import { buildChuangbianPrompt, normalizeCaption } from "../lib/chuangbianPrompt.js";
import {
  buildCombo,
  findGalleryItem,
  getCategoryForMeta,
  getCategoryName,
  hashGalleryVariant,
  markGalleryItemUsed,
  saveGeneratedImage,
  toPublicGalleryItem
} from "../lib/galleryStore.js";
import { generateImage } from "../lib/imageProvider.js";
import { getRuntimeModelConfig } from "../lib/modelConfigStore.js";
import {
  cleanCreatorEmail,
  cleanCreatorName,
  cleanReferralCode,
  cleanViewerId,
  consumeQuota,
  getClientIp,
  getQuotaStatus
} from "../lib/quotaStore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Only POST is supported" });
    return;
  }

  try {
    const body = parseBody(req.body);
    const text = normalizeCaption(body.text);
    if (!text) {
      res.status(400).json({ error: "先输入一句窗边时刻。" });
      return;
    }

    const avatarImage = cleanAvatarImage(body.avatarImage);
    const creatorId = cleanViewerId(body.creatorId);
    const creatorName = cleanCreatorName(body.userName);
    const creatorEmail = cleanCreatorEmail(body.userEmail);
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
    const effectiveCreatorId = quotaPreview.viewerId || creatorId;
    if (quotaPreview.remaining <= 0) {
      const error = new Error(
        quotaPreview.registered
          ? "今天的窗边额度用完了。拉一个新受害者来用，就给你加 5 张。"
          : "未注册 IP 额度用完了。注册昵称和邮箱后解锁上传自己形象，并额外获得 2 张。"
      );
      error.status = 429;
      error.quota = quotaPreview;
      throw error;
    }

    const hasAvatar = body.role === "avatar" && Boolean(avatarImage);
    if (body.role === "avatar" && !hasAvatar) {
      res.status(400).json({ error: "选择“我的头像”前，先注册昵称、邮箱并上传头像。", quota: quotaPreview });
      return;
    }

    const avatarVariant = hasAvatar ? hashGalleryVariant(avatarImage) : "";
    const { prompt, meta } = buildChuangbianPrompt({
      text,
      role: body.role,
      hasAvatar,
      userName: body.userName
    });
    const combo = buildCombo({ text, role: meta.role, variant: avatarVariant });
    const cached = await findGalleryItem(combo.comboKey);

    if (cached) {
      const item = (await markGalleryItemUsed(combo.comboKey)) || cached;
      const quota = await consumeQuota(quotaInput);
      res.status(200).json({
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
      requestedQuality: body.quality || "",
      requestedSize: body.size || ""
    });
    if (!runtimeModel.apiKey) {
      res.status(500).json({ error: "生图模型 Key 还没配置。可以在后台模型配置里填 Key，或在部署环境变量里设置 OPENAI_API_KEY。" });
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

    const item = await saveGeneratedImage({ image, model: runtimeModel.model, meta, prompt, combo, creatorId: effectiveCreatorId, creatorName, creatorEmailHash });
    const category = getCategoryForMeta(meta);
    const quota = await consumeQuota(quotaInput);
    res.status(200).json({
      image: item.imageUrl,
      cached: false,
      comboKey: item.comboKey,
      item: toPublicGalleryItem(item, effectiveCreatorId),
      meta: {
        ...meta,
        category,
        categoryName: getCategoryName(category)
      },
      quota
    });
  } catch (error) {
    res.status(error?.status || 500).json({ error: error?.message || "Image generation failed", quota: error?.quota });
  }
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

function parseBody(body) {
  if (!body) {
    return {};
  }

  if (typeof body === "string") {
    return JSON.parse(body);
  }

  return body;
}
