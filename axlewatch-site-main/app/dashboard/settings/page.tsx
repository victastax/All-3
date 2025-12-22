"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, Radio } from "lucide-react";

interface Receiver {
  id: string;
  deviceId: string;
  name: string;
  createdAt: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ deviceId: "" });
  const [error, setError] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("axlewatch-session");
    if (!token) {
      router.push("/login");
      return;
    }

    loadUser();
    loadReceivers();
  }, [router]);

  const loadUser = async () => {
    try {
      const token = localStorage.getItem("axlewatch-session");
      const res = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setUserEmail(data.user.email);
        setUserName(data.user.name);
      }
    } catch (err) {
      console.error("Failed to load user:", err);
    }
  };

  const loadReceivers = async () => {
    try {
      const token = localStorage.getItem("axlewatch-session");
      const res = await fetch("/api/receivers", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to load receivers");
      }

      const data = await res.json();
      setReceivers(data.receivers);
      setLoading(false);
    } catch (err) {
      console.error("Failed to load receivers:", err);
      setLoading(false);
    }
  };

  const handleAddReceiver = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const token = localStorage.getItem("axlewatch-session");
      const res = await fetch("/api/receivers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to add receiver");
        return;
      }

      setFormData({ deviceId: "" });
      setShowAddForm(false);
      loadReceivers();
    } catch (err) {
      setError("Failed to add receiver");
    }
  };

  const handleDeleteReceiver = async (id: string) => {
    if (!confirm("Are you sure you want to remove this receiver?")) {
      return;
    }

    try {
      const token = localStorage.getItem("axlewatch-session");
      const res = await fetch(`/api/receivers?id=${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        loadReceivers();
      }
    } catch (err) {
      console.error("Failed to delete receiver:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-neutral-600">
            Manage your AxleWatch receivers and account settings
          </p>
        </div>

        <Card className="rounded-2xl mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5" />
                My Receivers
              </CardTitle>
              <Button
                onClick={() => setShowAddForm(!showAddForm)}
                className="rounded-2xl"
                style={{ backgroundColor: "#d97706", color: "#fff" }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Receiver
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showAddForm && (
              <form
                onSubmit={handleAddReceiver}
                className="mb-6 p-4 bg-neutral-50 rounded-lg"
              >
                <h3 className="font-semibold mb-3">Add New Receiver</h3>
                {error && (
                  <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-3">
                    {error}
                  </div>
                )}
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">
                    Device ID (MAC Address)
                  </label>
                  <Input
                    type="text"
                    placeholder="AW-XXXXXXXXXXXX or XXXXXXXXXXXX"
                    value={formData.deviceId}
                    onChange={(e) =>
                      setFormData({ ...formData, deviceId: e.target.value })
                    }
                    required
                  />
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                    <strong>How to find your receiver MAC address:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Open your receiver's config portal at <code className="bg-blue-100 px-1 rounded">http://192.168.4.1</code></li>
                      <li>Look for the "Device ID" shown at the top (format: <code className="bg-blue-100 px-1 rounded">AW-XXXXXXXXXXXX</code>)</li>
                      <li>Enter the Device ID here, or just the MAC address part without the AW- prefix</li>
                    </ul>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    className="rounded-2xl"
                    style={{ backgroundColor: "#d97706", color: "#fff" }}
                  >
                    Add Receiver
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-2xl"
                    onClick={() => {
                      setShowAddForm(false);
                      setError("");
                      setFormData({ deviceId: "" });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {receivers.length === 0 ? (
              <div className="text-center py-8 text-neutral-600">
                <Radio className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No receivers added yet</p>
                <p className="text-sm">
                  Add your first receiver to start monitoring your fleet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {receivers.map((receiver) => (
                  <div
                    key={receiver.id}
                    className="flex items-center justify-between p-4 bg-white rounded-lg border"
                  >
                    <div>
                      <h4 className="font-semibold">{receiver.deviceId}</h4>
                      <p className="text-xs text-neutral-500">
                        Added {new Date(receiver.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDeleteReceiver(receiver.id)}
                      className="rounded-2xl"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <Input
                  type="email"
                  value={userEmail}
                  disabled
                  className="bg-neutral-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <Input
                  type="text"
                  value={userName}
                  disabled
                  className="bg-neutral-100"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
