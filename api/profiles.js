import { getClientIp } from "../lib/quotaStore.js";
import { saveUserProfileUpload } from "../lib/profileStore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Only POST is supported" });
    return;
  }

  try {
    const body = parseBody(req.body);
    const profile = await saveUserProfileUpload({
      avatarImage: body.avatarImage,
      ip: getClientIp(req),
      referralCode: body.referralCode,
      userAgent: getHeader(req, "user-agent"),
      userEmail: body.userEmail,
      userName: body.userName,
      viewerId: body.viewerId
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
