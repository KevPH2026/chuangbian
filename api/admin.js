import { assertAdminAccess, getAdminDashboard } from "../lib/adminData.js";
import { saveModelConfig } from "../lib/modelConfigStore.js";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.status(405).json({ error: "Only GET and POST are supported" });
    return;
  }

  try {
    assertAdminAccess(req);
    if (req.method === "POST") {
      const body = parseBody(req.body);
      if (body.action === "model-config") {
        const modelConfig = await saveModelConfig(body.modelConfig || {});
        const dashboard = await getAdminDashboard();
        res.status(200).json({ ...dashboard, modelConfig });
        return;
      }
      res.status(400).json({ error: "后台没看懂这个保存动作。" });
      return;
    }

    const dashboard = await getAdminDashboard();
    res.status(200).json(dashboard);
  } catch (error) {
    res.status(error?.status || 500).json({ error: error?.message || "Admin request failed" });
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
