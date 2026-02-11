# GitHub Pages 博客设置教程

本教程介绍如何设置和使用基于Hugo的GitHub Pages博客。

## 1. 创建GitHub仓库

1. 登录GitHub
2. 创建新仓库，**仓库名必须为 `[你的GitHub用户名].github.io`**，例如 `seeyou2n1ght.github.io`
3. 勾选 "Initialize this repository with a README"（可选）
4. 点击创建

## 2. 启用GitHub Pages

1. 进入仓库的 Settings 选项卡
2. 向下滚动到 "Pages" 部分
3. 在 "Source" 下拉菜单中选择 "Deploy from a branch"
4. 选择 "main" 分支（或 "master"）并点击 "Save"

## 3. 配置本地环境

```bash
# 安装Hugo Extended 版本（必须是Extended版本才能支持SCSS）
# macOS:
brew install hugo

# Ubuntu/Debian:
sudo apt-get install hugo

# 或者从官网下载: https://gohugo.io/getting-started/installing/
```

## 4. 克隆仓库并设置主题

```bash
git clone https://github.com/[你的用户名]/[你的用户名].github.io.git
cd [你的用户名].github.io

# 如果是从我们这里复制的项目，需要重新初始化git
rm -rf .git
git init
git remote add origin https://github.com/[你的用户名]/[你的用户名].github.io.git

# 安装PaperMod主题
git submodule add https://github.com/adityatelange/hugo-PaperMod.git themes/PaperMod
```

## 5. 本地开发测试

```bash
# 启动本地服务器
hugo server

# 在浏览器打开 http://localhost:1313 查看效果
```

## 6. 添加内容

```bash
# 创建新文章
hugo new posts/文章标题.md

# 文章会自动包含front matter（文章开头的配置信息）
```

## 7. 提交和部署

```bash
# 添加所有更改
git add .

# 提交更改
git commit -m "Add new post"

# 推送到GitHub
git push origin main
```

推送后，GitHub Actions 会自动构建并部署网站。

## 8. 自动化脚本使用

我们提供了自动化脚本用于将报告转换为博客文章：

```bash
# 用法: ./scripts/add-report.sh <报告文件路径> <文章标题>
./scripts/add-report.sh /path/to/your/report.md "文章标题"
```

## 9. 验证部署

1. 推送后，在仓库的 Actions 选项卡中可以看到构建过程
2. 部署完成后，网站将在 `https://[你的用户名].github.io` 可访问

## 故障排除

### GitHub Actions 构建失败
- 检查 `.github/workflows/gh-deploy.yml` 文件中的 Hugo 版本是否与主题要求兼容
- 确保使用的是 Hugo Extended 版本
- 检查配置文件语法

### 页面未更新
- 清除浏览器缓存
- 检查 GitHub Pages 设置是否正确指向了正确的分支

### 本地预览与线上显示不一致
- 确保 baseURL 在配置文件中正确设置
- 本地开发时可以使用 `hugo server -D` 包含草稿文章