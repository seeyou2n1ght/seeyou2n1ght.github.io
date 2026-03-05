# 工具与技能全面审查报告

## 执行摘要

- **审查时间**：2026-03-05 09:01 GMT+8
- **审查范围**：54 个系统 skills + 6 个自定义 skills + 8 个系统工具
- **发现问题**：2 个高风险、5 个中风险、8 个低风险
- **建议清理**：3 个技能/工具（jina-reader, x-reader-skill.bak, 冗余技能）

---

## 详细发现

### 🔴 高风险项目

| 名称 | 风险类型 | 具体问题 | 建议措施 |
|:---|:---|:---|:---|
| **agent-browser** | 配置过宽 | `allowedDomains: ["*"]` 允许访问任意域名，无白名单限制 | 立即配置域名白名单，限制为常用站点 |
| **capability-evolver** | 自修改代码 | `EVOLVE_ALLOW_SELF_MODIFY=true` 时可修改自身源代码，可能导致级联故障 | 保持默认 `false`，生产环境禁用自修改 |

### 🟡 中风险项目

| 名称 | 风险类型 | 具体问题 | 建议措施 |
|:---|:---|:---|:---|
| **jina-reader** | 数据外发 | 所有访问的 URL 发送至 r.jina.ai 第三方服务，可能泄露浏览历史 | 已标记移除，用 web_fetch 替代 |
| **gh-issues** | 令牌使用 | SKILL.md 中展示 GH_TOKEN 用法示例，可能诱导不当使用 | 添加安全警告，建议使用 op run 注入 |
| **1password** | 敏感操作 | 处理密码和凭证，若配置不当可能泄露 | 确保仅使用 op run/inject，不写磁盘 |
| **Telegram 配置** | 策略警告 | `groupPolicy: allowlist` 但 allowFrom 为空，群消息被静默丢弃 | 配置 groupAllowFrom 或设为 open |
| **canvas** | 网络暴露 | 默认监听 18793 端口，若暴露在公网可被访问 | 确保仅绑定 loopback 或通过 Tailscale 访问 |

### 🟢 低风险/优化建议

| 名称 | 类型 | 说明 | 建议 |
|:---|:---|:---|:---|
| **weather** | 外部 API | 使用 wttr.in 无需 API key，但请求内容可见 | 无敏感数据，可接受 |
| **web_search** | 外部 API | Brave Search API，查询内容发送外部 | 正常搜索行为，可接受 |
| **web_fetch** | 外部请求 | 抓取任意 URL，可能触发 SSRF | 已有基本限制，可接受 |
| **blogwatcher** | 定时任务 | 定期抓取订阅的 RSS/博客 | 确认订阅源可信即可 |
| **session-logs** | 本地读取 | 读取本地会话日志，无外发风险 | ✅ 良好实践 |
| **healthcheck** | 安全审计 | 本地安全加固，不修改核心配置 | ✅ 良好实践 |
| **self-improving-agent** | 学习记录 | 本地记录 learnings，可促进到 workspace 文件 | ✅ 良好实践 |
| **clawhub** | 技能管理 | 从 clawhub.com 安装技能，需审计 | 安装前用 `clawhub inspect` 审计 |

### ✅ 良好实践

1. **healthcheck** - 提供系统安全加固指导，支持定期审计
2. **session-logs** - 本地会话分析，无外发风险
3. **self-improving-agent** - 持续改进机制，学习本地存储
4. **security audit** - 当前审计结果：0 critical · 1 warn · 1 info
5. **定时任务隔离** - cron 任务使用 isolated 模式运行

---

## 清理建议清单

### 立即移除（P0）

- [ ] **jina-reader** - 功能已被 web_fetch 和 agent-reach 取代，且有数据外发风险
  ```bash
  rm -rf /root/.openclaw/workspace/skills/jina-reader
  rm /root/.openclaw/workspace/skills/jina-reader.zip
  ```

- [ ] **x-reader-skill.bak.20260305** - 备份目录，已无用
  ```bash
  rm -rf /root/.openclaw/workspace/skills/x-reader-skill.bak.20260305
  ```

### 考虑移除（P1）

- [ ] **model-usage** - 仅支持 macOS (CodexBar)，当前环境为 Debian Linux，不适用
- [ ] **apple-notes / apple-reminders** - 仅 macOS 适用，当前环境不适用
- [ ] **bear-notes** - 仅 macOS 适用，当前环境不适用
- [ ] **things-mac** - 仅 macOS 适用，当前环境不适用
- [ ] **imsg** - 仅 macOS iMessage，当前环境不适用

### 需要配置加固（P1）

- [ ] **agent-browser** - 配置域名白名单
  ```json
  {
    "allowedDomains": ["github.com", "api.github.com", "wttr.in", "r.jina.ai"],
    "confirmActions": ["eval", "download", "upload"],
    "maxOutput": 50000,
    "contentBoundaries": true
  }
  ```

- [ ] **capability-evolver** - 确认 `EVOLVE_ALLOW_SELF_MODIFY=false`
  ```bash
  grep EVOLVE_ALLOW_SELF_MODIFY /root/.openclaw/workspace/skills/evolver/.env 2>/dev/null || echo "使用默认值 false"
  ```

- [ ] **Telegram groupPolicy** - 修复配置警告
  ```json
  // openclaw.json
  "channels": {
    "telegram": {
      "groupPolicy": "open",  // 或配置 groupAllowFrom: ["user_id"]
      "groupAllowFrom": ["<your_user_id>"]
    }
  }
  ```

### 功能合并建议

- [ ] **jina-reader** 和 **web_fetch** 功能重叠，建议保留 web_fetch（本地处理，无第三方依赖）
- [ ] **capability-evolver** 和 **evolver** 为同一技能的不同版本，建议保留 evolver（clawhub 安装版本）
- [ ] **gh-issues** 和 **github** 功能部分重叠，github 使用 gh CLI 更安全，gh-issues 使用 curl+API

---

## 优化后的工具矩阵

| 功能类别 | 推荐工具 | 备选工具 | 已移除 |
|:---|:---|:---|:---|
| **网页内容提取** | web_fetch | browser, agent-reach | jina-reader, x-reader |
| **网页搜索** | web_search (Brave) | agent-reach (RSS/平台) | - |
| **浏览器自动化** | agent-browser | browser (内置) | - |
| **GitHub 操作** | github (gh CLI) | gh-issues (curl) | - |
| **安全审计** | healthcheck | openclaw security audit | - |
| **技能管理** | clawhub | - | - |
| **天气查询** | weather (wttr.in) | - | - |
| **自我进化** | evolver | capability-evolver | - |
| **持续改进** | self-improving-agent | - | - |
| **会话分析** | session-logs | - | - |
| **语音合成** | tts, sag | sherpa-onnx-tts | - |
| **画布展示** | canvas | - | - |
| **消息发送** | message | - | - |
| **节点控制** | nodes | - | - |

---

## 定时任务审查

### Crontab (系统级)

| 时间 | 任务 | 风险 | 建议 |
|:---|:---|:---|:---|
| `0 9 * * *` | morning-report.sh | 🟢 低 | 保留 |
| `0 23 * * *` | daily-check.sh | 🟢 低 | 保留 |
| `*/30 * * * *` | openclaw-health-check.sh | 🟡 中 (30min 频繁) | 考虑改为每小时 |

### OpenClaw Cron (Gateway 调度)

| 任务 | 时间 | 模式 | 状态 |
|:---|:---|:---|:---|
| nightly-security-audit | 0 3 * * * | isolated | ✅ ok |
| daily-capability-evolver | 0 4 * * * | isolated | ✅ ok |
| publish-evolution-report | 0 8 * * * | isolated | ✅ ok |

**建议**：
- 所有 cron 任务使用 isolated 模式 ✅
- evolver 相关任务建议添加 `--review` 标志确保人工审核

---

## 系统工具使用情况

| 工具 | 使用频率 | 必要性 | 风险等级 |
|:---|:---|:---|:---|
| web_search | 高 | 必需 | 🟢 低 |
| web_fetch | 高 | 必需 | 🟢 低 |
| browser | 中 | 必需 | 🟡 中 (需配置) |
| canvas | 中 | 可选 | 🟢 低 |
| nodes | 低 | 可选 | 🟢 低 |
| message | 高 | 必需 | 🟢 低 |
| tts | 中 | 可选 | 🟢 低 |
| sessions_spawn | 高 | 必需 | 🟢 低 |

---

## 安全审计总结

```
OpenClaw security audit
Summary: 0 critical · 1 warn · 1 info

WARN:
- gateway.trusted_proxies_missing (若通过反向代理暴露需配置)

INFO:
- attack_surface: groups open=0, allowlist=1
- tools.elevated: enabled
- hooks.webhooks: disabled
- hooks.internal: disabled
- browser control: enabled
- trust model: personal assistant (one trusted operator boundary)
```

**整体评估**：安全状况良好，无关键风险。主要需关注 agent-browser 的域名白名单配置和清理已标记移除的技能。

---

## 后续行动清单

### 本周完成（P0）
- [ ] 移除 jina-reader 技能和备份文件
- [ ] 配置 agent-browser 域名白名单
- [ ] 修复 Telegram groupPolicy 配置

### 下周完成（P1）
- [ ] 清理 macOS 专用技能（apple-*, bear-, things-mac, imsg）
- [ ] 清理 model-usage（Linux 不适用）
- [ ] 审查 gh-issues 的令牌使用方式
- [ ] 确认 evolver 自修改功能已禁用

### 持续监控
- [ ] 定期运行 `openclaw security audit --deep`
- [ ] 审查 clawhub 安装的新技能
- [ ] 监控 cron 任务执行情况

---

**报告生成**：2026-03-05 09:01 GMT+8  
**审查工具**：安全审计师子代理  
**下次审查**：建议 2026-04-05（月度审查）
