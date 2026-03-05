import { TFolder, Vault, normalizePath, requestUrl } from 'obsidian';
import { MiNote, MiAttachment } from '../types';

/**
 * 文件操作工具类
 */
export class FileHelper {
  private vault: Vault;

  constructor(vault: Vault) {
    this.vault = vault;
  }

  /**
   * 确保文件夹存在
   */
  async ensureFolderExists(folderPath: string): Promise<void> {
    const normalizedPath = normalizePath(folderPath);
    const folders = normalizedPath.split('/');
    
    let currentPath = '';
    for (const folder of folders) {
      currentPath = currentPath ? `${currentPath}/${folder}` : folder;
      const exists = await this.vault.adapter.exists(currentPath);
      if (!exists) {
        await this.vault.createFolder(currentPath);
      }
    }
  }

  /**
   * 保存笔记到文件
   */
  async saveNote(folderPath: string, note: MiNote, markdownContent: string): Promise<string> {
    await this.ensureFolderExists(folderPath);
    
    // 生成安全的文件名
    const fileName = this.sanitizeFileName(note.title) + '.md';
    const filePath = normalizePath(`${folderPath}/${fileName}`);
    
    // 处理文件冲突
    const finalPath = await this.handleConflict(filePath, note.id);
    
    // 添加 Frontmatter
    const frontmatter = this.generateFrontmatter(note);
    const fullContent = `${frontmatter}\n\n${markdownContent}`;
    
    // 写入文件
    await this.vault.create(finalPath, fullContent);
    
    return finalPath;
  }

  /**
   * 更新现有笔记
   */
  async updateNote(filePath: string, note: MiNote, markdownContent: string): Promise<void> {
    const frontmatter = this.generateFrontmatter(note);
    const fullContent = `${frontmatter}\n\n${markdownContent}`;
    
    await this.vault.modify(filePath, fullContent);
  }

  /**
   * 生成 Frontmatter
   */
  private generateFrontmatter(note: MiNote): string {
    const frontmatter: Record<string, any> = {
      id: note.id,
      title: note.title,
      created: new Date(note.createTime).toISOString(),
      modified: new Date(note.updateTime).toISOString(),
      source: 'mi-note',
    };

    if (note.folderName) {
      frontmatter.folder = note.folderName;
    }

    if (note.tags && note.tags.length > 0) {
      frontmatter.tags = note.tags;
    }

    // 转换为 YAML 格式
    let yaml = '---\n';
    for (const [key, value] of Object.entries(frontmatter)) {
      if (Array.isArray(value)) {
        yaml += `${key}:\n`;
        value.forEach(v => {
          yaml += `  - ${v}\n`;
        });
      } else {
        yaml += `${key}: ${value}\n`;
      }
    }
    yaml += '---';

    return yaml;
  }

  /**
   * 处理文件冲突
   */
  private async handleConflict(filePath: string, noteId: string): Promise<string> {
    // 检查文件是否已存在
    if (!await this.vault.adapter.exists(filePath)) {
      return filePath;
    }

    // 读取现有文件检查是否是同一个笔记
    const existingContent = await this.vault.read(filePath);
    if (existingContent.includes(`id: ${noteId}`)) {
      // 是同一个笔记，直接返回原路径（会覆盖）
      return filePath;
    }

    // 不同笔记同名，添加后缀
    const ext = filePath.endsWith('.md') ? '.md' : '';
    const baseName = filePath.replace(ext, '');
    let counter = 1;
    let newPath = `${baseName}-${counter}${ext}`;
    
    while (await this.vault.adapter.exists(newPath)) {
      counter++;
      newPath = `${baseName}-${counter}${ext}`;
    }

    return newPath;
  }

  /**
   * 清理文件名中的非法字符
   */
  private sanitizeFileName(name: string): string {
    // 移除 Windows/Unix 文件名非法字符
    return name
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100); // 限制长度
  }

  /**
   * 下载并保存附件
   */
  async downloadAttachment(
    attachment: MiAttachment,
    folderPath: string,
    noteId: string
  ): Promise<string | null> {
    try {
      await this.ensureFolderExists(folderPath);
      
      const fileName = this.sanitizeFileName(attachment.name);
      const filePath = normalizePath(`${folderPath}/${noteId}/${fileName}`);
      
      // 确保附件子文件夹存在
      await this.ensureFolderExists(`${folderPath}/${noteId}`);
      
      // 下载文件
      const response = await requestUrl({
        url: attachment.url,
        method: 'GET',
      });

      if (response.status === 200) {
        // 写入二进制数据
        const arrayBuffer = response.arrayBuffer;
        await this.vault.createBinary(filePath, arrayBuffer);
        return filePath;
      }
      
      return null;
    } catch (error) {
      console.error(`下载附件失败: ${attachment.name}`, error);
      return null;
    }
  }

  /**
   * 根据笔记 ID 查找现有文件
   */
  async findNoteFile(folderPath: string, noteId: string): Promise<string | null> {
    const folder = this.vault.getAbstractFileByPath(folderPath);
    if (!(folder instanceof TFolder)) {
      return null;
    }

    const files = this.vault.getMarkdownFiles();
    for (const file of files) {
      if (file.path.startsWith(folderPath)) {
        const content = await this.vault.read(file);
        if (content.includes(`id: ${noteId}`)) {
          return file.path;
        }
      }
    }

    return null;
  }

  /**
   * 获取文件夹中的所有笔记文件
   */
  async getNoteFiles(folderPath: string): Promise<string[]> {
    const files = this.vault.getMarkdownFiles();
    return files
      .filter(file => file.path.startsWith(folderPath))
      .map(file => file.path);
  }

  /**
   * 删除笔记文件
   */
  async deleteNoteFile(filePath: string): Promise<void> {
    const file = this.vault.getAbstractFileByPath(filePath);
    if (file) {
      await this.vault.delete(file);
    }
  }

  /**
   * 读取笔记文件并解析 Frontmatter
   */
  async parseNoteFile(filePath: string): Promise<{
    id?: string;
    title?: string;
    content: string;
    tags?: string[];
  } | null> {
    try {
      const content = await this.vault.read(filePath);
      
      // 解析 Frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!frontmatterMatch) {
        return { content };
      }

      const frontmatterText = frontmatterMatch[1];
      const markdownContent = frontmatterMatch[2];

      const frontmatter: Record<string, any> = {};
      const lines = frontmatterText.split('\n');
      let currentKey: string | null = null;
      let currentArray: string[] = [];

      for (const line of lines) {
        const arrayItemMatch = line.match(/^\s+-\s+(.*)$/);
        if (arrayItemMatch && currentKey) {
          currentArray.push(arrayItemMatch[1]);
          continue;
        }

        if (currentKey && currentArray.length > 0) {
          frontmatter[currentKey] = currentArray;
          currentArray = [];
        }

        const kvMatch = line.match(/^(\w+):\s*(.*)$/);
        if (kvMatch) {
          currentKey = kvMatch[1];
          const value = kvMatch[2].trim();
          if (value) {
            frontmatter[currentKey] = value;
          }
        }
      }

      if (currentKey && currentArray.length > 0) {
        frontmatter[currentKey] = currentArray;
      }

      return {
        id: frontmatter.id,
        title: frontmatter.title,
        content: markdownContent.trim(),
        tags: frontmatter.tags,
      };
    } catch (error) {
      console.error(`解析笔记文件失败: ${filePath}`, error);
      return null;
    }
  }
}
