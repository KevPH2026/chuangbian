import {
  cleanCreatorEmail,
  cleanCreatorName,
  cleanReferralCode,
  cleanViewerId,
  getClientIp,
  getQuotaStatus
} from "../lib/quotaStore.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Only GET is supported" });
    return;
  }

  try {
    const url = new URL(req.url || "", "http://localhost");
    const quota = await getQuotaStatus({
      ip: getClientIp(req),
      referralCode: cleanReferralCode(url.searchParams.get("referralCode")),
      userEmail: cleanCreatorEmail(url.searchParams.get("userEmail")),
      userName: cleanCreatorName(url.searchParams.get("userName")),
      viewerId: cleanViewerId(url.searchParams.get("viewerId"))
    });
    res.status(200).json({ quota });
  } catch (error) {
    res.status(error?.status || 500).json({ error: error?.message || "Quota request failed" });
  }
}
