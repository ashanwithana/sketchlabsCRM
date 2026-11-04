import "server-only";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";
import { writeStoredFile } from "@/lib/storage";

export type OutgoingEmail = {
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  attachment?: { filename: string; content: Buffer; contentType: string };
};

export type DeliveryMode = "SMTP" | "DEV_OUTBOX";
export type Delivery = { mode: DeliveryMode; outboxPath: string | null };

/** SMTP when SMTP_HOST is set. Otherwise the message is written to storage/outbox as an .eml file. */
export function configuredMode(): DeliveryMode {
  return getEnv().SMTP_HOST ? "SMTP" : "DEV_OUTBOX";
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

export async function deliver(email: OutgoingEmail): Promise<Delivery> {
  const env = getEnv();

  if (env.SMTP_HOST) {
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

  // Dev outbox: build the exact message that SMTP would send and keep it on disk for inspection.
  const builder = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "lf" });
  const info = await builder.sendMail(message(email));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const relative = `outbox/${stamp}-${randomUUID().slice(0, 8)}.eml`;
  await writeStoredFile(relative, Buffer.from(info.message as Buffer));
  return { mode: "DEV_OUTBOX", outboxPath: relative };
}
