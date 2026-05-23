import sharp from "sharp";

const SIZE = 512;

export async function generateFallbackMeme({ meta }) {
  const caption = String(meta?.caption || "窗边").trim() || "窗边";
  const role = String(meta?.role || "glasses-man");
  const action = String(meta?.action || "default");
  const question = action === "question" || action === "ai";
  const lines = wrapCaption(caption, question ? 8 : 7).slice(0, 4);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="night" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#16a7ff"/>
      <stop offset="0.58" stop-color="#0879d4"/>
      <stop offset="1" stop-color="#12225e"/>
    </linearGradient>
    <linearGradient id="wall" x1="0" x2="1">
      <stop offset="0" stop-color="#ded8cb"/>
      <stop offset="1" stop-color="#aeb8bd"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="2.4" flood-color="#06101f" flood-opacity=".5"/>
    </filter>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="#d7dce0"/>
  <rect x="0" y="0" width="134" height="${SIZE}" fill="url(#wall)"/>
  <rect x="114" y="0" width="20" height="${SIZE}" fill="#7e8992"/>
  <rect x="134" y="0" width="378" height="${SIZE}" fill="url(#night)"/>
  <rect x="152" y="22" width="318" height="450" rx="12" fill="none" stroke="#9bd8ff" stroke-opacity=".28" stroke-width="2"/>
  <rect x="356" y="0" width="18" height="${SIZE}" fill="#636d76"/>
  <rect x="488" y="0" width="12" height="${SIZE}" fill="#4f5963"/>
  <path d="M420 116c38-18 62 0 62 35v42" fill="none" stroke="#a8bdcd" stroke-width="14" stroke-linecap="round"/>
  <path d="M422 116c35-13 47 2 47 33v35" fill="none" stroke="#415566" stroke-width="6" stroke-linecap="round"/>
  <circle cx="229" cy="234" r="4" fill="#a9e8ff" opacity=".75"/>
  <circle cx="300" cy="298" r="3" fill="#d5f7ff" opacity=".55"/>
  <circle cx="410" cy="252" r="5" fill="#8de5ff" opacity=".6"/>
  ${characterSvg(role, question)}
  ${question ? bubbleSvg(lines) : captionSvg(lines)}
</svg>`;

  const png = await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, quality: 78 })
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

function characterSvg(role, question) {
  if (role === "opossum") {
    const head = question
      ? '<ellipse cx="176" cy="216" rx="54" ry="42" fill="#f0eee6"/><circle cx="150" cy="179" r="20" fill="#151923"/><circle cx="203" cy="185" r="18" fill="#151923"/><circle cx="191" cy="211" r="7" fill="#111827"/><ellipse cx="220" cy="226" rx="15" ry="8" fill="#e8a2a5"/>'
      : '<ellipse cx="198" cy="202" rx="74" ry="39" fill="#f0eee6"/><circle cx="160" cy="170" r="19" fill="#151923"/><circle cx="211" cy="175" r="17" fill="#151923"/><circle cx="231" cy="196" r="6" fill="#111827"/><ellipse cx="268" cy="207" rx="13" ry="8" fill="#e8a2a5"/>';
    return `
  <ellipse cx="149" cy="327" rx="58" ry="120" fill="#59605a"/>
  <ellipse cx="166" cy="336" rx="50" ry="113" fill="#74796f" opacity=".75"/>
  ${head}
  <path d="M118 386c-35 12-32 46 2 37" fill="none" stroke="#d5a38d" stroke-width="14" stroke-linecap="round"/>
  <path d="M142 385c-35 12-32 47 1 38" fill="none" stroke="#efc0a8" stroke-width="12" stroke-linecap="round"/>
  <path d="M92 248c-10 54-5 122 20 183" fill="none" stroke="#333832" stroke-width="18" stroke-linecap="round" opacity=".45"/>
  <path d="M96 448c-18 19-20 37 25 35" fill="none" stroke="#3f443f" stroke-width="18" stroke-linecap="round"/>`;
  }

  const isAi = role === "ai";
  const suit = role === "worker" ? "#3b4254" : role === "boss" ? "#111827" : isAi ? "#e9f6ff" : "#0f172a";
  const face = isAi ? "#e8fbff" : "#f0b894";
  const hair = isAi ? "#0ea5e9" : "#090b11";
  const eyes = question
    ? '<circle cx="173" cy="190" r="8" fill="#111827"/><circle cx="214" cy="190" r="8" fill="#111827"/><path d="M171 221c19 8 38 7 52-1" stroke="#111827" stroke-width="5" stroke-linecap="round" fill="none"/>'
    : '<circle cx="221" cy="189" r="7" fill="#111827"/><path d="M216 219c16 4 30 3 43-3" stroke="#111827" stroke-width="5" stroke-linecap="round" fill="none"/>';
  const head = question
    ? `<circle cx="194" cy="201" r="58" fill="${face}"/><path d="M139 185c11-48 90-62 113-14-24-13-77-8-113 14z" fill="${hair}"/>${eyes}${role === "glasses-man" || role === "boss" ? glassesSvg(194, 194) : ""}`
    : `<ellipse cx="212" cy="201" rx="47" ry="57" fill="${face}"/><path d="M168 183c10-48 74-57 98-19-23-8-62-3-98 19z" fill="${hair}"/>${eyes}${role === "glasses-man" || role === "boss" ? glassesSvg(216, 194, true) : ""}`;
  return `
  <rect x="112" y="250" width="122" height="168" rx="34" fill="${suit}"/>
  <path d="M126 294c-35 48-42 96-14 139" fill="none" stroke="${suit}" stroke-width="25" stroke-linecap="round"/>
  <path d="M223 292c-13 50-13 96 3 142" fill="none" stroke="${suit}" stroke-width="25" stroke-linecap="round"/>
  <path d="M120 420c19 20 77 22 103 0" fill="none" stroke="#efc0a8" stroke-width="17" stroke-linecap="round"/>
  <rect x="145" y="409" width="33" height="31" rx="14" fill="#efc0a8"/>
  <rect x="177" y="409" width="33" height="31" rx="14" fill="#f5c9b2"/>
  <rect x="143" y="246" width="62" height="18" rx="6" fill="#edf2f7"/>
  ${head}
  ${isAi ? '<rect x="165" y="181" width="58" height="32" rx="13" fill="#082f49"/><circle cx="183" cy="197" r="5" fill="#80ffdb"/><circle cx="207" cy="197" r="5" fill="#80ffdb"/>' : ""}`;
}

function glassesSvg(cx, cy, side = false) {
  const leftX = side ? cx - 9 : cx - 42;
  const rightX = side ? cx + 19 : cx + 9;
  return `<rect x="${leftX}" y="${cy - 13}" width="35" height="25" rx="7" fill="none" stroke="#111827" stroke-width="6"/>
  <rect x="${rightX}" y="${cy - 13}" width="35" height="25" rx="7" fill="none" stroke="#111827" stroke-width="6"/>
  <path d="M${leftX + 35} ${cy - 1}h${rightX - leftX - 35}" stroke="#111827" stroke-width="5"/>`;
}

function captionSvg(lines) {
  return `
  <g filter="url(#shadow)">
    ${lines
      .map((line, index) => `<text x="242" y="${338 + index * 48}" font-size="42" font-weight="900" fill="#fff" font-family="Arial, 'PingFang SC', sans-serif">${escapeXml(line)}</text>`)
      .join("")}
  </g>`;
}

function bubbleSvg(lines) {
  return `
  <path d="M254 96h206c20 0 36 16 36 36v72c0 20-16 36-36 36H318l-46 36 14-36h-32c-20 0-36-16-36-36v-72c0-20 16-36 36-36z" fill="#fff" stroke="#111827" stroke-width="8"/>
  ${lines
    .map((line, index) => `<text x="278" y="${153 + index * 38}" font-size="35" font-weight="900" fill="#111827" font-family="Arial, 'PingFang SC', sans-serif">${escapeXml(line)}</text>`)
    .join("")}`;
}

function wrapCaption(value, maxChars) {
  const compact = String(value || "").replace(/\s+/g, " ").trim();
  if (compact.length <= maxChars) {
    return [compact];
  }
  const lines = [];
  let current = "";
  for (const char of compact) {
    current += char;
    if (current.length >= maxChars) {
      lines.push(current);
      current = "";
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
