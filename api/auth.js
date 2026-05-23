import { sendLoginCode, verifyLoginCode } from "../lib/authStore.js";
import { getClientIp } from "../lib/quotaStore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Only POST is supported" });
    return;
  }

  try {
    const body = parseBody(req.body);
    const action = String(body.action || "").trim();
    if (action === "send") {
      const result = await sendLoginCode({
        email: body.email,
        ip: getClientIp(req),
        name: body.name,
        userAgent: getHeader(req, "user-agent")
      });
      res.status(200).json({ ok: true, ...result });
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
      res.status(200).json({ ok: true, ...result });
      return;
    }

    res.status(400).json({ error: "Unknown auth action" });
  } catch (error) {
    res.status(error?.status || 500).json({ error: error?.message || "Auth request failed" });
  }
}

function parseBody(body) {
  if (!body) {
    return {};
  }
  return typeof body === "string" ? JSON.parse(body) : body;
}

function getHeader(req, name) {
  const value = req?.headers?.[name] || req?.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : String(value || "").trim();
}
