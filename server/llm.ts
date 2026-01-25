import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// =====================
// Provider Configuration
// =====================
// Set LLM_PROVIDER env to "openai" or "claude" (default: claude)
// Required env vars:
// - For OpenAI: OPENAI_API_KEY
// - For Claude: ANTHROPIC_API_KEY

type LLMProvider = "openai" | "claude";

function getProvider(): LLMProvider {
  const provider = (process.env.LLM_PROVIDER || "claude").toLowerCase();
  if (provider === "openai") return "openai";
  return "claude";
}

// Initialize clients lazily
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

export function isLLMConfigured(): boolean {
  const provider = getProvider();
  if (provider === "openai") {
    return !!process.env.OPENAI_API_KEY;
  }
  return !!process.env.ANTHROPIC_API_KEY;
}

export function getLLMProvider(): string {
  return getProvider();
}

// =====================
// Unified Chat Completion
// =====================
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CompletionOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  jsonMode?: boolean;
}

async function complete(options: CompletionOptions): Promise<string> {
  const { messages, maxTokens = 1000, jsonMode = true } = options;
  const provider = getProvider();

  if (provider === "openai") {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: maxTokens,
      ...(jsonMode && { response_format: { type: "json_object" } }),
    });
    return response.choices[0]?.message?.content || "";
  } else {
    // Claude
    const anthropic = getAnthropic();
    
    // Extract system message for Claude (it uses a separate system parameter)
    const systemMessage = messages.find(m => m.role === "system")?.content || "";
    const chatMessages = messages
      .filter(m => m.role !== "system")
      .map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // For JSON mode with Claude, we add instruction to the system prompt
    const systemWithJson = jsonMode 
      ? `${systemMessage}\n\nIMPORTANT: You must respond with valid JSON only. No markdown, no code blocks, just raw JSON.`
      : systemMessage;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemWithJson,
      messages: chatMessages,
    });

    // Extract text content from Claude response
    const textBlock = response.content.find(block => block.type === "text");
    return textBlock?.type === "text" ? textBlock.text : "";
  }
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
  const content = await complete({
    messages: [
      {
        role: "system",
        content: `You are a website analyzer that helps convert websites into mobile apps. Analyze the provided website HTML and extract relevant information for creating a mobile app.

Return a JSON object with:
- appName: Suggested app name (short, catchy, based on the website brand/title)
- appDescription: A compelling app store description (max 150 chars)
- primaryColor: The primary brand color detected in hex format (e.g., "#3B82F6"). Look for colors in CSS, meta theme-color, or brand elements.
- isAppReady: Boolean - true if website can be converted (most websites can). Only false for completely broken sites.
- issues: Array of strings - ONLY list critical issues that would actually break the mobile app experience. Do NOT list:
  * SPA/React/Vue detection (these work fine in WebView)
  * Development tools (user may be testing locally)
  * SEO concerns (not relevant for apps)
  * Client-side rendering (normal for modern sites)
  Keep this array SHORT (0-2 items max). Only real problems like: mixed content, login walls, geo-blocks.
- suggestions: Array of strings - helpful tips for better mobile experience (max 2)

Be POSITIVE and encouraging. Most websites work great as apps.`
      },
      {
        role: "user",
        content: `Analyze this website for mobile app conversion:
URL: ${url}

HTML Content (truncated):
${htmlContent.substring(0, 15000)}`
      }
    ],
    maxTokens: 1000,
  });

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
  const content = await complete({
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
    maxTokens: 500,
  });

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
  const content = await complete({
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
    maxTokens: 400,
  });

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
  const content = await complete({
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
    maxTokens: 600,
  });

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
  const content = await complete({
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
    maxTokens: 500,
  });

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

Be helpful, concise, and friendly. If you're unsure or the issue needs human attention, set needsHuman to true.

Return a JSON object with:
- message: Your response to the user
- suggestedActions: Array of 1-3 suggested follow-up questions or actions
- needsHuman: Boolean - true if this needs human support
- category: Optional category (billing, technical, feature_request, general)`;

export async function supportChat(userMessage: string, conversationHistory: Array<{ role: "user" | "assistant"; content: string }>): Promise<ChatResponse> {
  const messages: ChatMessage[] = [
    { role: "system", content: SUPPORT_CONTEXT },
    ...conversationHistory.slice(-10).map(m => ({ ...m, role: m.role as "user" | "assistant" })),
    { role: "user", content: userMessage }
  ];

  const content = await complete({
    messages,
    maxTokens: 500,
  });

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
  const content = await complete({
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
    maxTokens: 400,
  });

  return JSON.parse(content) as TicketCategorization;
}

// =====================
// 8. App Prompt Parser (AI App Builder)
// =====================
export interface ParsedAppPrompt {
  appName: string;
  appDescription: string;
  industry: string;
  suggestedScreens: Array<{
    name: string;
    type: "webview" | "native";
    purpose: string;
    icon: string;
  }>;
  suggestedFeatures: string[];
  primaryColor: string;
  secondaryColor: string;
  icon: string;
  monetization?: string[];
  targetAudience?: string;
}

export async function parseAppPrompt(prompt: string, industryHint?: string): Promise<ParsedAppPrompt> {
  const content = await complete({
    messages: [
      {
        role: "system",
        content: `You are an expert app architect. Parse user prompts and generate complete app configurations.

Based on the user's description, create a comprehensive app configuration.

Return a JSON object with:
- appName: A catchy, memorable app name (max 20 chars, no special characters)
- appDescription: Compelling app store description (80-120 chars)
- industry: The industry category (ecommerce, food, health, education, entertainment, business, social, news, lifestyle, utilities, other)
- suggestedScreens: Array of 4-6 screens, each with:
  - name: Screen name (e.g., "Home", "Shop", "Cart")
  - type: "webview" (content from website) or "native" (pre-built template)
  - purpose: Brief description of what this screen does
  - icon: Single emoji representing this screen
- suggestedFeatures: Array of feature keys to enable. Choose from:
  ["bottomNav", "pullToRefresh", "offlineScreen", "pushNotifications", "deepLinking", "whatsappButton", "customMenu", "nativeLoadingProgress"]
  Select features that make sense for this type of app.
- primaryColor: Hex color that fits the industry/brand (e.g., "#FF6B35" for food, "#4CAF50" for health)
- secondaryColor: Complementary hex color
- icon: Single emoji that represents the app
- monetization: Optional array of monetization strategies (e.g., ["subscriptions", "in-app purchases", "ads"])
- targetAudience: Optional brief description of target users

Be creative but practical. Choose colors and features that match the industry.`
      },
      {
        role: "user",
        content: `Parse this app idea and generate a complete configuration:

User Prompt: "${prompt}"
${industryHint ? `Industry Hint: ${industryHint}` : ""}

Generate a well-structured app configuration.`
      }
    ],
    maxTokens: 1200,
  });

  try {
    return JSON.parse(content) as ParsedAppPrompt;
  } catch {
    // Fallback if JSON parsing fails
    return {
      appName: "My App",
      appDescription: prompt.substring(0, 120),
      industry: industryHint || "other",
      suggestedScreens: [
        { name: "Home", type: "webview", purpose: "Main landing page", icon: "🏠" },
        { name: "About", type: "native", purpose: "About the business", icon: "ℹ️" },
        { name: "Contact", type: "native", purpose: "Contact information", icon: "📞" },
      ],
      suggestedFeatures: ["pullToRefresh", "offlineScreen"],
      primaryColor: "#00E5FF",
      secondaryColor: "#A855F7",
      icon: "🚀",
    };
  }
}

// =====================
// 9. Screen Content Generator (for Native Screens)
// =====================
export interface GeneratedScreenContent {
  title: string;
  subtitle?: string;
  sections: Array<{
    type: "hero" | "text" | "features" | "team" | "gallery" | "contact" | "faq" | "cta";
    content: any;
  }>;
}

export async function generateScreenContent(
  screenType: string,
  appName: string,
  appDescription: string,
  businessInfo?: { name?: string; email?: string; phone?: string; address?: string }
): Promise<GeneratedScreenContent> {
  const content = await complete({
    messages: [
      {
        role: "system",
        content: `You are a mobile app content generator. Create compelling content for native app screens.

Return a JSON object with:
- title: Screen title (max 30 chars)
- subtitle: Optional subtitle (max 60 chars)
- sections: Array of content sections appropriate for the screen type

Section types and their content structure:
- "hero": { headline: string, subheadline: string, ctaText: string }
- "text": { heading: string, body: string }
- "features": { items: [{ icon: emoji, title: string, description: string }] }
- "team": { members: [{ name: string, role: string, avatar: emoji }] }
- "gallery": { images: [{ caption: string, placeholder: emoji }] }
- "contact": { email: string, phone: string, address: string, mapEnabled: boolean }
- "faq": { items: [{ question: string, answer: string }] }
- "cta": { headline: string, buttonText: string, buttonAction: string }

Create realistic, professional content that matches the app's purpose.`
      },
      {
        role: "user",
        content: `Generate content for a "${screenType}" screen:

App Name: ${appName}
App Description: ${appDescription}
${businessInfo ? `Business Info: ${JSON.stringify(businessInfo)}` : ""}

Create engaging, relevant content for this screen.`
      }
    ],
    maxTokens: 1000,
  });

  try {
    return JSON.parse(content) as GeneratedScreenContent;
  } catch {
    return {
      title: screenType.charAt(0).toUpperCase() + screenType.slice(1),
      sections: [
        {
          type: "text",
          content: { heading: "Welcome", body: "Content coming soon..." }
        }
      ]
    };
  }
}

