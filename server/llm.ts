import OpenAI from "openai";

// Initialize OpenAI client - uses OPENAI_API_KEY env variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export function isLLMConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// =====================
// 1. Website Analyzer
// =====================
export interface WebsiteAnalysis {
  appName: string;
  appDescription: string;
  primaryColor: string;
  isAppReady: boolean;
  issues: string[];
  suggestions: string[];
}

export async function analyzeWebsite(url: string, htmlContent: string): Promise<WebsiteAnalysis> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a website analyzer that helps convert websites into mobile apps. Analyze the provided website HTML and extract relevant information for creating a mobile app.

Return a JSON object with:
- appName: Suggested app name (short, catchy, based on the website brand/title)
- appDescription: A compelling app store description (max 150 chars)
- primaryColor: The primary brand color detected in hex format (e.g., "#3B82F6")
- isAppReady: Boolean - whether the website is suitable for conversion (responsive, no major issues)
- issues: Array of strings - any problems that might affect the app
- suggestions: Array of strings - recommendations for better app experience

Be concise and practical.`
      },
      {
        role: "user",
        content: `Analyze this website for mobile app conversion:
URL: ${url}

HTML Content (truncated):
${htmlContent.substring(0, 15000)}`
      }
    ],
    response_format: { type: "json_object" },
    max_tokens: 1000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  return JSON.parse(content) as WebsiteAnalysis;
}

// =====================
// 2. App Name Generator
// =====================
export interface AppNameSuggestions {
  suggestions: Array<{
    name: string;
    reason: string;
  }>;
}

export async function generateAppNames(websiteUrl: string, description: string): Promise<AppNameSuggestions> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a creative app naming expert. Generate catchy, memorable app names.

Return a JSON object with:
- suggestions: Array of 5 objects, each with:
  - name: The suggested app name (max 15 chars, no special characters)
  - reason: Brief explanation why this name works (max 50 chars)`
      },
      {
        role: "user",
        content: `Generate app name suggestions for:
Website: ${websiteUrl}
Description: ${description || "A mobile app version of the website"}`
      }
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  return JSON.parse(content) as AppNameSuggestions;
}

// =====================
// 3. App Description Enhancer
// =====================
export interface EnhancedDescription {
  enhanced: string;
  alternates: string[];
}

export async function enhanceAppDescription(originalDescription: string, appName: string): Promise<EnhancedDescription> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an app store copywriter. Enhance app descriptions to be compelling and professional.

Return a JSON object with:
- enhanced: The improved description (max 150 chars, engaging, highlights value)
- alternates: Array of 2 alternative descriptions (different tones: professional, casual)`
      },
      {
        role: "user",
        content: `Enhance this app description:
App Name: ${appName}
Original Description: ${originalDescription}`
      }
    ],
    response_format: { type: "json_object" },
    max_tokens: 400,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  return JSON.parse(content) as EnhancedDescription;
}

// =====================
// 4. Push Notification Generator
// =====================
export interface NotificationSuggestions {
  suggestions: Array<{
    title: string;
    body: string;
    purpose: string;
  }>;
}

export async function generatePushNotifications(appName: string, appDescription: string, context?: string): Promise<NotificationSuggestions> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a mobile marketing expert specializing in push notifications.

Return a JSON object with:
- suggestions: Array of 5 notification ideas, each with:
  - title: Notification title (max 50 chars, attention-grabbing)
  - body: Notification body (max 100 chars, clear call-to-action)
  - purpose: Brief description of when to send this (e.g., "Re-engagement", "New feature", "Promotion")`
      },
      {
        role: "user",
        content: `Generate push notification ideas for:
App Name: ${appName}
App Description: ${appDescription}
${context ? `Additional Context: ${context}` : ""}`
      }
    ],
    response_format: { type: "json_object" },
    max_tokens: 600,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  return JSON.parse(content) as NotificationSuggestions;
}

// =====================
// 5. Build Error Analyzer
// =====================
export interface BuildErrorAnalysis {
  summary: string;
  cause: string;
  solution: string;
  userAction: string;
  isUserFixable: boolean;
}

export async function analyzeBuildError(errorLogs: string, appInfo: { name: string; websiteUrl: string }): Promise<BuildErrorAnalysis> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a technical support specialist for a website-to-app conversion service. Analyze build errors and provide user-friendly explanations.

Return a JSON object with:
- summary: One-line summary of the error (non-technical, max 80 chars)
- cause: What likely caused this error (user-friendly explanation)
- solution: How to fix it (clear steps)
- userAction: What the user should do next (e.g., "Contact support", "Update website", "Try again")
- isUserFixable: Boolean - whether the user can fix this themselves`
      },
      {
        role: "user",
        content: `Analyze this build error:
App Name: ${appInfo.name}
Website URL: ${appInfo.websiteUrl}

Build Logs (last 5000 chars):
${errorLogs.slice(-5000)}`
      }
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  return JSON.parse(content) as BuildErrorAnalysis;
}

// =====================
// 6. Support Chatbot
// =====================
export interface ChatResponse {
  message: string;
  suggestedActions: string[];
  needsHuman: boolean;
  category?: string;
}

const SUPPORT_CONTEXT = `You are a helpful support assistant for Applyn, a service that converts websites into mobile apps.

Key information about the service:
- Users can convert any website into an Android or iOS app
- Pricing: Starter (₹499, 1 build), Standard (₹1499, 1 rebuild, push notifications), Pro (₹2999, 3 rebuilds, push notifications)
- Build process takes 5-15 minutes
- Users need a website URL to create an app
- Apps include splash screen customization, icon customization, and color theming
- Push notifications are available on Standard and Pro plans
- iOS builds require a GitHub account connection

Common issues and solutions:
- Build failed: Usually due to website not being mobile-responsive or having CORS issues
- App not loading: Website might be blocking WebView or have SSL issues
- Can't download: Build might still be in progress, check status
- Payment issues: Contact support with order ID

Be helpful, concise, and friendly. If you're unsure or the issue needs human attention, set needsHuman to true.`;

export async function supportChat(userMessage: string, conversationHistory: Array<{ role: "user" | "assistant"; content: string }>): Promise<ChatResponse> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: SUPPORT_CONTEXT },
    ...conversationHistory.slice(-10), // Keep last 10 messages for context
    { role: "user", content: userMessage }
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    response_format: { type: "json_object" },
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  // Parse with fallback
  try {
    const parsed = JSON.parse(content);
    return {
      message: parsed.message || content,
      suggestedActions: parsed.suggestedActions || [],
      needsHuman: parsed.needsHuman || false,
      category: parsed.category,
    };
  } catch {
    return {
      message: content,
      suggestedActions: [],
      needsHuman: false,
    };
  }
}

// =====================
// 7. Ticket Categorization
// =====================
export interface TicketCategorization {
  category: "billing" | "technical" | "feature_request" | "bug_report" | "general";
  priority: "low" | "medium" | "high" | "urgent";
  summary: string;
  suggestedResponse?: string;
}

export async function categorizeTicket(subject: string, message: string): Promise<TicketCategorization> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a support ticket categorization system for Applyn (website to app conversion service).

Return a JSON object with:
- category: One of "billing", "technical", "feature_request", "bug_report", "general"
- priority: One of "low", "medium", "high", "urgent"
  - urgent: Payment failed, app completely broken, time-sensitive
  - high: Build failures, can't access app, functionality issues
  - medium: Questions about features, minor issues
  - low: General inquiries, feedback
- summary: One-line summary of the issue (max 80 chars)
- suggestedResponse: A brief suggested response template (optional, if straightforward)`
      },
      {
        role: "user",
        content: `Categorize this support ticket:
Subject: ${subject}
Message: ${message}`
      }
    ],
    response_format: { type: "json_object" },
    max_tokens: 400,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  return JSON.parse(content) as TicketCategorization;
}
