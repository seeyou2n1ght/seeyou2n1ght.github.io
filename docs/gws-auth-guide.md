# Google Workspace CLI 授权指南

## 方法 1: 自动配置（推荐，需 gcloud）
```bash
gws auth setup  # 创建 Cloud 项目、启用 API、登录
```

## 方法 2: 手动 OAuth

1. 访问 https://console.cloud.google.com/apis/credentials
2. 创建 OAuth client (Desktop app)
3. 下载 client_secret.json 到 ~/.config/gws/
4. 运行 `gws auth login`

## 方法 3: 服务账户（服务器）
```bash
export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/path/to/service-account.json
gws drive files list
```

## 范围选择
- 最小权限：`--scopes drive`
- 常用组合：`--scopes drive,gmail,calendar`
- 完整权限：`--scopes all`（可能超出测试限制）
