const container = document.getElementById('modal-container');

export function openModal(title, contentHtml, options = {}) {
  return new Promise((resolve) => {
    const sizeClass = options.size === 'lg' ? 'modal-lg' : '';
    
    container.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal ${sizeClass}">
          <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close" id="modal-close-btn">
              <span class="material-icons-round">close</span>
            </button>
          </div>
          <div class="modal-body">${contentHtml}</div>
          ${options.footer !== false ? `
            <div class="modal-footer">
              ${options.cancelText !== false ? `<button class="btn btn-secondary" id="modal-cancel-btn">${options.cancelText || 'Batal'}</button>` : ''}
              ${options.confirmText ? `<button class="btn ${options.confirmClass || 'btn-primary'}" id="modal-confirm-btn">${options.confirmText}</button>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    const close = (result) => {
      container.innerHTML = '';
      resolve(result);
    };

    container.querySelector('#modal-close-btn')?.addEventListener('click', () => close(null));
    container.querySelector('#modal-cancel-btn')?.addEventListener('click', () => close(null));
    container.querySelector('#modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') close(null);
    });

    const confirmBtn = container.querySelector('#modal-confirm-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        if (options.onConfirm) {
          const result = options.onConfirm();
          close(result);
        } else {
          close(true);
        }
      });
    }

    // Allow external code to access modal elements
    if (options.onOpen) {
      options.onOpen(container.querySelector('.modal'));
    }
  });
}

export function closeModal() {
  container.innerHTML = '';
}

export async function confirmModal(title, message) {
  return openModal(title, `<p style="color: var(--text-secondary); font-size: var(--font-sm);">${message}</p>`, {
    confirmText: 'Ya, Lanjutkan',
    confirmClass: 'btn-danger',
    cancelText: 'Batal'
  });
}
