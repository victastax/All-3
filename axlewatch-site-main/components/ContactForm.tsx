"use client";
import { useState } from "react";

export default function ContactForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
    company: "", // honeypot
  });
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setError(data?.error ?? "Something went wrong.");
        return;
      }
      setStatus("ok");
      setForm({ name: "", email: "", phone: "", message: "", company: "" });
    } catch {
      setStatus("error");
      setError("Network error. Please try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border p-4">
      {/* Honeypot (hidden) */}
      <input
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        value={form.company}
        onChange={(e) => setForm({ ...form, company: e.target.value })}
        placeholder="Company"
      />

      <input
        className="w-full rounded border p-2"
        placeholder="Your name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
      />
      <input
        type="email"
        className="w-full rounded border p-2"
        placeholder="Your email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        required
      />
      <input
        className="w-full rounded border p-2"
        placeholder="Phone (optional)"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />
      <textarea
        className="w-full rounded border p-2"
        placeholder="How can we help? Tell us about your fleet, what you’d like to monitor, or any questions."
        rows={6}
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        required
      />

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded bg-[#D97706] px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {status === "sending" ? "Sending..." : "Send"}
      </button>

      {status === "ok" && (
        <p className="text-green-600">Thanks—your enquiry has been sent.</p>
      )}
      {status === "error" && <p className="text-red-600">Error: {error}</p>}
    </form>
  );
}
