/**
 * cardio-ble.engine.ts — BLE HR sensor (Web Bluetooth) для live пульса в CardioSessionTimer.
 * PRO: подключается к HR-датчику (Polar H10, Garmin HRM) → live HR в таймере + подсветка зоны.
 * Без датчика — fallback на ручной ввод.
 */
export interface BleHrState {
  connected: boolean;
  deviceName?: string;
  hr?: number;
  error?: string;
}

/** Подключить HR-датчик через Web Bluetooth (HR Service 0x180D). */
export async function connectBleHr(onHr: (hr: number) => void, onState: (s: BleHrState) => void): Promise<{ disconnect: () => void } | null> {
  const nav = navigator as unknown as { bluetooth?: { requestDevice: (opts: unknown) => Promise<BluetoothDevice> } };
  if (!nav.bluetooth) {
    onState({ connected: false, error: 'Web Bluetooth не поддерживается в этом браузере' });
    return null;
  }
  try {
    const device = await nav.bluetooth.requestDevice({
      filters: [{ services: ['heart_rate'] }],
      optionalServices: ['battery_service'],
    } as unknown);
    const server = await (device as unknown as { gatt?: { connect: () => Promise<BluetoothRemoteGATTServer> } }).gatt?.connect();
    if (!server) throw new Error('GATT connect failed');
    const service = await (server as unknown as { getPrimaryService: (uuid: string) => Promise<BluetoothRemoteGATTService> }).getPrimaryService('heart_rate');
    const char = await (service as unknown as { getCharacteristic: (uuid: string) => Promise<BluetoothRemoteGATTCharacteristic> }).getCharacteristic('heart_rate_measurement') as unknown as { startNotifications: () => Promise<void>; addEventListener: (t: string, h: (ev: Event) => void) => void; removeEventListener: (t: string, h: (ev: Event) => void) => void };
    await char.startNotifications();
    const handler = (ev: Event) => {
      const v = (ev.target as unknown as { value: DataView }).value;
      if (!v) return;
      const flags = v.getUint8(0);
      const hr = (flags & 0x01) ? v.getUint16(1, true) : v.getUint8(1);
      if (hr > 30 && hr < 250) {
        onHr(hr);
        onState({ connected: true, deviceName: device.name ?? 'HR sensor', hr });
      }
    };
    char.addEventListener('characteristicvaluechanged', handler);
    onState({ connected: true, deviceName: device.name ?? 'HR sensor' });
    const disconnect = () => {
      try { char.removeEventListener('characteristicvaluechanged', handler as EventListener); } catch { /* */ }
      try { (device as unknown as { gatt?: { disconnect: () => void } }).gatt?.disconnect(); } catch { /* */ }
      onState({ connected: false });
    };
    (device as unknown as { addEventListener: (t: string, h: () => void) => void }).addEventListener('gattserverdisconnected', () => onState({ connected: false }));
    return { disconnect };
  } catch (e) {
    onState({ connected: false, error: (e as Error).message || 'BLE ошибка' });
    return null;
  }
}

// типы для stub
type BluetoothDevice = { name?: string; gatt?: { connect: () => Promise<unknown>; disconnect: () => void } };
type BluetoothRemoteGATTServer = unknown;
type BluetoothRemoteGATTService = unknown;
type BluetoothRemoteGATTCharacteristic = unknown;
