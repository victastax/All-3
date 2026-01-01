// In-memory telemetry store
// In production, this should be replaced with a database (PostgreSQL, MongoDB, etc.)

export interface TelemetryReading {
  timestamp: string;
  trailer_id: string;
  readings: {
    hub_1: number;
    hub_2: number;
    hub_3: number;
    hub_4: number;
    hub_5: number;
    hub_6: number;
    hub_7?: number;
    hub_8?: number;
    ambient_temp?: number;
  };
  location: {
    latitude: number;
    longitude: number;
    speed: number;
  };
  alert?: {
    level: "warning" | "critical";
    message: string;
  };
}

export interface DeviceTelemetry {
  deviceId: string;
  lastUpdate: number;
  readings: TelemetryReading[];
  apiKey: string; // Store the API key that was used (for validation)
}

// In-memory store: deviceId -> telemetry data
const telemetryStore = new Map<string, DeviceTelemetry>();

// Maximum readings to store per device (keep last 100)
const MAX_READINGS_PER_DEVICE = 100;

export function storeTelemetry(
  deviceId: string,
  reading: TelemetryReading,
  apiKey: string
): void {
  const existing = telemetryStore.get(deviceId);

  if (existing) {
    // Add new reading to the beginning of the array
    existing.readings.unshift(reading);
    // Keep only the last MAX_READINGS_PER_DEVICE readings
    if (existing.readings.length > MAX_READINGS_PER_DEVICE) {
      existing.readings = existing.readings.slice(0, MAX_READINGS_PER_DEVICE);
    }
    existing.lastUpdate = Date.now();
  } else {
    // Create new device entry
    telemetryStore.set(deviceId, {
      deviceId,
      lastUpdate: Date.now(),
      readings: [reading],
      apiKey,
    });
  }
}

export function getTelemetry(deviceId: string): DeviceTelemetry | null {
  return telemetryStore.get(deviceId) || null;
}

export function getAllDeviceIds(): string[] {
  return Array.from(telemetryStore.keys());
}

export function getLatestReading(deviceId: string): TelemetryReading | null {
  const telemetry = telemetryStore.get(deviceId);
  return telemetry?.readings[0] || null;
}
