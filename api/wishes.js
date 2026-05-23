import { cleanCreatorEmail, cleanCreatorName, cleanViewerId, getClientIp } from "../lib/quotaStore.js";
import { getPublicWishes, saveWish, voteWish } from "../lib/wishStore.js";
import { verifyAuthToken } from "../lib/authStore.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const items = await getPublicWishes({ voterKey: getClientIp(req) });
      res.status(200).json({ items });
      return;
    }

    const body = parseBody(req.body);
    if (req.method === "POST") {
      const auth = verifyAuthToken(body.authToken);
      const wish = await saveWish({
        email: auth ? cleanCreatorEmail(auth.email) : "",
        name: auth ? cleanCreatorName(auth.name) : cleanCreatorName(body.userName),
        text: body.text,
        viewerId: auth?.viewerId ? cleanViewerId(auth.viewerId) : cleanViewerId(body.viewerId)
      });
      const items = await getPublicWishes({ voterKey: getClientIp(req) });
      res.status(200).json({ ok: true, items, wish });
      return;
    }

    if (req.method === "PATCH") {
      const result = await voteWish({
        id: body.id,
        voterKey: getClientIp(req)
      });
      const items = await getPublicWishes({ voterKey: getClientIp(req) });
      res.status(200).json({ ok: true, items, ...result });
      return;
    }

    res.status(405).json({ error: "Only GET, POST and PATCH are supported" });
  } catch (error) {
    res.status(error?.status || 500).json({ error: error?.message || "Wish request failed" });
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
