import { createActionGif } from "../lib/actionGifService.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Only POST is supported" });
    return;
  }

  try {
    const body = parseBody(req.body);
    const result = await createActionGif({ body, env: process.env, req });
    res.status(200).json(result);
  } catch (error) {
    res.status(error?.status || 500).json({
      error: error?.message || "Action GIF generation failed",
      quota: error?.quota
    });
  }
}

function parseBody(body) {
  if (!body) {
    return {};
  }
  return typeof body === "string" ? JSON.parse(body) : body;
}
