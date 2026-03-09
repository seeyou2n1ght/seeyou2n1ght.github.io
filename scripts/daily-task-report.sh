#!/bin/bash
# 每日任务结果汇报
# 运行时间：每天 22:00

set -e

TASK_DIR="/root/.openclaw/workspace/daily-tasks"
DATE=$(date +%Y-%m-%d)
TASK_FILE="$TASK_DIR/task-$DATE.md"

if [ ! -f "$TASK_FILE" ]; then
    echo "⚠️ 今日任务文件不存在: $TASK_FILE"
    exit 1
fi

# 读取任务内容
TASK_TYPE=$(grep "^\*\*类型\*\*" "$TASK_FILE" | cut -d':' -f2 | tr -d ' ')
TASK_CONTENT=$(grep "^\*\*任务\*\*" "$TASK_FILE" | cut -d':' -f2- | sed 's/^ //')

# 生成汇报消息
REPORT="🌙 **每日任务汇报** - $DATE

📋 **任务类型**: $TASK_TYPE
🎯 **任务内容**: $TASK_CONTENT

📄 **任务文件**: \`$TASK_FILE\`

---

⏰ 明天 09:00 将生成新任务，敬请期待！"

echo "$REPORT"

# 可选：发送到指定渠道（需要配置）
# echo "$REPORT" | openclaw message send --channel telegram
