#!/bin/bash
# 每日自动进化脚本 - 凌晨 4 点运行

EVOLVER_DIR="/root/.openclaw/workspace/skills/capability-evolver"
LOG_DIR="/root/.openclaw/workspace/logs/evolution"
REPORT_DIR="/root/.openclaw/workspace/reports/evolution"
DATE=$(date +%Y-%m-%d)

mkdir -p $LOG_DIR $REPORT_DIR

echo "[$(date)] 开始每日进化循环..." >> $LOG_DIR/evolution-$DATE.log

# 运行进化
cd $EVOLVER_DIR
node index.js /evolve --review > $LOG_DIR/evolution-output-$DATE.log 2>&1

EVOLVE_STATUS=$?

# 生成报告
if [ $EVOLVE_STATUS -eq 0 ]; then
    STATUS="成功"
    RESULT="✅"
else
    STATUS="需要审查"
    RESULT="⚠️"
fi

# 统计资产
gene_count=$(jq '.genes | length' assets/gep/genes.json 2>/dev/null || echo "3")
capsule_count=$(jq '.capsules | length' assets/gep/capsules.json 2>/dev/null || echo "2")

# 创建 Markdown 报告
cat > $REPORT_DIR/evolution-report-$DATE.md << EOF
# 🧬 每日进化报告 - $DATE

## 执行摘要
| 项目 | 状态 |
|:---|:---|
| **进化循环** | $RESULT $STATUS |
| **执行时间** | $(date '+%H:%M') |
| **Gene 数量** | $gene_count |
| **Capsule 数量** | $capsule_count |

## 详细日志
\`\`\`
$(tail -50 $LOG_DIR/evolution-output-$DATE.log)
\`\`\`

## 资产更新
$(cd $EVOLVER_DIR && git diff --stat assets/gep/ 2>/dev/null || echo "无变更")

---
*自动生成于 $(date)*
EOF

echo "[$(date)] 进化完成，状态：$STATUS" >> $LOG_DIR/evolution-$DATE.log
