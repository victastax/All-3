"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Thermometer, LayoutDashboard, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

function DashboardNav() {
  const [userEmail, setUserEmail] = useState("");
  const pathname = usePathname();

  useEffect(() => {
    // Get user info from session
    const token = localStorage.getItem("axlewatch-session");
    if (token) {
      fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            setUserEmail(data.user.email);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleLogout = async () => {
    const token = localStorage.getItem("axlewatch-session");
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.error("Logout error:", error);
      }
    }
    localStorage.removeItem("axlewatch-session");
    window.location.href = "/";
  };

  return (
    <nav className="bg-white border-b">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <Thermometer className="h-6 w-6 text-amber-700" />
              <span className="text-xl font-bold">AxleWatch</span>
            </Link>
            <div className="flex gap-4">
              <Link
                href="/dashboard"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  pathname === "/dashboard"
                    ? "bg-amber-100 text-amber-900"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <Link
                href="/dashboard/settings"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  pathname === "/dashboard/settings"
                    ? "bg-amber-100 text-amber-900"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-neutral-600">
              {userEmail}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleLogout}
              className="rounded-2xl"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Log Out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <DashboardNav />
      {children}
    </div>
  );
}
