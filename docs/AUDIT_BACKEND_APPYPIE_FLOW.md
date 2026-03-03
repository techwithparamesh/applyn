# Backend Audit: Appy Pie–Style Flow

**Goal:** Confirm the backend supports the same flow as the frontend audit: **prompt or website → premium app → customize → build → publish** (like [Appy Pie](https://www.appypie.com/)).

---

## 1. Flow Overview (What Appy Pie Expects)

| Step | Appy Pie | Applyn backend |
|------|----------|----------------|
| 1. User describes app or pastes URL | Single entry; AI or scraper | **Two paths:** `/api/ai/parse-prompt` (prompt) vs create-app flow (URL + scrape/analyze). |
| 2. AI suggests app structure | Name, screens, features, colors | **Yes.** `parseAppPrompt()` returns appName, industry, suggestedScreens, suggestedFeatures, primaryColor, secondaryColor, icon. |
| 3. App is created with screens | Backend creates app + screens | **Yes.** Client builds `editorScreens` from templates + AI result; `POST /api/apps` accepts and persists `editorScreens`, `generatedPrompt`, `industry`, etc. |
| 4. User customizes | Visual editor saves changes | **Yes.** `PATCH /api/apps/:id` with `editorScreensSchema`; storage persists and maintains history. |
| 5. Build (APK/AAB / IPA) | Build job produces artifacts | **Yes.** On create with `buildNow: true`, backend sets status `processing` and `enqueueBuildJob()`. Worker claims job, runs Android (Docker Gradle) or iOS (GitHub Actions). |
| 6. Publish to stores | Play / App Store | **Yes.** Play: internal testing + production via `publish/play/internal` and `publish/play/production`; iOS build exists, store submit is manual (documented). |

**Verdict:** The backend **does** support an Appy Pie–style flow end to end. A few gaps and one bug were found and are documented below.

---

## 2. What Was Audited

### 2.1 AI: Parse Prompt

- **Route:** `POST /api/ai/parse-prompt` (requireAuth, aiRateLimit).
- **Handler:** `parseAppPrompt(prompt, industryHint)` in `server/llm.ts`.
- **Returns:** `appName`, `appDescription`, `industry`, `suggestedScreens` (name, type, purpose, icon), `suggestedFeatures`, `primaryColor`, `secondaryColor`, `icon`, optional `monetization`, `targetAudience`.
- **Fallback:** If LLM is not configured (503) or JSON parse fails, a safe default object is returned.
- **Screens:** The backend does **not** build `editorScreens`; the **client** does (templates + `buildEditorScreensFromTemplate` + pruning). So “AI suggests, client builds screens” — consistent with one-shot create then customize.

### 2.2 App Creation

- **Route:** `POST /api/apps` (requireAuth, app create rate limit).
- **Schema:** `insertAppSchema.extend({ buildNow })` — includes `editorScreens`, `generatedPrompt`, `generatedScreens`, `industry`, `isNativeOnly`, `url`, etc.
- **Storage:** `storage.createApp(ownerId, payload)`. MySQL persists `editorScreens`, `generatedPrompt`, `industry`, and other fields.
- **Post-create:**
  - If `url` is `native://` or `runtime://`, backend overwrites `url` with a runtime URL (`/runtime/:id`) so the app has a real endpoint.
  - Industry-based seeding (e.g. services for salon/photography, products for ecommerce/restaurant) runs when MySQL is used.
  - If `status === "processing"`, `enqueueBuildJob(ownerId, created.id)` is called so the worker can build.

**Bug fixed:** `insertAppSchema` previously had `url: z.string().url()`, which rejects `native://app`. Scratch/prompt-created apps send `url: "native://app"`, so create would fail validation. **Fix:** `url` is now validated with a refine that allows `https?://`, `native://`, and `runtime://`.

### 2.3 Build Pipeline

- **Enqueue:** `storage.enqueueBuildJob(ownerId, appId)` — implemented in `server/storage.mysql.ts`; job is inserted and later claimed by the worker.
- **Worker:** `server/worker.ts` polls for build jobs, checks entitlements (`canBuild`, `canBuildIos`), then:
  - **Android:** `handleAndroidBuild()` → wrapper project + Docker Gradle → APK/AAB to artifacts.
  - **iOS:** `handleIOSBuild()` → `triggerIOSBuild()` (GitHub Actions); requires `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_TOKEN`.
- **Status:** App status is set to `processing` during build, then `succeeded` or `failed`; build error and logs are stored.

So the backend **does** support “create app → auto enqueue build → worker produces artifact” like Appy Pie.

### 2.4 Publish (Google Play)

- **Internal testing:** `POST /api/apps/:id/publish/play/internal` — uploads AAB and creates internal testing release.
- **Production:** Request + approval flow; then `POST /api/apps/:id/publish/play/production` for public release.
- **Play setup:** OAuth for “user” mode; platform can also publish in “central” mode.

No change needed for “will it work like Appy Pie?” — it does for Android.

### 2.5 Publish (iOS / App Store)

- **Build:** Worker can trigger iOS build via GitHub Actions; artifact is produced outside this repo.
- **Store submit:** No backend “Submit to App Store” API; documented as “download build, use Xcode/App Store Connect” (and in the frontend audit, an iOS card was added on the publish page). So backend supports “build”; store submission is manual, which is acceptable for the current product.

---

## 3. Gaps and Differences vs Appy Pie

| Area | Appy Pie (typical) | Applyn backend | Notes |
|------|--------------------|----------------|-------|
| **Single “prompt or URL” API** | One entry that can accept either | Two: `parse-prompt` (text) and create-app flow (URL). | Frontend unifies the story; backend can stay as-is or add a single “create from prompt or URL” endpoint later. |
| **Server-built screens from AI** | Some products generate full screen JSON on server | We generate **suggestions** (names, features); **client** builds `editorScreens` from templates. | Matches “AI suggests, user gets editable draft”; no backend change required. |
| **Website → same premium app** | URL might drive same native-style output | URL path (create-app) uses scrape/analyze and often produces a webview-style app; prompt path uses templates + `editorScreens`. | Backend doesn’t block unifying later (e.g. “analyze URL + suggest template + same create payload”). |
| **Build on create** | Often immediate queue | We set `processing` and enqueue when `buildNow: true`. | Aligned. |
| **Store submission** | Play + App Store in product | Play automated; iOS build automated, submit manual. | Documented and acceptable. |

---

## 4. Fix Applied in This Audit

- **`shared/schema.ts`:** `insertAppSchema` `url` validation now allows:
  - `https?://` (normal URLs)
  - `native://` and `runtime://` (native-only / runtime apps)

So `POST /api/apps` with `url: "native://app"` (and valid `editorScreens`, etc.) **succeeds** and the rest of the flow (runtime URL rewrite, build enqueue, worker) runs as intended.

---

## 5. Summary

- **Backend is audited** and supports the Appy Pie–style flow: parse prompt → create app with screens → customize (PATCH) → build (job + worker) → publish (Play automated, iOS manual).
- **One bug was fixed:** URL validation now allows `native://` and `runtime://`, so prompt/scratch-created apps are not rejected at creation.
- **No other backend changes are required** for “will it work like Appy Pie?” — it will, with the documented split between prompt path and URL path and the current build/publish behavior.
