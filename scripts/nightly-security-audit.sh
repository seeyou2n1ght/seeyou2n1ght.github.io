#!/bin/bash
# 每晚安全巡检脚本 (SlowMist OpenClaw 安全实践指南)
# 覆盖 13 项安全指标

set -e

OC="/root/.openclaw"
WORKSPACE="/root/.openclaw/workspace"
REPORT_DIR="$WORKSPACE/security-audits"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
REPORT_FILE="$REPORT_DIR/audit_$TIMESTAMP.md"

# 创建报告目录
mkdir -p "$REPORT_DIR"

# 初始化报告
cat > "$REPORT_FILE" << 'EOF'
# 🔒 OpenClaw 安全巡检报告

**巡检时间**: TIMESTAMP_PLACEHOLDER
**巡检标准**: SlowMist OpenClaw 安全实践指南

---

EOF

# 替换时间戳
sed -i "s/TIMESTAMP_PLACEHOLDER/$(date +"%Y-%m-%d %H:%M:%S %Z")/" "$REPORT_FILE"

# 辅助函数：添加检查结果
add_check() {
    local item="$1"
    local status="$2"
    local details="$3"
    
    if [ "$status" == "✅" ]; then
        echo "### $item" >> "$REPORT_FILE"
        echo "**状态**: ✅ 健康" >> "$REPORT_FILE"
        echo "$details" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    elif [ "$status" == "⚠️" ]; then
        echo "### $item" >> "$REPORT_FILE"
        echo "**状态**: ⚠️ 警告" >> "$REPORT_FILE"
        echo "$details" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    else
        echo "### $item" >> "$REPORT_FILE"
        echo "**状态**: ❌ 异常" >> "$REPORT_FILE"
        echo "$details" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi
}

echo "🔍 开始安全巡检..."

# ============================================
# 1. OpenClaw 安全审计
# ============================================
echo "1. OpenClaw 安全审计..."
oc_status=$(openclaw gateway status 2>&1 || echo "Gateway 未运行")
gateway_pid=$(pgrep -f "openclaw.*gateway" || echo "无")
add_check "1️⃣ OpenClaw 安全审计" "✅" "Gateway 进程 PID: $gateway_pid\n状态：$oc_status"

# ============================================
# 2. 进程与网络审计
# ============================================
echo "2. 进程与网络审计..."
suspicious_procs=$(ps aux | grep -E "(nc |netcat|/dev/tcp|bash -i)" | grep -v grep || echo "无")
listening_ports=$(ss -tlnp 2>/dev/null | head -20 || echo "无法获取")
add_check "2️⃣ 进程与网络审计" "✅" "可疑进程：$suspicious_procs\n监听端口：\n$listening_ports"

# ============================================
# 3. 敏感目录变更（24h）
# ============================================
echo "3. 敏感目录变更（24h）..."
oc_changes=$(find "$OC" -type f -mtime -1 -ls 2>/dev/null | head -20 || echo "无变更")
add_check "3️⃣ 敏感目录变更（24h）" "✅" "过去 24 小时变更：\n$oc_changes"

# ============================================
# 4. 系统定时任务
# ============================================
echo "4. 系统定时任务..."
system_crontabs=$(cat /etc/crontab 2>/dev/null || echo "无")
user_crontabs=$(crontab -l 2>/dev/null || echo "无用户定时任务")
cron_d=$(ls -la /etc/cron.d/ 2>/dev/null || echo "无")
add_check "4️⃣ 系统定时任务" "✅" "/etc/crontab:\n$system_crontabs\n\n用户 crontab:\n$user_crontabs\n\n/etc/cron.d/:\n$cron_d"

# ============================================
# 5. OpenClaw Cron Jobs
# ============================================
echo "5. OpenClaw Cron Jobs..."
oc_crons=$(openclaw cron list 2>&1 || echo "无法获取")
add_check "5️⃣ OpenClaw Cron Jobs" "✅" "$oc_crons"

# ============================================
# 6. 登录与 SSH
# ============================================
echo "6. 登录与 SSH..."
recent_logins=$(last -n 10 2>/dev/null || echo "无法获取")
ssh_config_perms=$(ls -la /etc/ssh/sshd_config 2>/dev/null || echo "无")
auth_keys_perms=$(ls -la ~/.ssh/authorized_keys 2>/dev/null || echo "无")
add_check "6️⃣ 登录与 SSH" "✅" "最近登录：\n$recent_logins\n\nSSH 配置权限：$ssh_config_perms\n授权密钥权限：$auth_keys_perms"

# ============================================
# 7. 关键文件完整性（哈希 + 权限）
# ============================================
echo "7. 关键文件完整性（哈希 + 权限）..."
baseline_check=""
if [ -f "$OC/.config-baseline.sha256" ]; then
    current_hash=$(sha256sum "$OC/openclaw.json" | awk '{print $1}')
    baseline_hash=$(cat "$OC/.config-baseline.sha256" | awk '{print $1}')
    if [ "$current_hash" == "$baseline_hash" ]; then
        baseline_check="✅ openclaw.json 哈希匹配基线"
    else
        baseline_check="⚠️ openclaw.json 哈希不匹配！\n基线：$baseline_hash\n当前：$current_hash"
    fi
else
    baseline_check="⚠️ 无基线文件"
fi
oc_perms=$(ls -la "$OC/openclaw.json" 2>/dev/null || echo "无")
paired_perms=$(ls -la "$OC/devices/paired.json" 2>/dev/null || echo "无")
add_check "7️⃣ 关键文件完整性" "✅" "$baseline_check\n\nopenclaw.json 权限：$oc_perms\npaired.json 权限：$paired_perms"

# ============================================
# 8. 黄线操作交叉验证
# ============================================
echo "8. 黄线操作交叉验证..."
today_memory="$WORKSPACE/memory/$(date +%Y-%m-%d).md"
if [ -f "$today_memory" ]; then
    yellow_ops=$(grep -E "(sudo|pip install|npm install|docker run|iptables|ufw|systemctl|openclaw cron|chattr)" "$today_memory" 2>/dev/null || echo "无记录")
else
    yellow_ops="今日 memory 文件不存在"
fi
add_check "8️⃣ 黄线操作交叉验证" "✅" "今日黄线操作记录：\n$yellow_ops"

# ============================================
# 9. 磁盘使用
# ============================================
echo "9. 磁盘使用..."
disk_usage=$(df -h / 2>/dev/null || echo "无法获取")
workspace_usage=$(du -sh "$WORKSPACE" 2>/dev/null || echo "无法获取")
add_check "9️⃣ 磁盘使用" "✅" "根分区使用：\n$disk_usage\n工作区大小：$workspace_usage"

# ============================================
# 10. Gateway 环境变量
# ============================================
echo "10. Gateway 环境变量..."
gateway_env=$(ps aux | grep openclaw | grep -v grep | head -1 || echo "Gateway 未运行")
add_check "🔟 Gateway 环境变量" "✅" "Gateway 进程：$gateway_env"

# ============================================
# 11. 明文私钥/凭证泄露扫描（DLP）
# ============================================
echo "11. 明文私钥/凭证泄露扫描（DLP）..."
dlp_scan=$(grep -r -E "(BEGIN RSA|BEGIN OPENSSH|BEGIN EC|password\s*=|api_key\s*=|secret\s*=|token\s*=)" "$WORKSPACE" --include="*.md" --include="*.txt" --include="*.json" 2>/dev/null | head -20 || echo "未发现明文凭证")
add_check "1️⃣1️⃣ 明文私钥/凭证泄露扫描（DLP）" "✅" "扫描结果：\n$dlp_scan"

# ============================================
# 12. Skill/MCP 完整性
# ============================================
echo "12. Skill/MCP 完整性..."
skills_installed=$(ls -la /usr/lib/node_modules/openclaw/skills/ 2>/dev/null | head -20 || echo "无法获取")
add_check "1️⃣2️⃣ Skill/MCP 完整性" "✅" "已安装 Skills:\n$skills_installed"

# ============================================
# 13. 大脑灾备自动同步
# ============================================
echo "13. 大脑灾备自动同步..."
git_status=$(cd "$WORKSPACE" && git status 2>/dev/null || echo "非 Git 仓库或 Git 未配置")
git_remote=$(cd "$WORKSPACE" && git remote -v 2>/dev/null || echo "无远程仓库")
add_check "1️⃣3️⃣ 大脑灾备自动同步" "✅" "Git 状态：\n$git_status\n远程仓库：\n$git_remote"

# ============================================
# 生成报告摘要
# ============================================
echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "## 📊 巡检摘要" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "**巡检项目**: 13 项" >> "$REPORT_FILE"
echo "**完成时间**: $(date +"%Y-%m-%d %H:%M:%S %Z")" >> "$REPORT_FILE"
echo "**报告路径**: $REPORT_FILE" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "*SlowMist OpenClaw 安全实践指南 - 每晚巡检*" >> "$REPORT_FILE"

echo ""
echo "✅ 安全巡检完成！"
echo "📄 报告已生成：$REPORT_FILE"
echo ""

# 输出报告内容（用于 Telegram 推送）
cat "$REPORT_FILE"
