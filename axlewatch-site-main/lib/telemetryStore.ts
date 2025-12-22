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

// Get latest reading for each unique trailer from a device
// Returns trailers sorted: TRAILER1, DOLLY1, TRAILER2, DOLLY2, etc.
export function getLatestReadingsByTrailer(deviceId: string): TelemetryReading[] {
  const telemetry = telemetryStore.get(deviceId);
  if (!telemetry || telemetry.readings.length === 0) {
    return [];
  }

  // Group readings by trailer_id, keeping only the latest for each
  const latestByTrailer = new Map<string, TelemetryReading>();

  for (const reading of telemetry.readings) {
    const trailerId = reading.trailer_id;
    if (!latestByTrailer.has(trailerId)) {
      latestByTrailer.set(trailerId, reading);
    }
  }

  // Convert to array and sort
  const trailers = Array.from(latestByTrailer.values());

  // Sort function: TRAILER1, DOLLY1, TRAILER2, DOLLY2, TX1, TX2, etc.
  trailers.sort((a, b) => {
    const aId = a.trailer_id.toUpperCase();
    const bId = b.trailer_id.toUpperCase();

    // Extract type prefix and number
    const parseId = (id: string): { type: string; num: number; priority: number } => {
      if (id.startsWith("TRAILER")) {
        return { type: "TRAILER", num: parseInt(id.slice(7)) || 0, priority: 1 };
      } else if (id.startsWith("DOLLY")) {
        return { type: "DOLLY", num: parseInt(id.slice(5)) || 0, priority: 2 };
      } else if (id.startsWith("TX")) {
        return { type: "TX", num: parseInt(id.slice(2)) || 0, priority: 3 };
      }
      return { type: id, num: 0, priority: 99 };
    };

    const aParsed = parseId(aId);
    const bParsed = parseId(bId);

    // Sort by number first (TRAILER1, DOLLY1, TRAILER2, DOLLY2)
    if (aParsed.num !== bParsed.num) {
      return aParsed.num - bParsed.num;
    }
    // Within same number, sort by priority (TRAILER before DOLLY)
    return aParsed.priority - bParsed.priority;
  });

  return trailers;
}
