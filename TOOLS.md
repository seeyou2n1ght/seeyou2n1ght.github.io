# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Environment

- **OS:** Debian (root access)
- **Security:** Privacy and server security are top priorities

## Auto Security Updates

- **Package:** unattended-upgrades (enabled)
- **Schedule:** Daily check for security updates
- **Origins:** Debian trixie + trixie-security + ESM
- **Auto-remove:** Yes (unused dependencies)
- **Auto-reboot:** No (manual review required)
- **Logs:** /var/log/unattended-upgrades/

## GitHub Deploy Keys

- **Repository:** seeyou2n1ght/seeyou2n1ght.github.io
- **Key Type:** ed25519
- **Private Key:** /root/.openclaw/identity/github-deploy-key (权限 600)
- **Public Key:** /root/.openclaw/identity/github-deploy-key.pub
- **Fingerprint:** SHA256:AMXe4A7ZwhVX7nfbqBDDfD5d3eEjFGAssUgb+SowlvM
- **Created:** 2026-02-26
- **Purpose:** GitHub Pages deployment (write access)
- **Security:** 密钥文件不暴露在对话/日志中

## GitHub Pages Website

- **URL:** https://seeyou2n1ght.github.io
- **Style:** 极简深色模式 (手写 HTML/CSS/JS)
- **Content:** 每日运行报告、任务产出物、关于我
- **Created:** 2026-02-26
- **Status:** ✅ Live
- **Security:** 内容经过安全审查，不暴露敏感信息

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

## 浏览器自动化工具

### Agent-Reach（内容提取）
- **用途**：多平台内容抓取（Twitter、小红书、B 站、抖音等）
- **命令**：`agent-reach <platform> <action>`
- **安全**：Cookie 本地存储，使用专用小号
- **安装日期**：2026-03-05
- **状态**：4/13 渠道可用（YouTube, RSS, 任意网页，B 站）
- **配置**：~/.agent-reach/

### Agent-Browser（浏览器控制）
- **用途**：精确浏览器自动化（点击、填写、截图）
- **命令**：`agent-browser open/snapshot/click/fill`
- **安全**：域名白名单、动作确认、AES 加密
- **安装日期**：2026-03-05
- **版本**：0.16.3
- **策略文件**：/root/.openclaw/workspace/.agent-browser-policy.json
- **Chromium 路径**：/root/.cache/ms-playwright/chromium-1208

---

## Google Workspace (gws)

Full access to Google Drive, Gmail, Calendar, Sheets, Docs via official CLI.

### Installation
```bash
npm install -g @googleworkspace/cli
```

### Authentication Required
Before first use, authenticate with Google:
```bash
gws auth login --scopes drive,gmail,calendar,sheets,docs
```

### Quick Reference

| Service | Command Example |
|:---|:---|
| Drive List | `gws drive files list --params '{"pageSize": 10}'` |
| Drive Upload | `gws drive files create --upload ./file.pdf` |
| Gmail Read | `gws gmail users messages list` |
| Calendar | `gws calendar events list` |
| Sheets | `gws sheets spreadsheets values get --params '{"range": "A1:D10"}'` |

### Security
- Credentials: AES-256-GCM encrypted
- Storage: OS keyring (keychain/secret service)
- Scope: Minimal permission per use case

---

Add whatever helps you do your job. This is your cheat sheet.
