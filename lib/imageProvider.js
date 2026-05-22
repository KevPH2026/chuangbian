import OpenAI from "openai";

export async function generateImage({ apiKey, baseURL, model, prompt, size, quality, referenceImage }) {
  if (referenceImage) {
    return generateImageEditWithFallback({ apiKey, baseURL, model, prompt, size, quality, referenceImage });
  }

  if (usesRouterImageGeneration(model, baseURL)) {
    return generateRouterImageWithFallback({ apiKey, baseURL, model, prompt, size, quality });
  }

  const attempts = buildImageAttempts({ size, quality });
  let lastError;
  for (const attempt of attempts) {
    try {
      return await generateOpenAIImage({ apiKey, baseURL, model, prompt, ...attempt });
    } catch (error) {
      lastError = error;
      if (!shouldTryNextAttempt(error)) {
        break;
      }
    }
  }

  throw lastError || new Error("Image generation failed");
}

async function generateImageEditWithFallback({ apiKey, baseURL, model, prompt, size, quality, referenceImage }) {
  const attempts = buildImageAttempts({ size, quality });
  let lastError;
  for (const attempt of attempts) {
    try {
      return await generateImageEdit({ apiKey, baseURL, model, prompt, referenceImage, ...attempt });
    } catch (error) {
      lastError = error;
      if (!shouldTryNextAttempt(error)) {
        break;
      }
    }
  }

  throw lastError || new Error("Image edit failed");
}

async function generateImageEdit({ apiKey, baseURL, model, prompt, size, quality, referenceImage }) {
  const endpoint = `${(baseURL || "https://api.openai.com/v1").trim().replace(/\/$/, "")}/images/edits`;
  const { blob, filename } = dataUrlToBlob(referenceImage);
  const formData = new FormData();
  formData.append("model", model);
  formData.append("prompt", prompt);
  formData.append("size", size);
  if (quality) {
    formData.append("quality", quality);
  }
  formData.append("image", blob, filename);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: formData
  });

  const data = await response.json().catch(async () => ({ error: await response.text() }));
  if (!response.ok) {
    const message = data?.error?.message || data?.error || data?.message || "Avatar image generation failed";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return extractImage(data);
}

async function generateOpenAIImage({ apiKey, baseURL, model, prompt, size, quality }) {
  const openai = new OpenAI({
    apiKey,
    baseURL: baseURL || undefined
  });

  const request = {
    model,
    prompt,
    size,
    quality
  };

  if (/gpt-image/i.test(model)) {
    request.output_format = "png";
  }

  return extractImage(await openai.images.generate(request));
}

async function generateRouterImageWithFallback({ apiKey, baseURL, model, prompt, size, quality }) {
  const attempts = buildImageAttempts({ size, quality });
  let lastError;
  for (const attempt of attempts) {
    try {
      return await generateRouterImage({ apiKey, baseURL, model, prompt, ...attempt });
    } catch (error) {
      lastError = error;
      if (!shouldTryNextAttempt(error)) {
        break;
      }
    }
  }

  throw lastError || new Error("Image generation failed");
}

async function generateRouterImage({ apiKey, baseURL, model, prompt, size, quality }) {
  const endpoint = `${baseURL.trim().replace(/\/$/, "")}/images/generations`;
  const body = {
    model,
    prompt,
    size
  };

  if (quality) {
    body.quality = quality;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(async () => ({ error: await response.text() }));
  if (!response.ok) {
    const message = data?.error?.message || data?.error || data?.message || "Image generation failed";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return extractImage(data);
}

function extractImage(data) {
  const item = data?.data?.[0];
  const imageUrl = item?.url || item?.image_url?.url || item?.imageUrl?.url;
  if (imageUrl) {
    return imageUrl;
  }

  if (item?.b64_json) {
    return `data:image/png;base64,${item.b64_json}`;
  }

  throw new Error("Image API did not return image data");
}

function dataUrlToBlob(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("头像图片格式不对，请重新上传。");
  }

  const bytes = Buffer.from(match[2], "base64");
  const extension = match[1].includes("jpeg") ? "jpg" : match[1].split("/")[1] || "png";
  return {
    blob: new Blob([bytes], { type: match[1] }),
    filename: `avatar.${extension}`
  };
}

function usesRouterImageGeneration(model, baseURL) {
  return Boolean(baseURL) && model.includes("/");
}

function buildImageAttempts({ size, quality }) {
  const requestedSize = size || "256x256";
  const requestedQuality = quality || "low";
  const attempts = [
    { size: requestedSize, quality: requestedQuality },
    { size: requestedSize, quality: undefined },
    { size: "512x512", quality: requestedQuality },
    { size: "512x512", quality: undefined },
    { size: "1024x1024", quality: requestedQuality },
    { size: "1024x1024", quality: undefined }
  ];
  const seen = new Set();
  return attempts.filter((attempt) => {
    const key = `${attempt.size}:${attempt.quality || ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function shouldTryNextAttempt(error) {
  const status = Number(error?.status || 0);
  return status === 400 || status === 422;
}
