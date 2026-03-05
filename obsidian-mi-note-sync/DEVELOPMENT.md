# 开发指南 - 小米笔记同步插件

## 项目状态

✅ **已完成**：
- 项目结构搭建
- 类型定义
- 小米 API 封装框架
- Markdown 转换器（HTML ↔ Markdown）
- 文件操作工具
- 同步引擎
- 设置面板 UI
- 同步进度弹窗
- 主入口和命令系统
- 自动同步机制

⚠️ **需要完善**：
- 小米 OAuth 实际登录流程（需要抓包获取真实 API 端点）
- 小米笔记 API 端点验证（当前使用模拟端点）
- 实际环境测试和调试

## 小米 API 逆向工程指南

### 1. 抓包准备

工具推荐：
- **Charles Proxy** 或 **Fiddler** - HTTP/HTTPS 抓包
- **Wireshark** - 网络包分析
- **Android Studio** - 模拟器 + 网络监控

### 2. 获取 API 端点

步骤：
1. 安装小米笔记 App（Android/iOS）
2. 配置代理，安装 CA 证书
3. 登录小米账号
4. 执行笔记同步操作
5. 分析以下请求：

关键端点：
```
# 认证相关
POST https://api.micloud.xiaomi.net/oauth2/token
GET  https://api.micloud.xiaomi.net/api/v1/user/profile

# 笔记相关
GET    https://api.micloud.xiaomi.net/api/v1/notes
GET    https://api.micloud.xiaomi.net/api/v1/notes/{id}
POST   https://api.micloud.xiaomi.net/api/v1/notes
PUT    https://api.micloud.xiaomi.net/api/v1/notes/{id}
DELETE https://api.micloud.xiaomi.net/api/v1/notes/{id}

# 文件夹
GET https://api.micloud.xiaomi.net/api/v1/notes/folders

# 附件
GET https://api.micloud.xiaomi.net/api/v1/attachments/{id}
```

### 3. 认证流程

小米使用 OAuth 2.0，典型流程：

```
1. 获取 Service Auth Token
   POST https://account.xiaomi.com/pass/serviceLogin
   Params: userId, hash

2. 获取安全令牌
   POST https://account.xiaomi.com/pass/getSecurityToken
   Headers: X-User-Agent, Cookie

3. 换取 Access Token
   POST https://api.micloud.xiaomi.net/oauth2/token
   Body: grant_type, userId, securityToken
```

### 4. 请求头示例

```http
Authorization: Bearer {access_token}
X-User-Agent: Android/11/Mi10Pro
User-Agent: Android-6.12.63+deb13-amd64
Content-Type: application/json
```

## 本地开发流程

### 1. 环境准备

```bash
# Node.js 版本要求：>= 16
node --version

# 安装依赖
cd obsidian-mi-note-sync
npm install
```

### 2. 开发模式

```bash
# 监听文件变化，自动构建
npm run dev
```

### 3. 构建生产版本

```bash
npm run build
```

### 4. 测试安装

将生成的文件复制到 Obsidian 插件目录：

```bash
# 假设 Obsidian 仓库在 ~/obsidian-vault
cp main.js manifest.json ~/obsidian-vault/.obsidian/plugins/mi-note-sync/
```

### 5. 调试

在 Obsidian 中：
1. 设置 → 关于 → 打开开发者工具
2. 查看 Console 日志
3. 搜索 `Mi Note Sync:` 前缀的日志

## 测试计划

### 单元测试

```typescript
// 示例：测试 Markdown 转换器
import { MarkdownConverter } from './utils/markdown-converter';

describe('MarkdownConverter', () => {
  it('should convert HTML headers to Markdown', () => {
    const html = '<h1>Title</h1>';
    const md = MarkdownConverter.htmlToMarkdown(html);
    expect(md).toBe('# Title');
  });
});
```

### 集成测试

1. **认证测试**
   - 登录流程
   - Token 刷新
   - 登出

2. **同步测试**
   - 全量拉取
   - 增量同步
   - 推送笔记
   - 冲突处理

3. **转换测试**
   - 各种 HTML 格式
   - 图片处理
   - 表格转换
   - 代码块

## 发布流程

### 1. 准备发布

- 更新 `manifest.json` 版本号
- 更新 `README.md`
- 测试所有功能

### 2. 提交到 GitHub

```bash
git add .
git commit -m "Release v1.0.0"
git tag v1.0.0
git push origin main --tags
```

### 3. 发布到社区插件

1. Fork `obsidianmd/obsidian-releases`
2. 添加插件信息到 `community-plugins.json`
3. 提交 PR

## 常见问题

### Q: Token 过期怎么办？

A: 插件会自动刷新 Token。如果刷新失败，需要重新登录。

### Q: 同步速度慢？

A: 
- 检查网络连接
- 减少单次同步数量（调整 limit）
- 关闭自动同步，改为手动

### Q: 笔记格式错乱？

A: 
- 检查 HTML 转换规则
- 在 `markdown-converter.ts` 中添加新的转换规则
- 提交 Issue 附上原始 HTML

## 安全注意事项

1. **不要硬编码密钥**：所有敏感信息通过环境变量或用户输入获取
2. **加密存储**：Token 使用 Obsidian 的加密存储机制
3. **最小权限**：只请求必要的 API 权限
4. **日志脱敏**：日志中不输出完整 Token

## 后续改进方向

1. **性能优化**
   - 批量操作支持
   - 增量同步优化
   - 缓存机制

2. **功能增强**
   - 支持小米笔记本分类
   - 支持笔记版本历史
   - 支持回收站同步

3. **用户体验**
   - 更详细的进度显示
   - 同步冲突可视化解决
   - 同步历史记录

## 资源链接

- [Obsidian 插件开发文档](https://marcus.se.net/obsidian-plugin-docs/)
- [Obsidian API 示例](https://github.com/obsidianmd/obsidian-sample-plugin)
- [小米云服务文档](https://dev.mi.com/)（需要开发者账号）

---

**提示**：开发过程中遇到问题，欢迎在 GitHub 上讨论。
