import { NextRequest } from "next/server";
import { deleteSession } from "@/lib/userStore";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

    if (token) {
      await deleteSession(token);
    }

    return Response.json({ success: true });

  } catch (error) {
    console.error("Logout error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
