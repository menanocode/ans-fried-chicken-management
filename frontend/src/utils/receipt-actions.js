import * as notify from '../components/notification.js';
import { closeModal, openModal } from '../components/modal.js';
import { openReceiptPreview } from './receipt.js';
import { printReceiptViaBluetooth, supportsBluetoothReceiptPrint } from '../services/bluetooth-printer.js';

function setButtonsDisabled(modal, disabled) {
  modal.querySelectorAll('[data-receipt-action]').forEach((button) => {
    button.disabled = disabled;
  });
}

export function openReceiptActions(receiptData) {
  const bluetoothSupported = supportsBluetoothReceiptPrint();
  const content = `
    <div class="receipt-action-panel">
      <p>
        Pilih cara cetak struk untuk transaksi <strong>${receiptData.saleCode}</strong>.
      </p>
      <div class="receipt-action-buttons">
        <button type="button" class="btn btn-primary" id="receipt-action-bluetooth" data-receipt-action="bluetooth">
          <span class="material-icons-round">bluetooth</span> Cetak Bluetooth
        </button>
        <button type="button" class="btn btn-secondary" id="receipt-action-preview" data-receipt-action="preview">
          <span class="material-icons-round">visibility</span> Preview Struk
        </button>
      </div>
      <div class="receipt-action-hint">
        ${bluetoothSupported
          ? 'Google Chrome mendukung percobaan cetak Bluetooth langsung pada perangkat ini.'
          : 'Cetak Bluetooth langsung belum tersedia pada perangkat ini. Sistem akan mengarahkan ke preview browser.'}
      </div>
    </div>
  `;

  return openModal(`Cetak Struk ${receiptData.saleCode}`, content, {
    footer: false,
    onOpen: (modal) => {
      modal.querySelector('#receipt-action-preview')?.addEventListener('click', async () => {
        closeModal();
        await openReceiptPreview(receiptData);
      });

      modal.querySelector('#receipt-action-bluetooth')?.addEventListener('click', async () => {
        setButtonsDisabled(modal, true);

        if (!bluetoothSupported) {
          notify.warning('Bluetooth print belum didukung. Membuka preview struk.');
          closeModal();
          await openReceiptPreview(receiptData);
          return;
        }

        try {
          await printReceiptViaBluetooth(receiptData);
          notify.success('Struk berhasil dikirim ke printer Bluetooth.');
          closeModal();
        } catch (err) {
          notify.warning(`Cetak Bluetooth gagal: ${err.message}. Membuka preview struk.`);
          closeModal();
          await openReceiptPreview(receiptData);
        }
      });
    },
  });
}
