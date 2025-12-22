import { NextRequest } from "next/server";
import { storeTelemetry, type TelemetryReading } from "@/lib/telemetryStore";

export const runtime = "nodejs";

// Simple API key validation
// In production, use a proper authentication system
function validateApiKey(apiKey: string | null): boolean {
  if (!apiKey) return false;

  // For now, accept any non-empty API key
  // In production, validate against a database of authorized keys
  return apiKey.trim().length > 0;
}

export async function POST(req: NextRequest) {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.get("authorization");
    const apiKey = authHeader?.replace(/^Bearer\s+/i, "").trim() || null;

    // Validate API key
    if (!validateApiKey(apiKey)) {
      return Response.json(
        { error: "Missing or invalid API key" },
        { status: 401 }
      );
    }

    // Parse the telemetry payload
    const payload: TelemetryReading = await req.json();

    // Validate required fields
    if (!payload.timestamp || !payload.trailer_id || !payload.readings) {
      return Response.json(
        { error: "Missing required fields: timestamp, trailer_id, readings" },
        { status: 400 }
      );
    }

    // Extract device ID from the request
    // Option 1: From a custom header (if receiver sends it)
    let deviceId = req.headers.get("x-device-id");

    // Option 2: From the payload (if we added device_id field to the firmware)
    if (!deviceId && "device_id" in payload) {
      deviceId = (payload as any).device_id;
    }

    // Option 3: Use the API key as the device identifier (temporary solution)
    // In production, you'd want to look up the device ID from the API key
    if (!deviceId) {
      // For now, we'll require the device_id in the payload
      // You'll need to update the ESP32 firmware to include this field
      return Response.json(
        {
          error: "Missing device_id. Please update receiver firmware to include device_id in payload.",
          hint: "Add doc['device_id'] = configMgr->config.deviceID; to the firmware"
        },
        { status: 400 }
      );
    }

    // Store the telemetry data
    storeTelemetry(deviceId, payload, apiKey!);

    // Return success
    return Response.json(
      {
        success: true,
        deviceId,
        timestamp: payload.timestamp
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Telemetry POST error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve all device IDs (for admin purposes)
export async function GET(req: NextRequest) {
  try {
    const { getAllDeviceIds } = await import("@/lib/telemetryStore");
    const deviceIds = getAllDeviceIds();

    return Response.json({
      deviceIds,
      count: deviceIds.length
    });
  } catch (error) {
    console.error("Telemetry GET error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
