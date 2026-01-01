import { NextRequest } from "next/server";
import { createUser, createSession } from "@/lib/userStore";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    // Validation
    if (!name || !email || !password) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return Response.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Create user
    let user;
    try {
      user = await createUser(name, email, password);
    } catch (error) {
      if (error instanceof Error && error.message === "User already exists") {
        return Response.json(
          { error: "An account with this email already exists" },
          { status: 409 }
        );
      }
      throw error;
    }

    // Create session
    const session = await createSession(user.id);

    return Response.json({
      success: true,
      token: session.token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });

  } catch (error) {
    console.error("Signup error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
