const DEFAULT_BRANCH = "chuangbian-data";
const DEFAULT_DIR = "data";

export function isGithubStorageEnabled(env = process.env) {
  return getGithubConfig(env).enabled;
}

export async function readGithubJson(path, env = process.env) {
  const file = await readGithubFile(path, env);
  if (!file) {
    return null;
  }

  return JSON.parse(file.buffer.toString("utf8"));
}

export async function writeGithubJson(path, value, env = process.env) {
  return writeGithubFile(path, Buffer.from(JSON.stringify(value, null, 2)), {
    contentType: "application/json",
    env,
    message: `chore(data): update ${path}`
  });
}

export async function putGithubFile(path, buffer, { contentType = "application/octet-stream", env = process.env } = {}) {
  return writeGithubFile(path, buffer, {
    contentType,
    env,
    message: `chore(data): upload ${path}`
  });
}

async function readGithubFile(path, env = process.env) {
  const config = getGithubConfig(env);
  if (!config.enabled) {
    return null;
  }

  try {
    const data = await githubRequest(config, `/repos/${config.repo}/contents/${encodeRepoPath(storagePath(config, path))}?ref=${encodeURIComponent(config.branch)}`);
    if (!data || Array.isArray(data) || data.type !== "file" || !data.content) {
      return null;
    }

    return {
      buffer: Buffer.from(String(data.content).replace(/\n/g, ""), "base64"),
      sha: data.sha
    };
  } catch (error) {
    if (error?.status === 404) {
      return null;
    }
    throw error;
  }
}

async function writeGithubFile(path, buffer, { contentType, env = process.env, message } = {}) {
  const config = getGithubConfig(env);
  if (!config.enabled) {
    throw new Error("GitHub storage is not configured.");
  }

  const fullPath = storagePath(config, path);
  const content = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  let lastError;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const existing = await readGithubFile(path, env);
      await githubRequest(config, `/repos/${config.repo}/contents/${encodeRepoPath(fullPath)}`, {
        method: "PUT",
        body: {
          branch: config.branch,
          content: content.toString("base64"),
          message,
          ...(existing?.sha ? { sha: existing.sha } : {})
        }
      });

      const rawUrl = rawGithubUrl(config, fullPath);
      return {
        contentType,
        downloadUrl: rawUrl,
        url: rawUrl
      };
    } catch (error) {
      lastError = error;
      if (error?.status !== 409) {
        break;
      }
    }
  }

  throw lastError || new Error("GitHub storage write failed.");
}

async function githubRequest(config, endpoint, { method = "GET", body } = {}) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      "User-Agent": "chuangbian-meme",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.message || `GitHub storage request failed with ${response.status}`);
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

function getGithubConfig(env) {
  const storage = String(env.CHUANGBIAN_STORAGE || "").trim().toLowerCase();
  const token = String(env.CHUANGBIAN_GITHUB_TOKEN || "").trim();
  const repoInput = String(env.CHUANGBIAN_GITHUB_REPO || "").trim();
  const repo = repoInput.match(/^[^/\s]+\/[^/\s]+$/) ? repoInput : "";
  return {
    branch: String(env.CHUANGBIAN_GITHUB_BRANCH || DEFAULT_BRANCH).trim() || DEFAULT_BRANCH,
    dir: String(env.CHUANGBIAN_GITHUB_DIR || DEFAULT_DIR).trim().replace(/^\/+|\/+$/g, "") || DEFAULT_DIR,
    enabled: storage === "github" && Boolean(token && repo),
    repo: repo ? repo.split("/").map(encodeURIComponent).join("/") : "",
    repoRaw: repo,
    token
  };
}

function storagePath(config, path) {
  return [config.dir, String(path || "").replace(/^\/+/, "")].filter(Boolean).join("/");
}

function encodeRepoPath(path) {
  return String(path || "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

function rawGithubUrl(config, path) {
  const repo = config.repoRaw || config.repo;
  return `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(config.branch)}/${encodeRepoPath(path)}`;
}
