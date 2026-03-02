# Production improvements for https://applyn.co.in

You already have PM2 and Nginx running. This guide suggests concrete improvements for **performance**, **security**, and **reliability** on your VPS.

---

## 1. Nginx improvements

### 1.1 Ensure proxy headers (required for sessions)

Your app uses `app.set("trust proxy", 1)`. Nginx **must** pass:

- `X-Forwarded-For` (so rate limiting and logs see real IP)
- `X-Forwarded-Proto: https` (so redirects and cookies use HTTPS)

**Minimal proxy block:**

```nginx
location / {
    proxy_pass http://127.0.0.1:5004;   # or your Node port
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
}
```

### 1.2 Serve static assets from Nginx (recommended)

Right now Node serves everything, including JS/CSS from `dist/public`. Let Nginx serve static files and only proxy API and SPA fallback to Node. This reduces load on Node and uses Nginx’s efficient file serving.

**Example:** build output is `dist/public/` (e.g. `index.html`, `assets/*.js`, `assets/*.css`).

```nginx
root /var/www/applyn/dist/public;   # path to your built client
index index.html;

location / {
    try_files $uri $uri/ /index.html;
}

location /api/ {
    proxy_pass http://127.0.0.1:5004;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
}

# Long cache for hashed assets (Vite uses content hashes)
location /assets/ {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000, immutable";
}
```

**If you do this:** either keep serving the app from Node (current behavior) or switch to the above and only proxy `/api/` and `/` (SPA) to Node. Don’t duplicate root and API in a way that bypasses Node for `/api/`.

### 1.3 Security headers (in Nginx)

Add these in the `server` block (or in a shared snippet):

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header X-XSS-Protection "1; mode=block" always;
```

Optional but recommended for HTTPS:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

(Your app already sets some of these in Express; having them in Nginx is redundant but harmless and ensures they’re present even if Node doesn’t run.)

### 1.4 Gzip

Enable gzip for text responses (HTML, JS, CSS, JSON):

```nginx
gzip on;
gzip_vary on;
gzip_min_length 256;
gzip_proxied any;
gzip_types text/plain text/css application/json application/javascript application/x-javascript text/xml application/xml;
```

### 1.5 Rate limiting at the edge (optional)

To protect against floods before they hit Node:

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;

server {
    ...
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://127.0.0.1:5004;
        # ... proxy headers as above
    }
    location / {
        limit_req zone=general burst=30 nodelay;
        # ...
    }
}
```

Tune `rate` and `burst` to your traffic.

### 1.6 WWW redirect (if you use both domains)

If you want `https://applyn.co.in` as canonical:

```nginx
server {
    listen 443 ssl http2;
    server_name www.applyn.co.in;
    return 301 https://applyn.co.in$request_uri;
}
```

And ensure `APP_ORIGINS` in `.env` includes both if users can land on either:

```bash
APP_ORIGINS=https://applyn.co.in,https://www.applyn.co.in
```

---

## 2. PM2 improvements

### 2.1 Use an ecosystem file

Run the app (and worker) from a config file so restarts and env are consistent. Example: `ecosystem.config.cjs` in the project root (see `deploy/ecosystem.config.cjs.example` in this repo). Then:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # enable restart on reboot
```

### 2.2 Run the worker

If you use builds or payment reconciliation, the worker must run separately:

```bash
pm2 start ecosystem.config.cjs --only applyn-worker
```

(Or add a second process in the ecosystem file and start both with one `pm2 start ecosystem.config.cjs`.)

### 2.3 Log rotation

Avoid disk fill from PM2 logs:

- **Option A:** Use `pm2-logrotate`:
  ```bash
  pm2 install pm2-logrotate
  pm2 set pm2-logrotate:max_size 50M
  pm2 set pm2-logrotate:retain 7
  ```
- **Option B:** Configure `out_file` / `error_file` in ecosystem to a path that your system logrotate rotates (e.g. `/var/log/applyn/`).

### 2.4 Restart on high memory (optional)

If the Node process ever leaks memory:

```javascript
max_memory_restart: "500M"
```

in the ecosystem file for the app process.

---

## 3. App / environment checks

### 3.1 Production `.env`

Confirm on the VPS:

- `NODE_ENV=production`
- `APP_URL=https://applyn.co.in` (no trailing slash)
- `APP_ORIGINS=https://applyn.co.in,https://www.applyn.co.in` (all origins where the app is loaded)
- `SESSION_STORE=mysql` and `DATABASE_URL=mysql://...`
- Strong `SESSION_SECRET` and `APP_CUSTOMER_TOKEN_SECRET` (e.g. 32+ byte random hex)

### 3.2 Google OAuth (if used)

- `GOOGLE_CALLBACK_URL=https://applyn.co.in/api/auth/google/callback`
- Authorized redirect URIs in Google Cloud Console must match exactly (including HTTPS).

---

## 4. Quick wins checklist

| Item | Action |
|------|--------|
| Proxy headers | Add `X-Forwarded-For`, `X-Forwarded-Proto` in Nginx `location` for the app. |
| HTTPS | Keep TLS at Nginx; ensure `secure` cookies (app does this when `NODE_ENV=production`). |
| HSTS | Add `Strict-Transport-Security` in Nginx. |
| Gzip | Enable `gzip` in Nginx for text/JS/CSS/JSON. |
| PM2 startup | Run `pm2 startup` and `pm2 save` so processes restart after reboot. |
| Worker | Run worker process via PM2 if you use builds/payments. |
| Log rotation | Install `pm2-logrotate` or rotate PM2 log files via logrotate. |
| APP_ORIGINS | Include both `https://applyn.co.in` and `https://www.applyn.co.in` if both are used. |

---

## 5. Optional: serve static from Nginx

If you want Nginx to serve `dist/public` and only proxy `/api/` and SPA to Node:

1. Build on the server (or deploy `dist/public`): `npm run build`.
2. Point Nginx `root` to `dist/public` and use `try_files $uri $uri/ /index.html` for `/`.
3. Proxy only `/api/` (and any other Node routes) to the Node port.
4. No code change required; the app still works. You can remove or keep `serveStatic` in Node; if Nginx serves static, Node will only get `/api/*` and fallback for `/`.

Example snippets: `deploy/nginx-applyn.conf.example` (Nginx), `deploy/ecosystem.config.cjs.example` (PM2). Copy ecosystem file to project root as `ecosystem.config.cjs` before use.

---

## 6. Monitoring (optional)

- **Uptime:** Use PM2 plus an external uptime check (e.g. UptimeRobot, Better Uptime) for `https://applyn.co.in/api/health`.
- **Logs:** `pm2 logs applyn-server` (or your app name). For production, consider shipping logs to a service (e.g. Loki, Papertrail, CloudWatch).

Implementing the proxy headers, HSTS, gzip, PM2 ecosystem + worker + log rotation, and env checks will already make https://applyn.co.in more robust and a bit faster.
