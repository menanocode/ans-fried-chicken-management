import { buildEscPosBytes } from '../utils/receipt.js';

const CHROME_EXCLUSION_PATTERN = /(edg|opr|opera|samsungbrowser|duckduckgo|brave)/i;
const BLUETOOTH_SERVICE_UUIDS = [
  0xFFE0,
  0xFFE5,
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];
const BLUETOOTH_CHARACTERISTIC_UUIDS = [
  0xFFE1,
  0xFFE9,
  '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
];
const MAX_CHUNK_SIZE = 180;

function isGoogleChromeBrowser() {
  const ua = navigator.userAgent || '';
  const vendor = navigator.vendor || '';
  return /chrome/i.test(ua) && /google inc/i.test(vendor) && !CHROME_EXCLUSION_PATTERN.test(ua);
}

function getWritableProperty(characteristic) {
  if (characteristic?.properties?.writeWithoutResponse) return 'writeWithoutResponse';
  if (characteristic?.properties?.write) return 'write';
  return '';
}

async function findWritableCharacteristic(server) {
  for (const serviceUuid of BLUETOOTH_SERVICE_UUIDS) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      const characteristics = await service.getCharacteristics();
      const writable = characteristics.find((characteristic) => getWritableProperty(characteristic));
      if (writable) return writable;
    } catch {
      // Lanjut ke kandidat berikutnya.
    }
  }

  try {
    const services = await server.getPrimaryServices();
    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      const writable = characteristics.find((characteristic) => getWritableProperty(characteristic));
      if (writable) return writable;
    }
  } catch {
    // Abaikan dan jatuhkan error di bawah.
  }

  throw new Error('Printer Bluetooth ditemukan, tetapi karakteristik tulis tidak tersedia.');
}

async function writeChunks(characteristic, bytes) {
  const mode = getWritableProperty(characteristic);
  if (!mode) throw new Error('Printer tidak mendukung mode tulis yang dibutuhkan.');

  for (let offset = 0; offset < bytes.length; offset += MAX_CHUNK_SIZE) {
    const chunk = bytes.slice(offset, offset + MAX_CHUNK_SIZE);
    if (mode === 'writeWithoutResponse') {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
  }
}

export function supportsBluetoothReceiptPrint() {
  return Boolean(
    window.isSecureContext &&
    navigator.bluetooth &&
    isGoogleChromeBrowser()
  );
}

export async function printReceiptViaBluetooth(receiptData) {
  if (!supportsBluetoothReceiptPrint()) {
    throw new Error('Google Chrome pada perangkat ini belum mendukung cetak Bluetooth langsung.');
  }

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [...BLUETOOTH_SERVICE_UUIDS],
  });

  if (!device?.gatt) {
    throw new Error('Perangkat printer tidak menyediakan koneksi GATT.');
  }

  const server = await device.gatt.connect();
  try {
    const characteristic = await findWritableCharacteristic(server);
    const bytes = buildEscPosBytes(receiptData);
    await writeChunks(characteristic, bytes);
  } finally {
    if (device.gatt.connected) device.gatt.disconnect();
  }
}
