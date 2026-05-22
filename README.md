# 窗边 Meme

一个极简中文互联网表情包生成器：输入一句话，选择角色，生成“背着手站在蓝色夜窗边”的低气压 Meme。

## 本地启动

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:5173/`。

如果本地只想调页面，不想连接 Vercel Blob：

```bash
CHUANGBIAN_STORAGE=memory npm run dev
```

## 环境变量

核心变量见 `.env.example`：

- `ADMIN_TOKEN`：后台口令，生产环境必须配置。
- `CONFIG_ENCRYPTION_KEY`：后台模型 Key 的加密密钥，开源部署建议单独设置并保持稳定。
- `BLOB_READ_WRITE_TOKEN`：Vercel Blob Token，用于保存图库、头像、许愿墙和后台配置。
- `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_IMAGE_MODEL`：后台模型配置关闭时的兜底生图配置。

不要把 `.env.local` 或真实 Key 提交到仓库。

开源前先跑：

```bash
npm run check:secrets
```

这个脚本会跳过 `.env.local`、`.vercel`、`dist`、`node_modules` 等本地文件，并检查源码里有没有疑似 API Key。发现疑似 Key 时只报文件和行号，不会把值打印出来。

## 后台模型配置

访问 `/admin`，输入 `ADMIN_TOKEN` 后可以配置：

- 生图调用地址 `Base URL`
- 模型名
- API Key
- 图片尺寸
- 图片质量

当前支持 OpenAI Images API 及 OpenAI 兼容的 `/images/generations`、`/images/edits` 接口。后台已预置 TokenRouter、OpenAI gpt-image、DALL·E 和自定义兼容接口。

后台保存的 API Key 会加密后写入 Vercel Blob，前端只会看到是否已配置和脱敏提示。

## 部署

推荐 Vercel：

```bash
vercel deploy --prod
```

部署后在 Vercel 项目里配置 `.env.example` 里的变量，再访问 `/admin` 设置实际生图供应商。
