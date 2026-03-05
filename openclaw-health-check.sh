#!/bin/bash
# OpenClaw 健康检查脚本
# 由健康监控子代理使用

LOG_FILE="/var/log/openclaw-health.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="445658574"

# 发送 Telegram 通知
send_alert() {
    local message="$1"
    if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}" \
            -d "text=${message}" \
            -d "parse_mode=Markdown" > /dev/null 2>&1
    fi
}

# 记录日志
log() {
    echo "[$DATE] $1" >> $LOG_FILE
}

# 检查 Gateway 服务
check_gateway() {
    log "=== 检查 Gateway 服务 ==="
    
    # 检查进程是否存在
    GATEWAY_PID=$(pgrep -f "openclaw-gateway" | head -1)
    if [ -n "$GATEWAY_PID" ]; then
        PROCESS_STATUS="运行中 (PID: $GATEWAY_PID)"
    else
        PROCESS_STATUS="未运行"
    fi
    log "进程状态: $PROCESS_STATUS"
    
    # 检查端口监听
    PORT_LISTENING=$(ss -tlnp 2>/dev/null | grep :18792 | wc -l)
    if [ "$PORT_LISTENING" -eq 0 ]; then
        PORT_LISTENING=$(netstat -tlnp 2>/dev/null | grep :18792 | wc -l)
    fi
    log "端口 18792 监听: $PORT_LISTENING"
    
    # 检查 API 响应
    API_RESPONSE=$(curl -s http://127.0.0.1:18792/api/status 2>/dev/null | head -c 100)
    if [ -z "$API_RESPONSE" ]; then
        API_STATUS="无响应"
    else
        API_STATUS="正常"
    fi
    log "API 状态: $API_STATUS"
    
    # 自动修复
    if [ -z "$GATEWAY_PID" ] || [ "$PORT_LISTENING" -eq 0 ] || [ "$API_STATUS" = "无响应" ]; then
        log "⚠️ Gateway 异常，尝试重启..."
        
        # 先停止现有进程
        pkill -f "openclaw-gateway" 2>/dev/null
        sleep 2
        
        # 启动 Gateway
        nohup openclaw-gateway > /var/log/openclaw-gateway.log 2>&1 &
        sleep 3
        
        # 验证修复
        NEW_PID=$(pgrep -f "openclaw-gateway" | head -1)
        if [ -n "$NEW_PID" ]; then
            log "✅ Gateway 重启成功 (PID: $NEW_PID)"
            send_alert "🟢 *OpenClaw 自动修复*%0AGateway 已重启并恢复正常%0A新 PID: $NEW_PID"
        else
            log "❌ Gateway 重启失败"
            send_alert "🔴 *OpenClaw 告警*%0AGateway 重启失败，请人工检查！"
        fi
    else
        log "✅ Gateway 运行正常"
    fi
}

# 检查磁盘空间
check_disk() {
    log "=== 检查磁盘空间 ==="
    
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    log "根分区使用率: ${DISK_USAGE}%"
    
    if [ "$DISK_USAGE" -gt 90 ]; then
        log "⚠️ 磁盘使用率超过90%，清理旧日志..."
        find /var/log -name "*.log.*" -mtime +7 -delete 2>/dev/null
        find /var/log -name "*.gz" -mtime +30 -delete 2>/dev/null
        journalctl --vacuum-time=7d 2>/dev/null
        log "✅ 日志清理完成"
        send_alert "🟡 *OpenClaw 维护*\n磁盘使用率 ${DISK_USAGE}%，已自动清理旧日志"
    elif [ "$DISK_USAGE" -gt 80 ]; then
        log "🟡 磁盘使用率超过80%"
        send_alert "🟡 *OpenClaw 提醒*\n磁盘使用率 ${DISK_USAGE}%，建议关注"
    else
        log "✅ 磁盘空间充足"
    fi
}

# 检查内存使用
check_memory() {
    log "=== 检查内存使用 ==="
    
    MEMORY_INFO=$(free | grep Mem)
    MEMORY_TOTAL=$(echo $MEMORY_INFO | awk '{print $2}')
    MEMORY_USED=$(echo $MEMORY_INFO | awk '{print $3}')
    MEMORY_USAGE=$((MEMORY_USED * 100 / MEMORY_TOTAL))
    
    log "内存使用率: ${MEMORY_USAGE}%"
    
    if [ "$MEMORY_USAGE" -gt 95 ]; then
        log "🔴 内存使用率超过95%"
        send_alert "🔴 *OpenClaw 告警*\n内存使用率 ${MEMORY_USAGE}%，可能存在内存泄漏"
    elif [ "$MEMORY_USAGE" -gt 85 ]; then
        log "🟡 内存使用率超过85%"
    else
        log "✅ 内存使用正常"
    fi
}

# 检查自动更新服务
check_auto_update() {
    log "=== 检查自动更新服务 ==="
    
    UNATTENDED_STATUS=$(systemctl is-active unattended-upgrades 2>/dev/null || echo "unknown")
    log "unattended-upgrades 状态: $UNATTENDED_STATUS"
    
    if [ "$UNATTENDED_STATUS" != "active" ]; then
        log "⚠️ 自动更新服务未运行，尝试启动..."
        systemctl start unattended-upgrades
        send_alert "🟡 *OpenClaw 维护*\n自动更新服务已重新启动"
    else
        log "✅ 自动更新服务正常"
    fi
}

# 主函数
main() {
    log "========================================"
    log "开始 OpenClaw 健康检查"
    log "========================================"
    
    check_gateway
    check_disk
    check_memory
    check_auto_update
    
    log "========================================"
    log "检查完成"
    log "========================================"
    log ""
}

# 执行检查
main
