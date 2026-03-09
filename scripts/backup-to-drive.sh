#!/bin/bash
# OpenClaw 备份到 Google Drive（支持增量同步）
# 运行时间：每天凌晨 4:00
# 功能：压缩 .openclaw 文件夹并上传到 Google Drive，支持增量更新

set -e

# 配置
BACKUP_SOURCE="${HOME}/.openclaw"
BACKUP_NAME="openclaw-backup-$(date +%Y%m%d-%H%M%S)"
INCREMENTAL_NAME="openclaw-latest"  # 增量同步的固定文件名
TEMP_DIR="/tmp/openclaw-backup"
GDRIVE_FOLDER_ID="${GDRIVE_BACKUP_FOLDER_ID:-1VIs60AGlV9xnX9FeEEncXCMmjpx-8N0t}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# 模式选择：incremental=增量同步（更新同一文件），daily=每日新文件
BACKUP_MODE="${BACKUP_MODE:-incremental}"

# 日志
LOG_FILE="/var/log/openclaw-backup.log"
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

echo "========================================"
echo "🔄 OpenClaw 每日备份开始"
echo "时间：$(date)"
echo "来源：$BACKUP_SOURCE"
echo "目标：Google Drive/$GDRIVE_FOLDER_ID"
echo "========================================"

# 设置凭证（优先级：环境变量 > 默认路径）
export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE="${GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE:-${HOME}/.config/gws/onepersoncompany-0826e97ce112.json}"

if [ ! -f "$GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE" ]; then
    echo "❌ 错误：Google Workspace 凭证文件不存在"
    echo "   路径：$GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE"
    exit 1
fi

echo "✅ 凭证文件：$GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE"

# 创建临时目录
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# 步骤 1: 准备备份内容（排除敏感和临时文件）
echo ""
echo "📦 步骤 1: 准备备份文件..."

# 创建排除列表
cat > /tmp/backup-exclude.txt << 'EOF'
# 临时文件
*.tmp
*.temp
*.log
*.pid
*.sock

# 缓存
.cache/
npm-cache/
pip-cache/
__pycache__/
*.pyc

# 大文件和媒体
*.mp4
*.mp3
*.avi
*.mov
*.zip
*.tar.gz
*.tar.bz2

# 敏感文件（已加密或不应上传）
*.key
*.pem
*.crt
id_rsa
id_ed25519

# 特定目录
media/
completions/
canvas/
logs/*.log

# Node modules（可重建）
node_modules/
EOF

# 使用 rsync 复制文件（带排除）
rsync -av --delete \
    --exclude-from=/tmp/backup-exclude.txt \
    "$BACKUP_SOURCE/" \
    "$TEMP_DIR/$BACKUP_NAME/" 2>/dev/null || \
cp -r "$BACKUP_SOURCE" "$TEMP_DIR/$BACKUP_NAME" 2>/dev/null

# 计算大小
BACKUP_SIZE=$(du -sh "$TEMP_DIR/$BACKUP_NAME" | cut -f1)
echo "✅ 备份文件准备完成：$BACKUP_SIZE"

# 步骤 2: 创建压缩包
echo ""
echo "🗜️  步骤 2: 创建压缩包..."
cd "$TEMP_DIR"

# 使用 tar.gz 压缩（保留权限和元数据）
tar czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"

COMPRESSED_SIZE=$(du -sh "${BACKUP_NAME}.tar.gz" | cut -f1)
echo "✅ 压缩完成：${BACKUP_NAME}.tar.gz ($COMPRESSED_SIZE)"

# 步骤 3: 上传到 Google Drive
echo ""
echo "☁️  步骤 3: 上传到 Google Drive (模式：$BACKUP_MODE)..."

# 通用参数：支持共享驱动器
DRIVE_PARAMS='{"supportsAllDrives": true}'

if [ "$BACKUP_MODE" = "incremental" ]; then
    # ===== 增量同步模式 =====
    # 使用固定文件名，只更新不创建多个副本
    
    echo "📍 目标文件：${INCREMENTAL_NAME}.tar.gz"
    
    # 查找是否已存在增量备份文件
    EXISTING_FILE=$(gws drive files list \
        --params "{\"q\": \"name = '${INCREMENTAL_NAME}.tar.gz' and '${GDRIVE_FOLDER_ID}' in parents and trashed = false\", \"fields\": \"files(id,name,modifiedTime,size)\", \"supportsAllDrives\": true}" \
        2>/dev/null | grep -o '"id": "[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -n "$EXISTING_FILE" ]; then
        echo "🔄 发现现有备份，使用 update 增量更新..."
        
        # 获取旧文件信息
        OLD_INFO=$(gws drive files get --params "{\"fileId\": \"$EXISTING_FILE\", \"fields\": \"size,modifiedTime\", \"supportsAllDrives\": true}" 2>/dev/null)
        OLD_SIZE=$(echo "$OLD_INFO" | grep -o '"size": [0-9]*' | head -1 | grep -o '[0-9]*')
        OLD_TIME=$(echo "$OLD_INFO" | grep -o '"modifiedTime": "[^"]*"' | cut -d'"' -f4)
        
        echo "   原大小：$((OLD_SIZE / 1024 / 1024)) MB"
        echo "   原修改时间：$OLD_TIME"
        
        # 使用 update 命令更新文件内容
        UPLOAD_RESULT=$(gws drive files update \
            --params "{\"fileId\": \"$EXISTING_FILE\", \"supportsAllDrives\": true}" \
            --upload "${INCREMENTAL_NAME}.tar.gz" \
            2>&1)
        
        FILE_ID="$EXISTING_FILE"
        ACTION="更新"
    else
        echo "📦 首次增量备份，创建新文件..."
        
        # 首次创建
        UPLOAD_RESULT=$(gws drive files create \
            --params '{"uploadType": "multipart", "supportsAllDrives": true}' \
            --json "{\"name\": \"${INCREMENTAL_NAME}.tar.gz\", \"mimeType\": \"application/gzip\", \"parents\": [\"$GDRIVE_FOLDER_ID\"]}" \
            --upload "${INCREMENTAL_NAME}.tar.gz" \
            2>&1)
        
        FILE_ID=$(echo "$UPLOAD_RESULT" | grep -o '"id": "[^"]*"' | head -1 | cut -d'"' -f4)
        ACTION="创建"
    fi
    
    TARGET_NAME="${INCREMENTAL_NAME}.tar.gz"
else
    # ===== 每日全量模式（原有逻辑）=====
    # 每天创建新的备份文件
    
    # 检查是否已有同名文件（避免重复）
    EXISTING_FILE=$(gws drive files list \
        --params "{\"q\": \"name = '${BACKUP_NAME}.tar.gz' and '${GDRIVE_FOLDER_ID}' in parents\", \"fields\": \"files(id,name)\", \"supportsAllDrives\": true}" \
        2>/dev/null | grep -o '"id": "[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -n "$EXISTING_FILE" ]; then
        echo "⚠️  发现同名文件，先删除旧版本..."
        gws drive files delete --params "{\"fileId\": \"$EXISTING_FILE\", \"supportsAllDrives\": true}" 2>/dev/null || true
    fi
    
    # 上传文件
    UPLOAD_RESULT=$(gws drive files create \
        --params '{"uploadType": "multipart", "supportsAllDrives": true}' \
        --json "{\"name\": \"${BACKUP_NAME}.tar.gz\", \"mimeType\": \"application/gzip\", \"parents\": [\"$GDRIVE_FOLDER_ID\"]}" \
        --upload "${BACKUP_NAME}.tar.gz" \
        2>&1)
    
    FILE_ID=$(echo "$UPLOAD_RESULT" | grep -o '"id": "[^"]*"' | head -1 | cut -d'"' -f4)
    TARGET_NAME="${BACKUP_NAME}.tar.gz"
    ACTION="创建"
fi

# 检查上传结果
if echo "$UPLOAD_RESULT" | grep -q '"id":\|"fileId":'; then
    if [ -z "$FILE_ID" ]; then
        FILE_ID=$(echo "$UPLOAD_RESULT" | grep -o '"id": "[^"]*"' | head -1 | cut -d'"' -f4)
    fi
    
    # 获取新文件信息
    NEW_INFO=$(gws drive files get --params "{\"fileId\": \"$FILE_ID\", \"fields\": \"size,modifiedTime\", \"supportsAllDrives\": true}" 2>/dev/null || echo "")
    NEW_SIZE=$(echo "$NEW_INFO" | grep -o '"size": [0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
    NEW_TIME=$(echo "$NEW_INFO" | grep -o '"modifiedTime": "[^"]*"' | cut -d'"' -f4 || echo "unknown")
    
    echo "✅ ${ACTION}成功!"
    echo "   文件 ID: $FILE_ID"
    echo "   文件名：$TARGET_NAME"
    echo "   新大小：$((NEW_SIZE / 1024 / 1024)) MB"
    echo "   修改时间：$NEW_TIME"
else
    echo "❌ 上传失败:"
    echo "$UPLOAD_RESULT"
    exit 1
fi

# 步骤 4: 清理旧备份（保留最近 N 天）
echo ""
echo "🧹 步骤 4: 清理旧备份（保留 $RETENTION_DAYS 天）..."

CUTOFF_DATE=$(date -u -d "$RETENTION_DAYS days ago" +%Y-%m-%d 2>/dev/null || date -v-${RETENTION_DAYS}d -u +%Y-%m-%d)

# 列出备份文件夹中的所有文件
OLD_FILES=$(gws drive files list \
    --params "{\"q\": \"'$GDRIVE_FOLDER_ID' in parents and name contains 'openclaw-backup-' and modifiedTime < '$CUTOFF_DATE'\", \"fields\": \"files(id,name,modifiedTime)\", \"supportsAllDrives\": true}" \
    2>/dev/null)

# 解析并删除旧文件
OLD_COUNT=$(echo "$OLD_FILES" | grep -c '"id":' || echo "0")

if [ "$OLD_COUNT" -gt 0 ]; then
    echo "发现 $OLD_COUNT 个旧备份文件需要清理"
    
    # 提取文件 ID 并删除
    echo "$OLD_FILES" | grep -o '"id": "[^"]*"' | while read id_line; do
        OLD_ID=$(echo "$id_line" | cut -d'"' -f4)
        OLD_NAME=$(echo "$OLD_FILES" | grep -A1 "$id_line" | grep '"name":' | head -1 | cut -d'"' -f4)
        
        echo "  删除：$OLD_NAME"
        gws drive files delete --params "{\"fileId\": \"$OLD_ID\", \"supportsAllDrives\": true}" 2>/dev/null || true
    done
else
    echo "没有需要清理的旧备份"
fi

# 步骤 5: 生成备份报告
echo ""
echo "📊 备份报告:"
echo "  模式：$BACKUP_MODE"
echo "  原始大小：$BACKUP_SIZE"
echo "  压缩后：$COMPRESSED_SIZE"
echo "  文件名：$TARGET_NAME"
echo "  文件 ID: $FILE_ID"
echo "  位置：Google Drive/备份文件夹"
if [ "$BACKUP_MODE" = "incremental" ]; then
    echo "  💡 增量同步：Drive 上始终只保留一份最新备份"
    echo "  💡 如需完整历史，请设置 BACKUP_MODE=daily"
else
    echo "  保留策略：$RETENTION_DAYS 天"
fi

# 清理临时文件
cd /
rm -rf "$TEMP_DIR"
rm -f /tmp/backup-exclude.txt

echo ""
echo "========================================"
echo "✅ 备份完成：$(date)"
echo "========================================"
