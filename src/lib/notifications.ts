export const showNotification = (message: string, duration: number = 2000) => {
  // Remove any existing notifications
  const existingNotifications = document.querySelectorAll('.notification-toast');
  existingNotifications.forEach(notification => notification.remove());

  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'notification-toast';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 9999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: opacity 0.3s ease;
    max-width: 90vw;
    text-align: center;
  `;

  // Add to document
  document.body.appendChild(notification);

  // Remove after duration
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, duration);
};

export const showConfirmDialog = (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    // Remove any existing dialogs
    const existingDialogs = document.querySelectorAll('.confirm-dialog-overlay');
    existingDialogs.forEach(dialog => dialog.remove());

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 20px;
    `;

    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.style.cssText = `
      background: white;
      padding: 24px;
      border-radius: 12px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    `;

    dialog.innerHTML = `
      <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #333;">${message}</p>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="confirm-cancel" style="
          padding: 8px 16px;
          border: 1px solid #d1d5db;
          background: white;
          color: #6b7280;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        ">Cancel</button>
        <button id="confirm-ok" style="
          padding: 8px 16px;
          border: none;
          background: #ef4444;
          color: white;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        ">Remove All</button>
      </div>
    `;

    // Add event listeners
    const cancelBtn = dialog.querySelector('#confirm-cancel') as HTMLButtonElement;
    const okBtn = dialog.querySelector('#confirm-ok') as HTMLButtonElement;

    cancelBtn.addEventListener('click', () => {
      overlay.remove();
      resolve(false);
    });

    okBtn.addEventListener('click', () => {
      overlay.remove();
      resolve(true);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });

    // Add dialog to overlay
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Focus on cancel button
    cancelBtn.focus();
  });
};
