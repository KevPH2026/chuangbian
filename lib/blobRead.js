export async function readBlobJson(url, { token = "" } = {}) {
  const response = await fetch(`${url}?ts=${Date.now()}`, {
    cache: "no-store",
    headers: token ? { authorization: `Bearer ${token}` } : {}
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw createBlobReadError(response.status, detail);
  }

  return response.json();
}

export function createBlobReadError(status, detail = "") {
  const message = String(detail || "");
  const error = new Error(
    status === 403 && /store is blocked|suspended/i.test(message)
      ? "Vercel Blob 存储被暂停了。数据还在存储里，但当前不能读取；恢复 Blob Store 后图库和许愿墙会回来。"
      : `Vercel Blob 读取失败：${status}`
  );
  error.status = status === 403 ? 503 : 500;
  error.code = status === 403 && /store is blocked|suspended/i.test(message) ? "BLOB_STORE_SUSPENDED" : "BLOB_READ_FAILED";
  return error;
}
