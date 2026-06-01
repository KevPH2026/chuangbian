import gifenc from "gifenc";
import sharp from "sharp";
import { verifyAuthToken } from "./authStore.js";
import { detectAction, getRolePreset, normalizeCaption } from "./chuangbianPrompt.js";
import { buildCombo, findGalleryItem, hashGalleryVariant, markGalleryItemUsed, saveGeneratedGif, toPublicGalleryItem } from "./galleryStore.js";
import { generateImage } from "./imageProvider.js";
import { getRuntimeModelConfig } from "./modelConfigStore.js";
import { cleanCreatorEmail, cleanCreatorName, cleanReferralCode, cleanViewerId, consumeQuota, getClientIp, getQuotaStatus } from "./quotaStore.js";

const { GIFEncoder, applyPalette, quantize } = gifenc;
const FRAME_SIZE = 240;

export async function createActionGif({ body = {}, env = process.env, req }) {
  const text = normalizeCaption(body.text);
  if (!text) {
    throwHttpError(400, "先输入一句话，GIF 才知道该怎么发疯。");
  }

  const auth = verifyAuthToken(body.authToken);
  const wantsAvatar = body.role === "avatar";
  const avatarImage = cleanAvatarImage(body.avatarImage);
  if (wantsAvatar && !avatarImage) {
    throwHttpError(400, "选择“我的头像”前，先上传一张自己的形象。");
  }

  const creatorId = auth?.viewerId ? cleanViewerId(auth.viewerId) : cleanViewerId(body.creatorId);
  const creatorName = auth ? cleanCreatorName(auth.name) : "无名受害者";
  const creatorEmail = auth ? cleanCreatorEmail(auth.email) : "";
  const quotaInput = {
    guestAvatar: wantsAvatar && !auth,
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
    const error = new Error(quotaPreview.registered ? "今天的窗边额度用完了。" : "未注册 IP 额度用完了，登录后继续动。");
    error.status = 429;
    error.quota = quotaPreview;
    throw error;
  }

  const { action, combo, meta, rolePreset } = getActionGifDescriptor({
    avatarImage,
    role: body.role,
    text
  });
  const cached = await findGalleryItem(combo.comboKey);
  if (cached?.mediaType === "gif") {
    const cachedItem = (await markGalleryItemUsed(combo.comboKey)) || cached;
    const quota = await consumeQuota(quotaInput).catch(() => quotaPreview);
    return {
      ...meta,
      cached: true,
      gif: cachedItem.imageUrl,
      item: toPublicGalleryItem(cachedItem, effectiveCreatorId),
      quota
    };
  }

  const runtimeModel = await getRuntimeModelConfig({
    env,
    requestedQuality: body.quality || "low",
    requestedSize: body.size || "1024x1024"
  });
  if (!runtimeModel.apiKey) {
    throwHttpError(500, "生图模型 Key 还没配置。");
  }

  const asset = await generateActionGifAsset({
    avatarImage: wantsAvatar ? avatarImage : "",
    runtimeModel,
    role: body.role,
    text
  });
  let item = null;
  let warning = "";
  try {
    item = await saveGeneratedGif({
      combo,
      creatorId: effectiveCreatorId,
      creatorName,
      creatorEmailHash: creatorEmail ? hashGalleryVariant(creatorEmail.toLowerCase()) : "",
      gif: asset.gif,
      meta,
      model: runtimeModel.model,
      prompt: asset.prompt
    });
  } catch (error) {
    warning = `GIF 已生成，但入库失败：${error?.message || "未知错误"}`;
  }
  const quota = await consumeQuota(quotaInput).catch(() => quotaPreview);

  return {
    ...meta,
    cached: false,
    frames: asset.frames,
    gif: asset.gif,
    item: item ? toPublicGalleryItem(item, effectiveCreatorId) : null,
    quota,
    sheetImage: asset.sheetImage,
    warning
  };
}

export function getActionGifDescriptor({ avatarImage = "", role, text }) {
  const caption = normalizeCaption(text);
  const rolePreset = getRolePreset(role);
  const action = detectAction(caption);
  const meta = {
    action: action.id,
    actionName: action.name,
    caption,
    role: rolePreset.id,
    roleName: rolePreset.name
  };
  const combo = buildCombo({
    text: caption,
    role: rolePreset.id,
    variant: buildActionGifVariant({ actionId: action.id, avatarImage })
  });

  return { action, combo, meta, rolePreset };
}

export async function generateActionGifAsset({ avatarImage = "", runtimeModel, role, text }) {
  const { action, meta, rolePreset } = getActionGifDescriptor({ avatarImage, role, text });
  const prompt = buildActionGifPrompt({ action, hasAvatar: Boolean(avatarImage), rolePreset, text: meta.caption });
  const sheetImage = await generateImage({
    apiKey: runtimeModel.apiKey,
    baseURL: runtimeModel.baseURL,
    model: runtimeModel.model,
    prompt,
    quality: runtimeModel.quality,
    referenceImage: avatarImage,
    size: runtimeModel.size
  });
  const frames = await splitStoryboardFrames(sheetImage);
  const gif = await encodeGif(frames);

  return {
    ...meta,
    frames,
    gif,
    prompt,
    sheetImage
  };
}

function buildActionGifVariant({ actionId, avatarImage }) {
  return `gif:${actionId}:${avatarImage ? hashGalleryVariant(avatarImage) : ""}`;
}

function buildActionGifPrompt({ action, hasAvatar, rolePreset, text }) {
  const roleLine =
    rolePreset.id === "opossum"
      ? "the same gray and white real opossum from the original viral blue-window meme, photographic, low-resolution repost screenshot feel, slightly blurry, narrow snout, small black ears, no 3D, no cute plush redesign"
      : rolePreset.id === "avatar" && hasAvatar
        ? "the uploaded person transformed into a humanized 3D meme figurine, recognizable hairstyle, glasses, face vibe and outfit color from the reference, not anime, not manga, not flat comic"
        : `${rolePreset.name}, a simple 3D chibi meme character, compact toy-like body`;
  const background =
    "same camera angle in all four frames: realistic indoor apartment blue night window, gray metal frame, visible silver window handle, beige curtain at the side, cold blue glass, close meme crop";
  const framePlan = buildFramePlan(action.id, text);
  const textStyle =
    action.id === "question" || action.id === "ai"
      ? `put the Chinese text "${text}" in a white rounded speech bubble with black outline, mostly in the final frame`
      : `put the Chinese text "${text}" as bold white meme caption with black shadow, stable and readable`;

  return [
    "Create ONE square image that is an animation sprite sheet, exactly a 2x2 grid with four equal square panels.",
    "Panel order is top-left frame 1, top-right frame 2, bottom-left frame 3, bottom-right frame 4.",
    "No extra panels, no numbering, no labels, no comic borders except thin separation gaps between panels.",
    "The four panels must show the same character, same background, same lighting, and same crop, only the pose changes.",
    roleLine,
    background,
    framePlan,
    textStyle,
    "Chinese internet meme style, awkward, funny, low-pressure, shareable as a sticker.",
    "Important: show real body motion across frames, not just camera zoom or lighting change."
  ].join(" ");
}

function buildFramePlan(actionId, text) {
  if (actionId === "question") {
    return [
      "Frame 1: character stands by the window, body facing the window, both hands clasped behind the back.",
      "Frame 2: body stays facing the window and hands remain behind the back, only the head starts twisting back.",
      "Frame 3: head suddenly turns back toward the viewer with confused 'huh?' energy, body still not rotated.",
      `Frame 4: hold the head-turned pose, confused expression, speech bubble says "${text}".`
    ].join(" ");
  }
  if (actionId === "interaction") {
    return [
      "Frame 1: character stands by the window, body mostly facing the window, hands behind the back.",
      "Frame 2: character notices someone in the room and turns head toward the viewer.",
      "Frame 3: one hand or paw comes out from behind the back and starts reaching forward.",
      "Frame 4: character faces the viewer more clearly and extends one hand or paw forward as greeting, handshake, or receiving something."
    ].join(" ");
  }
  if (actionId === "work") {
    return [
      "Frame 1: character faces the window, hands behind back.",
      "Frame 2: shoulders sink lower from workplace pressure.",
      "Frame 3: head turns slightly sideways as if being judged by KPI.",
      "Frame 4: character freezes in a deadpan office-pressure pose."
    ].join(" ");
  }
  if (actionId === "money") {
    return [
      "Frame 1: character faces the window, hands behind back.",
      "Frame 2: neck shrinks down and shoulders rise.",
      "Frame 3: body curls smaller with defeated poverty energy.",
      "Frame 4: character holds the shrunken low-pressure pose."
    ].join(" ");
  }
  if (actionId === "ai") {
    return [
      "Frame 1: character faces the blue window, hands behind back.",
      "Frame 2: head begins to turn with robotic precision.",
      "Frame 3: head turns back with a cold analytical stare.",
      "Frame 4: hold the cold stare, as if judging human efficiency."
    ].join(" ");
  }
  return [
    "Frame 1: character faces the blue window, hands clasped behind the back.",
    "Frame 2: character hesitates and slightly raises the shoulders.",
    "Frame 3: character turns the head a little toward the viewer.",
    "Frame 4: character freezes in an awkward meme reaction pose."
  ].join(" ");
}

async function splitStoryboardFrames(image) {
  const buffer = await imageToBuffer(image);
  const source = sharp(buffer, { animated: false });
  const metadata = await source.metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  if (!width || !height) {
    throw new Error("动作分镜图尺寸异常。");
  }

  const columns = 2;
  const rows = 2;
  const tileWidth = Math.floor(width / columns);
  const tileHeight = Math.floor(height / rows);
  const frames = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const left = column * tileWidth;
      const top = row * tileHeight;
      const extractWidth = column === columns - 1 ? width - left : tileWidth;
      const extractHeight = row === rows - 1 ? height - top : tileHeight;
      const frame = await sharp(buffer, { animated: false })
        .extract({ left, top, width: extractWidth, height: extractHeight })
        .resize(FRAME_SIZE, FRAME_SIZE, { fit: "cover" })
        .png({ compressionLevel: 9, quality: 72 })
        .toBuffer();
      frames.push(`data:image/png;base64,${frame.toString("base64")}`);
    }
  }
  return frames;
}

async function encodeGif(frames) {
  const gif = GIFEncoder();
  const delays = [260, 150, 150, 620];
  for (let index = 0; index < frames.length; index += 1) {
    const buffer = await imageToBuffer(frames[index]);
    const { data } = await sharp(buffer, { animated: false }).resize(FRAME_SIZE, FRAME_SIZE, { fit: "cover" }).ensureAlpha().raw().toBuffer({
      resolveWithObject: true
    });
    const palette = quantize(data, 160, { format: "rgb444" });
    const indexed = applyPalette(data, palette);
    gif.writeFrame(indexed, FRAME_SIZE, FRAME_SIZE, {
      delay: delays[index] || 160,
      palette,
      repeat: 0
    });
  }
  gif.finish();
  return `data:image/gif;base64,${Buffer.from(gif.bytes()).toString("base64")}`;
}

async function imageToBuffer(image) {
  const source = String(image || "");
  if (source.startsWith("data:image/")) {
    const match = source.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
    if (!match) {
      throw new Error("图片数据格式不对。");
    }
    return Buffer.from(match[1], "base64");
  }

  if (!/^https?:\/\//.test(source)) {
    throw new Error("图片地址不对。");
  }
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error("动作图下载失败。");
  }
  return Buffer.from(await response.arrayBuffer());
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

function throwHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
