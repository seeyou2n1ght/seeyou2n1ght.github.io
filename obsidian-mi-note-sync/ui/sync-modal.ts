import { Modal, App, Setting, ButtonComponent } from 'obsidian';

/**
 * 同步进度弹窗
 */
export class SyncModal extends Modal {
  private progressBar: HTMLElement;
  private statusText: HTMLElement;
  private currentLabel: HTMLElement;
  private cancelButton: ButtonComponent;
  private onCancel?: () => void;
  private progressValue = 0;
  private progressTotal = 0;

  constructor(app: App, onCancel?: () => void) {
    super(app);
    this.onCancel = onCancel;
  }

  onOpen() {
    const { contentEl } = this;
    
    this.setTitle('同步进度');
    this.setModalStyles();

    // 进度条容器
    const progressContainer = contentEl.createDiv('sync-progress-container');
    progressContainer.style.cssText = 'margin: 20px 0;';

    // 进度条
    this.progressBar = progressContainer.createDiv('sync-progress-bar');
    this.progressBar.style.cssText = `
      width: 100%;
      height: 20px;
      background-color: #ddd;
      border-radius: 10px;
      overflow: hidden;
      position: relative;
    `;

    const progressFill = this.progressBar.createDiv('sync-progress-fill');
    progressFill.style.cssText = `
      width: 0%;
      height: 100%;
      background-color: #4caf50;
      transition: width 0.3s ease;
    `;

    // 状态文本
    this.statusText = contentEl.createDiv('sync-status-text');
    this.statusText.style.cssText = `
      text-align: center;
      margin: 10px 0;
      font-size: 14px;
      color: #666;
    `;
    this.statusText.setText('准备同步...');

    // 当前处理项
    this.currentLabel = contentEl.createDiv('sync-current-label');
    this.currentLabel.style.cssText = `
      text-align: center;
      font-size: 12px;
      color: #999;
      margin-bottom: 20px;
      max-height: 40px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;

    // 取消按钮
    const buttonContainer = contentEl.createDiv('sync-button-container');
    buttonContainer.style.cssText = 'display: flex; justify-content: center; gap: 10px;';

    this.cancelButton = new ButtonComponent(buttonContainer);
    this.cancelButton
      .setButtonText('取消同步')
      .setWarning()
      .onClick(() => {
        if (this.onCancel) {
          this.onCancel();
        }
        this.close();
      });

    // 关闭按钮
    const closeButton = new ButtonComponent(buttonContainer);
    closeButton
      .setButtonText('关闭')
      .onClick(() => {
        this.close();
      });
    closeButton.buttonEl.style.display = 'none'; // 初始隐藏
    this.closeButton = closeButton;
  }

  private closeButton: ButtonComponent;

  /**
   * 更新进度
   */
  updateProgress(current: number, total: number, message: string) {
    this.progressValue = current;
    this.progressTotal = total;

    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    
    const progressFill = this.progressBar.querySelector('.sync-progress-fill') as HTMLElement;
    if (progressFill) {
      progressFill.style.width = `${percentage}%`;
    }

    this.statusText.setText(`${message} (${current}/${total})`);
    this.currentLabel.setText(message);

    // 完成时显示关闭按钮
    if (current >= total && total > 0) {
      this.closeButton.buttonEl.style.display = 'block';
      this.cancelButton.buttonEl.style.display = 'none';
      this.statusText.setText('同步完成！');
      this.statusText.style.color = '#4caf50';
    }
  }

  /**
   * 设置错误状态
   */
  setError(message: string) {
    this.statusText.setText(`错误：${message}`);
    this.statusText.style.color = '#f44336';
    this.closeButton.buttonEl.style.display = 'block';
    this.cancelButton.buttonEl.style.display = 'none';
  }

  /**
   * 设置模态框样式
   */
  private setModalStyles() {
    const { modalEl } = this;
    modalEl.style.cssText = `
      max-width: 500px;
      padding: 20px;
    `;
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
