export const WORKPLACE_PACK_COUNT = 9;

export const WORKPLACE_PACK_POOL = [
  "客户说再微调一下",
  "方案在做 人在窗边",
  "KPI很亮 我很暗",
  "这班非上不可吗",
  "收到 但灵魂不收",
  "需求很小 伤害很大",
  "排期排到下辈子",
  "老板你先睡 我站会儿",
  "日报写完 人也空了",
  "开会开到灵魂离线",
  "今天又被工作挑选",
  "工位没塌 我塌了",
  "先别催 我在重启",
  "这个锅我先看着",
  "加班使我靠近窗户",
  "预算没有 梦想很大",
  "对齐了 但没活路",
  "先同步一下痛苦",
  "收到 我先破防",
  "改完了 也改命吗",
  "需求来了 人没了",
  "PPT在发光 我在消失",
  "今天适合静默离职",
  "领导说再想想",
  "我没意见 我没灵魂",
  "工牌还在 人不在",
  "下班只是一个传说"
];

export function normalizeWorkplacePackCaptions(input) {
  const rawItems = Array.isArray(input)
    ? input
    : String(input || "")
        .split(/\r?\n|[|｜]/g);
  return rawItems
    .map((item) =>
      String(item || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 18)
    )
    .filter(Boolean)
    .slice(0, WORKPLACE_PACK_COUNT);
}

export function pickWorkplacePackCaptions(seed = Date.now()) {
  const shuffled = [...WORKPLACE_PACK_POOL]
    .map((text, index) => ({ text, score: seededScore(`${seed}:${text}:${index}`) }))
    .sort((a, b) => a.score - b.score)
    .map((item) => item.text);
  return shuffled.slice(0, WORKPLACE_PACK_COUNT);
}

export function buildWorkplacePackPrompt({ captions, userName = "" }) {
  const cleanCaptions = normalizeWorkplacePackCaptions(captions);
  const captionLines = cleanCaptions.map((caption, index) => `panel ${index + 1}: "${caption}"`).join("; ");
  const nameLine = userName ? `The character identity is ${userName}, based on the uploaded reference portrait.` : "Use the uploaded portrait as identity reference.";

  return [
    "Create one square 3x3 sticker sheet containing exactly nine equal square panels, no missing panels, no extra panels",
    "all nine panels must share one consistent visual style, same character identity, same outfit vibe, same blue night window meme setting",
    nameLine,
    "humanized 3D toy-like meme person from the uploaded portrait, recognizable hairstyle, glasses, face shape and outfit vibe, not anime, not manga, not comic illustration, not flat cartoon",
    "each panel: realistic indoor apartment or office window, gray metal window frame, silver curved handles, cold blue night glass, dark city bokeh outside, beige curtain if useful",
    "workplace meme energy: tired, restrained, office low pressure, hands clasped behind back near the window; vary head turn, shoulder slump, tiny gesture, and facial expression to match each caption",
    "each panel must be independently usable as a square Chinese sticker after cropping; keep the character and caption inside each panel with margins",
    "large bold white Chinese caption with black shadow in every panel, short and readable",
    `captions by panel order left to right, top to bottom: ${captionLines}`
  ].join(", ");
}

function seededScore(value) {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
