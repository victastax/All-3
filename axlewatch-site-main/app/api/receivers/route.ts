import { NextRequest } from "next/server";
import { verifyAuth, addReceiverToUser, removeReceiverFromUser, getUserReceivers } from "@/lib/userStore";
import { getTelemetry } from "@/lib/telemetryStore";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return Response.json(
        { error: "No authentication token provided" },
        { status: 401 }
      );
    }

    const user = await verifyAuth(token);
    if (!user) {
      return Response.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // Get user's receivers
    const receiverMacs = await getUserReceivers(user.id);

    // Get latest data for each receiver
    const receivers = receiverMacs.map(mac => {
      const telemetry = getTelemetry(mac);

      if (!telemetry || telemetry.readings.length === 0) {
        return {
          id: mac,
          deviceId: mac,
          name: mac,
          latestData: null,
          createdAt: new Date().toISOString(),
        };
      }

      // Group readings by trailer_id to find all unique trailers
      const trailerMap = new Map<string, typeof telemetry.readings[0]>();

      // Go through all readings and keep the most recent one for each trailer_id
      for (const reading of telemetry.readings) {
        const trailerId = reading.trailer_id;
        if (!trailerMap.has(trailerId)) {
          trailerMap.set(trailerId, reading);
        }
        // Since readings are sorted newest first, the first one we find for each trailer_id is the most recent
      }

      // Build trailer objects from the grouped data
      const trailers = Array.from(trailerMap.entries()).map(([trailerId, reading]) => {
        // Parse trailer ID - extract numeric part if possible, otherwise use hash
        let numericId = parseInt(trailerId.replace(/\D/g, ''), 10);
        if (isNaN(numericId)) {
          // Generate a stable numeric ID from the string
          numericId = trailerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        }

        const readingTimestamp = new Date(reading.timestamp).getTime();
        const isOnline = (Date.now() - readingTimestamp) < 60000; // Online if updated within last minute

        return {
          id: numericId,
          name: trailerId, // Keep the original trailer_id as name
          online: isOnline,
          rssi: -50,
          lastUpdate: readingTimestamp,
          ambientTemp: reading.readings.ambient_temp ?? null,
          hubTemperatures: [
            reading.readings.hub_1 || 0,
            reading.readings.hub_2 || 0,
            reading.readings.hub_3 || 0,
            reading.readings.hub_4 || 0,
            reading.readings.hub_5 || 0,
            reading.readings.hub_6 || 0,
            reading.readings.hub_7 || 0,
            reading.readings.hub_8 || 0,
          ].filter(t => t > 0),
        };
      });

      // Use the most recent reading for location data
      const latestReading = telemetry.readings[0];

      return {
        id: mac,
        deviceId: mac,
        name: mac,
        latestData: {
          id: Date.now().toString(),
          timestamp: new Date(telemetry.lastUpdate).toISOString(),
          latitude: latestReading.location?.latitude || null,
          longitude: latestReading.location?.longitude || null,
          speed: latestReading.location?.speed || null,
          satellites: null,
          trailers: trailers,
        },
        createdAt: new Date().toISOString(),
      };
    });

    return Response.json({ receivers });

  } catch (error) {
    console.error("Receivers GET error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return Response.json(
        { error: "No authentication token provided" },
        { status: 401 }
      );
    }

    const user = await verifyAuth(token);
    if (!user) {
      return Response.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    const { deviceId } = await req.json();

    if (!deviceId) {
      return Response.json(
        { error: "Device ID is required" },
        { status: 400 }
      );
    }

    // Normalize device ID
    let normalizedMac = deviceId.toUpperCase().trim();
    if (!normalizedMac.startsWith("AW-")) {
      const cleaned = normalizedMac.replace(/[:-]/g, "");
      normalizedMac = `AW-${cleaned}`;
    }

    // Add receiver to user
    await addReceiverToUser(user.id, normalizedMac);

    return Response.json({ success: true, deviceId: normalizedMac });

  } catch (error) {
    console.error("Receivers POST error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return Response.json(
        { error: "No authentication token provided" },
        { status: 401 }
      );
    }

    const user = await verifyAuth(token);
    if (!user) {
      return Response.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json(
        { error: "Receiver ID is required" },
        { status: 400 }
      );
    }

    // Remove receiver from user
    await removeReceiverFromUser(user.id, id);

    return Response.json({ success: true });

  } catch (error) {
    console.error("Receivers DELETE error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
