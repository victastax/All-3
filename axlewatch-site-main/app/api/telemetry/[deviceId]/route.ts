import { NextRequest } from "next/server";
import { getTelemetry, getLatestReading } from "@/lib/telemetryStore";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    deviceId: string;
  };
}

export async function GET(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const { deviceId } = context.params;

    if (!deviceId) {
      return Response.json(
        { error: "Device ID is required" },
        { status: 400 }
      );
    }

    // Normalize device ID (uppercase, trim)
    const normalizedDeviceId = deviceId.toUpperCase().trim();

    // Get telemetry data for this device
    const telemetry = getTelemetry(normalizedDeviceId);

    if (!telemetry) {
      return Response.json(
        {
          error: "No telemetry data found for this device",
          deviceId: normalizedDeviceId,
          hint: "Make sure the receiver is online and sending data to the cloud"
        },
        { status: 404 }
      );
    }

    // Check if data is stale (no updates in last 5 minutes)
    const isStale = Date.now() - telemetry.lastUpdate > 5 * 60 * 1000;

    // Return the telemetry data
    return Response.json({
      deviceId: telemetry.deviceId,
      lastUpdate: telemetry.lastUpdate,
      lastUpdateISO: new Date(telemetry.lastUpdate).toISOString(),
      isStale,
      readingsCount: telemetry.readings.length,
      latestReading: telemetry.readings[0], // Most recent reading
      readings: telemetry.readings, // All readings (up to last 100)
    });

  } catch (error) {
    console.error("Telemetry GET error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
