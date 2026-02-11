#!/bin/bash

# 博客部署配置脚本

echo "=== Hugo GitHub Pages 博客部署助手 ==="
echo

# 检查是否已安装Hugo
if ! command -v hugo &> /dev/null; then
    echo "错误: 未找到Hugo。请先安装Hugo Extended版本。"
    echo "安装指南:"
    echo "  macOS: brew install hugo"
    echo "  Ubuntu/Debian: sudo apt-get install hugo"
    echo "  更多选项: https://gohugo.io/getting-started/installing/"
    exit 1
fi

# 检查Hugo版本是否为Extended版本
if ! hugo version | grep -q "extended"; then
    echo "警告: 未检测到Hugo Extended版本，这可能导致主题样式问题。"
    read -p "是否继续？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "Hugo版本检查通过。"

# 获取用户名
read -p "请输入您的GitHub用户名: " github_username

# 验证仓库名格式
expected_repo="${github_username}.github.io"
current_dir=$(basename "$(pwd)")

if [ "$current_dir" != "$expected_repo" ]; then
    echo "警告: 当前目录名 '$current_dir' 与预期的仓库名 '$expected_repo' 不匹配。"
    echo "GitHub Pages要求仓库名必须是 '[username].github.io' 格式。"
    read -p "是否要继续？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 备份当前git配置（如果存在）
if [ -d ".git" ]; then
    echo "备份当前git配置..."
    cp -r .git .git_backup
fi

echo "初始化Git仓库..."
rm -rf .git
git init

echo "添加远程仓库..."
git remote add origin "https://github.com/$github_username/$github_username.github.io.git"

echo "安装PaperMod主题..."
git submodule add https://github.com/adityatelange/hugo-PaperMod.git themes/PaperMod

echo "创建初始提交..."
git add .
git config user.name "$github_username"
git config user.email "$github_username@users.noreply.github.com"
git commit -m "Initial commit: Hugo site with PaperMod theme"

echo
echo "=== 部署准备完成 ==="
echo "接下来请执行以下步骤："
echo
echo "1. 检查配置文件 hugo.yaml 是否符合您的需求"
echo "2. 如需，编辑 config/_default/params.yaml 添加个人信息"
echo "3. 创建您的第一篇文章: hugo new posts/first-post.md"
echo "4. 测试本地预览: hugo server"
echo "5. 推送到GitHub: git push -u origin master"
echo
echo "注意：首次推送后，GitHub Actions将自动开始构建和部署您的网站。"
echo "网站将在 https://${github_username}.github.io 上可用。"