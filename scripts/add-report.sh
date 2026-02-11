#!/bin/bash

# 脚本：将报告添加到博客中
# 用法: ./scripts/add-report.sh <报告文件路径> <文章标题>

if [ $# -ne 2 ]; then
    echo "Usage: $0 <report_file_path> <article_title>"
    exit 1
fi

REPORT_FILE=$1
TITLE=$2

# 检查报告文件是否存在
if [ ! -f "$REPORT_FILE" ]; then
    echo "Error: Report file '$REPORT_FILE' does not exist."
    exit 1
fi

# 生成日期戳
DATE=$(date +"%Y-%m-%dT%H:%M:%S%z")
DATE=${DATE:0:22}:${DATE:22}  # 格式化为RFC3339

# 生成文件名
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')

# 创建博客文章
POST_PATH="content/posts/${SLUG}.md"

cat << EOF > "$POST_PATH"
---
title: "$TITLE"
date: $DATE
draft: false
description: "自动生成的技术分析报告"
tags: ["AI", "技术报告", "分析"]
categories: ["技术报告"]
---

$(cat "$REPORT_FILE")

EOF

echo "Created blog post: $POST_PATH"