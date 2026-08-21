# Docker 部署与 GitHub 构建 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让「班主任智慧工作台」能用 Docker 构建镜像、推送到 GHCR，并在服务器上手动部署运行，数据持久化。

**Architecture:** 多阶段 Dockerfile（`node:24-alpine`）基于 Next.js `output: 'standalone'` 产物构建最小镜像；GitHub Actions 在 push 到 `main` 时构建并推送镜像到 `ghcr.io/rhinonan/open-edu`；服务器用 `docker compose` 拉取并运行，SQLite 数据放在命名卷 `open-edu-data`。

**Tech Stack:** Docker + Buildx、GitHub Actions、Node 24 (alpine)、Next.js standalone 输出、docker compose v2。

## Global Constraints

- 镜像推送到 GHCR：`ghcr.io/rhinonan/open-edu`（owner/repo 均小写，远程为 `git@github.com:rhinonan/open-edu.git`）。
- Node 版本要求 ≥ 22，基础镜像统一用 `node:24-alpine`（`node:sqlite` 无需 flag）。
- 应用对外绑定 `0.0.0.0:3000`，靠 `HOSTNAME=0.0.0.0` + `PORT=3000` 环境变量（standalone 默认只监听 localhost）。
- 数据持久化：命名卷 `open-edu-data` 挂到容器内 `/app/data`；镜像不打包本地 `data/`。
- 部署模式为半自动：CI 只构建+推送，服务器手动 `docker compose pull && up -d`。
- 本机无 Docker、不做本地构建验证；正确性最终以 GitHub Actions 日志为准。
- 提交信息遵循 `feat:` / `chore:` / `docs:` 前缀风格。

---

### Task 1: Docker 镜像构建（standalone 输出 + .dockerignore + Dockerfile）

**Files:**
- Modify: `next.config.ts`
- Create: `.dockerignore`
- Create: `Dockerfile`

**Interfaces:**
- Consumes: `package.json`（`build` 脚本）、`npm ci` 依赖安装、`.next/standalone` 输出（由 `output: 'standalone'` 产生）。
- Produces: 一个可 `docker build` 出生产镜像的 `Dockerfile`；镜像入口 `CMD ["node", "server.js"]`，监听 `0.0.0.0:3000`，以非 root 用户 `nextjs` 运行。

- [ ] **Step 1: 开启 standalone 输出**

把 `next.config.ts` 全文替换为：

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 2: 新增 `.dockerignore`**

创建 `.dockerignore`，内容如下：

```dockerignore
node_modules
.next
.git
.gitignore
data
docs
tests
.superpowers
*.md
.env*
.DS_Store
*.tsbuildinfo
```

说明：`data` 必须排除，避免本地演示数据库被打进镜像；`*.md` 排除 CLAUDE.md/AGENTS.md/prd.md 等对构建无用的文件。

- [ ] **Step 3: 新增 `Dockerfile`**

创建 `Dockerfile`，内容如下：

```dockerfile
# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /app/data \
  && chown nextjs:nodejs /app/data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
```

关键点：
- `RUN mkdir -p /app/data && chown nextjs:nodejs /app/data`：预先在镜像里建好数据目录并归属 `nextjs` 用户，这样命名卷首次挂载时会继承该目录的属主，非 root 用户可写。
- `public` 与 `.next/static` 必须手动拷贝，否则静态资源 404。

- [ ] **Step 4: 复核文件内容并提交**

```bash
git add next.config.ts .dockerignore Dockerfile
git commit -m "chore: dockerize app with standalone output and multi-stage build"
```

（本机无 Docker，不执行 `docker build`；构建正确性由 Task 3 的 CI 日志验证。）

---

### Task 2: 服务器部署编排（docker-compose.yml）

**Files:**
- Create: `docker-compose.yml`

**Interfaces:**
- Consumes: Task 1 产出的镜像（`ghcr.io/rhinonan/open-edu:latest`），容器内数据目录 `/app/data`。
- Produces: 服务器上 `docker compose up -d` 能启动的编排文件；对外端口映射 3000。

- [ ] **Step 1: 新增 `docker-compose.yml`**

创建 `docker-compose.yml`，内容如下：

```yaml
services:
  app:
    image: ghcr.io/rhinonan/open-edu:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - open-edu-data:/app/data

volumes:
  open-edu-data:
```

- [ ] **Step 2: 提交**

```bash
git add docker-compose.yml
git commit -m "chore: add docker-compose for server deployment"
```

---

### Task 3: GitHub Actions 构建与推送

**Files:**
- Create: `.github/workflows/docker-build.yml`

**Interfaces:**
- Consumes: Task 1 的 `Dockerfile`；`GITHUB_TOKEN`（仓库默认 secret）；`github.repository`（= `rhinonan/open-edu`）。
- Produces: 每次 push 到 `main`（或手动触发）构建并推送镜像到 GHCR，标签 `latest` 与 `sha-<短哈希>`。

- [ ] **Step 1: 新增工作流文件**

创建 `.github/workflows/docker-build.yml`，内容如下：

```yaml
name: Build and push Docker image

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  packages: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract image metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=raw,value=latest
            type=sha,format=short

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

说明：`permissions.packages: write` 允许 `GITHUB_TOKEN` 推送镜像到 GHCR；`type=sha,format=short` 生成 `ghcr.io/rhinonan/open-edu:abc1234` 这类标签。

- [ ] **Step 2: 提交并推送触发首次构建**

```bash
git add .github/workflows/docker-build.yml
git commit -m "ci: build and push docker image to ghcr"
git push origin main
```

- [ ] **Step 3: 在 GitHub Actions 页面核对日志**

打开仓库 Actions 标签页，确认 `Build and push Docker image` 工作流运行成功、无报错；构建完成后在仓库 `Packages` 页面确认出现 `ghcr.io/rhinonan/open-edu` 包。

（如报错，把日志反馈回来，按错误内容修复。）

---

### Task 4: 部署手册

**Files:**
- Create: `docs/DEPLOY.md`

**Interfaces:**
- Consumes: Task 2 的 `docker-compose.yml`、Task 3 的镜像地址与推送流程。
- Produces: 服务器运维人员可照做的部署手册。

- [ ] **Step 1: 新增 `docs/DEPLOY.md`**

创建 `docs/DEPLOY.md`，内容如下：

````markdown
# 部署手册（Docker）

本项目以 Docker 方式部署：GitHub Actions 构建镜像并推送到 GitHub Container Registry (GHCR)，服务器上手动拉取并启动。

## 镜像地址

`ghcr.io/rhinonan/open-edu`，标签 `latest`（每次 push 到 `main` 还会打一个 `sha-<短哈希>` 标签）。

## 服务器准备

1. 安装 Docker 与 Docker Compose 插件（`docker compose` 子命令）。
2. 把仓库里的 `docker-compose.yml` 放到服务器上任意目录（例如 `/opt/open-edu/`）。

## 登录 GHCR

需要一个 GitHub Personal Access Token（classic），勾选 `read:packages` 权限：

```bash
echo <PAT> | docker login ghcr.io -u rhinonan --password-stdin
```

## 拉取并启动

```bash
cd /opt/open-edu
docker compose pull
docker compose up -d
```

应用监听 `http://<服务器IP>:3000`。

## 常用命令

```bash
docker compose ps                        # 查看容器状态
docker compose logs -f app               # 跟踪日志
docker compose down                      # 停止并移除容器（数据保留在卷中）
docker compose pull && docker compose up -d   # 更新到最新镜像
```

## 数据持久化

SQLite 数据库存放在命名卷 `open-edu-data`（容器内 `/app/data`）。`docker compose down` 或重建容器都不会丢数据。

备份数据：

```bash
docker run --rm -v open-edu-data:/data -v "$(pwd)":/backup \
  alpine tar czf /backup/open-edu-data.tar.gz -C /data .
```

## 更新流程

1. 代码 push 到 `main`，GitHub Actions 自动构建并推送新镜像。
2. 服务器上执行 `docker compose pull && docker compose up -d`。
````

- [ ] **Step 2: 提交**

```bash
git add docs/DEPLOY.md
git commit -m "docs: add docker deployment guide"
```

---

## 自审记录

- **Spec 覆盖**：standalone 输出（Task 1）✓、Dockerfile 多阶段（Task 1）✓、数据持久化命名卷（Task 1/2）✓、GHCR 构建推送（Task 3）✓、服务器手动部署（Task 2/4）✓、`.dockerignore`（Task 1）✓、`docs/DEPLOY.md`（Task 4）✓。
- **占位符**：无 TBD/TODO；GHCR 路径、owner/repo、标签均取实际值。
- **类型/命名一致**：镜像地址 `ghcr.io/rhinonan/open-edu`、卷名 `open-edu-data`、容器内路径 `/app/data`、端口 `3000`、非 root 用户 `nextjs`，在四个任务中一致。
