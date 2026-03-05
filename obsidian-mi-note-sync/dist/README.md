# Mi Note Sync - 小米笔记 Obsidian 同步插件

🥟 小肉包开发 | v1.0.0

## 功能特性

### ✅ 已实现功能

1. **认证模块**
   - 小米账号 OAuth 登录框架
   - Token 持久化存储（本地加密存储）
   - Token 自动刷新机制

2. **拉取功能**
   - 全量拉取：首次同步所有笔记
   - 增量同步：按时间戳同步变更笔记
   - 两种模式支持：
     - 保存到指定文件夹（默认 `小米笔记/`）
     - 插入到当前光标位置

3. **笔记处理**
   - HTML 富文本 → Markdown 格式转换
   - 图片/附件下载支持
   - 标签同步
   - 冲突处理（覆盖/跳过/重命名）

4. **设置面板**
   - 同步文件夹路径配置
   - 同步模式选择（全量/增量）
   - 同步频率设置（手动/定时自动同步）
   - 选择性同步（按标签过滤）
   - 冲突处理策略配置

5. **用户界面**
   - 设置面板（完整的配置选项）
   - 同步进度弹窗（实时显示进度）
   - Ribbon 图标快速同步
   - 命令面板支持

## 安装方法

### 方法一：手动安装（推荐开发阶段）

1. 克隆或下载插件源码到本地
2. 进入插件目录：
   ```bash
   cd obsidian-mi-note-sync
   ```

3. 安装依赖：
   ```bash
   npm install
   ```

4. 构建插件：
   ```bash
   npm run build
   ```

5. 将生成的 `main.js`、`manifest.json` 复制到 Obsidian 插件目录：
   ```
   <你的 Obsidian 仓库>/.obsidian/plugins/mi-note-sync/
   ```

6. 在 Obsidian 中启用插件

### 方法二：BRAT 插件安装（待发布后）

1. 安装 BRAT 插件
2. 添加此插件仓库
3. 一键安装

## 使用方法

### 首次使用

1. 打开 Obsidian 设置 → Mi Note Sync
2. 点击"登录"按钮，完成小米账号授权
3. 配置同步文件夹路径（默认：`小米笔记`）
4. 选择同步模式（建议首次使用全量同步）
5. 点击"立即同步"开始同步

### 命令面板

- `Mi Note Sync: 同步所有小米笔记` - 双向同步
- `Mi Note Sync: 从小米云拉取笔记` - 仅拉取
- `Mi Note Sync: 推送笔记到小米云` - 仅推送
- `Mi Note Sync: 插入小米笔记到当前位置` - 选择笔记插入
- `Mi Note Sync: 打开同步设置` - 打开设置面板

### 自动同步

在设置中启用"自动同步"并设置间隔时间，插件会定期自动拉取小米笔记。

## 技术架构

```
obsidian-mi-note-sync/
├── manifest.json          # 插件元数据
├── package.json           # 依赖管理
├── tsconfig.json          # TypeScript 配置
├── main.ts               # 插件主入口
├── types.ts              # 类型定义
├── mi-api.ts             # 小米 API 封装
├── sync-engine.ts        # 同步引擎
├── ui/
│   ├── settings-tab.ts   # 设置面板
│   └── sync-modal.ts     # 同步进度弹窗
└── utils/
    ├── markdown-converter.ts  # Markdown 转换器
    └── file-helper.ts         # 文件操作工具
```

## 注意事项

### ⚠️ 小米 API 说明

小米笔记 API 未完全公开，本插件使用的端点基于社区逆向工程：

- API 端点可能需要更新
- 部分功能可能需要额外的认证步骤
- 建议在生产环境使用前充分测试

### 安全建议

1. **Token 存储**：Token 加密存储在本地，不会上传到任何服务器
2. **权限控制**：插件仅请求必要的笔记读写权限
3. **定期更新**：关注插件更新，及时修复可能的安全问题

### 已知限制

1. 小米 API 的稳定性依赖于官方接口，可能随时变化
2. 大量附件同步可能较慢
3. 某些特殊格式的笔记可能转换不完美

## 开发指南

### 本地开发

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 生产构建
npm run build
```

### 调试

1. 打开 Obsidian 开发者工具（Ctrl+Shift+I）
2. 查看 Console 日志
3. 插件日志前缀：`Mi Note Sync:`

### 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v1.0.0 (2026-03-03)

- ✨ 初始版本发布
- ✅ 实现基础同步功能
- ✅ 支持双向同步
- ✅ Markdown 格式转换
- ✅ 自动同步支持
- ✅ 标签过滤
- ✅ 冲突处理

## 许可证

MIT License

## 作者

🥟 小肉包  
GitHub: [@seeyou2n1ght](https://github.com/seeyou2n1ght)

---

**提示**：如有问题或建议，欢迎在 GitHub 上提交 Issue。
