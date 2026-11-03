import "server-only";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";
import { writeStoredFile } from "@/lib/storage";

// Import EmailJS SDK (Node.js compatible)
try {
  var emailjs = require("@emailjs/nodejs");
} catch {
  var emailjs = null;
}

export type OutgoingEmail = {
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  attachment?: { filename: string; content: Buffer; contentType: string };
};

export type DeliveryMode = "EMAILJS" | "SMTP" | "DEV_OUTBOX";
export type Delivery = { mode: DeliveryMode; outboxPath: string | null };

/** 
 * Delivery mode priority:
 * 1. EmailJS (if configured)
 * 2. SMTP (if configured)
 * 3. DEV_OUTBOX (default)
 */
export function configuredMode(): DeliveryMode {
  const env = getEnv();
  if (emailjs && env.EMAILJS_SERVICE_ID && env.EMAILJS_TEMPLATE_ID && env.EMAILJS_PUBLIC_KEY) {
    return "EMAILJS";
  }
  return env.SMTP_HOST ? "SMTP" : "DEV_OUTBOX";
}

function message(email: OutgoingEmail) {
  return {
    from: email.from,
    to: email.to,
    cc: email.cc.length ? email.cc : undefined,
    subject: email.subject,
    text: email.text,
    attachments: email.attachment
      ? [{ filename: email.attachment.filename, content: email.attachment.content, contentType: email.attachment.contentType }]
      : [],
  };
}

async function deliverViaEmailJS(email: OutgoingEmail, env: ReturnType<typeof getEnv>): Promise<Delivery> {
  if (!emailjs) throw new Error("EmailJS SDK not available");

  try {
    emailjs.init(env.EMAILJS_PUBLIC_KEY);

    const templateParams = {
      to_email: email.to.join(", "),
      cc_email: email.cc.join(", "),
      from_email: email.from,
      subject: email.subject,
      message: email.text,
      has_attachment: email.attachment ? "Yes" : "No",
      attachment_name: email.attachment?.filename || "N/A",
    };

    await emailjs.send(env.EMAILJS_SERVICE_ID, env.EMAILJS_TEMPLATE_ID, templateParams);

    console.log(`✓ Email sent via EmailJS to ${email.to.join(", ")}`);
    return { mode: "EMAILJS", outboxPath: null };
  } catch (error) {
    console.error("EmailJS delivery failed:", error);
    throw error;
  }
}

async function deliverViaSMTP(email: OutgoingEmail, env: ReturnType<typeof getEnv>): Promise<Delivery> {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });

  try {
    await transporter.sendMail(message(email));
  } finally {
    transporter.close();
  }

  return { mode: "SMTP", outboxPath: null };
}

async function deliverViaDevOutbox(email: OutgoingEmail): Promise<Delivery> {
  // Dev outbox: build the exact message that SMTP would send and keep it on disk for inspection.
  const builder = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "lf" });
  const info = await builder.sendMail(message(email));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const relative = `outbox/${stamp}-${randomUUID().slice(0, 8)}.eml`;
  await writeStoredFile(relative, Buffer.from(info.message as Buffer));
  return { mode: "DEV_OUTBOX", outboxPath: relative };
}

export async function deliver(email: OutgoingEmail): Promise<Delivery> {
  const env = getEnv();
  const mode = configuredMode();

  switch (mode) {
    case "EMAILJS":
      return deliverViaEmailJS(email, env);
    case "SMTP":
      return deliverViaSMTP(email, env);
    case "DEV_OUTBOX":
    default:
      return deliverViaDevOutbox(email);
  }
}
