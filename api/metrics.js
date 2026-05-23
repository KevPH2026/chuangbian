import { getClientIp } from "../lib/quotaStore.js";
import { getTodayMemeMetrics, trackTodayMemeVisit } from "../lib/metricsStore.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const metrics = await getTodayMemeMetrics();
      res.status(200).json({ metrics });
      return;
    }

    if (req.method === "POST") {
      const body = parseBody(req.body);
      const metrics = await trackTodayMemeVisit({
        ip: getClientIp(req),
        userAgent: getHeader(req, "user-agent"),
        viewerId: body.viewerId
      });
      res.status(200).json({ metrics });
      return;
    }

    res.status(405).json({ error: "Only GET and POST are supported" });
  } catch (error) {
    res.status(error?.status || 500).json({ error: error?.message || "Metrics request failed" });
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
