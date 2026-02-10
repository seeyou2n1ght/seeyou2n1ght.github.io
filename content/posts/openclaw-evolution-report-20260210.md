---
title: "OpenClaw 构建历程深度分析"
date: 2026-02-10T14:00:00+08:00
lastmod: 2026-02-10T14:00:00+08:00
draft: false
tags: ["OpenClaw", "开源项目", "AI", "构建历程", "Git"]
categories: ["技术洞察"]
description: "基于10,000+ commit的开源项目演进研究"
---

**分析对象**: https://github.com/openclaw/openclaw  
**分析时间**: 2026年2月10日

---

## 📌 执行摘要

OpenClaw 是一个从简单的 WhatsApp 消息中继工具演进而来的 AI 助手平台。通过分析 10,000+ 条 commit 记录，我们可以看到产品经历了三个主要阶段：

| 阶段 | 时间 | 核心特征 |
|------|------|---------|
| **warelay** | 2025.11-2025.12 | WhatsApp/Twilio 消息中继 + Claude 自动回复 |
| **clawdis** | 2025.12-2026.01 | 多 Agent 架构、macOS App、Voice Wake |
| **OpenClaw** | 2026.01-至今 | 开源品牌、网关架构、多通道支持 |

---

## 🏗️ 演进历程详解

### 第一阶段：warelay（2025年11月）

**起点**（2025-11-24）:
```
f6dd362d3 Initial commit
```

**核心问题**：如何让 Claude AI 通过 WhatsApp 与用户交互？

**早期架构决策**：
1. **Twilio Webhook**：使用 Twilio API 接收/发送 WhatsApp 消息
2. **Tailscale Funnel**：解决内网穿透，让 webhook 能访问本地服务
3. **Claude 自动回复**：配置驱动的命令自动回复系统

**关键技术挑战**：

| 挑战 | 解决方案 | Commit |
|------|---------|--------|
| Webhook 配置复杂 | 引导式设置流程，自动检测 Tailscale | `a2b73ec57` |
| 发送者身份识别 | 支持 TWILIO_SENDER_SID 覆盖 | `e52e94331` |
| 进程保活 | `waitForever` + SIGINT 优雅退出 | `fc5f37514` |
| Baileys 库兼容 | 升级到 7.0.0-rc.9，多文件认证 | `289b417c8` |

**产品化里程碑**（v0.1.0 - v1.0.0）：
- 图片消息支持
- 音频转录
- 会话持久化
- 打字指示器
- 命令队列序列化

---

### 第二阶段：clawdis（2025年12月-2026年1月）

**品牌重塑**（关键 commit）：
```
a27ee2366 🦞 Rebrand to CLAWDIS - add docs, update README
594ef1e2e chore: rename package to clawdis
```

**核心架构升级**：

#### 1. 多 Agent 架构
- 从单一 Claude 实例 → 多 Agent 支持
- 每个 Agent 独立的 workspace、配置、会话

#### 2. macOS 原生应用

**macOS 功能演进**：

| 功能 | 说明 |
|------|------|
| 菜单栏图标动画 | 耳朵/腿摆动 |
| 设置面板 | Trimmy 风格标签页 |
| Voice Wake | 语音唤醒 + SSH 转发 |
| WebChat 集成 | WKWebView 内嵌 |
| 权限管理 | 自动化权限、麦克风权限 |
| XPC 通信 | 安全的进程间通信 |

#### 3. Heartbeat 机制
- 定期唤醒 Agent 执行任务
- 支持 idle override 和 session 保鲜

#### 4. 安全加固
- 媒体服务路径遍历修复
- 会话存储清理
- IPC Socket 加固

---

### 第三阶段：OpenClaw（2026年1月至今）

**开源转型**：
```
f72214725 chore: restore OpenClaw branding
```

**架构演进为网关模式**：

#### 1. Gateway 架构
- 从单一 WhatsApp → 多通道网关（Telegram、Discord、Slack 等）
- WebSocket 控制平面
- HTTP API（OpenAI 兼容）

#### 2. 协议标准化
- Gateway Protocol：统一的连接、认证、消息格式
- 结构化 Presence 系统
- 会话隔离（主会话 vs 隔离会话）

#### 3. Node 系统
- 节点发现和配对
- 手机作为计算节点
- 相机、屏幕录制远程控制

#### 4. Skill → Tool 迁移
- Skills（外部脚本）→ Tools（内置功能）
- 更好的类型安全
- 统一的工具调用协议

---

## 🔍 关键技术决策分析

### 1. 为什么选择 Baileys？

**决策背景**：
- Twilio 收费高，需要自己的 WhatsApp 基础设施
- Baileys 是纯 TypeScript 的 WhatsApp Web 库

**遇到的问题**：
- Baileys 7.0.0 RC 版本不稳定
- 需要处理 515 错误自动重启
- 多文件认证存储

### 2. 从 Twilio 到 WhatsApp Web

**决策**（v1.3.0）：
```
7c7314f67 chore: drop twilio and go web-only
```

**原因**：
- Twilio 成本过高
- Baileys 稳定性提升
- 支持更多功能（群组、已读回执等）

### 3. macOS 应用的技术选型

| 技术 | 用途 | 原因 |
|------|------|------|
| SwiftUI | UI 框架 | 原生体验、实时预览 |
| SwiftData | 配置存储 | 类型安全、自动持久化 |
| XPC | 进程通信 | 安全隔离、权限分离 |
| launchd | 服务管理 | 系统级服务、自动重启 |

### 4. Voice Wake 的设计挑战

**核心难点**：
- 本地语音识别（on-device）
- SSH 转发到远程服务器
- 权限管理（麦克风、辅助功能）
- 音频电平实时显示

### 5. 品牌演进的原因

| 品牌 | 时期 | 原因 |
|------|------|------|
| warelay | 原型期 | 强调 WhatsApp Relay |
| clawdis | 产品化 | Claw + Discord，多平台 |
| OpenClaw | 开源期 | 开源社区，更通用 |

---

## 📊 开发模式分析

### Commit 频率

```
总 commit 数: 10,208
开发周期: ~3 个月
平均每日: ~100 commits
```

**高强度开发期**（2025年12月）：
- macOS App 开发期间 commit 密度最高
- 大量 UI 微调、动画优化

### 代码组织演进

```
早期: 单体 CLI (index.ts 为主)
  ↓
中期: 模块化 (cli/, providers/, utils/)
  ↓
后期: Monorepo (packages/agent, packages/gateway, etc.)
```

---

## 🚧 遇到的重大挑战

### 1. WhatsApp Web 的稳定性

**问题**：Baileys 经常断开连接  
**解决**：心跳检测、指数退避重连、自动恢复

### 2. 媒体消息处理

**问题**：图片/音频的 MIME 类型识别  
**解决**：文件头嗅探、扩展名保留

### 3. 安全漏洞

**问题**：媒体服务器路径遍历攻击  
**解决**：路径规范化、符号链接检查

### 4. 并发和竞态条件

**问题**：多连接同时写入会话存储  
**解决**：IPC 锁机制、忙时跳过

### 5. 语音转发的稳定性

**问题**：SSH 转发延迟、超时  
**解决**：增加超时时间、健康检查、日志展示

---

## 🎯 产品哲学演变

### 早期（warelay）
> "让 Claude 能回 WhatsApp 消息"

### 中期（clawdis）
> "一个可扩展的 AI Agent 平台"

### 后期（OpenClaw）
> "AI 助手的开源网关"

**核心理念转变**：
- 从**功能驱动**（回消息）→ **架构驱动**（多 Agent、多通道）
- 从**个人工具** → **平台化产品**
- 从**闭源产品** → **开源社区**

---

## 🔮 未来趋势预测

基于 commit 分析，可能的发展方向：

1. **更多通道支持**：Signal、Telegram、Discord 的深度集成
2. **节点生态**：手机、树莓派等作为计算节点
3. **语音优先**：Voice Wake 的进一步完善
4. **企业功能**：多租户、审计日志、合规性
5. **AI 模型生态**：支持更多本地模型、多模型协作

---

10,208 条 commit，3 个月高强度开发，从个人工具到开源平台。
