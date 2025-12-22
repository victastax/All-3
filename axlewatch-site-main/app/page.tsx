"use client";

import React, { useMemo, useState } from "react";
import {
  Check,
  Thermometer,
  Radio,
  Activity,
  Bell,
  Truck,
  Cpu,
  Wifi,
  HardDrive,
  PlayCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import ContactForm from "../components/ContactForm"; // ✅ new import

export default function Page() {
  const [showDiag, setShowDiag] = useState(false);
  const conceptImagePath = "/AxleWatch-hero.png";

  const diagnostics = useMemo(() => {
    const results: Array<{ name: string; pass: boolean; note?: string }> = [];
    const imgLooksValid =
      typeof conceptImagePath === "string" &&
      conceptImagePath.length > 0 &&
      /\.(png|jpg|jpeg|webp)$/i.test(conceptImagePath);
    results.push({
      name: "Concept image path valid extension",
      pass: imgLooksValid,
      note: conceptImagePath,
    });
    try {
      const _el = Feature({ icon: null, title: "T", desc: "D" });
      results.push({ name: "Feature component creatable", pass: !!_el });
    } catch (e: any) {
      results.push({
        name: "Feature component creatable",
        pass: false,
        note: String(e?.message || e),
      });
    }
    try {
      const price = Number(18);
      const ok = Number.isFinite(price) && price > 0;
      results.push({
        name: "Price number invariant",
        pass: ok,
        note: ok ? "18" : "Invalid",
      });
    } catch (e: any) {
      results.push({
        name: "Price number invariant",
        pass: false,
        note: String(e?.message || e),
      });
    }
    return results;
  }, [conceptImagePath]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header Navigation */}
      <header className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Thermometer className="h-8 w-8 text-amber-600" />
              <span className="text-2xl font-bold text-neutral-900">AxleWatch</span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" asChild>
                <a href="/login">Log In</a>
              </Button>
              <Button
                asChild
                style={{ backgroundColor: "#d97706", color: "#fff" }}
              >
                <a href="/signup">Sign Up</a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_-10%,#fed7aa_0%,transparent_60%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm text-amber-800">
              <PlayCircle className="h-4 w-4" /> Live pilot expressions of
              interest now open
            </div>
            <h1 className="mt-6 text-4xl sm:text-5xl font-extrabold tracking-tight">
              Monitoring heat.{" "}
              <span className="text-amber-700">Protecting the fleet.</span>
            </h1>
            <p className="mt-4 text-lg text-neutral-700 max-w-xl">
              AxleWatch protects your drivers, cargo, and assets with early heat detection.
              Catch bearing failures and brake issues before they destroy your equipment
              or leave you stranded in the outback.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button
                className="rounded-2xl"
                style={{ backgroundColor: "#d97706", color: "#fff" }}
              >
                <a href="#contact">Contact us</a>
              </Button>
              <Button className="rounded-2xl" variant="secondary">
                <a href="#hardware">View hardware</a>
              </Button>
            </div>
            <div className="mt-6 flex items-center gap-6 text-sm text-neutral-600">
              <div className="flex items-center gap-2">
                <ShieldIcon /> Prevent catastrophic failures
              </div>
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4" /> Keep your fleet moving
              </div>
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" /> Instant driver alerts
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[16/10] rounded-2xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden grid place-items-center">
              <img
                src={conceptImagePath}
                alt="AxleWatch concept graphic — temperature-monitored trailer"
                className="object-contain w-full h-full"
                loading="eager"
              />
            </div>
            <p className="mt-3 text-center text-sm text-neutral-600">
              AxleWatch concept illustration — temperature-monitored trailer
            </p>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="py-16 border-t border-neutral-200 bg-white"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight">
            Protect what matters most
          </h2>
          <p className="mt-2 text-neutral-600 max-w-2xl">
            Every minute of downtime costs you money. Every fire destroys assets.
            AxleWatch catches problems early so you can fix them before disaster strikes.
          </p>
          <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Feature
              icon={<Bell />}
              title="Stop fires before they happen"
              desc="Get instant alerts when hubs overheat. Pull over and fix the problem before flames destroy your trailer, cargo, and livelihood."
            />
            <Feature
              icon={<Truck />}
              title="Eliminate costly breakdowns"
              desc="Catch bearing failures early and schedule maintenance on your terms — not on the side of the road waiting for a tow."
            />
            <Feature
              icon={<Activity />}
              title="Protect your drivers"
              desc="Keep your team safe with real-time warnings. No more discovering a fire after it's too late to stop it."
            />
            <Feature
              icon={<Thermometer />}
              title="Save thousands in repairs"
              desc="A seized bearing can destroy an entire axle assembly. Early detection means fixing a $200 bearing instead of a $10,000+ repair."
            />
            <Feature
              icon={<HardDrive />}
              title="Prove what happened"
              desc="Temperature, GPS, and speed data logs provide evidence for insurance claims and incident investigations."
            />
            <Feature
              icon={<Radio />}
              title="Monitor your whole fleet"
              desc="Track multiple trailers at once. Know the health of every asset in real-time, even across road-trains."
            />
          </div>
        </div>
      </section>

      <section id="about" className="py-16 border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight">About AxleWatch</h2>
          <div className="mt-8 max-w-3xl">
            <div className="space-y-4 text-neutral-700 leading-relaxed">
              <p>
                With over 15 years of experience as a field service mechanic across the Goldfields of Western Australia, Nick has seen firsthand what heat can do to heavy vehicles. From collapsed wheel bearings and seized brake components to the occasional truck fire, the pattern was always the same — excess heat, downtime, and costly repairs.
              </p>
              <p>
                To manage the risk, transport companies began having their operators manually record hub temperatures at every stop. But this process was slow, inconsistent, and often too late.
              </p>
              <p>
                Driven to create a better way, Nick developed AxleWatch — a system that continuously monitors brake and bearing temperatures in real time. Built for reliability and simplicity, AxleWatch eliminates guesswork, helping operators prevent damage before it happens.
              </p>
              <p className="font-semibold text-neutral-900">
                It's a solution built in the field, by someone who's been there.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="hardware" className="py-16 border-t border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <h2 className="text-3xl font-bold tracking-tight">
              Built to survive the outback
            </h2>
            <p className="text-sm text-neutral-600">
              Rugged, reliable, and ready for extreme conditions
            </p>
          </div>
          <div className="mt-8 grid lg:grid-cols-2 gap-6">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" /> Trailer Transmitter
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-neutral-700">
                <ul className="grid sm:grid-cols-2 gap-2">
                  {[
                    "Monitors all hubs on your trailer",
                    "Works with any 12–48V vehicle",
                    "Long-range signal to the cab",
                    "Battery backup for reliability",
                    "Weatherproof and dust-sealed",
                    "Easy trailer identification",
                  ].map((t, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 text-emerald-600" />
                      {t}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Thermometer className="h-5 w-5" /> In-Cab Receiver
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-neutral-700">
                <ul className="grid sm:grid-cols-2 gap-2">
                  {[
                    "Clear visual alerts you can't miss",
                    "Loud alarm for immediate attention",
                    "Monitors entire road-train fleet",
                    "Records proof for insurance claims",
                    "Simple touch-screen interface",
                    "Keeps working without internet",
                  ].map((t, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 text-emerald-600" />
                      {t}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ✅ Updated Contact section */}
      <section id="contact" className="py-16 border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight">Contact</h2>
          <p className="mt-2 text-neutral-600">
            Send us an enquiry — we’ll get back to you promptly.
          </p>
          <div className="mt-8 grid md:grid-cols-2 gap-6">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Send an enquiry</CardTitle>
              </CardHeader>
              <CardContent>
                <ContactForm /> {/* ✅ replaces old static form */}
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Fast facts</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-neutral-700 space-y-2">
                <p>
                  <b>HQ:</b> Western Australia
                </p>
                <p>
                  <b>Prevents:</b> Trailer fires, bearing seizures, brake failures,
                  roadside breakdowns, cargo loss, and expensive emergency repairs.
                </p>
                <p>
                  <b>Saves you:</b> Downtime costs, towing fees, insurance premiums,
                  asset replacement, and lost business from unreliable equipment.
                </p>
                <p>
                  <b>Support:</b>{" "}
                  <a className="underline" href="mailto:info@axlewatch.com">
                    info@axlewatch.com
                  </a>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <footer className="py-10 border-t border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-sm text-neutral-600 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4" />
            <span>
              © {new Date().getFullYear()} AxleWatch Pty Ltd. All rights
              reserved.
            </span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-neutral-900">
              Terms
            </a>
            <a href="#" className="hover:text-neutral-900">
              Privacy
            </a>
            <a href="#contact" className="hover:text-neutral-900">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="h-8 w-8 rounded-xl bg-amber-100 grid place-items-center text-amber-700">
            {icon}
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-neutral-700">{desc}</p>
      </CardContent>
    </Card>
  );
}

function ShieldIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      <path
        d="M12 3l7 4v5c0 5-3.5 9-7 9s-7-4-7-9V7l7-4z"
        strokeWidth="2"
      />
      <path d="M9 12l2 2 4-4" strokeWidth="2" />
    </svg>
  );
}

