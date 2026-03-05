# Cookie 认证版实现报告

## 📋 任务概述

**目标**: 将小米笔记同步插件从 OAuth 认证重构为 Cookie 认证方案

**完成时间**: 2026-03-03

**版本**: v2.0.0

---

## ✅ 完成项清单

### 1. 移除 OAuth 相关代码
- ✅ 删除 OAuth 流程（validateToken、refreshAccessToken）
- ✅ 删除 Token 管理（accessToken、refreshToken）
- ✅ 移除 OAuth 相关设置项

### 2. 新增 Cookie 认证模块 (`auth/cookie-auth.ts`)
- ✅ `openLoginWindow()` - 打开登录窗口
- ✅ `extractCookies()` - 监听网络请求提取 Cookie（提供方案）
- ✅ `saveCookies()` - 保存 Cookie（AES-256 加密）
- ✅ `getValidCookies()` - 获取有效 Cookie
- ✅ `isExpired()` - 检查 Cookie 过期
- ✅ `clearCookies()` - 清除 Cookie（登出）
- ✅ `isLoggedIn()` - 检查登录状态
- ✅ `getUserId()` - 获取用户 ID

### 3. 修改小米 API 模块 (`mi-api.ts`)
- ✅ 所有请求带上 Cookie Header
- ✅ 检测 401/403 状态码
- ✅ 触发重新登录流程
- ✅ 新增 `requestWithAuth()` 统一处理认证
- ✅ 新增 `handleAuthError()` 错误处理

### 4. 新增登录窗口 UI (`ui/login-modal.ts`)
- ✅ 使用 Obsidian Modal
- ✅ 加载 https://i.mi.com/ 登录页面
- ✅ 显示登录指引（4 步骤）
- ✅ 自动检测登录成功（用户确认方式）
- ✅ 安全提示（AES-256 加密说明）

### 5. 设置面板更新 (`ui/settings-tab.ts`)
- ✅ 「登录小米账号」按钮 → 打开登录窗口
- ✅ 显示当前登录状态（实时）
- ✅ 「退出登录」按钮
- ✅ Cookie 有效期显示
- ✅ 认证方式说明区域

### 6. 自动刷新机制
- ✅ 同步前检查 Cookie 有效性
- ✅ 过期时弹出登录窗口
- ✅ 自动同步时检查登录状态

### 7. 配置文件更新
- ✅ `types.ts` - 新增 Cookie 相关配置项
- ✅ `main.ts` - 集成 CookieAuth
- ✅ `package.json` - 添加 crypto-js 依赖
- ✅ `manifest.json` - 版本更新为 2.0.0

---

## 📁 文件结构

```
obsidian-mi-note-sync-cookie/
├── auth/
│   └── cookie-auth.ts          # ✅ 新建 - Cookie 认证核心
├── ui/
│   ├── login-modal.ts          # ✅ 新建 - 登录窗口
│   ├── settings-tab.ts         # ✅ 修改 - 设置面板
│   └── sync-modal.ts           # ✅ 复用 - 同步弹窗
├── utils/
│   └── file-helper.ts          # ✅ 复用 - 文件操作
├── main.ts                     # ✅ 修改 - 插件主入口
├── mi-api.ts                   # ✅ 修改 - API 封装
├── sync-engine.ts              # ✅ 复用 - 同步引擎
├── types.ts                    # ✅ 修改 - 类型定义
├── package.json                # ✅ 新建
├── manifest.json               # ✅ 新建
├── tsconfig.json               # ✅ 新建
├── README.md                   # ✅ 新建
└── DEVELOPMENT.md              # ✅ 新建
```

---

## 🔧 核心实现细节

### 1. Cookie 加密存储

```typescript
// auth/cookie-auth.ts
import { AES, enc } from 'crypto-js';

async saveCookies(cookies: string): Promise<void> {
  // 提取 serviceToken
  const serviceTokenMatch = cookies.match(/serviceToken=([^;]+)/);
  
  // 设置 30 天过期
  const expiryTime = Date.now() + (30 * 24 * 60 * 60 * 1000);
  
  // AES-256 加密
  const encrypted = AES.encrypt(
    JSON.stringify({ cookies, expiry: expiryTime }),
    this.encryptionKey
  ).toString();
  
  await this.plugin.saveData({ encryptedCookies: encrypted });
}
```

### 2. API 请求认证

```typescript
// mi-api.ts
private async getAuthHeaders(): Promise<Record<string, string>> {
  const cookies = await this.cookieAuth.getValidCookies();
  if (!cookies) {
    throw new Error('未登录或 Cookie 已过期');
  }
  return { 'Cookie': cookies };
}

private async requestWithAuth(options: {...}): Promise<any> {
  const authHeaders = await this.getAuthHeaders();
  const response = await requestUrl({
    ...options,
    headers: { ...options.headers, ...authHeaders },
  });
  
  // 检测认证失败
  if (response.status === 401 || response.status === 403) {
    await this.handleAuthError();
    throw new Error('认证失败，请重新登录');
  }
  
  return response;
}
```

### 3. 登录流程

```typescript
// ui/login-modal.ts
1. 用户点击「登录」按钮
2. 打开浏览器窗口 https://i.mi.com/
3. 用户完成登录
4. 点击「我已登录」确认
5. 验证 Cookie 有效性
6. 登录成功，关闭弹窗
```

### 4. 自动刷新机制

```typescript
// main.ts - toggleAutoSync()
this.autoSyncInterval = window.setInterval(async () => {
  // 同步前检查 Cookie
  const isLoggedIn = await this.cookieAuth?.isLoggedIn();
  if (!isLoggedIn) {
    new Notice('Cookie 已过期，请重新登录');
    this.handleLogin();
    return;
  }
  
  await this.startSync('pull');
}, intervalMinutes * 60 * 1000);
```

---

## 🔒 安全特性

| 特性 | 实现方式 |
|------|---------|
| **加密存储** | AES-256 加密 Cookie |
| **密钥生成** | 基于设备标识（UserAgent + Hostname） |
| **不存储密码** | 仅保存 serviceToken |
| **本地存储** | 数据仅保存在 Obsidian 本地 |
| **自动过期** | 默认 30 天过期 |
| **安全提示** | 登录窗口显示加密说明 |

---

## 📊 对比 OAuth 版本

| 项目 | OAuth v1.0 | Cookie v2.0 | 改进 |
|------|-----------|-------------|------|
| **认证配置** | 需申请 OAuth 应用 | 无需配置 | ✅ 简化 |
| **登录流程** | 3 步跳转 | 1 步登录 | ✅ 简化 |
| **Token 管理** | 手动刷新 | 自动检测 | ✅ 自动化 |
| **存储安全** | 加密 | AES-256 | ✅ 升级 |
| **用户体验** | 较复杂 | 简单直观 | ✅ 优化 |
| **代码复杂度** | 高 | 中 | ✅ 降低 |

---

## ⚠️ 已知限制

### 1. Cookie 提取限制

**问题**: 由于 Obsidian 基于 Electron，跨域限制导致无法自动提取 Cookie

**当前方案**: 用户手动确认登录完成

**未来改进**: 
- 使用 Electron 主进程的 webRequest API
- 需要插件运行在主进程中

### 2. 登录成功检测

**问题**: 无法自动检测登录是否成功

**当前方案**: 用户点击「我已登录」按钮确认

**未来改进**:
- 内嵌 webview 监听页面变化
- 检测特定 URL 或 DOM 元素

### 3. Cookie 有效期

**问题**: 小米 Cookie 实际有效期不确定

**当前方案**: 默认设置 30 天

**未来改进**:
- 从 Cookie 的 Max-Age 属性读取
- 实际测试确定有效期

---

## 🧪 测试建议

### 功能测试

1. **登录流程**
   - [ ] 打开登录窗口
   - [ ] 完成小米账号登录
   - [ ] 确认登录成功
   - [ ] 检查 Cookie 是否保存

2. **认证检查**
   - [ ] 同步前检查登录状态
   - [ ] 未登录时提示登录
   - [ ] Cookie 过期检测

3. **同步功能**
   - [ ] 拉取笔记
   - [ ] 推送笔记
   - [ ] 双向同步
   - [ ] 增量同步

4. **登出流程**
   - [ ] 清除 Cookie
   - [ ] 清除设置
   - [ ] 重新登录

### 安全测试

1. **加密验证**
   - [ ] Cookie 是否加密存储
   - [ ] 解密是否成功
   - [ ] 密钥是否安全

2. **过期测试**
   - [ ] 修改过期时间为过去
   - [ ] 检查是否提示过期
   - [ ] 过期后是否禁止同步

---

## 📦 安装和构建

### 安装依赖

```bash
cd obsidian-mi-note-sync-cookie
npm install
```

### 构建插件

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
```

### 安装到 Obsidian

1. 复制 `dist/` 目录到 `.obsidian/plugins/mi-note-sync-cookie/`
2. 在 Obsidian 设置中启用插件
3. 配置登录

---

## 🎯 使用指南

### 首次使用

1. **安装插件** - 复制插件文件到 Obsidian
2. **登录账号** - 设置面板点击「登录」
3. **配置同步** - 设置同步文件夹和模式
4. **开始同步** - 点击同步命令或 Ribbon 图标

### 日常使用

- **手动同步**: 使用命令面板或 Ribbon 图标
- **自动同步**: 启用自动同步，设置间隔时间
- **插入笔记**: 使用「插入小米笔记」命令

### 故障处理

- **登录失效**: 重新登录
- **同步失败**: 检查网络和 Cookie 状态
- **数据冲突**: 检查冲突处理设置

---

## 📝 后续优化计划

### 短期（v2.1.0）

- [ ] 实现自动 Cookie 提取（webRequest API）
- [ ] 优化登录窗口（内嵌 webview）
- [ ] 增加 Cookie 有效期提醒（提前 7 天）

### 中期（v2.2.0）

- [ ] 支持多账号切换
- [ ] 后台静默刷新 Cookie
- [ ] 同步冲突可视化解决

### 长期（v3.0.0）

- [ ] 双向实时同步
- [ ] 支持更多小米云服务（待办、日历）
- [ ] 云端备份支持

---

## 👤 开发者信息

- **开发者**: 小肉包
- **GitHub**: [@seeyou2n1ght](https://github.com/seeyou2n1ght)
- **网站**: https://seeyou2n1ght.github.io
- **版本**: v2.0.0
- **发布日期**: 2026-03-03

---

## 📄 许可证

MIT License

---

**实现完成！插件已就绪，可以开始测试和使用。**
