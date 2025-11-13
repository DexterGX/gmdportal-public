import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { google } from "googleapis";

const { OAuth2 } = google.auth;

async function sendResetEmail(to: string, resetUrl: string) {
  const GMAIL_USER = process.env.GMAIL_USER;
  const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
  const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
  const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

  if (!GMAIL_USER || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    // Env not configured: fallback to logging the URL for manual testing
    console.warn("Gmail env vars not configured, logging reset URL instead.");
    console.log(`Reset URL for ${to}: ${resetUrl}`);
    return;
  }

  const oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

  const accessTokenRes = await oauth2Client.getAccessToken();
  const accessToken = (accessTokenRes as any)?.token || accessTokenRes;
  // Debug: report whether we obtained an access token (length only — never log tokens)
  try {
    console.log(
      "Gmail OAuth: access token present?",
      accessToken ? true : false,
      "length:",
      accessToken ? String(accessToken).length : 0
    );
  } catch (e) {
    /* ignore */
  }

  if (!accessToken) {
    throw new Error(
      "Failed to obtain OAuth access token for Gmail. Check CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN and that the refresh token is valid."
    );
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: GMAIL_USER,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      refreshToken: REFRESH_TOKEN,
      accessToken,
    },
  });

  const mailOptions = {
    // Send 'From' as the domain alias/alternate address. Make sure this
    // alias is authorized in Google Workspace (user must be allowed to send as it).
    from: `"GM Design Portal" <info@gmdesignusa.com>`,
    to,
    subject: "GM Design Portal — Password reset",
    replyTo: GMAIL_USER, // replies will go to the actual mailbox that owns the OAuth token
    envelope: {
      from: "info@gmdesignusa.com",
      to,
    },
    html: `
      <p>You requested to reset your password for GM Design Portal.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>If you didn't request this, ignore this email.</p>
    `,
  };

  console.log(
    "Sending reset email with From: info@gmdesignusa.com (reply-to:",
    GMAIL_USER,
    ")"
  );
  const info = await transporter.sendMail(mailOptions);
  console.log("Reset email sent:", info?.messageId || info);
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ message: "Invalid email" }, { status: 400 });
    }

    // Find user by email (case-insensitive)
    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond with a generic message to avoid user enumeration
    const genericMessage = "If that email exists, a reset link has been sent.";

    if (!user) {
      console.log(`Password reset requested for non-existing email: ${email}`);
      return NextResponse.json({ message: genericMessage });
    }

    // Generate token and store its hash in DB
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: tokenHash, resetTokenExpiry: expiry },
    });

    const resetUrl = `${
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    }/reset/confirm?token=${token}`;

    // Send reset email (or log the URL if env not configured)
    try {
      await sendResetEmail(email, resetUrl);
    } catch (sendErr) {
      console.error("Failed to send reset email:", sendErr);
      // still return generic message to client
    }

    return NextResponse.json({ message: genericMessage });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
