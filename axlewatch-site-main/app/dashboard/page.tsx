"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Thermometer,
  Radio,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import Link from "next/link";

interface Trailer {
  id: number;
  online: boolean;
  rssi: number;
  lastUpdate: number;
  ambientTemp: number;
  hubTemperatures: number[];
}

interface DataPoint {
  id: string;
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  satellites: number | null;
  trailers: Trailer[];
}

interface Receiver {
  id: string;
  deviceId: string;
  name: string;
  latestData: DataPoint | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [selectedReceiver, setSelectedReceiver] = useState<Receiver | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem("axlewatch-session");
    if (!token) {
      router.push("/login");
      return;
    }

    loadReceivers();
    // Refresh data every 30 seconds
    const interval = setInterval(loadReceivers, 30000);
    return () => clearInterval(interval);
  }, [router]);

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

      // Auto-select first receiver if none selected
      if (!selectedReceiver && data.receivers.length > 0) {
        setSelectedReceiver(data.receivers[0]);
      } else if (selectedReceiver) {
        // Update selected receiver with new data
        const updated = data.receivers.find((r: Receiver) => r.id === selectedReceiver.id);
        if (updated) {
          setSelectedReceiver(updated);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error("Failed to load receivers:", err);
      setLoading(false);
    }
  };

  const handleSelectReceiver = (receiver: Receiver) => {
    setSelectedReceiver(receiver);
  };

  const getMaxHubTemp = (trailers: Trailer[]) => {
    let max = 0;
    trailers.forEach((trailer) => {
      trailer.hubTemperatures.forEach((temp) => {
        if (temp > max) max = temp;
      });
    });
    return max;
  };

  const getAvgHubTemp = (trailers: Trailer[]) => {
    let sum = 0;
    let count = 0;
    trailers.forEach((trailer) => {
      trailer.hubTemperatures.forEach((temp) => {
        sum += temp;
        count++;
      });
    });
    return count > 0 ? (sum / count).toFixed(1) : "0";
  };

  const getTempStatus = (temp: number) => {
    if (temp > 80) return "text-red-600";
    if (temp > 60) return "text-amber-600";
    return "text-green-600";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-amber-600" />
          <p className="text-neutral-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (receivers.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="rounded-2xl max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <Radio className="h-16 w-16 mx-auto mb-4 text-neutral-400" />
            <h2 className="text-xl font-bold mb-2">No Receivers Yet</h2>
            <p className="text-neutral-600 mb-4">
              Add your first AxleWatch receiver to start monitoring your fleet.
            </p>
            <Link href="/dashboard/settings">
              <Button
                className="rounded-2xl"
                style={{ backgroundColor: "#d97706", color: "#fff" }}
              >
                Go to Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const defaultCenter = { lat: -30.5595, lng: 22.9375 }; // South Africa center
  const mapCenter = selectedReceiver?.latestData?.latitude &&
    selectedReceiver?.latestData?.longitude
    ? {
        lat: selectedReceiver.latestData.latitude,
        lng: selectedReceiver.latestData.longitude,
      }
    : defaultCenter;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Fleet Dashboard</h1>
        <p className="text-neutral-600">
          Monitor your fleet in real-time with live temperature and GPS data
        </p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6 mb-6">
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-600">
              Active Receivers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{receivers.length}</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-600">
              Total Trailers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {receivers.reduce(
                (sum, r) => sum + (r.latestData?.trailers.length || 0),
                0
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-600">
              Max Hub Temp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                selectedReceiver?.latestData
                  ? getTempStatus(
                      getMaxHubTemp(selectedReceiver.latestData.trailers)
                    )
                  : ""
              }`}
            >
              {selectedReceiver?.latestData
                ? `${getMaxHubTemp(selectedReceiver.latestData.trailers)}°C`
                : "N/A"}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-600">
              Avg Hub Temp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {selectedReceiver?.latestData
                ? `${getAvgHubTemp(selectedReceiver.latestData.trailers)}°C`
                : "N/A"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5" />
              Select Receiver
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {receivers.map((receiver) => (
                <button
                  key={receiver.id}
                  onClick={() => handleSelectReceiver(receiver)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedReceiver?.id === receiver.id
                      ? "bg-amber-50 border-amber-300"
                      : "bg-white hover:bg-neutral-50"
                  }`}
                >
                  <div className="font-semibold">{receiver.deviceId}</div>
                  {receiver.latestData && (
                    <div className="text-xs text-neutral-500 mt-1">
                      Last update:{" "}
                      {new Date(receiver.latestData.timestamp).toLocaleString()}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              GPS Location
              {selectedReceiver && ` - ${selectedReceiver.deviceId}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] rounded-lg overflow-hidden bg-neutral-100">
              <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}>
                <Map
                  defaultCenter={mapCenter}
                  defaultZoom={10}
                  mapId="axlewatch-map"
                  gestureHandling="greedy"
                >
                  {selectedReceiver?.latestData?.latitude &&
                    selectedReceiver?.latestData?.longitude && (
                      <Marker
                        position={{
                          lat: selectedReceiver.latestData.latitude,
                          lng: selectedReceiver.latestData.longitude,
                        }}
                      />
                    )}
                </Map>
              </APIProvider>
            </div>
            {selectedReceiver?.latestData && (
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-neutral-600">Speed:</span>{" "}
                  <span className="font-semibold">
                    {selectedReceiver.latestData.speed?.toFixed(1) || "0"} km/h
                  </span>
                </div>
                <div>
                  <span className="text-neutral-600">Coordinates:</span>{" "}
                  <span className="font-semibold">
                    {selectedReceiver.latestData.latitude?.toFixed(4)}, {selectedReceiver.latestData.longitude?.toFixed(4)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedReceiver?.latestData && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Thermometer className="h-5 w-5" />
              Hub Temperatures - {selectedReceiver.deviceId}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedReceiver.latestData.trailers.length === 0 ? (
              <p className="text-neutral-600 text-center py-8">
                No trailer data available
              </p>
            ) : (
              <div className="space-y-6">
                {selectedReceiver.latestData.trailers.map((trailer) => (
                  <div key={trailer.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">
                        Trailer #{trailer.id}
                        <span
                          className={`ml-2 text-xs ${
                            trailer.online ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {trailer.online ? "● Online" : "● Offline"}
                        </span>
                      </h3>
                      <div className="text-sm text-neutral-600">
                        Ambient: {trailer.ambientTemp}°C
                      </div>
                    </div>
                    <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                      {trailer.hubTemperatures.map((temp, idx) => (
                        <div
                          key={idx}
                          className="text-center p-3 bg-neutral-50 rounded-lg"
                        >
                          <div className="text-xs text-neutral-600 mb-1">
                            Hub {idx + 1}
                          </div>
                          <div className={`text-lg font-bold ${getTempStatus(temp)}`}>
                            {temp}°
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
