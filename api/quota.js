import {
  cleanCreatorEmail,
  cleanCreatorName,
  cleanReferralCode,
  cleanViewerId,
  getClientIp,
  getQuotaStatus
} from "../lib/quotaStore.js";
import { verifyAuthToken } from "../lib/authStore.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Only GET is supported" });
    return;
  }

  try {
    const url = new URL(req.url || "", "http://localhost");
    const auth = verifyAuthToken(url.searchParams.get("authToken"));
    const quota = await getQuotaStatus({
      ip: getClientIp(req),
      referralCode: cleanReferralCode(url.searchParams.get("referralCode")),
      userEmail: auth ? cleanCreatorEmail(auth.email) : "",
      userName: auth ? cleanCreatorName(auth.name) : "",
      viewerId: auth?.viewerId ? cleanViewerId(auth.viewerId) : cleanViewerId(url.searchParams.get("viewerId"))
    });
    res.status(200).json({ quota });
  } catch (error) {
    res.status(error?.status || 500).json({ error: error?.message || "Quota request failed" });
  }
}
