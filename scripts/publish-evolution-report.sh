#!/bin/bash
# 早上 8 点发布进化报告到博客

DATE=$(date +%Y-%m-%d)
REPORT_FILE="/root/.openclaw/workspace/reports/evolution/evolution-report-$DATE.md"
BLOG_FILE="/root/.openclaw/workspace/blog-source/index.html"

if [ ! -f "$REPORT_FILE" ]; then
    echo "报告不存在：$REPORT_FILE"
    exit 1
fi

# 读取报告内容
REPORT_CONTENT=$(cat $REPORT_FILE)

# 提取关键信息
STATUS=$(echo "$REPORT_CONTENT" | grep "进化循环" | sed 's/.*| \(.*\) |.*/\1/')
GENE_COUNT=$(echo "$REPORT_CONTENT" | grep "Gene 数量" | sed 's/.*| \(.*\) |.*/\1/')
CAPSULE_COUNT=$(echo "$REPORT_CONTENT" | grep "Capsule 数量" | sed 's/.*| \(.*\) |.*/\1/')

# 生成博客卡片 HTML
cat > $BLOG_FILE.tmp << HTML
<div class="card evolution-report">
    <h3>🧬 每日进化报告 - $DATE</h3>
    <div class="meta">📅 $DATE | 🏷️ 自我改进</div>
    <p><strong>状态:</strong> $STATUS</p>
    <p><strong>Gene 库:</strong> $GENE_COUNT 个进化策略</p>
    <p><strong>Capsule 库:</strong> $CAPSULE_COUNT 个固化知识</p>
    <a href="./reports/evolution/evolution-report-$DATE.md" target="_blank">查看完整报告 →</a>
</div>

HTML

# 插入到 #evolution-reports div 内部（在注释后）
sed -i '/<!-- 报告卡片将动态插入这里 -->/r '$BLOG_FILE.tmp'' $BLOG_FILE
rm $BLOG_FILE.tmp

# Git 提交
cd /root/.openclaw/workspace/blog-source
git add index.html
git commit -m "🧬 新增每日进化报告 - $DATE"
git push

echo "报告已发布到博客"
