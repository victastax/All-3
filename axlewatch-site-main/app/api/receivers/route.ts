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
      return {
        id: mac,
        deviceId: mac,
        name: mac, // For now, use MAC as name
        latestData: telemetry?.readings[0] ? {
          id: Date.now().toString(),
          timestamp: new Date(telemetry.lastUpdate).toISOString(),
          latitude: telemetry.readings[0].location?.latitude || null,
          longitude: telemetry.readings[0].location?.longitude || null,
          speed: telemetry.readings[0].location?.speed || null,
          satellites: null, // Not in our current telemetry structure
          trailers: [{
            id: 1,
            online: true,
            rssi: -50,
            lastUpdate: telemetry.lastUpdate,
            ambientTemp: 25,
            hubTemperatures: [
              telemetry.readings[0].readings.hub_1 || 0,
              telemetry.readings[0].readings.hub_2 || 0,
              telemetry.readings[0].readings.hub_3 || 0,
              telemetry.readings[0].readings.hub_4 || 0,
              telemetry.readings[0].readings.hub_5 || 0,
              telemetry.readings[0].readings.hub_6 || 0,
              telemetry.readings[0].readings.hub_7 || 0,
              telemetry.readings[0].readings.hub_8 || 0,
            ].filter(t => t > 0),
          }],
        } : null,
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
