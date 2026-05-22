import {
  getGalleryCategories,
  getGalleryItems,
  toPublicGalleryItems,
  updateGalleryThumbnail
} from "../lib/galleryStore.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const items = await getGalleryItems();
      const viewerId = getViewerId(req.url);
      const publicItems = toPublicGalleryItems(items, viewerId);
      res.status(200).json({ items: publicItems, categories: getGalleryCategories(publicItems) });
      return;
    }

    if (req.method === "POST" || req.method === "PATCH") {
      const body = parseBody(req.body);
      await updateGalleryThumbnail(body);
      const items = await getGalleryItems();
      const publicItems = toPublicGalleryItems(items, cleanViewerId(body.viewerId));
      res.status(200).json({ items: publicItems, categories: getGalleryCategories(publicItems) });
      return;
    }

    if (req.method === "DELETE") {
      res.status(402).json({ error: "生图免费，删图 9.9，请转账。为什么收钱，因为没做删除功能。" });
      return;
    }

    res.status(405).json({ error: "Only GET, POST, PATCH and DELETE are supported" });
  } catch (error) {
    res.status(error?.status || 500).json({ error: error?.message || "Gallery request failed" });
  }
}

function getViewerId(url) {
  try {
    const requestUrl = new URL(url || "", "http://localhost");
    return cleanViewerId(requestUrl.searchParams.get("viewerId"));
  } catch {
    return "";
  }
}

function cleanViewerId(value) {
  const viewerId = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{6,90}$/.test(viewerId) ? viewerId : "";
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
