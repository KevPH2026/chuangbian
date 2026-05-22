import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([
  ".git",
  ".vercel",
  "artifacts",
  "coverage",
  "dist",
  "node_modules"
]);
const ignoredFiles = new Set([
  ".env",
  ".env.local"
]);
const ignoredExtensions = new Set([
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
  ".zip"
]);

const allowedSnippets = [
  "sk-...",
  "sk-your-key",
  "change-me",
  "change-me-long-random-string",
  "vercel-blob-token"
];

const secretPatterns = [
  { name: "OpenAI-style API key", regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: "OpenAI project API key", regex: /\bsk-proj-[A-Za-z0-9_-]{20,}\b/g },
  { name: "Hugging Face token", regex: /\bhf_[A-Za-z0-9]{20,}\b/g },
  { name: "GitHub token", regex: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { name: "Slack token", regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { name: "Google API key", regex: /\bAIza[0-9A-Za-z_-]{20,}\b/g },
  { name: "Vercel Blob token", regex: /\bvercel_blob_[A-Za-z0-9_-]{20,}\b/g },
  {
    name: "Hardcoded env secret",
    regex: /\b(?:OPENAI_API_KEY|BLOB_READ_WRITE_TOKEN|ADMIN_TOKEN|ADMIN_PASSWORD|CONFIG_ENCRYPTION_KEY)\s*[:=]\s*["']?(?!change-me|sk-your-key|vercel-blob-token)[^"'\s]+/g
  }
];

const findings = [];
await scan(root);

if (findings.length) {
  console.error("Secret-like values found. Values are hidden on purpose:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.name}`);
  }
  process.exit(1);
}

console.log("Secret scan passed. No secret-like values found in source files.");

async function scan(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(root, absolute) || entry.name;

    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        await scan(absolute);
      }
      continue;
    }

    if (!entry.isFile() || shouldSkipFile(entry.name, relative)) {
      continue;
    }

    const info = await stat(absolute);
    if (info.size > 1_000_000) {
      continue;
    }

    const content = await readFile(absolute, "utf8").catch(() => "");
    if (!content || content.includes("\u0000")) {
      continue;
    }

    inspectContent(relative, content);
  }
}

function shouldSkipFile(name, relative) {
  if (ignoredFiles.has(name) || /\.env\..*local$/.test(name)) {
    return true;
  }
  return ignoredExtensions.has(path.extname(relative).toLowerCase());
}

function inspectContent(file, content) {
  for (const pattern of secretPatterns) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(content))) {
      const value = match[0];
      if (allowedSnippets.some((snippet) => value.includes(snippet))) {
        continue;
      }
      findings.push({
        file,
        line: content.slice(0, match.index).split("\n").length,
        name: pattern.name
      });
    }
  }
}
