#!/bin/bash
# 每日趣味任务生成器
# 运行时间：每天 09:00 生成任务，22:00 汇报结果

set -e

TASK_DIR="/root/.openclaw/workspace/daily-tasks"
mkdir -p "$TASK_DIR"

# 任务库
TECH_TASKS=(
    "探索一个从未用过的 Linux 工具，写一篇简短介绍"
    "研究一种新型数据库或存储方案"
    "学习一个 Shell 脚本技巧并实践"
    "分析系统日志，发现有趣的使用模式"
    "尝试用 AI 生成一段代码并评估质量"
)

DATA_TASKS=(
    "分析过去 7 天的系统资源使用趋势"
    "统计最常用的 10 个命令并可视化"
    "检查磁盘空间变化，找出增长最快的目录"
    "分析网络流量模式（如有数据）"
    "生成一份系统健康度评分报告"
)

CREATIVE_TASKS=(
    "用 AI 写一首关于技术的短诗"
    "设计一个极简的 CLI 工具概念"
    "生成一个有趣的系统监控仪表盘设计"
    "创作一个技术相关的微型故事"
    "设计一个个性化的终端配色方案"
)

PRACTICAL_TASKS=(
    "整理和归档过去一周的日志文件"
    "优化一个现有的脚本或配置"
    "检查并更新系统的安全设置"
    "清理不必要的缓存和临时文件"
    "备份重要数据并验证完整性"
)

RESEARCH_TASKS=(
    "追踪一个技术话题的最新动态"
    "研究一个开源项目的架构设计"
    "比较两种相似工具的优缺点"
    "阅读一篇技术博客并总结要点"
    "探索一个新的编程语言特性"
)

# 根据星期几选择任务类型
day_of_week=$(date +%u)
case $day_of_week in
    1) TASK_TYPE="技术探索"; TASK_LIST=("${TECH_TASKS[@]}");;
    2) TASK_TYPE="数据分析"; TASK_LIST=("${DATA_TASKS[@]}");;
    3) TASK_TYPE="创意生成"; TASK_LIST=("${CREATIVE_TASKS[@]}");;
    4) TASK_TYPE="实用优化"; TASK_LIST=("${PRACTICAL_TASKS[@]}");;
    5) TASK_TYPE="信息研究"; TASK_LIST=("${RESEARCH_TASKS[@]}");;
    6) TASK_TYPE="自由探索"; TASK_LIST=("${TECH_TASKS[@]}" "${CREATIVE_TASKS[@]}");;
    7) TASK_TYPE="周总结"; TASK_LIST=("回顾本周完成的任务，生成总结报告");;
esac

# 随机选择任务
RANDOM_TASK=${TASK_LIST[$RANDOM % ${#TASK_LIST[@]}]}

# 生成任务文件
DATE=$(date +%Y-%m-%d)
TASK_FILE="$TASK_DIR/task-$DATE.md"

cat > "$TASK_FILE" << EOF
# 每日趣味任务 - $DATE

## 📋 任务详情

**类型**: $TASK_TYPE  
**任务**: $RANDOM_TASK  
**生成时间**: $(date "+%H:%M")  
**截止时间**: 22:00  
**状态**: ⏳ 进行中

---

## 🎯 执行记录

### 开始时间: 
### 完成时间: 
### 实际耗时: 

---

## 📝 执行过程

（在这里记录执行步骤和发现）

---

## ✅ 任务成果

（描述最终产出）

---

## 💡 心得体会

（有什么有趣的发现或感悟）

---

*自动生成于 $(date)*
EOF

echo "✅ 今日任务已生成: $TASK_FILE"
echo "📋 任务类型: $TASK_TYPE"
echo "🎯 任务内容: $RANDOM_TASK"
