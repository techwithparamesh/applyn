/**
 * Email Service - Sends transactional emails
 * 
 * Uses nodemailer with configurable SMTP settings.
 * Falls back to console logging if SMTP is not configured.
 */

import nodemailer from "nodemailer";

// SMTP Configuration from environment
const smtpHost = process.env.SMTP_HOST || "";
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpUser = process.env.SMTP_USER || "";
const smtpPass = process.env.SMTP_PASS || "";
const smtpFrom = process.env.SMTP_FROM || "noreply@applyn.co.in";
const smtpSecure = process.env.SMTP_SECURE === "true"; // true for 465, false for others

/**
 * Check if SMTP is configured
 */
export function isEmailConfigured(): boolean {
  return !!(smtpHost && smtpUser && smtpPass);
}

/**
 * Create nodemailer transporter (cached singleton)
 */
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!isEmailConfigured()) return null;
  
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }
  
  return transporter;
}

/**
 * Send an email
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}): Promise<boolean> {
  const transport = getTransporter();
  
  if (!transport) {
    // SMTP not configured - log to console for development
    console.log(`[EMAIL - DEV MODE] Would send email:`);
    console.log(`  To: ${options.to}`);
    console.log(`  Subject: ${options.subject}`);
    console.log(`  Body: ${options.text || options.html}`);
    return true; // Return true for dev mode
  }

  try {
    await transport.sendMail({
      from: smtpFrom,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    console.log(`[EMAIL] Sent to ${options.to}: ${options.subject}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL] Failed to send to ${options.to}:`, error);
    return false;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<boolean> {
  const subject = "Reset your Applyn password";
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🔐 Password Reset</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Hi there,</p>
    
    <p>We received a request to reset your password for your Applyn account. Click the button below to set a new password:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Reset Password
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">This link will expire in <strong>1 hour</strong>.</p>
    
    <p style="color: #6b7280; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
      If the button doesn't work, copy and paste this link:<br>
      <a href="${resetUrl}" style="color: #6366f1; word-break: break-all;">${resetUrl}</a>
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} Applyn. All rights reserved.</p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Reset Your Password

Hi there,

We received a request to reset your password for your Applyn account.

Click the link below to set a new password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

---
© ${new Date().getFullYear()} Applyn. All rights reserved.
  `.trim();

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
}

/**
 * Send welcome email after registration
 */
export async function sendWelcomeEmail(email: string, name?: string): Promise<boolean> {
  const subject = "Welcome to Applyn! 🎉";
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Welcome to Applyn!</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Hi${name ? ` ${name}` : ""},</p>
    
    <p>Thank you for signing up for Applyn! We're excited to help you convert your website into a mobile app.</p>
    
    <p><strong>Here's what you can do next:</strong></p>
    <ul>
      <li>Create your first app from your website URL</li>
      <li>Customize your app's name and icon</li>
      <li>Download APK (Android) or IPA (iOS) files</li>
    </ul>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.APP_URL || 'https://applyn.co.in'}/dashboard" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Go to Dashboard
      </a>
    </div>
    
    <p>If you have any questions, feel free to reach out to our support team.</p>
    
    <p>Best regards,<br>The Applyn Team</p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} Applyn. All rights reserved.</p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Welcome to Applyn!

Hi${name ? ` ${name}` : ""},

Thank you for signing up for Applyn! We're excited to help you convert your website into a mobile app.

Here's what you can do next:
- Create your first app from your website URL
- Customize your app's name and icon
- Download APK (Android) or IPA (iOS) files

Visit your dashboard: ${process.env.APP_URL || 'https://applyn.co.in'}/dashboard

If you have any questions, feel free to reach out to our support team.

Best regards,
The Applyn Team

---
© ${new Date().getFullYear()} Applyn. All rights reserved.
  `.trim();

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
}

/**
 * Send welcome email to a new team member (admin/support) with credentials
 */
export async function sendTeamMemberWelcomeEmail(
  email: string, 
  tempPassword: string, 
  role: "admin" | "support",
  invitedBy?: string
): Promise<boolean> {
  const appUrl = process.env.APP_URL || "https://applyn.co.in";
  const loginUrl = `${appUrl}/login`;
  
  const roleLabel = role === "admin" ? "Administrator" : "Support Team Member";
  const roleDescription = role === "admin" 
    ? "As an Admin, you have full access to all features including user management, app management, and team settings."
    : "As a Support team member, you can view and respond to support tickets, access build logs, and help users troubleshoot issues.";

  const subject = `🎉 Welcome to Applyn - You've been added as ${role === "admin" ? "an Admin" : "a Support Team Member"}!`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🚀 Welcome to Applyn!</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">You've been added as ${roleLabel}</p>
  </div>
  
  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="font-size: 16px; color: #374151;">Hi there,</p>
    
    ${invitedBy ? `<p style="color: #6b7280;">You've been invited by <strong style="color: #374151;">${invitedBy}</strong> to join the Applyn team.</p>` : ""}
    
    <p style="color: #374151;">${roleDescription}</p>
    
    <div style="background: linear-gradient(135deg, #f0f9ff 0%, #faf5ff 100%); border: 1px solid #e0e7ff; border-radius: 12px; padding: 24px; margin: 24px 0;">
      <h3 style="margin: 0 0 16px 0; color: #1e40af; font-size: 16px;">🔑 Your Login Credentials</h3>
      
      <div style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Email / Username</p>
        <p style="margin: 4px 0 0 0; color: #111827; font-size: 16px; font-weight: 600;">${email}</p>
      </div>
      
      <div style="background: white; border-radius: 8px; padding: 16px;">
        <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Temporary Password</p>
        <p style="margin: 4px 0 0 0; color: #111827; font-size: 18px; font-family: 'Courier New', monospace; font-weight: 600; letter-spacing: 1px;">${tempPassword}</p>
      </div>
    </div>

    <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        <strong>⚠️ Important:</strong> For security, you'll be asked to change your password when you first log in. Please use a strong, unique password.
      </p>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${loginUrl}" style="background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 10px; font-weight: 600; display: inline-block; font-size: 16px; box-shadow: 0 4px 14px rgba(6, 182, 212, 0.3);">
        Login to Applyn →
      </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
    
    <h3 style="color: #374151; margin: 0 0 16px 0; font-size: 16px;">📋 How to Change Your Password</h3>
    <ol style="color: #6b7280; padding-left: 20px; margin: 0;">
      <li style="margin-bottom: 8px;">Go to <a href="${loginUrl}" style="color: #06b6d4;">${loginUrl}</a></li>
      <li style="margin-bottom: 8px;">Enter your email and the temporary password above</li>
      <li style="margin-bottom: 8px;">You'll be redirected to set a new password</li>
      <li style="margin-bottom: 8px;">Choose a strong password (8+ characters, mix of letters and numbers)</li>
      <li>You're all set! 🎉</li>
    </ol>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
    
    <p style="color: #9ca3af; font-size: 13px; margin: 0;">
      If you have any questions or didn't expect this email, please contact your administrator.
    </p>
  </div>
  
  <div style="text-align: center; padding: 24px; color: #9ca3af; font-size: 12px; background: #f9fafb; border-radius: 0 0 16px 16px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="margin: 0;">© ${new Date().getFullYear()} Applyn. All rights reserved.</p>
    <p style="margin: 8px 0 0 0;">Convert your website to a mobile app in minutes.</p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Welcome to Applyn!

You've been added as ${roleLabel}.

${invitedBy ? `You've been invited by ${invitedBy} to join the Applyn team.` : ""}

${roleDescription}

YOUR LOGIN CREDENTIALS
======================
Email/Username: ${email}
Temporary Password: ${tempPassword}

IMPORTANT: For security, you'll be asked to change your password when you first log in.

HOW TO LOGIN
============
1. Go to ${loginUrl}
2. Enter your email and the temporary password above
3. You'll be redirected to set a new password
4. Choose a strong password (8+ characters, mix of letters and numbers)
5. You're all set!

If you have any questions or didn't expect this email, please contact your administrator.

---
© ${new Date().getFullYear()} Applyn. All rights reserved.
Convert your website to a mobile app in minutes.
  `.trim();

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
}

/**
 * Send email verification email
 */
export async function sendEmailVerificationEmail(email: string, verifyUrl: string, name?: string): Promise<boolean> {
  const subject = "Verify your Applyn email address";
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">✉️ Verify Your Email</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Hi${name ? ` ${name}` : ""},</p>
    
    <p>Thanks for signing up for Applyn! Please verify your email address by clicking the button below:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verifyUrl}" style="background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Verify Email Address
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">This link will expire in <strong>24 hours</strong>.</p>
    
    <p style="color: #6b7280; font-size: 14px;">If you didn't create an account on Applyn, you can safely ignore this email.</p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
      If the button doesn't work, copy and paste this link:<br>
      <a href="${verifyUrl}" style="color: #06b6d4; word-break: break-all;">${verifyUrl}</a>
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} Applyn. All rights reserved.</p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Verify Your Email Address

Hi${name ? ` ${name}` : ""},

Thanks for signing up for Applyn! Please verify your email address by clicking the link below:

${verifyUrl}

This link will expire in 24 hours.

If you didn't create an account on Applyn, you can safely ignore this email.

---
© ${new Date().getFullYear()} Applyn. All rights reserved.
  `.trim();

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
}

/**
 * Send build completion notification email
 */
export async function sendBuildCompleteEmail(
  email: string,
  appName: string,
  status: "success" | "failed",
  dashboardUrl: string,
  errorMessage?: string
): Promise<boolean> {
  const isSuccess = status === "success";
  const subject = isSuccess
    ? `🎉 Your app "${appName}" is ready!`
    : `❌ Build failed for "${appName}"`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${isSuccess ? 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' : 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)'}; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${isSuccess ? '🎉 Build Complete!' : '❌ Build Failed'}</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Hi there,</p>
    
    ${isSuccess ? `
    <p>Great news! Your app <strong>${appName}</strong> has been successfully built and is ready for download.</p>
    
    <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; color: #065f46;">✓ APK file is ready for Android</p>
    </div>
    
    <p>You can now:</p>
    <ul>
      <li>Download your APK file</li>
      <li>Test on your Android device</li>
      <li>Submit to Google Play Store (paid plans)</li>
    </ul>
    ` : `
    <p>Unfortunately, there was an issue building your app <strong>${appName}</strong>.</p>
    
    ${errorMessage ? `
    <div style="background: #fef2f2; border: 1px solid #ef4444; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0; color: #991b1b; font-weight: 600;">Error Details:</p>
      <p style="margin: 0; color: #7f1d1d; font-family: monospace; font-size: 13px;">${errorMessage}</p>
    </div>
    ` : ''}
    
    <p>Common fixes:</p>
    <ul>
      <li>Ensure your website URL is accessible</li>
      <li>Check if the site loads correctly on mobile</li>
      <li>Try rebuilding the app</li>
    </ul>
    `}
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${dashboardUrl}" style="background: ${isSuccess ? 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' : 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)'}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        ${isSuccess ? 'Download Your App' : 'View Details & Retry'}
      </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    
    <p style="color: #6b7280; font-size: 14px;">
      Need help? <a href="mailto:support@applyn.co.in" style="color: #06b6d4;">Contact our support team</a>
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} Applyn. All rights reserved.</p>
  </div>
</body>
</html>
  `.trim();

  const text = `
${isSuccess ? 'Build Complete!' : 'Build Failed'}

Hi there,

${isSuccess
    ? `Great news! Your app "${appName}" has been successfully built and is ready for download.`
    : `Unfortunately, there was an issue building your app "${appName}".`
  }

${errorMessage ? `Error: ${errorMessage}` : ''}

Visit your dashboard to ${isSuccess ? 'download your app' : 'view details and retry'}:
${dashboardUrl}

---
© ${new Date().getFullYear()} Applyn. All rights reserved.
  `.trim();

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
}

/**
 * Send account locked notification email
 */
export async function sendAccountLockedEmail(
  email: string,
  unlockTime: Date
): Promise<boolean> {
  const subject = "🔒 Your Applyn account has been temporarily locked";
  const unlockTimeStr = unlockTime.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🔒 Account Temporarily Locked</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Hi there,</p>
    
    <p>Your Applyn account has been temporarily locked due to multiple failed login attempts.</p>
    
    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; color: #92400e;">
        Your account will be automatically unlocked at:<br>
        <strong>${unlockTimeStr}</strong>
      </p>
    </div>
    
    <p>If this wasn't you, we recommend:</p>
    <ul>
      <li>Resetting your password after the lockout period</li>
      <li>Using a strong, unique password</li>
      <li>Enabling two-factor authentication (coming soon)</li>
    </ul>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    
    <p style="color: #6b7280; font-size: 14px;">
      If you believe this is an error, please <a href="mailto:support@applyn.co.in" style="color: #06b6d4;">contact support</a>.
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} Applyn. All rights reserved.</p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Account Temporarily Locked

Hi there,

Your Applyn account has been temporarily locked due to multiple failed login attempts.

Your account will be automatically unlocked at: ${unlockTimeStr}

If this wasn't you, we recommend resetting your password after the lockout period.

If you believe this is an error, please contact support@applyn.co.in.

---
© ${new Date().getFullYear()} Applyn. All rights reserved.
  `.trim();

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
}