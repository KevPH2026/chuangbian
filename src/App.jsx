import {
  Activity,
  BarChart3,
  Copy,
  Download,
  ExternalLink,
  Film,
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
import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeWorkplacePackCaptions, pickWorkplacePackCaptions, WORKPLACE_PACK_COUNT } from "../lib/workplacePack.js";

const roles = [
  { id: "opossum", name: "负鼠", hint: "原图味", mark: "鼠" },
  { id: "glasses-man", name: "Q版眼镜男", hint: "领导味", mark: "镜" },
  { id: "worker", name: "打工人", hint: "班味低气压", mark: "工" },
  { id: "boss", name: "老板", hint: "压迫感", mark: "板" },
  { id: "ai", name: "AI助手", hint: "冷脸 AI", mark: "AI" },
  { id: "avatar", name: "我的头像", hint: "游客 1 次", mark: "我" }
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
const localGalleryKey = "chuangbian-local-gallery";
const localGalleryLimit = 18;
const authTokenKey = "chuangbian-auth-token";
const authProfileKey = "chuangbian-auth-profile";
const workplacePackSampleImages = [
  "/workplace-pack-sample/01.png",
  "/workplace-pack-sample/02.png",
  "/workplace-pack-sample/03.png",
  "/workplace-pack-sample/04.png",
  "/workplace-pack-sample/05.png",
  "/workplace-pack-sample/06.png",
  "/workplace-pack-sample/07.png",
  "/workplace-pack-sample/08.png",
  "/workplace-pack-sample/09.png"
];

const opossumGifDemos = [
  {
    id: "opossum-question",
    caption: "啊？",
    actionName: "扭头疑惑",
    gif: "/gif-demo/opossum-question.gif"
  },
  {
    id: "opossum-hello",
    caption: "大爷，来玩啊～",
    actionName: "伸手社交",
    gif: "/gif-demo/opossum-hello.gif"
  },
  {
    id: "opossum-low",
    caption: "心塞",
    actionName: "低气压",
    gif: "/gif-demo/opossum-low.gif"
  },
  {
    id: "opossum-work",
    caption: "别搞",
    actionName: "工作审判",
    gif: "/gif-demo/opossum-work.gif"
  }
];

const galleryCategoryOrder = ["all", "gif", "question", "money", "work", "love", "ai", "default", "opossum-original", "recovery"];
const galleryCategoryLabels = {
  all: "全部",
  ai: "AI",
  default: "认命",
  gif: "GIF",
  love: "恋爱",
  money: "穷鬼",
  "opossum-original": "原图负鼠",
  question: "疑惑",
  recovery: "大家的窗边",
  work: "打工"
};

const moods = [
  { id: "question", name: "扭头疑惑", detail: "身子不动，只把头拧回来", test: isQuestionLike },
  { id: "money", name: "穷鬼低气压", detail: "肩膀会自动塌下去", test: (value) => /钱|房租|账单|穷|工资|余额|还款|花呗|借呗|信用卡/.test(value) },
  { id: "work", name: "工位审判", detail: "背着手被 KPI 凝视", test: (value) => /客户|老板|kpi|KPI|方案|需求|加班|绩效|汇报|会议|微调|干活/.test(value) },
  { id: "love", name: "已读沉默", detail: "蓝窗负责替你冷静", test: (value) => /消息|已读|不回|爱|喜欢|恋爱|备注|分手|前任|忙/.test(value) },
  { id: "ai", name: "AI 审视", detail: "人类效率观察中", test: (value) => /\b(ai|gpt|openai|deepseek|token)\b|人工智能|提示词|模型|算力|人类|效率/i.test(value) }
];

const defaultMood = { id: "default", name: "认命看窗", detail: "今晚先站一会儿" };

function cn(...values) {
  return values.filter(Boolean).join(" ");
}

function isQuestionLike(value) {
  return /[?？]|啊[？?]?$|啊$|吗$|呢$|么$|啥|什么|为啥|为什么|怎么|咋|谁|哪|凭什么|合理吗|真的假的|尊嘟假嘟|不是哥们/i.test(
    String(value || "").trim()
  );
}

function Root() {
  const isAdmin = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  return isAdmin ? <AdminApp /> : <App />;
}

function App() {
  const resultRef = useRef(null);
  const [text, setText] = useState("啊？");
  const [role, setRole] = useState("opossum");
  const [viewerId, setViewerId] = useState(() => getOrCreateViewerId());
  const [referralCode, setReferralCode] = useState(() => getOrCreateReferralCode());
  const [referredBy] = useState(() => readIncomingReferral());
  const [authToken, setAuthToken] = useState(() => readLocalValue(authTokenKey));
  const [authProfile, setAuthProfile] = useState(() => readLocalJson(authProfileKey));
  const [profileName, setProfileName] = useState(
    () => readLocalJson(authProfileKey)?.name || readLocalValue("chuangbian-profile-name")
  );
  const [profileEmail, setProfileEmail] = useState(
    () => readLocalJson(authProfileKey)?.email || readLocalValue("chuangbian-profile-email")
  );
  const [loginTicket, setLoginTicket] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [authStatus, setAuthStatus] = useState("idle");
  const [authMessage, setAuthMessage] = useState("");
  const [avatarImage, setAvatarImage] = useState(() => readLocalValue("chuangbian-avatar-image"));
  const [avatarDragActive, setAvatarDragActive] = useState(false);
  const [workplacePackText, setWorkplacePackText] = useState(() => pickWorkplacePackCaptions().join("\n"));
  const [workplacePackItems, setWorkplacePackItems] = useState([]);
  const [workplacePackStatus, setWorkplacePackStatus] = useState("idle");
  const [profileSyncStatus, setProfileSyncStatus] = useState("idle");
  const [profileSaved, setProfileSaved] = useState(() => Boolean(readLocalValue(authTokenKey) && readLocalJson(authProfileKey)?.viewerId));
  const [visibleExamples, setVisibleExamples] = useState(() => pickExamples());
  const [imageUrl, setImageUrl] = useState("");
  const [meta, setMeta] = useState(null);
  const [cacheHit, setCacheHit] = useState(false);
  const [status, setStatus] = useState("idle");
  const [copyStatus, setCopyStatus] = useState("idle");
  const [gifPreviewUrl, setGifPreviewUrl] = useState("");
  const [resultMode, setResultMode] = useState("image");
  const [gifStatus, setGifStatus] = useState("idle");
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
  const [memeMetrics, setMemeMetrics] = useState(null);
  const [metricsStatus, setMetricsStatus] = useState("loading");
  const [error, setError] = useState("");

  const selectedRole = roles.find((item) => item.id === role) || roles[1];
  const isAvatarRole = role === "avatar";
  const loggedIn = Boolean(profileSaved && authToken && authProfile?.viewerId && authProfile?.email);
  const authEmail = loggedIn ? authProfile.email : "";
  const displayName = loggedIn ? authProfile.name || profileName.trim() || "无名受害者" : profileName.trim() || "无名受害者";
  const avatarPreview = avatarImage || authProfile?.avatarUrl || "";
  const avatarReady = Boolean(avatarImage?.startsWith?.("data:image/"));
  const currentMood = useMemo(() => moods.find((item) => item.test(text)) || defaultMood, [text]);
  const workplacePackCaptions = useMemo(() => normalizeWorkplacePackCaptions(workplacePackText), [workplacePackText]);
  const resultAssetUrl = resultMode === "gif" && gifPreviewUrl ? gifPreviewUrl : imageUrl;
  const resultAssetType = resultMode === "gif" && gifPreviewUrl ? "gif" : "image";
  const resultAssetLabel = resultAssetType === "gif" ? "GIF" : "PNG";
  const quotaBlocked = Boolean(quota && quota.remaining <= 0);
  const guestAvatarBlocked = Boolean(isAvatarRole && !loggedIn && quota && Number(quota.guestAvatarRemaining || 0) <= 0);
  const canGenerate =
    text.trim().length > 0 && status !== "loading" && gifStatus !== "encoding" && !quotaBlocked && !guestAvatarBlocked && (!isAvatarRole || avatarReady);
  const canGenerateWorkplacePack =
    loggedIn && avatarReady && status !== "loading" && workplacePackStatus !== "loading" && !quotaBlocked && workplacePackCaptions.length === WORKPLACE_PACK_COUNT;
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
  }, [viewerId, referralCode, authToken]);

  useEffect(() => {
    loadMemeMetrics();
    const timer = window.setInterval(loadMemeMetrics, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [viewerId]);

  useEffect(() => {
    window.localStorage.setItem("chuangbian-profile-name", profileName.trim());
    window.localStorage.setItem("chuangbian-profile-email", profileEmail.trim());
  }, [profileName, profileEmail]);

  useEffect(() => {
    if (authToken && authProfile?.viewerId) {
      writeLocalValue(authTokenKey, authToken);
      writeLocalJson(authProfileKey, authProfile);
      setProfileSaved(true);
      if (authProfile.name && authProfile.name !== profileName) {
        setProfileName(authProfile.name);
      }
      if (authProfile.email && authProfile.email !== profileEmail) {
        setProfileEmail(authProfile.email);
      }
      return;
    }

    removeLocalValue(authTokenKey);
    removeLocalValue(authProfileKey);
    setProfileSaved(false);
  }, [authToken, authProfile]);

  useEffect(() => {
    if (avatarImage) {
      window.localStorage.setItem("chuangbian-avatar-image", avatarImage);
    } else {
      window.localStorage.removeItem("chuangbian-avatar-image");
    }
  }, [avatarImage]);

  useEffect(() => {
    return () => {
      if (gifPreviewUrl?.startsWith?.("blob:")) {
        URL.revokeObjectURL(gifPreviewUrl);
      }
    };
  }, [gifPreviewUrl]);

  async function generateImage(overrides = {}) {
    const nextText = String(overrides.text ?? text).trim();
    const nextRole = String(overrides.role ?? role);
    const nextIsAvatarRole = nextRole === "avatar";
    if (!nextText) {
      setError("先输入一句窗边时刻。");
      return;
    }

    if (nextIsAvatarRole && !avatarReady) {
      setError("先上传一张自己的形象，再让它去站窗边。");
      return;
    }

    if (nextIsAvatarRole && !loggedIn && quota && Number(quota.guestAvatarRemaining || 0) <= 0) {
      setError("游客用自己照片只能生成 1 次。登录后可以继续管理自己的形象。");
      return;
    }

    if (overrides.text) {
      setText(nextText.slice(0, 42));
    }
    if (overrides.role && overrides.role !== role) {
      setRole(nextRole);
    }
    setStatus("loading");
    setGifStatus("encoding");
    setResultMode("image");
    setGifPreviewUrl("");
    setError("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authToken: loggedIn ? authToken : "",
          text: nextText,
          role: nextRole,
          creatorId: loggedIn ? authProfile.viewerId : viewerId,
          referralCode: quota?.referralCode || referralCode,
          referredBy,
          userName: loggedIn ? displayName : "",
          userEmail: loggedIn ? authEmail : "",
          avatarImage: nextIsAvatarRole ? avatarImage : "",
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
      if (data.gif) {
        setGifPreviewUrl(data.gif);
        setGifStatus("done");
        window.setTimeout(() => setGifStatus("idle"), 1400);
      } else {
        setGifStatus("idle");
      }
      const galleryItems = [];
      if (data.item) {
        const localItem = rememberLocalGalleryItem({
          ...data.item,
          creatorName: data.item.creatorName || displayName,
          downloadUrl: data.item.downloadUrl || data.image,
          imageUrl: data.item.imageUrl || data.image,
          thumbnail: data.item.thumbnail || data.image
        });
        if (localItem) {
          galleryItems.push(localItem);
        }
      }
      if (data.gifItem) {
        const localGifItem = rememberLocalGalleryItem({
          ...data.gifItem,
          creatorName: data.gifItem.creatorName || displayName,
          downloadUrl: data.gifItem.downloadUrl || data.gif,
          imageUrl: data.gifItem.imageUrl || data.gif,
          thumbnail: data.gifItem.thumbnail || data.gif
        });
        galleryItems.push(localGifItem || data.gifItem);
      }
      if (galleryItems.length) {
        setGallery((current) => {
          const nextGallery = mergeGalleryItems(galleryItems, current);
          setGalleryCategories(getClientGalleryCategories(nextGallery));
          return nextGallery;
        });
        setGalleryStatus("done");
        setActiveCategory("all");
      }
      if (data.comboKey && !data.cached) {
        publishThumbnail(data.comboKey, data.image);
      } else {
        loadGallery();
      }
      if (data.warning) {
        setError(data.warning);
      }
      window.requestAnimationFrame(() => {
        if (window.innerWidth <= 900) {
          resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
      loadMemeMetrics();
    } catch (err) {
      setStatus("error");
      setGifStatus("error");
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

  function focusLoginForm() {
    setAuthMessage("填昵称和邮箱，收验证码后解锁职场九宫格。");
    window.requestAnimationFrame(() => {
      const target = document.getElementById(profileName.trim() ? "profile-email" : "profile-name");
      target?.focus();
    });
  }

  async function sendLoginCode() {
    const nextName = profileName.trim();
    const nextEmail = profileEmail.trim();
    if (!nextName || !isValidEmail(nextEmail)) {
      setError("昵称和邮箱都填一下，验证码才知道往哪儿跑。");
      return;
    }

    setAuthStatus("sending");
    setAuthMessage("");
    setLoginTicket("");
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          email: nextEmail,
          name: nextName
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "验证码发送失败");
      }
      setAuthStatus("code-sent");
      setLoginTicket(data.loginTicket || "");
      setAuthMessage(`验证码已发到 ${data.maskedEmail || nextEmail}，10 分钟内有效。`);
    } catch (err) {
      setAuthStatus("error");
      setError(err instanceof Error ? err.message : "验证码发送失败。");
    }
  }

  async function verifyLogin() {
    const nextName = profileName.trim();
    const nextEmail = profileEmail.trim();
    if (!nextName || !isValidEmail(nextEmail) || !loginCode.trim()) {
      setError("昵称、邮箱、验证码，一个都别少。");
      return;
    }

    setAuthStatus("verifying");
    setAuthMessage("");
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          code: loginCode.trim(),
          email: nextEmail,
          loginTicket,
          name: nextName,
          referralCode: quota?.referralCode || referralCode,
          viewerId
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "验证码登录失败");
      }

      setAuthToken(data.token || "");
      setAuthProfile(data.profile || null);
      setLoginTicket("");
      setLoginCode("");
      setAuthStatus("done");
      setAuthMessage("登录好了。现在可以上传自己的形象去上班受苦了。");
      if (data.profile?.viewerId) {
        setViewerId(data.profile.viewerId);
        writeLocalValue("chuangbian-viewer-id", data.profile.viewerId);
      }
      if (data.profile?.name) {
        setProfileName(data.profile.name);
      }
      if (data.profile?.email) {
        setProfileEmail(data.profile.email);
      }
      if (data.profile?.avatarUrl && !avatarImage) {
        setAuthProfile((current) => ({ ...(current || data.profile), avatarUrl: data.profile.avatarUrl }));
      }
      loadQuota();
    } catch (err) {
      setAuthStatus("error");
      setError(err instanceof Error ? err.message : "验证码登录失败。");
    }
  }

  function logoutProfile() {
    setAuthToken("");
    setAuthProfile(null);
    setLoginTicket("");
    setLoginCode("");
    setAuthStatus("idle");
    setAuthMessage("已退出。窗边替身下班了。");
    setAvatarImage("");
    if (role === "avatar") {
      setRole("opossum");
    }
  }

  function generateWorkplacePack() {
    void submitWorkplacePack();
  }

  function rerollWorkplacePack() {
    setWorkplacePackText(pickWorkplacePackCaptions(Date.now()).join("\n"));
    setWorkplacePackItems([]);
    setError("");
  }

  async function submitWorkplacePack() {
    if (!loggedIn) {
      setError("先邮箱验证码登录，职场窗边包才知道谁去受苦。");
      return;
    }
    if (!avatarReady) {
      setError("先上传自己的形象，再一键生成职场窗边包。");
      return;
    }
    if (workplacePackCaptions.length !== WORKPLACE_PACK_COUNT) {
      setError("职场包需要 9 句文案，一行一句。也可以点摇骰子随机。");
      return;
    }

    setWorkplacePackStatus("loading");
    setError("");
    try {
      const response = await fetch("/api/workplace-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authToken,
          avatarImage,
          captions: workplacePackCaptions,
          referralCode: quota?.referralCode || referralCode,
          referredBy,
          size: "1024x1024",
          quality: "low"
        })
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.quota) {
          setQuota(data.quota);
        }
        throw new Error(data.error || "职场包生成失败");
      }

      const items = Array.isArray(data.items) ? data.items : [];
      setWorkplacePackItems(items);
      setQuota(data.quota || null);
      syncIdentityFromQuota(data.quota);
      if (items.length) {
        const nextGallery = mergeGalleryItems(items, gallery);
        setGallery(nextGallery);
        setGalleryCategories(getClientGalleryCategories(nextGallery));
        setActiveCategory("work");
        const first = items[0];
        setImageUrl(first.imageUrl || "");
        setGifPreviewUrl("");
        setResultMode("image");
        setMeta({
          action: first.action,
          actionName: first.actionName,
          caption: first.caption,
          category: first.category,
          categoryName: first.categoryName,
          creatorName: first.creatorName || displayName,
          role: first.role,
          roleName: first.roleName
        });
        setCacheHit(false);
      }
      setWorkplacePackStatus("done");
      setAuthMessage(data.warning || `职场包已生成 ${items.length} 张，已切成单张入库。`);
    } catch (err) {
      setWorkplacePackStatus("error");
      setError(err instanceof Error ? err.message : "职场包生成失败。");
    }
  }

  async function handleAvatarUpload(event) {
    const file = event.target.files?.[0];
    try {
      await handleAvatarFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "头像读取失败，请换一张图片。");
    } finally {
      event.target.value = "";
    }
  }

  async function handleAvatarFile(file) {
    if (!file) {
      return;
    }

    setError("");
    const nextAvatar = await prepareAvatarImage(file);
    setAvatarImage(nextAvatar);
    setRole("avatar");
    setProfileSyncStatus("idle");
    if (loggedIn) {
      saveUploadedProfile(nextAvatar);
    } else {
      setAuthMessage("已读取照片。游客可用自己的照片生成 1 次。");
    }
  }

  function handleAvatarDrag(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === "dragenter" || event.type === "dragover") {
      setAvatarDragActive(true);
    }
    if (event.type === "dragleave") {
      setAvatarDragActive(false);
    }
  }

  async function handleAvatarDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    setAvatarDragActive(false);
    const file = event.dataTransfer?.files?.[0];
    try {
      await handleAvatarFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "头像读取失败，请换一张图片。");
    }
  }

  async function saveUploadedProfile(nextAvatar) {
    if (!loggedIn || !nextAvatar) {
      return;
    }

    setProfileSyncStatus("saving");
    try {
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authToken,
          avatarImage: nextAvatar,
          referralCode: quota?.referralCode || referralCode,
          viewerId: authProfile?.viewerId || viewerId
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
      if (data.profile) {
        setAuthProfile((current) => ({ ...(current || {}), ...data.profile, email: authEmail || profileEmail.trim() }));
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
        viewerId
      });
      if (loggedIn && authToken) {
        params.set("authToken", authToken);
      }
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

  async function loadMemeMetrics() {
    setMetricsStatus((current) => (current === "done" ? "refreshing" : "loading"));
    try {
      const response = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewerId })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "今日 Meme 人数加载失败");
      }
      setMemeMetrics(data.metrics || null);
      setMetricsStatus("done");
    } catch {
      setMetricsStatus("error");
    }
  }

  async function loadGallery() {
    try {
      const response = await fetch(`/api/gallery?viewerId=${encodeURIComponent(viewerId)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "加载失败");
      }

      const nextGallery = mergeGalleryItems(readLocalGalleryItems(), Array.isArray(data.items) ? data.items : []);
      setGallery(nextGallery);
      setGalleryCategories(getClientGalleryCategories(nextGallery, data.categories));
      setGalleryStatus("done");
      if (activeCategory !== "all" && !getClientGalleryCategories(nextGallery, data.categories).some((category) => category.id === activeCategory)) {
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
        const nextGallery = mergeGalleryItems(readLocalGalleryItems(), Array.isArray(data.items) ? data.items : []);
        setGallery(nextGallery);
        setGalleryCategories(getClientGalleryCategories(nextGallery, data.categories));
        setGalleryStatus("done");
      }
    } catch {
      loadGallery();
    }
  }

  async function copyImage() {
    if (!resultAssetUrl) {
      return;
    }

    setCopyStatus("copying");
    setError("");

    try {
      await copyImageFromUrl(resultAssetUrl, resultAssetType === "gif" ? "image/gif" : "image/png");
      setCopyStatus("done");
      window.setTimeout(() => setCopyStatus("idle"), 1400);
    } catch (err) {
      setCopyStatus("error");
      setError(friendlyImageError(err, `复制失败，可以先分享或下载 ${resultAssetLabel}。`));
    }
  }

  async function shareImage() {
    if (!resultAssetUrl) {
      return;
    }

    setShareStatus("sharing");
    setError("");

    try {
      const blob = resultAssetType === "gif" ? await fetchRawImageBlob(resultAssetUrl) : await fetchImageBlob(resultAssetUrl);
      const fileType = resultAssetType === "gif" ? "image/gif" : "image/png";
      const file = new File([blob], `chuangbian-meme-${Date.now()}.${resultAssetType === "gif" ? "gif" : "png"}`, { type: fileType });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          title: "窗边 Meme",
          text: meta?.caption || text,
          files: [file]
        });
        setShareStatus("done");
      } else {
        await copyImageFromUrl(resultAssetUrl, fileType);
        setShareStatus("copied");
      }
      window.setTimeout(() => setShareStatus("idle"), 1400);
    } catch (err) {
      setShareStatus("error");
      setError(friendlyImageError(err, `分享失败，可以先复制或下载 ${resultAssetLabel}。`));
    }
  }

  async function downloadDemoGif() {
    const nextText = text.trim();
    if (!nextText) {
      setError("先输入一句话，GIF 才知道该怎么动。");
      return;
    }
    if (role === "avatar" && !avatarReady) {
      setError("先上传自己的形象，再让它动起来。");
      return;
    }

    setGifStatus("encoding");
    setError("");

    try {
      const response = await fetch("/api/action-gif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authToken: loggedIn ? authToken : "",
          avatarImage: role === "avatar" ? avatarImage : "",
          creatorId: loggedIn ? authProfile.viewerId : viewerId,
          quality: "low",
          referralCode: quota?.referralCode || referralCode,
          referredBy,
          role,
          size: "1024x1024",
          text: nextText
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "动作 GIF 生成失败。");
      }
      setGifPreviewUrl(data.gif);
      setResultMode("gif");
      if (data.quota) {
        setQuota(data.quota);
        syncIdentityFromQuota(data.quota);
      }
      if (data.item) {
        const nextGallery = mergeGalleryItems([data.item], gallery, readLocalGalleryItems());
        setGallery(nextGallery);
        setGalleryCategories(getClientGalleryCategories(nextGallery));
        setActiveCategory("gif");
        setGalleryStatus("done");
      }
      downloadUrl(data.gif, `chuangbian-action-${Date.now()}.gif`);
      setGifStatus("done");
      if (data.warning) {
        setError(data.warning);
      }
      window.setTimeout(() => setGifStatus("idle"), 1400);
    } catch (err) {
      setGifStatus("error");
      setError(err instanceof Error ? err.message : "GIF 生成失败，先别让它动了。");
    }
  }

  function previewOpossumGifDemo(item) {
    setRole("opossum");
    setText(item.caption);
    setGifPreviewUrl(item.gif);
    setResultMode("gif");
    setGifStatus("idle");
    setError("");
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
      await copyImageFromUrl(target, getGalleryMimeType(item));
      setGalleryCopyId(`${item.comboKey || item.id}:done`);
      window.setTimeout(() => setGalleryCopyId(""), 1400);
    } catch (err) {
      setGalleryCopyId("");
      setError(friendlyImageError(err, isGifGalleryItem(item) ? "复制失败，可以先下载 GIF。" : "复制失败，可以先下载 PNG。"));
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
          authToken: loggedIn ? authToken : "",
          text: nextWish,
          userEmail: loggedIn ? authEmail : "",
          userName: loggedIn ? displayName : "匿名许愿怪",
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

      <section className="live-board" aria-label="今日 Meme 人数">
        <div>
          <span className="live-dot">LIVE</span>
          <strong>今日 Meme 人数</strong>
          <small>{metricsStatus === "error" ? "看板短暂离线，精神状态仍在线" : "5 分钟跳一次，看起来非常忙"}</small>
        </div>
        <b>{memeMetrics ? memeMetrics.visibleUv : "78"}</b>
        <p>
          今日访问 UV · {memeMetrics?.hits ? `围观 ${memeMetrics.hits} 次` : "正在蹲窗边"}
        </p>
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
            {status === "loading" ? "静图 + GIF 一起站" : quotaBlocked ? "额度见底了" : guestAvatarBlocked ? "游客照片用完" : "生成 Meme + GIF"}
          </button>
          {imageUrl && (
            <button type="button" className="secondary-button" onClick={generateImage} disabled={status === "loading" || gifStatus === "encoding"}>
              <RefreshCw size={18} />
              重新生成一套
            </button>
          )}
        </div>
        {(status === "loading" || gifStatus === "encoding") && (
          <div className="generation-progress" role="status" aria-live="polite">
            <div>
              <span>正在同时开工</span>
              <strong>先出静图，再把它动起来</strong>
            </div>
            <div className="generation-progress-steps">
              <i className={cn("generation-step", status === "loading" && "generation-step-active")}>静图</i>
              <i className={cn("generation-step", gifStatus === "encoding" && "generation-step-active")}>GIF</i>
              <i className="generation-step">入库</i>
            </div>
          </div>
        )}

        <section className="quota-card">
          <div>
            <span>{quota?.registered ? "注册额度" : "游客额度"}</span>
            <strong>{quota ? `还剩 ${quota.remaining}/${quota.limit} 张` : "额度读取中"}</strong>
          </div>
          <small>
            {quota?.bonus
              ? `已拉 ${quota.invitedCount} 个受害者，续了 ${quota.bonus} 张`
              : loggedIn
                ? "已登录，可继续管理自己的形象"
                : `游客照片还剩 ${quota?.guestAvatarRemaining ?? 1}/1 次；转发 +5`}
          </small>
          <button type="button" className="invite-button" onClick={shareInvite}>
            <Share2 size={14} />
            {inviteStatus === "done" ? "已转发" : inviteStatus === "copied" ? "已复制" : "转发续命"}
          </button>
        </section>

        <section
          className={cn("passport-card", (loggedIn || avatarReady) && "passport-ready", avatarDragActive && "passport-dragging")}
          onDragEnter={handleAvatarDrag}
          onDragLeave={handleAvatarDrag}
          onDragOver={handleAvatarDrag}
          onDrop={handleAvatarDrop}
        >
          <div className="passport-head">
            <div className="avatar-preview">
              {avatarPreview ? <img src={avatarPreview} alt="已上传头像" /> : <UserRound size={24} />}
            </div>
            <div>
              <span>{loggedIn ? "已登录，形象可保存" : "游客可试 1 次自己的照片"}</span>
              <strong>{avatarReady ? `${displayName} 的窗边替身` : "拖照片到这里，或点上传"}</strong>
            </div>
            {loggedIn && (
              <button type="button" className="passport-logout" onClick={logoutProfile}>
                退出
              </button>
            )}
          </div>
          <div className="passport-actions">
            <input
              id="profile-name"
              value={profileName}
              onChange={(event) => setProfileName(event.target.value.slice(0, 18))}
              className="name-input"
              placeholder="昵称"
              aria-label="昵称"
              disabled={loggedIn}
            />
            <input
              id="profile-email"
              value={profileEmail}
              onChange={(event) => setProfileEmail(event.target.value.slice(0, 120))}
              className="email-input"
              placeholder="邮箱"
              aria-label="邮箱"
              inputMode="email"
              disabled={loggedIn}
            />
            <label className="upload-button">
              <Upload size={15} />
              {avatarReady ? "换个形象" : "上传/拖照片"}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarUpload} />
            </label>
            {!loggedIn ? (
              <>
                <button type="button" className="auth-button" onClick={sendLoginCode} disabled={authStatus === "sending"}>
                  {authStatus === "sending" ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
                  发验证码
                </button>
                <input
                  value={loginCode}
                  onChange={(event) => setLoginCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="code-input"
                  placeholder="验证码"
                  aria-label="验证码"
                  inputMode="numeric"
                />
                <button type="button" className="auth-button auth-button-dark" onClick={verifyLogin} disabled={authStatus === "verifying"}>
                  {authStatus === "verifying" ? <Loader2 className="animate-spin" size={15} /> : <LockKeyhole size={15} />}
                  验证登录
                </button>
              </>
            ) : (
              <>
                <button type="button" className="auth-button auth-button-dark" onClick={generateWorkplacePack} disabled={status === "loading" || !avatarReady}>
                  <Sparkles size={15} />
                  生成九宫格
                </button>
              </>
            )}
          </div>
          {!loggedIn && (
            <section className="workplace-pack-card workplace-pack-locked" aria-label="职场九宫格介绍">
              <div className="workplace-pack-head">
                <div>
                  <span>登录解锁</span>
                  <strong>职场九宫格：一次生成 9 张</strong>
                </div>
                <div className="workplace-pack-head-actions">
                  <button type="button" onClick={downloadDemoGif} disabled={gifStatus === "encoding"}>
                    {gifStatus === "encoding" ? <Loader2 className="animate-spin" size={13} /> : <Film size={13} />}
                    动作 GIF
                  </button>
                  <button type="button" onClick={focusLoginForm}>
                    <LockKeyhole size={13} />
                    去登录
                  </button>
                </div>
              </div>
              <p className="workplace-pack-copy">用自己的形象，一次生成同一风格的 3x3 职场表情包；系统会自动切成 9 张单图，方便直接复制走。</p>
              <div className="workplace-pack-sample-grid" aria-label="职场九宫格真实效果图">
                {workplacePackSampleImages.map((src, index) => (
                  <img key={src} src={src} alt={`职场窗边 Meme 样例 ${index + 1}`} loading="lazy" />
                ))}
              </div>
            </section>
          )}
          {loggedIn && (
            <section className="workplace-pack-card" aria-label="职场九宫格">
              <div className="workplace-pack-head">
                <div>
                  <span>职场九宫格</span>
                  <strong>一次生成 9 张，同一风格，自动切图</strong>
                </div>
                <button type="button" onClick={rerollWorkplacePack} disabled={workplacePackStatus === "loading"}>
                  <RefreshCw size={13} />
                  摇骰子
                </button>
              </div>
              <textarea
                value={workplacePackText}
                onChange={(event) => setWorkplacePackText(event.target.value.slice(0, 260))}
                className="workplace-pack-input"
                rows={9}
                placeholder="一行一句，正好 9 句"
              />
              <div className="workplace-pack-foot">
                <span>{workplacePackCaptions.length}/{WORKPLACE_PACK_COUNT} 句</span>
                <button type="button" className="auth-button auth-button-dark" onClick={generateWorkplacePack} disabled={!canGenerateWorkplacePack}>
                  {workplacePackStatus === "loading" ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />}
                  {workplacePackStatus === "loading" ? "生成中" : "生成 9 张"}
                </button>
              </div>
              {workplacePackItems.length > 0 && (
                <div className="workplace-pack-grid">
                  {workplacePackItems.map((item) => (
                    <img key={item.comboKey || item.id} src={item.thumbnail || item.imageUrl} alt={item.caption || "职场包"} loading="lazy" />
                  ))}
                </div>
              )}
            </section>
          )}
          {authMessage && <small className="auth-note">{authMessage}</small>}
          {!loggedIn && (
            <small className="auth-note">游客可用自己的照片生成 1 次；登录后可保存形象并继续生成职场包。</small>
          )}
          {loggedIn && !avatarReady && (
            <small className="auth-note">已登录。现在传一张正脸或半身照，AI 会做成拟人 3D 窗边替身，不走漫画风。</small>
          )}
          {profileSyncStatus !== "idle" && (
            <small className={cn("profile-sync-note", profileSyncStatus === "error" && "profile-sync-note-error")}>
              {profileSyncStatus === "saving" ? "后台正在收录你的形象" : profileSyncStatus === "done" ? "后台已收录，别后悔" : "后台刚才手滑了"}
            </small>
          )}
        </section>

        {error && <div className="error-box">{error}</div>}
      </section>

      <section className="result" ref={resultRef}>
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
              <div className="result-mode-switch" role="tablist" aria-label="结果类型">
                <button
                  type="button"
                  className={cn(resultMode !== "gif" && "result-mode-active")}
                  onClick={() => setResultMode("image")}
                >
                  静图
                </button>
                <button
                  type="button"
                  className={cn(resultMode === "gif" && "result-mode-active")}
                  onClick={() => gifPreviewUrl && setResultMode("gif")}
                  disabled={!gifPreviewUrl}
                >
                  GIF
                </button>
              </div>
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
                href={resultAssetUrl}
                download={`chuangbian-${Date.now()}.${resultAssetType === "gif" ? "gif" : "png"}`}
                title={`下载 ${resultAssetLabel}`}
              >
                <Download size={18} />
                {resultAssetLabel}
              </a>
              <button
                type="button"
                className="download-button gif-demo-button desktop-image-action"
                onClick={downloadDemoGif}
                disabled={gifStatus === "encoding"}
                title="下载动作 GIF"
              >
                {gifStatus === "encoding" ? <Loader2 className="animate-spin" size={18} /> : <Film size={18} />}
                {gifStatus === "done" ? "已出 GIF" : "补 GIF"}
              </button>
              <div className="mobile-save-hint">长按当前{resultAssetLabel}保存或转发</div>
            </div>
          )}
        </div>

        <div className="image-stage">
          {resultAssetUrl ? (
            <img src={resultAssetUrl} alt={resultAssetType === "gif" ? "生成的窗边 GIF" : "生成的窗边表情包"} />
          ) : status === "loading" ? (
            <div className="empty-window empty-window-loading">
              <Loader2 className="animate-spin" size={44} />
              <span>正在把人送去窗边</span>
            </div>
          ) : (
            <div className="empty-window">
              <ImageIcon size={44} />
              <span>还没人站过去</span>
            </div>
          )}
        </div>
        <div className="opossum-gif-demos" aria-label="负鼠 GIF 示意头像">
          <div className="opossum-gif-demos-head">
            <span>GIF 示意头像</span>
            <strong>负鼠先动一下</strong>
          </div>
          <div className="opossum-gif-demo-grid">
            {opossumGifDemos.map((item) => (
              <button key={item.id} type="button" onClick={() => previewOpossumGifDemo(item)}>
                <img src={item.gif} alt={`${item.caption} 负鼠 GIF 示意`} loading="lazy" />
                <span>{item.caption}</span>
                <small>{item.actionName}</small>
              </button>
            ))}
          </div>
        </div>
        {gifPreviewUrl && (
          <div className="gif-preview-card">
            <img src={gifPreviewUrl} alt="窗边 GIF demo 预览" />
            <div>
              <strong>动作 GIF 已生成</strong>
              <span>点上方 GIF 可直接预览；也会进 GIF 库。</span>
            </div>
            <button type="button" onClick={() => setResultMode("gif")}>
              看 GIF
            </button>
          </div>
        )}
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
                {item.blocked ? (
                  <div className="gallery-blocked-thumb">
                    <ImageIcon size={28} />
                    <span>Blob 暂停</span>
                  </div>
                ) : (
                  <img src={item.thumbnail || item.imageUrl || item.image} alt={item.caption || "窗边缩略图"} loading="lazy" />
                )}
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
                    <button type="button" className="gallery-copy desktop-image-action" onClick={() => copyGalleryImage(item)} disabled={item.blocked}>
                      <Copy size={13} />
                      {item.blocked ? "待恢复" : galleryCopyId === `${item.comboKey || item.id}:done` ? "已复制" : "复制"}
                    </button>
                    <a className={cn("gallery-copy desktop-image-action", item.blocked && "gallery-copy-disabled")}
                      href={item.blocked ? undefined : item.downloadUrl || item.imageUrl || item.image}
                      download={item.blocked ? undefined : `chuangbian-meme-${item.comboKey || item.id}.${getGalleryFileExtension(item)}`}
                    >
                      <Download size={13} />
                      {item.blocked ? "403" : getGalleryDownloadLabel(item)}
                    </a>
                    <div className="mobile-save-hint">{item.blocked ? "旧图还在，但 Blob 暂停导致暂时看不到" : "长按图片保存或转发"}</div>
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

      <footer className="site-footer">
        powered by @Mr.k · 微信 Kevph2026 ·{" "}
        <a href="https://github.com/KevPH2026/chuangbian" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>

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

function readLocalJson(key) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeLocalJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Login still works for this tab even if localStorage refuses the profile.
  }
}

function removeLocalValue(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to clean up if storage is blocked.
  }
}

function readLocalGalleryItems() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(localGalleryKey) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeGalleryItem).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeLocalGalleryItems(items) {
  try {
    window.localStorage.setItem(localGalleryKey, JSON.stringify(items.slice(0, localGalleryLimit)));
  } catch {
    // If localStorage is full, keep the current page state and let the next refresh use server data.
  }
}

function rememberLocalGalleryItem(item) {
  const nextItem = normalizeGalleryItem({
    ...item,
    createdAt: item?.createdAt || new Date().toISOString(),
    localOnly: Boolean(item?.imageUrl?.startsWith?.("data:image/"))
  });
  if (!nextItem) {
    return null;
  }

  const nextItems = mergeGalleryItems([nextItem], readLocalGalleryItems()).slice(0, localGalleryLimit);
  writeLocalGalleryItems(nextItems);
  return nextItem;
}

function normalizeGalleryItem(item) {
  if (!item) {
    return null;
  }

  const comboKey = String(item.comboKey || item.id || `local_${Date.now()}`).trim();
  const imageUrl = String(item.imageUrl || item.image || item.thumbnail || "").trim();
  if (!comboKey || !imageUrl) {
    return null;
  }

  const category = String(item.category || item.action || "default");
  return {
    ...item,
    id: String(item.id || comboKey),
    comboKey,
    caption: String(item.caption || "窗边时刻"),
    category,
    categoryName: item.categoryName || galleryCategoryLabels[category] || item.actionName || "窗边",
    creatorName: item.creatorName || "无名受害者",
    downloadUrl: item.downloadUrl || imageUrl,
    imageUrl,
    lastUsedAt: item.lastUsedAt || item.createdAt || new Date().toISOString(),
    roleName: item.roleName || "路过角色",
    thumbnail: item.thumbnail || imageUrl,
    uses: Number(item.uses || 1)
  };
}

function isGifGalleryItem(item) {
  const url = String(item?.downloadUrl || item?.imageUrl || item?.thumbnail || "");
  return item?.mediaType === "gif" || /image\/gif/i.test(String(item?.contentType || "")) || /\.gif($|\?)/i.test(url);
}

function getGalleryMimeType(item) {
  return isGifGalleryItem(item) ? "image/gif" : "image/png";
}

function getGalleryFileExtension(item) {
  return isGifGalleryItem(item) ? "gif" : "png";
}

function getGalleryDownloadLabel(item) {
  return isGifGalleryItem(item) ? "GIF" : "PNG";
}

function mergeGalleryItems(...groups) {
  const byKey = new Map();
  for (const group of groups) {
    for (const rawItem of Array.isArray(group) ? group : []) {
      const item = normalizeGalleryItem(rawItem);
      if (!item) {
        continue;
      }

      const existing = byKey.get(item.comboKey);
      byKey.set(item.comboKey, {
        ...existing,
        ...item,
        thumbnail: item.thumbnail || existing?.thumbnail,
        imageUrl: item.imageUrl || existing?.imageUrl,
        downloadUrl: item.downloadUrl || existing?.downloadUrl
      });
    }
  }

  return [...byKey.values()].sort((left, right) => {
    const leftTime = new Date(left.lastUsedAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.lastUsedAt || right.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
}

function getClientGalleryCategories(items, fallbackCategories = []) {
  const fallbackMap = new Map(
    (Array.isArray(fallbackCategories) ? fallbackCategories : []).map((category) => [category.id, category.name])
  );
  const counts = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (item?.category) {
      counts.set(item.category, (counts.get(item.category) || 0) + 1);
    }
  }

  return galleryCategoryOrder
    .filter((id) => id === "all" || counts.has(id))
    .map((id) => ({
      id,
      name: galleryCategoryLabels[id] || fallbackMap.get(id) || id,
      count: id === "all" ? (Array.isArray(items) ? items.length : 0) : counts.get(id) || 0
    }));
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

async function copyImageFromUrl(src, preferredMimeType = "image/png") {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("当前浏览器不支持直接复制图片，可以先分享或下载。");
  }

  const blob = preferredMimeType === "image/gif" ? await fetchRawImageBlob(src) : await fetchImageBlob(src);
  await navigator.clipboard.write([new ClipboardItem({ [preferredMimeType]: blob })]);
}

function downloadUrl(url, fileName) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

async function fetchImageBlob(src) {
  const blob = await fetchRawImageBlob(src);
  return blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" });
}

async function fetchRawImageBlob(src) {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error("图片读取失败。");
  }

  return response.blob();
}

function friendlyImageError(error, fallback) {
  const message = error instanceof Error ? error.message : "";
  if (/permission|denied|not allowed|not permitted/i.test(message)) {
    return "浏览器没给图片剪贴板权限，可以点分享或下载。";
  }
  if (/clipboard|ClipboardItem/i.test(message)) {
    return "当前浏览器不支持直接复制图片，可以点分享或下载。";
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
