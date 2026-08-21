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
