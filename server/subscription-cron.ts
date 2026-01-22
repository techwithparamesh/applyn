/**
 * Subscription Renewal Cron Jobs
 * 
 * This module handles:
 * 1. Expiring subscriptions that are past their expiry date
 * 2. Sending 7-day renewal reminder emails
 * 
 * Should be run daily via cron or as an interval in the main server.
 */

import { storage } from "./storage";
import { sendEmail, isEmailConfigured } from "./email";
import { getPlan } from "@shared/pricing";

const RENEWAL_REMINDER_DAYS = 7;

/**
 * Process subscription expirations
 * - Marks subscriptions as "expired" if past their expiry date
 */
export async function processExpirations(): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;

  try {
    const count = await storage.expireSubscriptions();
    processed = count;
    console.log(`[Subscription Cron] Expired ${count} subscriptions`);
  } catch (err) {
    const errorMsg = `Error processing expirations: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[Subscription Cron] ${errorMsg}`);
    errors.push(errorMsg);
  }

  return { processed, errors };
}

/**
 * Send renewal reminder emails
 * - Sends to users whose subscriptions expire within RENEWAL_REMINDER_DAYS
 */
export async function sendRenewalReminders(): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = [];
  let sent = 0;

  if (!isEmailConfigured()) {
    console.log("[Subscription Cron] Email not configured, skipping renewal reminders");
    return { sent: 0, errors: [] };
  }

  try {
    const users = await storage.getUsersWithExpiringSubscriptions(RENEWAL_REMINDER_DAYS);
    console.log(`[Subscription Cron] Found ${users.length} users with expiring subscriptions`);

    for (const user of users) {
      try {
        if (!user.username || !user.username.includes("@")) {
          // Username should be an email for this to work
          continue;
        }

        const planDetails = user.plan ? getPlan(user.plan as any) : null;
        const planName = planDetails?.name || user.plan || "your plan";
        const expiryDate = user.planExpiryDate ? new Date(user.planExpiryDate).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }) : "soon";

        const renewalUrl = process.env.BASE_URL 
          ? `${process.env.BASE_URL}/pricing` 
          : "https://applyn.in/pricing";

        await sendEmail({
          to: user.username,
          subject: `Your Applyn ${planName} subscription expires on ${expiryDate}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #6366f1;">Subscription Renewal Reminder</h2>
              <p>Hi ${user.name || "there"},</p>
              <p>Your <strong>${planName}</strong> subscription on Applyn will expire on <strong>${expiryDate}</strong>.</p>
              <p>To continue enjoying unlimited access to your apps and features, please renew your subscription before it expires.</p>
              
              <div style="margin: 30px 0;">
                <a href="${renewalUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Renew Subscription
                </a>
              </div>
              
              <p>What happens if your subscription expires:</p>
              <ul>
                <li>Your existing apps will continue to work</li>
                <li>You won't be able to rebuild or modify your apps</li>
                <li>Access to premium features will be suspended</li>
              </ul>
              
              <p>If you have any questions, please contact our support team.</p>
              
              <p style="color: #666; margin-top: 30px;">
                Best regards,<br>
                The Applyn Team
              </p>
            </div>
          `,
          text: `
Hi ${user.name || "there"},

Your ${planName} subscription on Applyn will expire on ${expiryDate}.

To continue enjoying unlimited access to your apps and features, please renew your subscription before it expires.

Renew here: ${renewalUrl}

What happens if your subscription expires:
- Your existing apps will continue to work
- You won't be able to rebuild or modify your apps
- Access to premium features will be suspended

If you have any questions, please contact our support team.

Best regards,
The Applyn Team
          `.trim(),
        });

        sent++;
        console.log(`[Subscription Cron] Sent renewal reminder to ${user.username}`);
      } catch (err) {
        const errorMsg = `Error sending reminder to ${user.username}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[Subscription Cron] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
  } catch (err) {
    const errorMsg = `Error fetching expiring subscriptions: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[Subscription Cron] ${errorMsg}`);
    errors.push(errorMsg);
  }

  return { sent, errors };
}

/**
 * Run all subscription cron jobs
 */
export async function runSubscriptionCron(): Promise<{
  expirations: { processed: number; errors: string[] };
  reminders: { sent: number; errors: string[] };
}> {
  console.log("[Subscription Cron] Starting subscription cron jobs...");
  
  const expirations = await processExpirations();
  const reminders = await sendRenewalReminders();

  console.log("[Subscription Cron] Completed subscription cron jobs");
  console.log(`  - Expirations processed: ${expirations.processed}`);
  console.log(`  - Reminders sent: ${reminders.sent}`);
  
  if (expirations.errors.length > 0 || reminders.errors.length > 0) {
    console.error("[Subscription Cron] Errors occurred:");
    [...expirations.errors, ...reminders.errors].forEach((e) => console.error(`  - ${e}`));
  }

  return { expirations, reminders };
}

// Interval in milliseconds (24 hours)
const CRON_INTERVAL_MS = 24 * 60 * 60 * 1000;

let cronInterval: NodeJS.Timeout | null = null;

/**
 * Start the subscription cron job as an interval
 * Runs immediately, then every 24 hours
 */
export function startSubscriptionCronInterval(): void {
  if (cronInterval) {
    console.log("[Subscription Cron] Cron interval already running");
    return;
  }

  console.log("[Subscription Cron] Starting subscription cron interval (runs every 24 hours)");

  // Run immediately
  runSubscriptionCron().catch((err) => {
    console.error("[Subscription Cron] Error running initial cron:", err);
  });

  // Then run every 24 hours
  cronInterval = setInterval(() => {
    runSubscriptionCron().catch((err) => {
      console.error("[Subscription Cron] Error running scheduled cron:", err);
    });
  }, CRON_INTERVAL_MS);
}

/**
 * Stop the subscription cron interval
 */
export function stopSubscriptionCronInterval(): void {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log("[Subscription Cron] Stopped subscription cron interval");
  }
}
