/**
 * HTML 到 Markdown 转换器
 * 将小米笔记的富文本 HTML 内容转换为 Markdown 格式
 */

export class MarkdownConverter {
  /**
   * 将 HTML 转换为 Markdown
   */
  static htmlToMarkdown(html: string): string {
    if (!html) return '';

    let markdown = html;

    // 处理标题
    markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gis, '# $1\n\n');
    markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gis, '## $1\n\n');
    markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gis, '### $1\n\n');
    markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gis, '#### $1\n\n');
    markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gis, '##### $1\n\n');
    markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gis, '###### $1\n\n');

    // 处理粗体和斜体
    markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gis, '**$1**');
    markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gis, '**$1**');
    markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gis, '*$1*');
    markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gis, '*$1*');

    // 处理链接
    markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gis, '[$2]($1)');

    // 处理图片
    markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gis, '![$2]($1)');
    markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*>/gis, '![]($1)');

    // 处理列表
    markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gis, (match, content) => {
      return content.replace(/<li[^>]*>(.*?)<\/li>/gis, '- $1\n');
    });
    markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gis, (match, content) => {
      let index = 1;
      return content.replace(/<li[^>]*>(.*?)<\/li>/gis, () => `${index++}. $1\n`);
    });
    markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gis, '- $1\n');

    // 处理段落
    markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n');

    // 处理代码块
    markdown = markdown.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gis, '```\n$1\n```\n');
    markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gis, '`$1`');

    // 处理引用
    markdown = markdown.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gis, '> $1\n');

    // 处理换行
    markdown = markdown.replace(/<br[^>]*>/gis, '\n');

    // 处理删除线
    markdown = markdown.replace(/<del[^>]*>(.*?)<\/del>/gis, '~~$1~~');
    markdown = markdown.replace(/<s[^>]*>(.*?)<\/s>/gis, '~~$1~~');

    // 处理表格
    markdown = this.convertTable(markdown);

    // 移除剩余的 HTML 标签
    markdown = markdown.replace(/<[^>]+>/g, '');

    // 清理多余的空行
    markdown = markdown.replace(/\n\s*\n\s*\n/g, '\n\n');
    markdown = markdown.trim();

    return markdown;
  }

  /**
   * 转换 HTML 表格为 Markdown 表格
   */
  private static convertTable(html: string): string {
    const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) return html;

    const tableContent = tableMatch[1];
    const rows: string[] = [];
    
    // 提取表头
    const headerMatch = tableContent.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
    if (headerMatch) {
      const headerRow = headerMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
      if (headerRow) {
        const headers = headerRow[1].match(/<t[hd][^>]*>(.*?)<\/t[hd]>/gi) || [];
        const headerCells = headers.map(h => h.replace(/<[^>]+>/g, '').trim());
        rows.push(`| ${headerCells.join(' | ')} |`);
        rows.push(`| ${headerCells.map(() => '---').join(' | ')} |`);
      }
    }

    // 提取表格主体
    const bodyMatch = tableContent.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : tableContent;
    const bodyRows = bodyContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    
    bodyRows.forEach(row => {
      const cells = row.match(/<t[hd][^>]*>(.*?)<\/t[hd]>/gi) || [];
      const cellContents = cells.map(c => c.replace(/<[^>]+>/g, '').trim());
      if (cellContents.length > 0) {
        rows.push(`| ${cellContents.join(' | ')} |`);
      }
    });

    return rows.join('\n') + '\n\n';
  }

  /**
   * 将 Markdown 转换为 HTML（用于同步回小米云）
   */
  static markdownToHtml(markdown: string): string {
    if (!markdown) return '';

    let html = markdown;

    // 处理标题（从大到小，避免冲突）
    html = html.replace(/^###### (.*?)$/gm, '<h6>$1</h6>');
    html = html.replace(/^##### (.*?)$/gm, '<h5>$1</h5>');
    html = html.replace(/^#### (.*?)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

    // 处理粗体和斜体
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // 处理链接
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

    // 处理图片
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">');

    // 处理代码块
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');

    // 处理引用
    html = html.replace(/^> (.*?)$/gm, '<blockquote>$1</blockquote>');

    // 处理删除线
    html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

    // 处理无序列表
    html = html.replace(/^\s*-\s+(.*?)$/gm, '<li>$1</li>');
    
    // 处理有序列表（简化处理）
    html = html.replace(/^\s*\d+\.\s+(.*?)$/gm, '<li>$1</li>');

    // 处理段落
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // 清理多余的段落标签
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<p>(<h[1-6]>)/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ol>)/g, '$1');
    html = html.replace(/(<\/ol>)<\/p>/g, '$1');
    html = html.replace(/<p>(<pre>)/g, '$1');
    html = html.replace(/(<\/pre>)<\/p>/g, '$1');
    html = html.replace(/<p>(<blockquote>)/g, '$1');
    html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');

    return html.trim();
  }

  /**
   * 提取 HTML 中的图片 URL
   */
  static extractImageUrls(html: string): string[] {
    const urls: string[] = [];
    const imgRegex = /<img[^>]*src="([^"]*)"[^>]*>/gi;
    let match;
    
    while ((match = imgRegex.exec(html)) !== null) {
      urls.push(match[1]);
    }
    
    return urls;
  }
}
