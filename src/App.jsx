import {
  Activity,
  BarChart3,
  Copy,
  Download,
  ExternalLink,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCw,
  Send,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Users,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const roles = [
  { id: "opossum", name: "负鼠", hint: "原图味", mark: "鼠" },
  { id: "glasses-man", name: "Q版眼镜男", hint: "领导味", mark: "镜" },
  { id: "worker", name: "打工人", hint: "班味低气压", mark: "工" },
  { id: "boss", name: "老板", hint: "压迫感", mark: "板" },
  { id: "ai", name: "AI助手", hint: "冷脸 AI", mark: "AI" },
  { id: "avatar", name: "我的头像", hint: "注册解锁", mark: "我" }
];

const examplePool = [
  "啊？",
  "不是哥们",
  "我请问呢",
  "你要不要看看你在说什么",
  "这合理吗",
  "绷不住了",
  "我裂开了",
  "收到 但不改",
  "行吧",
  "你开心就好",
  "尊嘟假嘟",
  "别搞",
  "救命",
  "谁懂啊",
  "退退退",
  "我先破防",
  "你继续说",
  "别问 问就是没钱",
  "老板你睡了吗",
  "客户又微调了",
  "消息呢",
  "人类效率真低"
];

const exampleCount = 6;

const moods = [
  { id: "question", name: "扭头疑惑", detail: "身子不动，只把头拧回来", test: isQuestionLike },
  { id: "money", name: "穷鬼低气压", detail: "肩膀会自动塌下去", test: (value) => /钱|房租|账单|穷|工资|余额|还款|花呗|借呗|信用卡/.test(value) },
  { id: "work", name: "工位审判", detail: "背着手被 KPI 凝视", test: (value) => /客户|老板|kpi|KPI|方案|需求|加班|绩效|汇报|会议|微调|干活/.test(value) },
  { id: "love", name: "已读沉默", detail: "蓝窗负责替你冷静", test: (value) => /消息|已读|不回|爱|喜欢|恋爱|备注|分手|前任|忙/.test(value) },
  { id: "ai", name: "AI 审视", detail: "人类效率观察中", test: (value) => /\b(ai|gpt|openai|deepseek|token)\b|人工智能|提示词|模型|算力|人类|效率/i.test(value) }
];

const defaultMood = { id: "default", name: "认命看窗", detail: "今晚先站一会儿" };

const diagnosisBank = {
  question: {
    titles: ["疑惑拧头型", "当场问号型", "耳朵听脏了型"],
    details: ["身体还在窗边，头已经开始质问世界。", "适合回那种让对面重新组织语言的话。", "这不是疑问，这是精神刹车。"],
    replies: ["不是 你再说一遍？", "啊？我没听懂 但我先站窗边", "你要不要看看你在说什么", "这合理吗", "我请问呢"]
  },
  money: {
    titles: ["余额空窗型", "穷鬼常驻型", "账单压颈型"],
    details: ["钱包没说话，但窗户替它蓝了。", "适合发给一切消费主义刺客。", "不是低气压，是余额正在抽真空。"],
    replies: ["钱没有 窗边有", "余额在窗边替我沉默", "这个月先别做人了", "账单不同意我活着", "穷得很稳定"]
  },
  work: {
    titles: ["工位被审型", "微调创伤型", "KPI 凝视型"],
    details: ["看似站窗边，实际被需求按在玻璃上。", "适合回客户、老板、和所有凌晨冒泡的人。", "班味已经从肩膀渗出来了。"],
    replies: ["客户说微调 我说微死", "方案在做 人在窗边", "KPI 很亮 我很暗", "老板睡了吗 我还没", "收到 但灵魂不收"]
  },
  love: {
    titles: ["已读降温型", "备注遗址型", "蓝窗代哭型"],
    details: ["消息没回，风先替你回了。", "适合发给所有不值得但很上头的人。", "恋爱脑已下线，窗边脑正在接管。"],
    replies: ["消息没回 风先回了", "爱没有 已读有", "你说忙 我说行", "备注还在 人不在", "我没事 我站一会儿"]
  },
  ai: {
    titles: ["AI 冷眼型", "算力燃烧型", "人类待优化型"],
    details: ["不是 AI 不近人情，是人类样本太抽象。", "适合发给所有把人生外包给提示词的人。", "模型在算，人在窗边等命运加载。"],
    replies: ["人类效率真低 但很会许愿", "提示词写了 人没救了", "模型在算 我在站", "算力在烧 你在笑", "这题建议交给窗边"]
  },
  default: {
    titles: ["认命蓝窗型", "稳定发疯型", "沉默背手型"],
    details: ["事情还没解决，但姿态已经很完整。", "适合一切说不清但很想发一张图的时刻。", "先别解释了，窗边会替你沉默。"],
    replies: ["先别说了 站会儿窗边", "人生加载失败", "今天也是稳定发疯", "别问 问就是窗边", "我已抵达窗边"]
  }
};

const ammoBank = {
  question: {
    polite: ["我先确认一下 你是认真的吗", "收到 但我需要缓一下", "这句话信息量有点大"],
    shade: ["你这句话把窗户都问沉默了", "我理解不了 但我尊重物种多样性", "你再说一遍 我让负鼠也听听"],
    window: ["啊？我去窗边重启一下", "这题太抽象 我先背手", "我脖子已经拧过来了"]
  },
  money: {
    polite: ["我先不参与消费主义了", "这个月预算已经投降", "先活着 其他再说"],
    shade: ["你说得对 但余额不同意", "钱没来 窗边先来了", "我不是抠 我是现金流严谨"],
    window: ["余额在窗边看着我", "穷得很稳定 站得很端正", "今天先把人生赊着"]
  },
  work: {
    polite: ["收到 我先看一下", "我理解需求 但灵魂另算", "这边先排期哈"],
    shade: ["微调一下是吧 我微死一下", "方案可以改 人不一定在", "需求很小 伤害很大"],
    window: ["客户说得对 我先站窗边", "KPI 在蓝窗里发光", "班味太重 我要通风"]
  },
  love: {
    polite: ["没事 我先不打扰了", "收到 祝你忙得开心", "好 我懂了"],
    shade: ["你忙你的 我站我的窗边", "已读也算一种回复吧", "爱没有 但礼貌还在"],
    window: ["消息没回 我先背手", "备注还在 人已经蓝了", "我不等了 我站一会儿"]
  },
  ai: {
    polite: ["建议重新输入提示词", "模型理解了 但人类没有", "这个任务建议异步处理"],
    shade: ["你这需求训练集都没见过", "人类效率低 但很会加需求", "提示词不长 人生挺长"],
    window: ["算力在烧 我在窗边", "模型沉默了 我也沉默", "AI 看完也想背手"]
  },
  default: {
    polite: ["好的 我先消化一下", "收到 先放这里", "我懂 但不完全懂"],
    shade: ["你说得很好 下次别说了", "这事不能细想 一想就站窗边", "我没破防 我只是靠近窗户"],
    window: ["先别说了 去窗边", "人生加载中 请勿催促", "我已切换背手模式"]
  }
};

function cn(...values) {
  return values.filter(Boolean).join(" ");
}

function isQuestionLike(value) {
  return /[?？]|啊[？?]?$|啊$|吗$|呢$|么$|啥|什么|为啥|为什么|怎么|咋|谁|哪|凭什么|合理吗|真的假的|尊嘟假嘟|不是哥们/i.test(
    String(value || "").trim()
  );
}

function buildWindowDiagnosis(text, mood, role) {
  const cleanText = String(text || "").trim() || "啊？";
  const moodId = diagnosisBank[mood?.id] ? mood.id : "default";
  const seed = hashText(`${cleanText}:${moodId}:${role?.id || ""}`);
  const bank = diagnosisBank[moodId];
  const score = 61 + (seed % 38);
  const title = pickSeeded(bank.titles, seed);
  const detail = `${role?.name || "窗边人"}：${pickSeeded(bank.details, Math.floor(seed / 7))}`;
  const reply = pickSeeded(bank.replies, Math.floor(seed / 13));

  return {
    detail,
    reply,
    score,
    title
  };
}

function buildReplyAmmo(text, mood, role) {
  const cleanText = String(text || "").trim() || "啊？";
  const moodId = ammoBank[mood?.id] ? mood.id : "default";
  const seed = hashText(`ammo:${cleanText}:${moodId}:${role?.id || ""}`);
  const bank = ammoBank[moodId];
  return [
    {
      id: "polite",
      label: "体面装死",
      text: pickSeeded(bank.polite, seed)
    },
    {
      id: "shade",
      label: "阴阳反问",
      text: pickSeeded(bank.shade, Math.floor(seed / 11))
    },
    {
      id: "window",
      label: "彻底窗边",
      text: pickSeeded(bank.window, Math.floor(seed / 17))
    }
  ];
}

function pickSeeded(items, seed) {
  return items[Math.abs(seed) % items.length];
}

function hashText(value) {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function Root() {
  const isAdmin = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  return isAdmin ? <AdminApp /> : <App />;
}

function App() {
  const [text, setText] = useState("啊？");
  const [role, setRole] = useState("opossum");
  const [viewerId, setViewerId] = useState(() => getOrCreateViewerId());
  const [referralCode, setReferralCode] = useState(() => getOrCreateReferralCode());
  const [referredBy] = useState(() => readIncomingReferral());
  const [profileName, setProfileName] = useState(() => readLocalValue("chuangbian-profile-name"));
  const [profileEmail, setProfileEmail] = useState(() => readLocalValue("chuangbian-profile-email"));
  const [avatarImage, setAvatarImage] = useState(() => readLocalValue("chuangbian-avatar-image"));
  const [profileSyncStatus, setProfileSyncStatus] = useState("idle");
  const [profileSaved, setProfileSaved] = useState(
    Boolean(readLocalValue("chuangbian-profile-name")) && isValidEmail(readLocalValue("chuangbian-profile-email"))
  );
  const [visibleExamples, setVisibleExamples] = useState(() => pickExamples());
  const [imageUrl, setImageUrl] = useState("");
  const [meta, setMeta] = useState(null);
  const [cacheHit, setCacheHit] = useState(false);
  const [status, setStatus] = useState("idle");
  const [copyStatus, setCopyStatus] = useState("idle");
  const [diagnosisCopyStatus, setDiagnosisCopyStatus] = useState("idle");
  const [ammoCopyStatus, setAmmoCopyStatus] = useState("idle");
  const [inviteStatus, setInviteStatus] = useState("idle");
  const [shareStatus, setShareStatus] = useState("idle");
  const [wishOpen, setWishOpen] = useState(false);
  const [wishStatus, setWishStatus] = useState("idle");
  const [wishText, setWishText] = useState("");
  const [wishes, setWishes] = useState([]);
  const [wishWallStatus, setWishWallStatus] = useState("loading");
  const [wishVoteId, setWishVoteId] = useState("");
  const [quota, setQuota] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [galleryCategories, setGalleryCategories] = useState([{ id: "all", name: "全部", count: 0 }]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [galleryCopyId, setGalleryCopyId] = useState("");
  const [galleryStatus, setGalleryStatus] = useState("loading");
  const [error, setError] = useState("");

  const selectedRole = roles.find((item) => item.id === role) || roles[1];
  const isAvatarRole = role === "avatar";
  const hasProfile = profileName.trim().length > 0 && isValidEmail(profileEmail);
  const displayName = profileName.trim() || "无名受害者";
  const avatarReady = hasProfile && Boolean(avatarImage);
  const currentMood = useMemo(() => moods.find((item) => item.test(text)) || defaultMood, [text]);
  const windowDiagnosis = useMemo(() => buildWindowDiagnosis(text, currentMood, selectedRole), [text, currentMood, selectedRole]);
  const replyAmmo = useMemo(() => buildReplyAmmo(text, currentMood, selectedRole), [text, currentMood, selectedRole]);
  const quotaBlocked = Boolean(quota && quota.remaining <= 0);
  const canGenerate = text.trim().length > 0 && status !== "loading" && !quotaBlocked;
  const visibleGallery = useMemo(
    () => (activeCategory === "all" ? gallery : gallery.filter((item) => item.category === activeCategory)),
    [activeCategory, gallery]
  );

  useEffect(() => {
    loadGallery();
  }, [viewerId]);

  useEffect(() => {
    loadWishWall();
  }, []);

  useEffect(() => {
    loadQuota();
  }, [viewerId, referralCode, profileName, profileEmail]);

  useEffect(() => {
    window.localStorage.setItem("chuangbian-profile-name", profileName.trim());
    window.localStorage.setItem("chuangbian-profile-email", profileEmail.trim());
    setProfileSaved(Boolean(profileName.trim()) && isValidEmail(profileEmail));
  }, [profileName, profileEmail]);

  useEffect(() => {
    if (avatarImage) {
      window.localStorage.setItem("chuangbian-avatar-image", avatarImage);
    } else {
      window.localStorage.removeItem("chuangbian-avatar-image");
    }
  }, [avatarImage]);

  async function generateImage() {
    const nextText = text.trim();
    if (!nextText) {
      setError("先输入一句窗边时刻。");
      return;
    }

    if (isAvatarRole && !avatarReady) {
      setError("先登记昵称、邮箱并上传头像，再用“我的头像”生成。");
      return;
    }

    setStatus("loading");
    setError("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: nextText,
          role,
          creatorId: viewerId,
          referralCode: quota?.referralCode || referralCode,
          referredBy,
          userName: displayName,
          userEmail: profileEmail.trim(),
          avatarImage: isAvatarRole ? avatarImage : "",
          size: "1024x1024",
          quality: "low"
        })
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.quota) {
          setQuota(data.quota);
        }
        throw new Error(data.error || "生成失败");
      }

      setImageUrl(data.image);
      setMeta({ ...(data.meta || {}), creatorName: data.item?.creatorName || displayName });
      setQuota(data.quota || null);
      syncIdentityFromQuota(data.quota);
      setCacheHit(Boolean(data.cached));
      setCopyStatus("idle");
      setShareStatus("idle");
      setStatus("done");
      if (data.comboKey && !data.cached) {
        publishThumbnail(data.comboKey, data.image);
      } else {
        loadGallery();
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "生成失败");
    }
  }

  function useExample(example) {
    setText(example);
    setVisibleExamples(pickExamples(example));
    setError("");
  }

  function rerollExamples() {
    setVisibleExamples(pickExamples(text));
  }

  function applyDiagnosisReply() {
    setText(windowDiagnosis.reply.slice(0, 42));
    setVisibleExamples(pickExamples(windowDiagnosis.reply));
    setError("");
  }

  function applyAmmoReply(reply) {
    setText(String(reply || "").slice(0, 42));
    setVisibleExamples(pickExamples(reply));
    setError("");
  }

  async function copyDiagnosis() {
    const payload = `窗边体检：${windowDiagnosis.title}｜${windowDiagnosis.score}分\n${windowDiagnosis.detail}\n建议回：${windowDiagnosis.reply}`;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("当前浏览器不支持直接复制文字。");
      }
      await navigator.clipboard.writeText(payload);
      setDiagnosisCopyStatus("done");
      window.setTimeout(() => setDiagnosisCopyStatus("idle"), 1400);
    } catch (err) {
      setDiagnosisCopyStatus("error");
      setError(err instanceof Error ? err.message : "复制失败，窗边体检报告拒绝离开窗边。");
    }
  }

  async function copyReplyAmmo() {
    const payload = replyAmmo.map((item) => `${item.label}：${item.text}`).join("\n");
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("当前浏览器不支持直接复制文字。");
      }
      await navigator.clipboard.writeText(payload);
      setAmmoCopyStatus("done");
      window.setTimeout(() => setAmmoCopyStatus("idle"), 1400);
    } catch (err) {
      setAmmoCopyStatus("error");
      setError(err instanceof Error ? err.message : "复制失败，弹药库卡壳了。");
    }
  }

  async function handleAvatarUpload(event) {
    if (!hasProfile) {
      setError("先填昵称和邮箱完成注册，再上传自己的形象。");
      event.target.value = "";
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError("");
    try {
      const nextAvatar = await prepareAvatarImage(file);
      setAvatarImage(nextAvatar);
      setRole("avatar");
      saveUploadedProfile(nextAvatar);
    } catch (err) {
      setError(err instanceof Error ? err.message : "头像读取失败，请换一张图片。");
    } finally {
      event.target.value = "";
    }
  }

  async function saveUploadedProfile(nextAvatar) {
    if (!hasProfile || !nextAvatar) {
      return;
    }

    setProfileSyncStatus("saving");
    try {
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarImage: nextAvatar,
          referralCode: quota?.referralCode || referralCode,
          userEmail: profileEmail.trim(),
          userName: displayName,
          viewerId
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "头像后台保存失败");
      }
      if (data.profile?.viewerId && data.profile.viewerId !== viewerId) {
        setViewerId(data.profile.viewerId);
        writeLocalValue("chuangbian-viewer-id", data.profile.viewerId);
      }
      setProfileSyncStatus("done");
      window.setTimeout(() => setProfileSyncStatus("idle"), 1800);
    } catch (err) {
      setProfileSyncStatus("error");
      setError(err instanceof Error ? `头像已本地保存，但后台没收住：${err.message}` : "头像已本地保存，但后台没收住。");
    }
  }

  async function loadQuota() {
    try {
      const params = new URLSearchParams({
        referralCode,
        userEmail: profileEmail.trim(),
        userName: displayName,
        viewerId
      });
      const response = await fetch(`/api/quota?${params.toString()}`);
      const data = await response.json();
      if (response.ok && data.quota) {
        setQuota(data.quota);
        syncIdentityFromQuota(data.quota);
      }
    } catch {
      setQuota(null);
    }
  }

  async function loadGallery() {
    try {
      const response = await fetch(`/api/gallery?viewerId=${encodeURIComponent(viewerId)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "加载失败");
      }

      setGallery(Array.isArray(data.items) ? data.items : []);
      setGalleryCategories(Array.isArray(data.categories) ? data.categories : [{ id: "all", name: "全部", count: 0 }]);
      setGalleryStatus("done");
      if (activeCategory !== "all" && !data.categories?.some((category) => category.id === activeCategory)) {
        setActiveCategory("all");
      }
    } catch {
      setGalleryStatus("error");
    }
  }

  async function loadWishWall() {
    try {
      const response = await fetch("/api/wishes");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "许愿墙加载失败");
      }

      setWishes(Array.isArray(data.items) ? data.items : []);
      setWishWallStatus("done");
    } catch {
      setWishWallStatus("error");
    }
  }

  async function publishThumbnail(comboKey, image) {
    try {
      const thumbnail = await createThumbnail(image);
      const response = await fetch("/api/gallery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comboKey,
          thumbnail,
          viewerId
        })
      });
      const data = await response.json();
      if (response.ok) {
        setGallery(Array.isArray(data.items) ? data.items : []);
        setGalleryCategories(Array.isArray(data.categories) ? data.categories : [{ id: "all", name: "全部", count: 0 }]);
        setGalleryStatus("done");
      }
    } catch {
      loadGallery();
    }
  }

  async function copyImage() {
    if (!imageUrl) {
      return;
    }

    setCopyStatus("copying");
    setError("");

    try {
      await copyImageFromUrl(imageUrl);
      setCopyStatus("done");
      window.setTimeout(() => setCopyStatus("idle"), 1400);
    } catch (err) {
      setCopyStatus("error");
      setError(friendlyImageError(err, "复制失败，可以先分享或下载 PNG。"));
    }
  }

  async function shareImage() {
    if (!imageUrl) {
      return;
    }

    setShareStatus("sharing");
    setError("");

    try {
      const blob = await fetchImageBlob(imageUrl);
      const file = new File([blob], `chuangbian-meme-${Date.now()}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          title: "窗边 Meme",
          text: meta?.caption || text,
          files: [file]
        });
        setShareStatus("done");
      } else {
        await copyImageFromUrl(imageUrl);
        setShareStatus("copied");
      }
      window.setTimeout(() => setShareStatus("idle"), 1400);
    } catch (err) {
      setShareStatus("error");
      setError(friendlyImageError(err, "分享失败，可以先复制或下载 PNG。"));
    }
  }

  async function shareInvite() {
    const activeReferralCode = buildShareReferralCode(quota?.viewerId || viewerId);
    const inviteUrl = `${window.location.origin}${window.location.pathname}?ref=${encodeURIComponent(activeReferralCode)}`;
    const shareText = "来窗边生成一张精神状态很稳定的表情包。你用一次，我多活 5 张。";
    setInviteStatus("sharing");
    setError("");

    try {
      if (navigator.share) {
        await navigator.share({
          title: "窗边 Meme",
          text: shareText,
          url: inviteUrl
        });
        setInviteStatus("done");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
        setInviteStatus("copied");
      } else {
        throw new Error("当前浏览器不支持直接复制邀请链接。");
      }
      window.setTimeout(() => setInviteStatus("idle"), 1400);
    } catch (err) {
      setInviteStatus("error");
      setError(err instanceof Error ? err.message : "转发链接失败，可以手动复制当前网址。");
    }
  }

  async function copyGalleryImage(item) {
    const target = item.imageUrl || item.image || item.thumbnail;
    if (!target) {
      return;
    }

    setGalleryCopyId(item.comboKey || item.id);
    setError("");

    try {
      await copyImageFromUrl(target);
      setGalleryCopyId(`${item.comboKey || item.id}:done`);
      window.setTimeout(() => setGalleryCopyId(""), 1400);
    } catch (err) {
      setGalleryCopyId("");
      setError(friendlyImageError(err, "复制失败，可以先下载 PNG。"));
    }
  }

  function deleteGalleryImage() {
    setError("");
    if (!window.confirm("确认删除？")) {
      return;
    }
    window.alert("生图免费，删图 9.9，请转账。为什么收钱，因为没做删除功能。");
  }

  async function submitWish() {
    const nextWish = wishText.trim();
    if (!nextWish) {
      setWishStatus("empty");
      return;
    }

    setWishStatus("saving");
    setError("");

    try {
      const response = await fetch("/api/wishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: nextWish,
          userEmail: profileEmail.trim(),
          userName: displayName,
          viewerId
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "许愿失败");
      }

      setWishStatus("done");
      setWishText("");
      if (data.wish) {
        setWishes((current) => mergeWishItems(data.wish, Array.isArray(data.items) ? data.items : current));
        setWishWallStatus("done");
      } else if (Array.isArray(data.items)) {
        setWishes(data.items);
        setWishWallStatus("done");
      } else {
        loadWishWall();
      }
      window.setTimeout(() => setWishStatus("idle"), 2200);
    } catch (err) {
      setWishStatus("error");
      setError(err instanceof Error ? err.message : "许愿失败，可能窗边暂时不接待愿望。");
    }
  }

  async function voteWishItem(item) {
    if (!item?.id || item.hasVoted || wishVoteId) {
      return;
    }

    setWishVoteId(item.id);
    setError("");

    try {
      const response = await fetch("/api/wishes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, viewerId })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "+1 失败");
      }

      if (data.item) {
        setWishes((current) => mergeWishItems(data.item, Array.isArray(data.items) ? data.items : current));
      } else if (Array.isArray(data.items)) {
        setWishes(data.items);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "+1 失败，窗边暂时不收民意。");
    } finally {
      setWishVoteId("");
    }
  }

  function syncIdentityFromQuota(nextQuota) {
    if (!nextQuota) {
      return;
    }

    if (nextQuota.viewerId && nextQuota.viewerId !== viewerId) {
      setViewerId(nextQuota.viewerId);
      writeLocalValue("chuangbian-viewer-id", nextQuota.viewerId);
    }

    if (nextQuota.referralCode && nextQuota.referralCode !== referralCode) {
      setReferralCode(nextQuota.referralCode);
      writeLocalValue("chuangbian-referral-code", nextQuota.referralCode);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-strip">
        <div>
          <p className="eyebrow">AI Sticker Lab</p>
          <h1>窗边 Meme</h1>
        </div>
        <div className="ticker-rail" aria-label="状态">
          <span>别问 问就是窗边</span>
          <span>糊点才像表情包</span>
          <span>速速偷走</span>
          <span>{gallery.length} 个受害者</span>
        </div>
      </section>

      <section className="creator">
        <div className="panel-title">
          <div>
            <span>说一句，AI 去站窗边</span>
            <strong>{selectedRole.name}</strong>
          </div>
          <small>{text.length}/42</small>
        </div>

        <div className="prompt-zone">
          <label className="input-label" htmlFor="window-text">输入一句</label>
          <textarea
            id="window-text"
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, 42))}
            maxLength={42}
            className="text-input"
            placeholder="比如：客户说就微调一下"
          />
          <div className="example-row">
            {visibleExamples.map((example) => (
              <button key={example} type="button" className="example-chip" onClick={() => useExample(example)}>
                {example}
              </button>
            ))}
            <button type="button" className="example-chip example-chip-refresh" onClick={rerollExamples}>
              <RefreshCw size={13} />
              换一批疯话
            </button>
          </div>
          <div className={cn("mood-ticket", `mood-${currentMood.id}`)}>
            <span>AI 识别</span>
            <strong>{currentMood.name}</strong>
            <small>{currentMood.detail}</small>
          </div>
          <section className="meme-lab-card" aria-label="窗边体检">
            <div className="meme-lab-head">
              <div>
                <span>窗边体检</span>
                <strong>{windowDiagnosis.title}</strong>
              </div>
              <b>{windowDiagnosis.score}</b>
            </div>
            <p>{windowDiagnosis.detail}</p>
            <div className="meme-lab-reply">
              <span>建议回</span>
              <button type="button" onClick={applyDiagnosisReply}>
                {windowDiagnosis.reply}
              </button>
            </div>
            <div className="meme-lab-actions">
              <button type="button" onClick={applyDiagnosisReply}>
                <Sparkles size={14} />
                帮我发疯
              </button>
              <button type="button" onClick={copyDiagnosis}>
                <Copy size={14} />
                {diagnosisCopyStatus === "done" ? "已复制" : "复制体检"}
              </button>
            </div>
          </section>
          <section className="reply-ammo-card" aria-label="回复弹药库">
            <div className="reply-ammo-head">
              <div>
                <span>回复弹药库</span>
                <strong>挑一句，直接拿去回</strong>
              </div>
              <button type="button" onClick={copyReplyAmmo}>
                <Copy size={13} />
                {ammoCopyStatus === "done" ? "已复制" : "复制三连"}
              </button>
            </div>
            <div className="reply-ammo-list">
              {replyAmmo.map((item) => (
                <button key={item.id} type="button" onClick={() => applyAmmoReply(item.text)}>
                  <span>{item.label}</span>
                  <strong>{item.text}</strong>
                </button>
              ))}
            </div>
          </section>
        </div>

        <section className="role-zone" aria-label="角色">
          {roles.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRole(item.id)}
              className={cn("role-card", role === item.id && "role-card-active")}
            >
              <b>{item.mark}</b>
              <span>{item.name}</span>
              <small>{item.hint}</small>
            </button>
          ))}
        </section>

        <div className="action-row">
          <button type="button" className="primary-button" onClick={generateImage} disabled={!canGenerate}>
            {status === "loading" ? <Loader2 className="animate-spin" size={19} /> : <Sparkles size={19} />}
            {status === "loading" ? "AI 站窗边中" : quotaBlocked ? "额度见底了" : "生成 Meme"}
          </button>
          {imageUrl && (
            <button type="button" className="secondary-button" onClick={generateImage} disabled={status === "loading"}>
              <RefreshCw size={18} />
              重新生成
            </button>
          )}
        </div>

        <section className="quota-card">
          <div>
            <span>{quota?.registered ? "注册额度" : "游客额度"}</span>
            <strong>{quota ? `还剩 ${quota.remaining}/${quota.limit} 张` : "额度读取中"}</strong>
          </div>
          <small>
            {quota?.bonus ? `已拉 ${quota.invitedCount} 个受害者，续了 ${quota.bonus} 张` : "游客也能转发 +5；登录再解锁形象"}
          </small>
          <button type="button" className="invite-button" onClick={shareInvite}>
            <Share2 size={14} />
            {inviteStatus === "done" ? "已转发" : inviteStatus === "copied" ? "已复制" : "转发续命"}
          </button>
        </section>

        <section className={cn("passport-card", profileSaved && "passport-ready")}>
          <div className="passport-head">
            <div className="avatar-preview">
              {avatarImage ? <img src={avatarImage} alt="已上传头像" /> : <UserRound size={24} />}
            </div>
            <div>
              <span>{profileSaved ? "已登录，形象上传解锁" : "邮箱轻登录后解锁形象"}</span>
              <strong>{avatarReady ? `${profileName.trim()} 的窗边替身` : profileSaved ? "上传头像生成自己的窗边" : "昵称和邮箱填完就算登录"}</strong>
            </div>
          </div>
          <div className="passport-actions">
            <input
              value={profileName}
              onChange={(event) => setProfileName(event.target.value.slice(0, 18))}
              className="name-input"
              placeholder="昵称"
              aria-label="昵称"
            />
            <input
              value={profileEmail}
              onChange={(event) => setProfileEmail(event.target.value.slice(0, 120))}
              className="email-input"
              placeholder="邮箱"
              aria-label="邮箱"
              inputMode="email"
            />
            <label className={cn("upload-button", !hasProfile && "upload-button-disabled")}>
              <Upload size={15} />
              {hasProfile ? "上传形象" : "登录解锁"}
              <input type="file" accept="image/png,image/jpeg,image/webp" disabled={!hasProfile} onChange={handleAvatarUpload} />
            </label>
          </div>
          {profileSyncStatus !== "idle" && (
            <small className={cn("profile-sync-note", profileSyncStatus === "error" && "profile-sync-note-error")}>
              {profileSyncStatus === "saving" ? "后台正在收录你的形象" : profileSyncStatus === "done" ? "后台已收录，别后悔" : "后台刚才手滑了"}
            </small>
          )}
        </section>

        {error && <div className="error-box">{error}</div>}
      </section>

      <section className="result">
        <div className="result-head">
          <div>
            <p className="result-title">{imageUrl ? meta?.caption || text : "蓝窗预览"}</p>
            <p className="result-meta">
              {imageUrl
                ? `${meta?.roleName || selectedRole.name} / ${meta?.actionName || "窗边"} / ${
                    cacheHit ? "图库命中" : "新生成"
                  } / @${meta?.creatorName || displayName}`
                : `${selectedRole.name} / 蓝窗 / 背手`}
            </p>
          </div>
          {imageUrl && (
            <div className="result-actions">
              <button
                type="button"
                className="download-button desktop-image-action"
                onClick={copyImage}
                disabled={copyStatus === "copying"}
              >
                <Copy size={18} />
                {copyStatus === "done" ? "已复制" : "复制到聊天"}
              </button>
              <button
                type="button"
                className="download-button desktop-image-action"
                onClick={shareImage}
                disabled={shareStatus === "sharing"}
              >
                <Share2 size={18} />
                {shareStatus === "done" ? "已分享" : shareStatus === "copied" ? "已复制" : "分享"}
              </button>
              <a
                className="download-button desktop-image-action"
                href={imageUrl}
                download={`chuangbian-${Date.now()}.png`}
                title="下载 PNG"
              >
                <Download size={18} />
                PNG
              </a>
              <div className="mobile-save-hint">长按图片保存或转发</div>
            </div>
          )}
        </div>

        <div className="image-stage">
          {imageUrl ? (
            <img src={imageUrl} alt="生成的窗边表情包" />
          ) : (
            <div className="empty-window">
              <ImageIcon size={44} />
              <span>还没人站过去</span>
            </div>
          )}
        </div>
      </section>

      <section className="gallery-panel">
        <div className="gallery-head">
          <div>
            <h2>窗边库存</h2>
            <p>{gallery.length ? `${gallery.length} 张已入库，随手复制走` : "库存还空着"}</p>
          </div>
          <button type="button" className="gallery-refresh" onClick={loadGallery}>
            <RefreshCw size={15} />
            刷新
          </button>
        </div>

        {gallery.length > 0 && (
          <div className="category-tabs" role="tablist" aria-label="窗边分类">
            {galleryCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={cn("category-tab", activeCategory === category.id && "category-tab-active")}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.name}
                <span>{category.count}</span>
              </button>
            ))}
          </div>
        )}

        {visibleGallery.length > 0 ? (
          <div className="gallery-grid">
            {visibleGallery.map((item) => (
              <article key={item.id} className="gallery-item">
                <img src={item.thumbnail || item.imageUrl || item.image} alt={item.caption || "窗边缩略图"} loading="lazy" />
                <div className="gallery-item-body">
                  <strong>{item.caption || "窗边时刻"}</strong>
                  <span>
                    {[
                      `@${item.creatorName || "无名受害者"}`,
                      item.roleName,
                      item.categoryName || item.actionName
                    ]
                      .filter(Boolean)
                      .join(" / ") || "窗边"}
                  </span>
                  <div className="gallery-card-actions">
                    <button type="button" className="gallery-copy desktop-image-action" onClick={() => copyGalleryImage(item)}>
                      <Copy size={13} />
                      {galleryCopyId === `${item.comboKey || item.id}:done` ? "已复制" : "复制"}
                    </button>
                    <a
                      className="gallery-copy desktop-image-action"
                      href={item.downloadUrl || item.imageUrl || item.image}
                      download={`chuangbian-meme-${item.comboKey || item.id}.png`}
                    >
                      <Download size={13} />
                      PNG
                    </a>
                    <div className="mobile-save-hint">长按图片保存或转发</div>
                    <button type="button" className="gallery-copy gallery-delete" onClick={deleteGalleryImage}>
                      <Trash2 size={13} />
                      删掉
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="gallery-empty">
            {galleryStatus === "loading" ? "正在看窗边有没有人..." : "还没有访客留下窗边。"}
          </div>
        )}
      </section>

      <section className="wish-wall-panel">
        <div className="wish-wall-head">
          <div>
            <h2>许愿墙</h2>
            <p>{wishes.length ? "点 +1，给离谱功能续一口气。票多也不一定做，但至少显得很有民意。" : "还没人上墙，世界安静得不合理。"}</p>
          </div>
          <button type="button" className="gallery-refresh" onClick={loadWishWall}>
            <RefreshCw size={15} />
            刷新
          </button>
        </div>

        {wishes.length > 0 ? (
          <div className="wish-wall-list">
            {wishes.slice(0, 12).map((wish, index) => (
              <article key={wish.id} className={cn("wish-wall-item", wish.hasVoted && "wish-wall-item-voted")}>
                <div className="wish-rank">{index + 1}</div>
                <div className="wish-wall-copy">
                  <strong>{wish.text}</strong>
                  <span>
                    @{wish.name || "匿名许愿怪"} · {formatDateTime(wish.createdAt)}
                  </span>
                </div>
                <button type="button" className="wish-vote-button" onClick={() => voteWishItem(wish)} disabled={wish.hasVoted || wishVoteId === wish.id}>
                  {wishVoteId === wish.id ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                  {wish.hasVoted ? "已怂恿" : "+1"}
                  <b>{wish.voteCount || 0}</b>
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="wish-wall-empty">{wishWallStatus === "loading" ? "正在把愿望从窗边捞上来..." : "空的。可以许愿，但别太正常。"}</div>
        )}
      </section>

      <footer className="site-footer">powered by @Mr.k · 微信 Kevph2026</footer>

      <button type="button" className="wish-float-button" onClick={() => setWishOpen(true)}>
        <Sparkles size={16} />
        你还想咋玩？
      </button>

      {wishOpen && (
        <section className="wish-panel" aria-label="功能许愿">
          <div className="wish-panel-head">
            <div>
              <span>许愿池，水不深</span>
              <strong>你还想咋玩？</strong>
            </div>
            <button type="button" className="wish-close" onClick={() => setWishOpen(false)} aria-label="关闭许愿">
              <X size={16} />
            </button>
          </div>
          <p>可以许愿，反正许愿后也不一定做。上墙后别人能点 +1，做了你就赚到了！</p>
          <textarea
            value={wishText}
            onChange={(event) => setWishText(event.target.value.slice(0, 180))}
            className="wish-input"
            placeholder="比如：让老板也站窗边、GIF 回头、自动生成阴阳怪气回复..."
          />
          <div className="wish-actions">
            <small>{wishText.length}/180</small>
            <button type="button" className="wish-submit" onClick={submitWish} disabled={wishStatus === "saving"}>
              {wishStatus === "saving" ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
              {wishStatus === "saving" ? "正在丢愿望" : "把愿望丢上墙"}
            </button>
          </div>
          {wishStatus === "done" && <div className="wish-note">愿望已上墙。票多也不一定做，但你已经开始制造压力。</div>}
          {wishStatus === "empty" && <div className="wish-note wish-note-warn">空愿望不灵。你先疯一句。</div>}
        </section>
      )}
    </main>
  );
}

function AdminApp() {
  const [token, setToken] = useState(() => readLocalValue("chuangbian-admin-token"));
  const [draftToken, setDraftToken] = useState(() => readLocalValue("chuangbian-admin-token"));
  const [data, setData] = useState(null);
  const [modelDraft, setModelDraft] = useState(() => createModelDraft());
  const [modelSaveStatus, setModelSaveStatus] = useState("idle");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    loadAdminData(token);
  }, []);

  async function loadAdminData(nextToken = token) {
    setStatus("loading");
    setError("");

    try {
      const response = await fetch("/api/admin", {
        headers: nextToken ? { "x-admin-token": nextToken } : {}
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "后台读取失败");
      }

      setData(payload);
      setModelDraft(createModelDraft(payload.modelConfig));
      setToken(nextToken);
      setDraftToken(nextToken);
      if (nextToken) {
        window.localStorage.setItem("chuangbian-admin-token", nextToken);
      }
      setStatus("done");
    } catch (err) {
      setData(null);
      setStatus("error");
      setError(err instanceof Error ? err.message : "后台读取失败");
    }
  }

  function handleAdminLogin(event) {
    event.preventDefault();
    loadAdminData(draftToken.trim());
  }

  function applyModelPreset(preset) {
    setModelDraft((current) => ({
      ...current,
      baseURL: preset.baseURL || "",
      model: preset.model || "",
      presetId: preset.id,
      quality: preset.quality || current.quality,
      size: preset.size || current.size
    }));
  }

  async function saveAdminModelConfig(event) {
    event.preventDefault();
    setModelSaveStatus("saving");
    setError("");

    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-admin-token": token } : {})
        },
        body: JSON.stringify({
          action: "model-config",
          modelConfig: modelDraft
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "模型配置保存失败");
      }

      setData(payload);
      setModelDraft(createModelDraft(payload.modelConfig));
      setModelSaveStatus("done");
      window.setTimeout(() => setModelSaveStatus("idle"), 1800);
    } catch (err) {
      setModelSaveStatus("error");
      setError(err instanceof Error ? err.message : "模型配置保存失败");
    }
  }

  const summary = data?.summary || {};
  const modelConfig = data?.modelConfig || {};
  const modelPresets = modelConfig.presets || [];
  const statCards = [
    { label: "库存", value: summary.galleryCount || 0, note: `今天新增 ${summary.todayImages || 0}`, icon: ImageIcon },
    { label: "总使用", value: summary.totalUses || 0, note: `今天被用 ${summary.activeToday || 0}`, icon: Activity },
    { label: "形象", value: summary.profileCount || 0, note: `上传 ${summary.avatarUploads || 0}`, icon: UserRound },
    { label: "许愿", value: summary.wishCount || 0, note: "做不做另说", icon: Sparkles },
    { label: "访客", value: summary.viewerCount || 0, note: `注册 ${summary.registeredViewers || 0}`, icon: Users }
  ];

  return (
    <main className="admin-shell">
      <header className="admin-hero">
        <div>
          <p className="eyebrow">Window Control Room</p>
          <h1>窗边后台</h1>
          <span>看看今天又是谁在窗边精神稳定。</span>
        </div>
        <div className="admin-hero-actions">
          <a href="/" className="admin-link-button">
            <ExternalLink size={15} />
            回前台
          </a>
          <button type="button" className="admin-link-button" onClick={() => loadAdminData(token)} disabled={status === "loading"}>
            {status === "loading" ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
            刷新
          </button>
        </div>
      </header>

      {!data ? (
        <section className="admin-auth-card">
          <div className="admin-auth-icon">
            <LockKeyhole size={24} />
          </div>
          <div>
            <h2>后台门口</h2>
            <p>输入后台口令。没口令就先站窗边冷静一下，别硬闯。</p>
          </div>
          <form className="admin-auth-form" onSubmit={handleAdminLogin}>
            <label>
              <span>后台口令</span>
              <input
                value={draftToken}
                onChange={(event) => setDraftToken(event.target.value)}
                placeholder="ADMIN_TOKEN"
                type="password"
              />
            </label>
            <button type="submit" disabled={status === "loading"}>
              {status === "loading" ? <Loader2 className="animate-spin" size={16} /> : <KeyRound size={16} />}
              开门
            </button>
          </form>
          {error && <div className="admin-error">{error}</div>}
        </section>
      ) : (
        <>
          <section className="admin-stats" aria-label="后台总览">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.label} className="admin-stat-card">
                  <Icon size={18} />
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.note}</small>
                </article>
              );
            })}
          </section>

          <section className="admin-panel admin-model-panel">
            <div className="admin-panel-head">
              <div>
                <span>模型配置</span>
                <h2>生图供应商</h2>
              </div>
              <small>{modelConfig.keySource || "未配置"} · {modelConfig.model || "无模型"}</small>
            </div>
            <form className="admin-model-form" onSubmit={saveAdminModelConfig}>
              <label className="admin-model-toggle">
                <input
                  type="checkbox"
                  checked={modelDraft.enabled}
                  onChange={(event) => setModelDraft((current) => ({ ...current, enabled: event.target.checked }))}
                />
                <span>启用后台配置</span>
                <small>关闭时走环境变量，适合开源默认部署。</small>
              </label>

              <div className="admin-model-presets">
                {modelPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={cn("admin-model-preset", modelDraft.presetId === preset.id && "admin-model-preset-active")}
                    onClick={() => applyModelPreset(preset)}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>

              <div className="admin-model-fields">
                <label>
                  <span>调用地址 Base URL</span>
                  <input
                    value={modelDraft.baseURL}
                    onChange={(event) => setModelDraft((current) => ({ ...current, baseURL: event.target.value }))}
                    placeholder="https://api.openai.com/v1"
                  />
                </label>
                <label>
                  <span>模型名</span>
                  <input
                    value={modelDraft.model}
                    onChange={(event) => setModelDraft((current) => ({ ...current, model: event.target.value }))}
                    placeholder="gpt-image-2"
                  />
                </label>
                <label>
                  <span>API Key</span>
                  <input
                    value={modelDraft.apiKey}
                    onChange={(event) => setModelDraft((current) => ({ ...current, apiKey: event.target.value }))}
                    placeholder={modelConfig.apiKeyHint ? `已保存 ${modelConfig.apiKeyHint}，留空不改` : "sk-..."}
                    type="password"
                  />
                </label>
                <label>
                  <span>尺寸</span>
                  <select value={modelDraft.size} onChange={(event) => setModelDraft((current) => ({ ...current, size: event.target.value }))}>
                    <option value="256x256">256x256</option>
                    <option value="512x512">512x512</option>
                    <option value="1024x1024">1024x1024</option>
                  </select>
                </label>
                <label>
                  <span>质量</span>
                  <select value={modelDraft.quality} onChange={(event) => setModelDraft((current) => ({ ...current, quality: event.target.value }))}>
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="standard">standard</option>
                    <option value="hd">hd</option>
                    <option value="auto">auto</option>
                  </select>
                </label>
              </div>

              <div className="admin-model-actions">
                <div>
                  <strong>{modelConfig.hasApiKey ? "Key 已就位" : "Key 还没来"}</strong>
                  <span>后台保存的 Key 会加密存储，不会明文下发到前端。</span>
                </div>
                <button type="submit" disabled={modelSaveStatus === "saving"}>
                  {modelSaveStatus === "saving" ? <Loader2 className="animate-spin" size={15} /> : <KeyRound size={15} />}
                  {modelSaveStatus === "done" ? "已保存" : "保存模型配置"}
                </button>
              </div>
            </form>
          </section>

          <section className="admin-grid">
            <article className="admin-panel admin-panel-wide">
              <div className="admin-panel-head">
                <div>
                  <span>图库</span>
                  <h2>最近入库</h2>
                </div>
                <small>{formatDateTime(data.generatedAt)}</small>
              </div>
              <div className="admin-gallery-grid">
                {(data.gallery || []).slice(0, 24).map((item) => (
                  <article key={item.id} className="admin-gallery-card">
                    <img src={item.thumbnail || item.imageUrl} alt={item.caption || "窗边图"} loading="lazy" />
                    <div>
                      <strong>{item.caption || "窗边时刻"}</strong>
                      <span>
                        @{item.creatorName} / {item.roleName} / {item.categoryName}
                      </span>
                      <small>{item.uses} 次 · {formatDateTime(item.createdAt)}</small>
                      <a href={item.imageUrl} target="_blank" rel="noreferrer">
                        打开图片
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </article>

            <article className="admin-panel admin-panel-wide">
              <div className="admin-panel-head">
                <div>
                  <span>用户形象</span>
                  <h2>最近上传</h2>
                </div>
                <small>{summary.profileCount || 0} 个替身入档</small>
              </div>
              {(data.profiles || []).length ? (
                <div className="admin-profile-grid">
                  {(data.profiles || []).slice(0, 18).map((profile) => (
                    <article key={profile.viewerHash} className="admin-profile-card">
                      <img src={profile.avatarUrl} alt={`${profile.name || "用户"} 上传的形象`} loading="lazy" />
                      <div>
                        <strong>@{profile.name || "无名受害者"}</strong>
                        <span>{profile.maskedEmail || "没留邮箱"} · {profile.uploadCount || 0} 次</span>
                        <small>{profile.viewerHash} · {formatDateTime(profile.updatedAt)}</small>
                        <a href={profile.avatarUrl} target="_blank" rel="noreferrer">
                          打开原图
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="admin-empty">还没人上传形象。大家暂时只是在精神上站窗边。</p>
              )}
            </article>

            <article className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <span>许愿池</span>
                  <h2>用户想咋玩</h2>
                </div>
                <Sparkles size={18} />
              </div>
              <div className="admin-wish-list">
                {(data.wishes || []).length ? (
                  data.wishes.slice(0, 18).map((wish) => (
                    <article key={wish.id} className="admin-wish-item">
                      <strong>{wish.text}</strong>
                      <span>
                        @{wish.name} · {wish.voteCount || 0} 票 · {formatDateTime(wish.createdAt)}
                      </span>
                    </article>
                  ))
                ) : (
                  <p className="admin-empty">还没人许愿。世界暂时正常，令人不安。</p>
                )}
              </div>
            </article>

            <article className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <span>分类</span>
                  <h2>精神构成</h2>
                </div>
                <BarChart3 size={18} />
              </div>
              <div className="admin-bars">
                {(data.breakdowns?.categories || []).map((item) => (
                  <div key={item.id || item.name} className="admin-bar-row">
                    <span>{item.name}</span>
                    <div>
                      <i style={{ width: `${barWidth(item.count, summary.galleryCount || 1)}%` }} />
                    </div>
                    <b>{item.count}</b>
                  </div>
                ))}
              </div>
            </article>

            <article className="admin-panel admin-panel-wide">
              <div className="admin-panel-head">
                <div>
                  <span>额度 / 裂变</span>
                  <h2>谁还在续命</h2>
                </div>
                <small>{data.quota?.stats?.invited || 0} 个受害者被拉来</small>
              </div>
              <div className="admin-quota-strip">
                <span>IP {data.quota?.stats?.ipCount || 0}</span>
                <span>游客生成 {data.quota?.stats?.anonymousUsed || 0}</span>
                <span>注册生成 {data.quota?.stats?.registeredUsed || 0}</span>
                <span>奖励额度 {data.quota?.stats?.bonus || 0}</span>
              </div>
              <div className="admin-viewer-list">
                {(data.quota?.viewers || []).slice(0, 24).map((viewer) => (
                  <article key={viewer.idHash} className="admin-viewer-item">
                    <strong>{viewer.registered ? "注册受害者" : "游客路过"}</strong>
                    <span>{viewer.idHash}</span>
                    <small>
                      用了 {viewer.registeredUsed} · 拉了 {viewer.invitedCount} · 奖励 {viewer.bonus}
                    </small>
                  </article>
                ))}
              </div>
            </article>
          </section>
        </>
      )}
    </main>
  );
}

function readLocalValue(key) {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function createModelDraft(config = {}) {
  return {
    apiKey: "",
    baseURL: config.baseURL || "https://api.tokenrouter.com/v1",
    enabled: Boolean(config.enabled),
    model: config.model || "openai/gpt-5.4-image-2",
    presetId: config.presetId || "tokenrouter-gpt-image-2",
    quality: config.quality || "low",
    size: config.size || "1024x1024"
  };
}

function writeLocalValue(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // localStorage may be blocked; quota identity still comes from the current request.
  }
}

function getOrCreateViewerId() {
  const key = "chuangbian-viewer-id";
  const existing = readLocalValue(key);
  if (existing) {
    return existing;
  }

  const next = `cb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  try {
    window.localStorage.setItem(key, next);
  } catch {
    return next;
  }
  return next;
}

function getOrCreateReferralCode() {
  const key = "chuangbian-referral-code";
  const existing = readLocalValue(key);
  if (existing) {
    return existing;
  }

  const next = `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    window.localStorage.setItem(key, next);
  } catch {
    return next;
  }
  return next;
}

function buildShareReferralCode(viewerId) {
  return `rv_${String(viewerId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 86)}`;
}

function readIncomingReferral() {
  try {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("ref") || readLocalValue("chuangbian-referred-by");
    if (next) {
      window.localStorage.setItem("chuangbian-referred-by", next);
    }
    return next || "";
  } catch {
    return "";
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function pickExamples(exclude = "") {
  const candidates = examplePool.filter((item) => item !== exclude);
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, exampleCount);
}

function createThumbnail(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const size = 160;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("无法创建缩略图"));
        return;
      }

      context.fillStyle = "#050b14";
      context.fillRect(0, 0, size, size);

      const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.onerror = () => reject(new Error("缩略图生成失败"));
    image.src = src;
  });
}

function prepareAvatarImage(file) {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("请上传图片格式的头像。"));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const size = 512;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("头像处理失败。"));
          return;
        }

        context.fillStyle = "#d8e9f7";
        context.fillRect(0, 0, size, size);
        const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.onerror = () => reject(new Error("头像读取失败，请换一张图片。"));
      image.src = String(reader.result || "");
    };
    reader.onerror = () => reject(new Error("头像读取失败。"));
    reader.readAsDataURL(file);
  });
}

async function copyImageFromUrl(src) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("当前浏览器不支持直接复制图片，可以先分享或下载 PNG。");
  }

  const blob = await fetchImageBlob(src);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

async function fetchImageBlob(src) {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error("图片读取失败。");
  }

  const blob = await response.blob();
  return blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" });
}

function friendlyImageError(error, fallback) {
  const message = error instanceof Error ? error.message : "";
  if (/permission|denied|not allowed|not permitted/i.test(message)) {
    return "浏览器没给图片剪贴板权限，可以点分享或 PNG 下载。";
  }
  if (/clipboard|ClipboardItem/i.test(message)) {
    return "当前浏览器不支持直接复制图片，可以点分享或 PNG 下载。";
  }
  return message || fallback;
}

function mergeWishItems(primary, items) {
  const merged = [...(Array.isArray(items) ? items : []), primary].filter(Boolean);
  const byId = new Map();
  for (const item of merged) {
    byId.set(item.id, item);
  }

  return [...byId.values()].sort((left, right) => {
    const voteDelta = Number(right.voteCount || 0) - Number(left.voteCount || 0);
    if (voteDelta) {
      return voteDelta;
    }
    return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
  });
}

function formatDateTime(value) {
  if (!value) {
    return "刚刚";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit"
  }).format(date);
}

function barWidth(count, total) {
  return Math.max(8, Math.round((Number(count || 0) / Math.max(1, Number(total || 1))) * 100));
}

export default Root;
