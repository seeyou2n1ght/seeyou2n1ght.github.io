# AI 研究与行业洞察博客

这是一个用于发布AI研究、行业洞察和技术分析报告的博客，基于Hugo和PaperMod主题构建，并通过GitHub Actions自动部署到GitHub Pages。

## 设置说明

1. **克隆仓库**：
   ```bash
   git clone https://github.com/seeyou2n1ght/seeyou2n1ght.github.io.git
   cd seeyou2n1ght.github.io
   git submodule update --init --recursive
   ```

2. **本地开发**：
   ```bash
   hugo server
   ```

## 添加新文章

### 手动添加
```bash
hugo new posts/文章标题.md
```

### 自动添加报告
使用提供的脚本将现有报告转换为博客文章：
```bash
./scripts/add-report.sh /path/to/report.md "文章标题"
```

## 部署

推送到main分支会自动触发GitHub Actions进行构建和部署。

## 目录结构

- `content/posts/` - 博客文章
- `static/` - 静态资源
- `themes/` - Hugo主题
- `.github/workflows/` - GitHub Actions工作流

## 配置

博客配置在 `hugo.yaml` 中，可以根据需要调整参数。