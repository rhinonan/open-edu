# Docker 部署与 GitHub 构建 — 设计文档

- 日期：2026-08-21
- 状态：已评审通过，待实现

## 目标

把「班主任智慧工作台」以 Docker 方式部署到服务器，并在 GitHub 上通过 Actions 构建 Docker 镜像。采用**半自动**流程：GitHub Actions 负责构建并推送镜像到 GHCR，服务器上由用户手动拉取并启动容器。

## 现状

- Next.js 16.3 + React 19 + TypeScript strict + Tailwind 4，要求 Node ≥ 22（本机为 24）。
- 数据库为嵌入式 SQLite（`node:sqlite` `DatabaseSync`），文件位于 `process.cwd()/data/app.db`，开启 WAL。
- `data/` 已被 `.gitignore` 忽略，首次启动 `seedIfEmpty` 自动生成演示数据。
- `next.config.ts` 为空，未开启 `output: 'standalone'`。
- 当前仓库无 `.github/`、`Dockerfile`、`docker-compose.yml` 等部署相关文件，属从零搭建。
- 源码无任何 `process.env` 依赖，应用本身无需额外环境变量。

## 架构决策

### 1. 镜像仓库：GitHub Container Registry (GHCR)

- 原生集成，无需额外账号；私有仓库默认免费。
- Actions 使用 `GITHUB_TOKEN` 即可免密钥登录，无需配置 PAT。

### 2. 访问方式：直接暴露端口

- 不做反向代理与 HTTPS，`docker-compose` 仅运行单个应用容器。
- 对外通过 `http://服务器IP:3000` 访问（映射到宿主机端口可改）。

### 3. 部署流程：半自动

- GitHub Actions 在 `push` 到 `main` 时构建并推送镜像。
- 服务器上手动执行 `docker compose pull && docker compose up -d`。

## 组件设计

### Dockerfile（多阶段构建）

- 基础镜像 `node:24-alpine`。
- 阶段一 `deps`：`npm ci` 安装生产与开发依赖。
- 阶段二 `builder`：`npm run build`。
- 阶段三 `runner`：仅拷贝 `.next/standalone`、`public`、`.next/static`，`node server.js` 启动。
- 依赖 `next.config.ts` 的 `output: 'standalone'` 输出。

### 数据持久化

- 镜像不打包数据库。
- compose 挂命名卷 `open-edu-data` 到容器内 `/app/data`，保证重建不丢数据。

### GitHub Actions

- 工作流文件 `.github/workflows/docker-build.yml`。
- 触发：`push` 到 `main`。
- 步骤：checkout → 安装 buildx → `GITHUB_TOKEN` 登录 GHCR → build & push。
- 标签：`ghcr.io/<owner>/<repo>:latest` 与 `:sha-<短哈希>`。
- 权限 `packages: write`，启用 buildx gha 缓存。

### 服务器手动部署

- 服务器放置同一份 `docker-compose.yml`。
- 登录 GHCR 后 `docker compose pull && docker compose up -d`。

## 改动文件清单

| 操作 | 文件 |
|---|---|
| 改 | `next.config.ts`（加 `output: 'standalone'`） |
| 新增 | `Dockerfile` |
| 新增 | `.dockerignore` |
| 新增 | `docker-compose.yml` |
| 新增 | `.github/workflows/docker-build.yml` |
| 新增 | `docs/DEPLOY.md` |

## 关键细节

- `output: 'standalone'` 产出的 `server.js` 默认只监听 localhost，需 `ENV HOSTNAME=0.0.0.0` 才能被容器外访问；端口由 `PORT` 环境变量控制（默认 3000）。
- standalone 产物需手动拷贝 `public` 与 `.next/static` 到 standalone 目录，否则静态资源 404。
- `node:sqlite` 为 Node 内置模块，standalone 打包不涉及原生二进制拷贝。
- 健康检查（HEALTHCHECK）与重启策略（`restart: unless-stopped`）为可选项，实现时按需加入。
