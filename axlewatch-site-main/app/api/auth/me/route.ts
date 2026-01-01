import { NextRequest } from "next/server";
import { verifyAuth } from "@/lib/userStore";

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

    return Response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        receivers: user.receivers,
      },
    });

  } catch (error) {
    console.error("Auth verification error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
