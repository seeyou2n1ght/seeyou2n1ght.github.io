#!/bin/bash
# 报告自动保存和发布脚本
# 用法: ./save-and-publish-reports.sh [报告文件路径]

set -e

BLOG_DIR="/home/ilvzhengwei/.openclaw/workspace/blog-seeyou2n1ght"
REPORTS_DIR="/home/ilvzhengwei/.openclaw/workspace"
POSTS_DIR="$BLOG_DIR/content/posts"

echo "🚀 开始保存和发布报告..."

# 检查参数
if [ $# -eq 0 ]; then
    echo "📝 检测到以下报告文件:"
    ls -la $REPORTS_DIR/*report*.md 2>/dev/null || echo "未找到报告文件"
    echo ""
    echo "使用方法: ./save-and-publish-reports.sh [报告文件路径]"
    echo "或直接运行以保存所有报告"
    read -p "是否保存所有报告文件? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # 保存所有报告文件
        for report in $REPORTS_DIR/*report*.md; do
            if [ -f "$report" ]; then
                filename=$(basename "$report")
                echo "📄 保存报告: $filename"
                cp "$report" "$POSTS_DIR/"
            fi
        done
        
        # 保存其他类型的报告
        for report in $REPORTS_DIR/pi-mono-analysis-*.md; do
            if [ -f "$report" ]; then
                filename=$(basename "$report")
                echo "📄 保存报告: $filename"
                cp "$report" "$POSTS_DIR/"
            fi
        done
        
        for report in $REPORTS_DIR/twitter_daily_report_*.md; do
            if [ -f "$report" ]; then
                filename=$(basename "$report")
                echo "📄 保存报告: $filename"
                cp "$report" "$POSTS_DIR/"
            fi
        done
    else
        echo "❌ 已取消"
        exit 0
    fi
else
    # 保存指定的报告文件
    for report in "$@"; do
        if [ -f "$report" ]; then
            filename=$(basename "$report")
            echo "📄 保存报告: $filename"
            cp "$report" "$POSTS_DIR/"
        else
            echo "❌ 文件不存在: $report"
        fi
    done
fi

echo ""
echo "📦 正在提交到博客仓库..."
cd $BLOG_DIR

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo "📦 发现新文件，正在提交..."
    git add .
    git commit -m "Add reports: $(date '+%Y-%m-%d %H:%M:%S')"
    
    echo "📤 推送到 GitHub..."
    git push origin main
    
    echo "✅ 报告已成功发布到博客！"
    echo "🌐 博客地址: https://seeyou2n1ght.github.io"
    echo ""
    echo "查看构建状态: https://github.com/seeyou2n1ght/seeyou2n1ght.github.io/actions"
else
    echo "✅ 没有新的更改需要提交"
fi