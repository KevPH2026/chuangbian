import { getClientIp } from "../lib/quotaStore.js";
import { saveUserProfileUpload } from "../lib/profileStore.js";
import { verifyAuthToken } from "../lib/authStore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Only POST is supported" });
    return;
  }

  try {
    const body = parseBody(req.body);
    const auth = verifyAuthToken(body.authToken);
    if (!auth) {
      res.status(401).json({ error: "先邮箱验证码登录，再上传自己的窗边替身。" });
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
    res.status(200).json({ ok: true, profile });
  } catch (error) {
    res.status(error?.status || 500).json({ error: error?.message || "Profile upload failed" });
  }
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

function getHeader(req, name) {
  const value = req?.headers?.[name] || req?.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : String(value || "").trim();
}
