import { Resend } from "resend";

export const runtime = "nodejs";

// Use the installed SDK signature (string), and trim env var just in case
const resend = new Resend((process.env.RESEND_API_KEY || "").trim());

function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(req: Request) {
  try {
    const { name, email, phone, message, company } = await req.json();

    // Honeypot
    if (company) return Response.json({ ok: true });

    if (!name || !email || !message) {
      return Response.json({ error: "Missing required fields." }, { status: 400 });
    }

    // TEMP: use Resend's onboarding sender to isolate auth problems from domain/DKIM
    const from = "AxleWatch <onboarding@resend.dev>";
    // After it works, change to: "AxleWatch Website <info@axlewatch.com>"

    // In Resend sandbox mode, you can only send to your verified email.
    // Set RESEND_TO_EMAIL env var to change recipient (default: nickbould@gmail.com)
    // For production: verify domain at resend.com/domains, then update from/to addresses
    const to = process.env.RESEND_TO_EMAIL || "nickbould@gmail.com";

    const result = await resend.emails.send({
      from,
      to: [to],
      replyTo: email, // SDK uses camelCase
      subject: `Website enquiry from ${name}${phone ? ` (${phone})` : ""}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6">
          <h2>New AxleWatch enquiry</h2>
          <p><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          ${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ""}
          <p><strong>Message:</strong></p>
          <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
        </div>
      `,
      text: `New AxleWatch enquiry

Name: ${name}
Email: ${email}
${phone ? `Phone: ${phone}\n` : ""}Message:
${message}
`,
    });

    // The SDK returns { data, error }
    if (result.error) {
      // Surface provider error to the client so we can see what's wrong
      return Response.json(
        { error: result.error.message || "Email provider error." },
        { status: 502 }
      );
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    // Show server error with a hint if the key was empty at runtime
    const hasKey = !!(process.env.RESEND_API_KEY || "").trim();
    return Response.json(
      { error: `Server error. Key present: ${hasKey}. ${e?.message || ""}`.trim() },
      { status: 500 }
    );
  }
}
