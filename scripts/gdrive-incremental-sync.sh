#!/bin/bash
# Google Drive 增量同步脚本
# 使用 drive.changes API 实现高效同步

set -e

# 配置
CREDENTIALS_FILE="${GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE:-~/.config/gws/onepersoncompany-0826e97ce112.json}"
export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE="$CREDENTIALS_FILE"

STATE_DIR="${HOME}/.config/gws/sync-state"
mkdir -p "$STATE_DIR"

# 状态文件
LAST_TOKEN_FILE="$STATE_DIR/last-page-token"
LAST_SYNC_FILE="$STATE_DIR/last-sync-time"
FOLDER_ID="${1:-1VIs60AGlV9xnX9FeEEncXCMmjpx-8N0t}"  # 默认 openclawData

echo "🔄 Google Drive 增量同步"
echo "========================"
echo "时间: $(date)"
echo ""

# 获取或初始化 pageToken
if [ -f "$LAST_TOKEN_FILE" ]; then
    PAGE_TOKEN=$(cat "$LAST_TOKEN_FILE")
    echo "📍 从上次 token 继续: ${PAGE_TOKEN:0:20}..."
else
    echo "🆕 首次同步，获取起始 token..."
    RESPONSE=$(gws drive changes getStartPageToken 2>/dev/null)
    PAGE_TOKEN=$(echo "$RESPONSE" | grep -o '"startPageToken": "[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$PAGE_TOKEN" ]; then
        echo "❌ 无法获取起始 token，尝试使用 files.list..."
        # 回退到 modifiedTime 方案
        echo "   使用 modifiedTime 筛选作为备选"
        PAGE_TOKEN=""
    else
        echo "$PAGE_TOKEN" > "$LAST_TOKEN_FILE"
        echo "✅ 起始 token: ${PAGE_TOKEN:0:20}..."
    fi
fi

echo ""

# 方法1: 使用 changes API（真正的增量）
if [ -n "$PAGE_TOKEN" ]; then
    echo "📡 使用 changes API 获取变更..."
    
    CHANGES_RESPONSE=$(gws drive changes list --params "{\"pageToken\": \"$PAGE_TOKEN\", \"pageSize\": 100}" 2>/dev/null)
    
    # 解析变更
    CHANGE_COUNT=$(echo "$CHANGES_RESPONSE" | grep -c '"changeId"' || echo "0")
    NEW_TOKEN=$(echo "$CHANGES_RESPONSE" | grep -o '"nextPageToken": "[^"]*"' | head -1 | cut -d'"' -f4)
    
    echo "📊 发现 $CHANGE_COUNT 个变更"
    
    # 保存新 token
    if [ -n "$NEW_TOKEN" ]; then
        echo "$NEW_TOKEN" > "$LAST_TOKEN_FILE"
        echo "💾 已更新 token: ${NEW_TOKEN:0:20}..."
    fi
    
    # 显示变更详情
    echo "$CHANGES_RESPONSE" | grep -E '"fileId"|"file":|"removed":' | head -30 || true
fi

echo ""

# 方法2: 使用 modifiedTime 筛选（备选/补充）
echo "📡 使用 modifiedTime 筛选最近文件..."

# 计算上次同步时间（默认1小时前）
if [ -f "$LAST_SYNC_FILE" ]; then
    LAST_SYNC=$(cat "$LAST_SYNC_FILE")
    echo "📍 上次同步: $LAST_SYNC"
else
    # 默认查询最近1天的文件
    LAST_SYNC=$(date -u -d "1 day ago" +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -v-1d -u +%Y-%m-%dT%H:%M:%S)
    echo "🆕 首次同步，查询最近24小时"
fi

# 查询指定文件夹中最近修改的文件
QUERY="'$FOLDER_ID' in parents and modifiedTime > '$LAST_SYNC'"

echo "🔍 查询: $QUERY"
FILES_RESPONSE=$(gws drive files list --params "{\"q\": \"$QUERY\", \"orderBy\": \"modifiedTime desc\", \"pageSize\": 50, \"fields\": \"files(id,name,mimeType,modifiedTime,size)\"}" 2>/dev/null)

# 统计结果
FILE_COUNT=$(echo "$FILES_RESPONSE" | grep -c '"id":' || echo "0")
echo "📁 找到 $FILE_COUNT 个最近修改的文件"

# 显示文件列表
echo ""
echo "📋 文件列表:"
echo "$FILES_RESPONSE" | grep -E '"name":|"modifiedTime":' | sed 's/.*"name": "\([^"]*\)".*/  📄 \1/' | head -20 || true

# 保存本次同步时间
date -u +%Y-%m-%dT%H:%M:%S > "$LAST_SYNC_FILE"

echo ""
echo "✅ 同步完成: $(date)"
echo "========================"
