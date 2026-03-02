# Complete Technical Audit Report — Applyn

**Date:** March 2, 2025  
**Scope:** Full codebase (Node.js + Express, MySQL, React frontend). No DevOps (Docker/CI/CD/K8s); manual VPS deployment assumed.

---

## 1. ARCHITECTURE REVIEW

### Is this a proper layered architecture?

**No.** The backend is **not** a clean layered architecture.

- **Single routes file:** All HTTP entry points live in `server/routes.ts` (~9,500+ lines). There is no `controllers/` or `routes/` directory; route handlers are inline.
- **Mixed concerns:** Handlers perform auth checks, load resources, call storage/verticals, and send responses in one place. There is no dedicated controller layer that delegates to services.
- **Partial service layer:** Business logic is reasonably separated in:
  - `server/verticals/` (ecommerce, restaurant, realestate, healthcare) with `service.ts`, `validators.ts`, `events.ts`
  - `server/storage.ts` / `server/storage.mysql.ts` (data access)
  - `server/entitlements.ts`, `server/llm.ts`, `server/publishing/`, `server/build/`
- Many routes still embed logic that belongs in a service (e.g. app ownership checks, payment handling, analytics).

### Is business logic separated from controllers?

**Partially.** Vertical-specific logic is in services; app CRUD, subscriptions, support tickets, and a large amount of ad-hoc logic live inside route handlers. There is no consistent “controller → service → storage” flow.

### Is the code scalable?

**Limited.**

- **Single file bottleneck:** `routes.ts` is a maintenance and merge bottleneck. Adding or changing a feature requires editing a very large file.
- **No horizontal scaling story for some state:** In-memory structures are used for rate limiting and runtime create windows (`runtimeCreateWindows` Map in `routes.ts`). With multiple Node instances behind a load balancer, limits are per-process, not global.
- **Stateless API:** Session store is externalized (MySQL), so the HTTP layer can scale horizontally if you add a global/store-backed rate limiter.

### Is the folder structure clean?

**Mostly.** Structure is understandable:

- `server/` — backend (index, routes, auth, storage, worker, verticals, build, publishing)
- `client/` — Vite + React (pages, components, lib, design, native)
- `shared/` — Zod schemas, Drizzle schema, pricing, editor screens

The main problem is the size and responsibility of `server/routes.ts`, not the top-level layout.

### What architectural risks exist?

| Risk | Severity | Description |
|------|----------|-------------|
| **Monolithic routes file** | High | One file holds almost all API surface; refactors and onboarding are costly. |
| **Copy-paste authorization** | Medium | App ownership is enforced by repeating `getApp` + `ownerId !== user.id` in many handlers. One missed check can cause an authorization bypass. |
| **In-memory rate limiting** | Medium | Auth/build/payment limiters are in-process. Multiple instances = multiplied limits; no shared view. |
| **Tight coupling to Express** | Low | Handlers are Express-specific; extracting to a pure service layer would require refactoring. |

---

## 2. FRONTEND REVIEW

### Component structure

- **Pages:** 39+ page components under `client/src/pages/` (dashboard, app-editor, visual-editor, billing, admin, runtime-app, etc.). Clear route-to-page mapping in `App.tsx` (Wouter).
- **Components:** `client/src/components/` (UI primitives, support chatbot, build logs, mobile preview, Play setup wizard). Radix-based `ui/` components. Feature-specific components are present.
- **Native app UI:** `client/src/native/` (render, ProductGrid, HeroSection, etc.) and `client/src/sections/` for presets and blueprints.
- **Design:** `client/src/design/` (tokens, theme, preview-theme). Theming is structured.

**Verdict:** Structure is good; no major organizational issues.

### API integration quality

- **Centralized client:** `client/src/lib/queryClient.ts` exposes `apiRequest()` and `getQueryFn()`. All use `credentials: "include"` for session cookies.
- **Consistency:** Some pages use `apiRequest`/`getQueryFn`, others use raw `fetch(..., { credentials: "include" })`. Not fully consistent but functionally correct for same-origin.
- **Error handling:** `throwIfResNotOk` parses JSON error body and message/details; throws `Error` with a clear message. TanStack Query gets errors via this.

### Error handling

- **Global:** Failed fetches throw; React Query surfaces them. Toaster is used for user feedback in many flows.
- **Gaps:** Not every mutation shows a toast on error; some forms may leave the user without feedback. No global error boundary mentioned for API errors.

### Loading states

- TanStack Query provides `isLoading`, `isPending`; many pages use them for spinners or disabled states. Not audited per-page; expect some flows to lack explicit loading UX.

### Security risks (token storage, XSS)

- **Dashboard auth:** Session cookie (httpOnly, sameSite: lax, secure in prod). No token in localStorage for the main app — **good**.
- **Runtime app (end-user):** Customer token stored in `localStorage` under `runtime_token:${appId}`. Token is HMAC-signed (JWT-style) and short-lived (30-day exp). Risk: XSS can steal it; same as any client-side token. Mitigation: strict CSP and sanitization would help; not fully audited.
- **Draft data:** `localStorage` used for create-app and prompt-create drafts (`applyn_draft`, `applyn_prompt_draft`). Not sensitive; acceptable.
- **Reset/verify tokens:** Taken from URL query params and sent to API; not stored in localStorage long-term. **Acceptable.**

### UX improvement suggestions

- Standardize on `apiRequest`/`getQueryFn` everywhere and add a single place for “request failed” toasts.
- Add a global React error boundary and optional “Retry” for API errors.
- Ensure every mutation path has a loading state and success/error feedback (toast or inline).

### Production readiness score (Frontend): **7/10**

- Modern stack, good structure, credentials and errors handled. Deducted for: inconsistent API usage, possible missing loading/error UX in some flows, and runtime token in localStorage (inherent SPA tradeoff).

---

## 3. BACKEND REVIEW

### Controller structure

- There are no separate controller modules. “Controllers” are the inline handlers in `server/routes.ts`. Each route is a function that does auth, validation, storage/vertical calls, and response.

### Service layer separation

- **Present where it matters:** Verticals (ecommerce, restaurant, realestate, healthcare), storage, entitlements, LLM, publishing, build. These are used by routes but not through a single service facade; routes call storage and verticals directly.
- **Missing:** A consistent service layer for “app management”, “subscription”, “support”, “admin” so that routes only do HTTP and delegate.

### Input validation

- **Zod:** Used in many routes (~102 usages of schema parse/safeParse). Shared schemas in `shared/schema.ts` and verticals’ `validators.ts`. Good coverage for critical inputs (auth, payments, support, verticals).
- **Gaps:** Not every route was audited; some POST/PATCH bodies may be trusted without schema validation. Recommendation: ensure every body/query/param that affects state is validated.

### Error handling consistency

- **Central handler:** `server/logger.ts` exports `errorHandler` that:
  - Handles `ZodError` (400, no stack).
  - Uses `err.status`/`statusCode` for HTTP status.
  - In production, 5xx responses are sanitized to “Internal Server Error”.
  - Logs with `requestId`, `userId`, path.
- **Per-route:** Many handlers use try/catch and `next(err)` or `res.status(...).json(...)`. Inconsistent; some swallow errors or return 201 on analytics failure. Overall, central handler gives a good baseline.

### Async/await correctness

- Routes and storage use async/await. No obvious `.then()` chains that drop errors. Passport strategies and worker use async correctly.

### SQL injection risks

- **Drizzle ORM:** Queries use Drizzle’s API and `sql` template literals with bound parameters (e.g. `sql`${buildJobs.status} IN (...)` with variables passed safely). No raw string concatenation of user input into SQL found.
- **Worker:** Retention cleanup uses `pool.query(sqlText, params)` with parameterized queries. **Low risk.**

### Authentication & authorization logic

- **Dashboard:** Passport (local + Google). Session in cookie; MySQL session store required in production.
- **Authorization:** `requireAuth`, `requireRole(roles)`, `requirePermission(perm)`. App-level access is enforced by loading the app and checking `!isStaff(user) && appItem.ownerId !== user.id` in many places. Pattern is repeated; no shared middleware like `requireAppOwner(appParamName)`.
- **Runtime app:** HMAC-signed “JWT-style” token (custom implementation), verified with `verifyRuntimeToken(appId, token)`. Secret is `APP_CUSTOMER_TOKEN_SECRET` (or SESSION_SECRET) + appId. Algorithm is HS256-style; expiration and appId are validated.

### API design quality

- REST-style routes (`/api/apps/:id`, `/api/runtime/:appId/...`). Mixed use of status codes and JSON bodies. Webhooks and payments use standard patterns. No API versioning in the path.

### Logging quality

- **Structured logger:** `server/logger.ts` — level, time, message, and fields. LOG_LEVEL respected. Request logging for selected routes (payments, webhooks, build, runtime create). Errors logged with requestId, userId, path.
- **Gaps:** Not every important operation is logged (e.g. login success/fail, subscription changes). Audit log exists for some actions; coverage not fully verified.

### Production readiness score (Backend): **6.5/10**

- Solid auth, validation, rate limiting, and error handling. Major deductions: single giant routes file, repeated authz pattern with risk of missed checks, and in-memory rate limits.

---

## 4. DATABASE REVIEW

### Schema design

- **ORM:** Drizzle with MySQL. Schema in `shared/db.mysql.ts`: users, apps, app_customers, app_products, orders, payments, build jobs, support tickets, vertical-specific tables (ecommerce, restaurant, realestate, healthcare, courses, fitness, etc.), webhooks, audit logs, sessions.
- **Normalization:** Tables are normalized; app-scoped data keyed by `appId`; orders/items/refunds follow standard patterns. No obvious denormalization issues.

### Indexing

- Indexes are defined on high-use columns: `owner_id`, `app_id`, `status`, `plan_status`, `plan_expiry_date`, `reset_token`, and composite indexes for (appId, status), (appId, customerId), etc. Performance indexes exist (e.g. `007_performance_indexes.sql`, `008_payments_status_created_at_idx`). No full table scan patterns identified in the audit.

### Missing foreign keys

- **No foreign keys in Drizzle schema.** Relationships are logical (e.g. `appId`, `ownerId`, `customerId`) with indexes only. This is a deliberate choice (flexibility, no FK cascades). Downside: referential integrity is not enforced by the DB; orphaned rows or invalid IDs are possible if application code errs.

### Data duplication risks

- Some JSON columns store large blobs (e.g. `editor_screens`, `modules`, `navigation`). Duplication is minimal; duplication risk is low if app/clone logic is correct.

### Query optimization

- Queries use Drizzle and indexes. Aggregations in admin/founder metrics use SQL (e.g. `COUNT(*)`, `GROUP BY DATE(...)`). No obvious N+1 or heavy full scans in the sampled code.

### Scalability

- Single MySQL instance assumed. Connection pooling (`DB_POOL_SIZE`, default 10) is configured. For growth: read replicas and splitting read-heavy analytics would be the next step; schema does not block that.

### Financial calculation accuracy (if loan app)

- This is an app-builder / CRM / verticals platform with ecommerce (orders, payments, refunds). Money is stored in cents/paise. Razorpay integration and refund/order status flows exist. No loan-specific logic was audited; for payments, calculations use integer cents and standard patterns.

---

## 5. SECURITY AUDIT

### JWT / token implementation

- **Custom “JWT-style” tokens** for runtime app customers: header.payload.signature with HMAC-SHA256. Expiration and `appId` are enforced. Implementation is correct; no `alg: none` or key confusion. Secret is per-app (secret + appId).

### Password hashing

- **Scrypt** (Node crypto), not bcrypt: 16-byte salt, key length 64, timing-safe comparison. **Strong and appropriate.** No plaintext or weak hashing.

### Secrets in code

- No hardcoded secrets found. `APP_CUSTOMER_TOKEN_SECRET`, `SESSION_SECRET`, Razorpay, Google, SMTP, etc. come from `process.env`. `.env.example` documents them; `.env` is gitignored.

### .env usage

- Correct. Required vars are validated at startup (`APP_CUSTOMER_TOKEN_SECRET`, `SESSION_SECRET`). Production enforces MySQL session store and `SESSION_STORE=mysql`.

### CORS

- **No CORS middleware** in the app. Same-origin is assumed (e.g. SPA and API on same host/port). Production CSRF check uses Origin/Referer against `APP_ORIGINS`. If you later serve the SPA from another origin (e.g. different subdomain or CDN), you must add CORS (e.g. `cors` package) and align with `APP_ORIGINS`.

### Rate limiting

- **Present:** express-rate-limit on auth (20/15min), payments verify/create, Razorpay webhook, build, Unsplash, contact, Play OAuth, publish, trial start (IP and user), runtime payments. Limits are sensible. **Gap:** In-memory store; multi-instance deployment multiplies effective limits.

### Input sanitization

- Zod validates types and lengths. No systematic HTML/script sanitization for stored content that is later rendered (e.g. app name, support ticket body). If any of that is rendered in a browser without escaping, XSS is possible. Recommendation: sanitize or escape all user-generated content on output, or sanitize on input for rich text.

### Authorization bypass risks

- **Pattern:** Many routes load app by id and check `appItem.ownerId !== user.id` (and staff). If a new route is added and this check is forgotten, a user could access another user’s app. Recommendation: middleware or helper `requireAppAccess(req, res, next)` that loads app and enforces ownership/staff once.

### OWASP Top 10 (brief)

| Risk | Status |
|------|--------|
| A01 Broken Access Control | Partially mitigated; repeated pattern, no central middleware. |
| A02 Cryptographic Failures | Strong password hashing; secrets from env. |
| A03 Injection | Drizzle + parameterized queries; low SQL injection risk. |
| A04 Insecure Design | Architecture is monolithic routes; design is not inherently insecure. |
| A05 Security Misconfiguration | Production requires MySQL session; no CORS if same-origin. |
| A06 Vulnerable Components | Not audited (npm audit recommended). |
| A07 Auth Failures | Session + strong hashing; lockout and rate limiting present. |
| A08 Software/Data Integrity | Webhook signatures (Razorpay HMAC); no obvious integrity gaps. |
| A09 Logging/Monitoring | Structured logging; audit log for some actions. |
| A10 SSRF | Image proxy and external fetches exist; URL allowlist/validation should be verified. |

### Security level (1–10): **6.5/10**

- Good: passwords, tokens, secrets, rate limiting, CSRF in prod, parameterized DB.
- Gaps: no CORS if needed, in-memory rate limits, no central authz middleware, and input/output sanitization for XSS not fully verified.

---

## 6. PRODUCTION HARDENING CHECK (No DevOps)

### Is the process managed properly (PM2)?

- **No PM2 (or any process manager) config in the repo.** For a VPS, you should run the Node process under PM2 (or systemd) so it restarts on crash and survives reboots. Recommendation: add `ecosystem.config.js` (or equivalent) and run `pm2 start ecosystem.config.js`.

### Is the app crash-safe?

- **Uncaught exceptions:** In dev only, uncaughtException/unhandledRejection are logged. In production there is no global handler; an uncaught exception can bring down the process. Use a process manager (PM2) to restart. Optional: add a process-level uncaughtException handler that logs and exits so PM2 restarts cleanly.

### Is Nginx configured correctly?

- **No Nginx config in the repo.** If Nginx is in front of the app, it should: proxy to Node (e.g. port 5004), set `X-Forwarded-*` (trust proxy is set in Express), and ideally terminate TLS and serve static assets. You need to maintain this outside the repo.

### Are server ports exposed unnecessarily?

- App listens on `0.0.0.0:PORT`. On a VPS, only Nginx (or the reverse proxy) should be exposed (e.g. 80/443); Node should bind to localhost or a private port and not be directly internet-facing. Not enforceable in code; deployment must ensure this.

### Is MySQL secured?

- Connection uses `DATABASE_URL`. Ensure: MySQL listens only on localhost or a private network, strong password, principle of least privilege (no SUPER), and no default root from remote. No DB credentials in repo.

### Are logs rotated?

- **No log rotation in the app.** Logging is to stdout. On VPS, use the OS or a logging daemon (e.g. logrotate for files if you redirect stdout to a file) or ship logs to a service. The app does not write to log files itself.

### Is a backup strategy defined?

- **No backup or restore logic in the repo.** You need external backups of MySQL (and any file artifacts) and a tested restore procedure.

### Is HTTPS properly configured?

- Cookie is `secure: true` in production. TLS must be terminated at Nginx (or similar). No HTTPS logic inside the Node app; deployment must enforce HTTPS.

---

## 7. BUSINESS & FEATURE GAPS

### What important features are missing?

- **API versioning:** No `/v1/` or similar; future breaking changes are harder.
- **Audit coverage:** Audit log exists but not every sensitive action may be recorded (e.g. all role/permission changes, all app delete/publish actions).
- **Global rate limiting store:** For multi-instance deployment, use Redis (or similar) for rate limit state.
- **Health dependency checks:** `/api/health/ready` checks MySQL; consider checking session store and critical external services.
- **Structured “maintenance mode”:** No explicit flag to disable non-read-only traffic during deployments.

### What enterprise CRM / app-builders usually have?

- SSO/SAML, audit trail for all mutations, role-based permissions beyond “admin/support/user”, multi-tenancy with tenant isolation, and compliance (e.g. data export/deletion). The app has RBAC (roles, permissions), audit log, and verticals; SSO and full compliance workflows are gaps.

### Where can this break in real-world usage?

- **Single routes file:** Merge conflicts and regression risk when many people touch the same file.
- **Missed owner check:** A new app-scoped route without `ownerId` check could leak data.
- **Session store:** If MySQL is down or session table is missing, production startup correctly refuses to run (SESSION_STORE=mysql).
- **Worker:** If the worker process is not run or crashes, builds and payment reconciliation can stall; no built-in alerting.

### Monetization & scaling suggestions

- Subscription and plan logic exist (starter, standard, pro, trial, grace). For scaling: add Redis for sessions and rate limiting, read replicas for analytics, background job queue (e.g. Bull with Redis), and separate worker processes per queue type. For monetization: the current plan/entitlement model is a good base; consider usage-based add-ons and clear limits in the UI.

---

## 8. TECHNICAL DEBT REPORT

### Critical issues

1. **Single 9,500+ line routes file** — Refactor into modules by domain (e.g. `routes/auth.ts`, `routes/apps.ts`, `routes/runtime.ts`, `routes/admin.ts`) and/or introduce a thin controller layer that delegates to services.
2. **Repeated app ownership check** — Introduce `requireAppAccess` (or similar) middleware and use it on every app-scoped route to avoid bypasses.
3. **No process manager config in repo** — Add PM2 (or systemd) example/config so production runs with restarts and a single command.

### Medium priority issues

4. **In-memory rate limiting** — Replace with a store (e.g. Redis) for multi-instance and consistent limits.
5. **No CORS middleware** — If the SPA is ever on a different origin, add and configure CORS.
6. **Inconsistent frontend API usage** — Prefer `apiRequest`/`getQueryFn` everywhere and document it.
7. **No foreign keys** — Consider adding FKs for critical relations (e.g. app_id → apps.id) to enforce integrity; evaluate impact on migrations and deletes first.
8. **Logging and audit** — Extend audit log to all sensitive actions; ensure login (success/failure) and lockout are logged.

### Cosmetic improvements

9. **Type safety** — Some `(user as any)` and `(req as any)`; replace with proper typings (e.g. Express user type, custom request type).
10. **Duplicate error messages** — Some routes return the same JSON shape manually instead of using a shared helper.
11. **Comments and docs** — Add a short README or doc for “running in production” (env, PM2, Nginx, worker, backups).

---

## 9. FINAL CTO REVIEW

### Overall system score: **6.5/10**

- **Strengths:** Modern stack, strong password hashing, session and token design, Zod validation, rate limiting, central error handling, Drizzle with parameterized queries, vertical-based structure, and clear frontend organization.
- **Weaknesses:** Monolithic routes file, repeated authorization pattern, no in-repo production runbook (PM2/Nginx/backups), and in-memory rate limiting for scaling.

### Top 5 risks

1. **Authorization bypass** — A new or modified app-scoped route that forgets the owner check could expose one customer’s data to another. Mitigate with a single middleware/helper used everywhere.
2. **Single routes file** — High regression and merge conflict risk; slows feature work and onboarding. Split by domain and/or add a controller layer.
3. **No process manager** — Node process can exit and not come back after crash or reboot. Use PM2 or systemd and document it.
4. **No backup strategy** — Data loss if MySQL or disk fails. Define and test backups and restore.
5. **In-memory rate limits** — Under multiple instances, limits are per-process; abuse or cost control may be insufficient. Move to Redis (or similar) when scaling.

### 30-day improvement roadmap

| Week | Action |
|------|--------|
| 1 | Add PM2 (or systemd) config and a short “Production runbook” (env, start command, worker, Nginx, HTTPS). Run the app under PM2 on the VPS. |
| 2 | Introduce `requireAppAccess(req, res, next)` (or equivalent) that loads app by id, checks ownership/staff, and attaches app to request. Use it on one app-scoped route and plan rollout to all. |
| 3 | Split `routes.ts` into 3–5 domain files (e.g. auth, apps, runtime, admin, webhooks) and require each from a single `registerRoutes`. No change in behavior. |
| 4 | Add CORS middleware if the SPA can be on a different origin. Run `npm audit` and fix high/critical. Optionally add audit log entries for login success/failure and critical admin actions. |

### What must be fixed before real users

- **Must:** Run behind HTTPS (Nginx or other). Use MySQL session store in production (already enforced). Ensure `APP_CUSTOMER_TOKEN_SECRET` and `SESSION_SECRET` are strong and unique. Run the worker process for builds and payment reconciliation. Use a process manager (PM2) so the app and worker restart on failure.
- **Should:** Implement `requireAppAccess` (or equivalent) and use it on every app-scoped route. Have a MySQL backup and restore procedure. Document how to deploy and operate the app (runbook).
- **Nice to have:** Split routes, add CORS if needed, and plan Redis-based rate limiting for multi-instance.

---

*End of report.*
