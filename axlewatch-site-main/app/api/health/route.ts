import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    endpoints: {
      signup: "/api/auth/signup (POST)",
      login: "/api/auth/login (POST)",
      me: "/api/auth/me (GET)",
      logout: "/api/auth/logout (POST)",
    },
    message: "AxleWatch Authentication API is running"
  });
}
