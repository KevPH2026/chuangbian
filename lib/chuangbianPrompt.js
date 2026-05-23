export const ROLE_PRESETS = [
  {
    id: "opossum",
    name: "负鼠",
    short: "原图感",
    character:
      "the same gray and white opossum from the classic viral window meme, small black ears, narrow snout, side/back profile, standing upright with hands clasped behind its back",
    style:
      "strictly preserve the original opossum window meme style: photographic, slightly blurry, low-resolution repost feel, blue night window, simple crop, no redesign"
  },
  {
    id: "glasses-man",
    name: "Q版眼镜男",
    short: "小领导",
    character:
      "a Chinese chibi man with black slicked hair, black rectangular glasses, a tiny goatee, and a black suit",
    style:
      "clean 3D chibi character render blended with a realistic indoor window background, soft plastic toy material"
  },
  {
    id: "worker",
    name: "打工人",
    short: "工位低气压",
    character:
      "a tired Chinese chibi office worker in a dark suit, slightly hunched, with a resigned face",
    style:
      "clean 3D chibi character render blended with a realistic indoor window background, subtle office-worker exhaustion"
  },
  {
    id: "boss",
    name: "老板",
    short: "压迫感",
    character:
      "a stern Chinese chibi boss in a black suit, compact body, polished hair, calm but oppressive presence",
    style:
      "clean 3D chibi character render blended with a realistic indoor window background, understated boss pressure"
  },
  {
    id: "ai",
    name: "AI助手",
    short: "冷漠审视",
    character:
      "a minimal cold robot assistant with a smooth white faceplate and dark suit-like body, not cute, quietly judgmental",
    style:
      "clean 3D chibi cyber assistant render blended with a realistic indoor window background, cold blue technology mood"
  },
  {
    id: "avatar",
    name: "我的头像",
    short: "头像拟人",
    character:
      "the person from the uploaded portrait reference, transformed into a human-like 3D meme figurine, small head and compact body, recognizable hairstyle, glasses, face vibe, outfit color and age impression",
    style:
      "use the uploaded portrait only as identity reference, render a humanized 3D toy-like meme person similar to a social sticker, not manga, not anime, not comic illustration, not flat cartoon"
  }
];

const ACTION_PRESETS = [
  {
    id: "question",
    name: "扭头疑惑",
    test: isQuestionLike,
    pose:
      "the torso, shoulders, hips, legs, and clasped hands stay completely facing the window; the body must NOT rotate toward the viewer. Only the head and neck twist back toward the viewer, creating a clear 'huh?' questioning feeling while both hands remain clasped behind the back",
    expression: "confused, questioning, timid, harmless, awkwardly funny, no scary eyes",
    textTreatment:
      "a white rounded speech bubble with a black outline in the upper right, black Chinese text inside"
  },
  {
    id: "money",
    name: "缩脖低气压",
    test: (text) => includesAny(text, ["钱", "房租", "账单", "穷", "工资", "余额", "还款", "花呗", "借呗", "信用卡"]),
    pose:
      "the body faces the window, both hands clasped behind the back, neck tucked down, shoulders slightly raised, looking out at the blue night with defeated poverty energy",
    expression: "shrunken, resigned, financially haunted",
    textTreatment:
      "large bold white Chinese caption over the lower middle-right area, with a soft black drop shadow"
  },
  {
    id: "work",
    name: "工作审判",
    test: (text) =>
      includesAny(text, ["客户", "老板", "kpi", "KPI", "方案", "需求", "加班", "绩效", "汇报", "会议", "微调", "干活"]),
    pose:
      "the body faces the window, both hands clasped behind the back, head turns slightly sideways with a restrained judgmental office stare",
    expression: "quietly pressured, suspicious, workplace deadpan",
    textTreatment:
      "large bold white Chinese caption over the lower middle-right area, with a soft black drop shadow"
  },
  {
    id: "love",
    name: "恋爱沉默",
    test: (text) => includesAny(text, ["消息", "已读", "不回", "爱", "喜欢", "恋爱", "备注", "分手", "前任", "忙"]),
    pose:
      "the body faces the window, both hands clasped behind the back, head only turns a little, silently staring at the cold blue window",
    expression: "quiet emo, pretending not to care",
    textTreatment:
      "large bold white Chinese caption over the lower middle-right area, with a soft black drop shadow"
  },
  {
    id: "ai",
    name: "AI审视",
    test: (text) => /\b(ai|gpt|openai|deepseek|token)\b|人工智能|提示词|模型|算力|人类|效率/i.test(text),
    pose:
      "the body faces the window, both hands clasped behind the back, head turns back with a cold analytical stare, judging human efficiency",
    expression: "cold, analytical, unimpressed",
    textTreatment:
      "a white rounded speech bubble with a black outline in the upper right, black Chinese text inside"
  }
];

const DEFAULT_ACTION = {
  id: "default",
  name: "认命看窗",
  pose:
    "the body faces the window, both hands clasped behind the back, head does not turn back, only a side/back profile is visible, fully resigned",
  expression: "resigned, low-pressure, absurdly calm",
  textTreatment:
    "large bold white Chinese caption over the lower middle-right area, with a soft black drop shadow"
};

function includesAny(text, keywords) {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function isQuestionLike(text) {
  return /[?？]|啊[？?]?$|啊$|吗$|呢$|么$|啥|什么|为啥|为什么|怎么|咋|谁|哪|凭什么|合理吗|真的假的|尊嘟假嘟|不是哥们/i.test(
    String(text || "").trim()
  );
}

export function getRolePreset(roleId) {
  return ROLE_PRESETS.find((role) => role.id === roleId) || ROLE_PRESETS[1];
}

export function detectAction(text) {
  const normalized = String(text || "").trim();
  return ACTION_PRESETS.find((action) => action.test(normalized)) || DEFAULT_ACTION;
}

export function normalizeCaption(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, 42);
}

export function buildChuangbianPrompt({ text, role, hasAvatar = false, userName = "" }) {
  const caption = normalizeCaption(text);
  const rolePreset = getRolePreset(role);
  let action = detectAction(caption);
  if (action.id === "default" && rolePreset.id === "ai") {
    action = ACTION_PRESETS.find((item) => item.id === "ai") || action;
  }
  if (rolePreset.id === "opossum" && action.id !== "question") {
    action = {
      id: "opossum-original",
      name: "原图侧影",
      pose:
        "preserve the original pose: the opossum is in side/back profile, facing the blue window, hands clasped behind its back, no head twist toward the viewer, no direct eye contact",
      expression: "original awkward opossum meme expression, neutral and funny, not scary",
      textTreatment:
        "large bold white Chinese caption directly over the image, like the original meme, no speech bubble"
    };
  }

  const roleLine =
    rolePreset.id === "opossum"
      ? "gray and white opossum, photographic low-resolution repost style, no 3D, no cute redesign"
      : rolePreset.id === "avatar" && hasAvatar
        ? "uploaded person as a humanized 3D meme figurine, recognizable hairstyle, glasses, face shape and outfit vibe from the reference, small compact body, natural toy-like material, not anime, not manga, not comic, not flat cartoon"
        : `${rolePreset.name}, simple 3D chibi meme character`;
  const actionLine =
    action.id === "question"
      ? "body faces the window, hands behind back, only head twists back with confused huh feeling"
      : `${action.name}, body faces the window, hands behind back`;
  const textLine =
    action.id === "question" || action.id === "ai"
      ? `speech bubble with Chinese text: ${caption}`
      : `big bold white Chinese text: ${caption}`;

  const prompt = [
    "square Chinese internet meme image",
    roleLine,
    rolePreset.id === "avatar"
      ? "strictly use the original opossum window meme background: realistic indoor apartment window, gray metal frame, silver curved window handles, beige curtain at the side, cold blue night glass, dark city bokeh outside, close crop, no mountain, no lake, no fantasy scenery"
      : "blue night window, gray frame, visible window handle, cold blue light",
    actionLine,
    textLine,
    rolePreset.id === "avatar"
      ? "funny awkward low-pressure sticker, preserve the blue window meme composition, body standing near the window with hands clasped behind the back, avoid illustration style"
      : "funny, awkward, low-pressure, shareable sticker, simple crop"
  ].join(", ");

  return {
    prompt,
    meta: {
      role: rolePreset.id,
      roleName: rolePreset.name,
      action: action.id,
      actionName: action.name,
      caption,
      userName: normalizeCaption(userName).slice(0, 18)
    }
  };
}
