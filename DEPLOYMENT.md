# CBT.AI — Master Production Deployment & Operations Guide

## 1. System Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│  LAYER 1 — Public Frontend Web Application (React 18 / Vite SPA)       │
│  Hosted on: Cloudflare Pages (Global Edge Network)                     │
│  - Static production bundle in /dist                                   │
│  - Client-side routing preserved via Cloudflare SPA rules             │
│  - Firebase Google Authentication (Popup / Cross-Device Session)       │
│  - Firestore Client SDK for User-Scoped Cross-Device Persistence       │
│  - Strict Zero-Secret Architecture: Zero AI keys in browser            │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │  HTTPS API Calls (CORS Protected)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│  LAYER 2 — Secure CBT.AI Backend & Orchestration Engine                │
│  Hosted on: VPS / Remote Cloud Container (Port 443 / 3001)             │
│  - Quota-Aware Intelligent Model Router & Fallback Chain               │
│  - Strict FREE_ONLY Zero-Paid AI Policy (Zero automatic billing)       │
│  - 8-Minute Hard Deadline & Timeout Bounding                           │
│  - Batch Generation & Targeted Single-Question Regeneration            │
│  - Real-Time Server-Sent Events (SSE) Streams                          │
│  - Rate Limiting, Helmet Security Headers, Strict CORS                 │
│  - Server-Side Exam Evaluation & Objective / Rubric Grading            │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │  Isolated Docker Network (freellm-private)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│  LAYER 3 — Private FreeLLMAPI Unified Gateway                          │
│  Isolated network (internal: true, ZERO public ports exposed)          │
│  - Interconnects 34 free AI providers & 635 free endpoints             │
│  - Upstream providers: Google Gemini, Groq, OpenRouter, Cerebras, etc. │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Firebase & Google Authentication Setup

CBT.AI uses Firebase for **Google Authentication** and **Firestore** for private, cross-device user examination history.

### Step 1: Create Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project**, name it `cbt-ai` (or your preferred name), and disable Google Analytics for minimal setup (or enable if desired).
3. Click **Create Project**.

### Step 2: Enable Google Authentication
1. In Firebase Console, navigate to **Build > Authentication > Sign-in method**.
2. Click **Google**, enable the toggle, select your project support email, and click **Save**.
3. Under **Authentication > Settings > Authorized domains**, add:
   - `localhost` (for local development)
   - `your-project.pages.dev` (your Cloudflare Pages domain)
   - `your-custom-domain.com` (if using a custom domain)

### Step 3: Register Web App & Retrieve Keys
1. In **Project Overview > Project settings > General**, scroll down to **Your apps** and click the Web icon (`</>`).
2. Register the app as `CBT.AI Web`.
3. Copy the `firebaseConfig` object values.

### Step 4: Configure Cloud Firestore & Deploy Rules
1. In Firebase Console, navigate to **Build > Firestore Database** and click **Create database**.
2. Choose a production region (e.g., `us-central1` or `asia-south1`).
3. Deploy the strict security rules from `firestore.rules`:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
         match /exams/{examId} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }
         match /attempts/{attemptId} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }
         match /results/{resultId} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }
       }
       match /{document=**} {
         allow read, write: false;
       }
     }
   }
   ```
   *Guarantee: User A cannot read or write User B's exams or results.*

---

## 3. Frontend Deployment (Cloudflare Pages)

### Build Settings
- **Framework Preset**: `Vite`
- **Build Command**: `npm run build`
- **Build Output Directory**: `dist`
- **Node Version**: `18.x` or `20.x`

### Environment Variables on Cloudflare Pages
Add these in **Cloudflare Pages > Project Settings > Environment variables**:

| Variable | Value / Format | Purpose |
|---|---|---|
| `VITE_API_URL` | `https://api.yourdomain.com` | Base URL of deployed backend |
| `VITE_FIREBASE_API_KEY` | `AIzaSy...` | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `cbt-ai-xyz.firebaseapp.com` | Firebase Auth Domain |
| `VITE_FIREBASE_PROJECT_ID` | `cbt-ai-xyz` | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | `cbt-ai-xyz.firebasestorage.app` | Firebase Storage Bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `123456789012` | FCM Sender ID |
| `VITE_FIREBASE_APP_ID` | `1:123456789:web:abcdef` | Firebase Web App ID |

*Note: In local development, if Firebase environment variables are absent, CBT.AI automatically falls back to an offline demo user mode so all UI and examination features remain fully interactive.*

---

## 4. Backend & FreeLLMAPI Gateway Deployment

Deploy the backend to any VPS or container provider (Hetzner, DigitalOcean, Linode, AWS EC2, or Railway).

### Step 1: Copy Backend Files
Upload the `backend/` directory to the server:
```bash
rsync -avz --exclude 'node_modules' --exclude 'dist' backend/ user@your-server:/opt/cbt-ai-backend/
```

### Step 2: Configure `backend/.env`
Create `/opt/cbt-ai-backend/.env` based on `backend/.env.example`:
```env
PORT=3001
NODE_ENV=production
ALLOWED_ORIGIN=https://cbt-ai.pages.dev,https://yourdomain.com
FREE_ONLY=true
ADMIN_API_KEY=your-super-secure-admin-secret-key-min-32-chars

# Job & Provider Constraints
JOB_TIMEOUT_MS=480000
JOB_MAX_CONCURRENT=3
PROVIDER_TIMEOUT_MS=35000
PROVIDER_COOLDOWN_MS=120000

# Private Internal FreeLLMAPI Gateway
FREELLMAPI_BASE_URL=http://freellmapi:8000
FREELLMAPI_API_KEY=sk-internal-gateway-token

# Optional direct provider fallback keys (free-tier only)
GEMINI_API_KEY=your-gemini-key
GROQ_API_KEY=your-groq-key
OPENROUTER_API_KEY=your-openrouter-key
```

### Step 3: Launch Production Containers
```bash
cd /opt/cbt-ai-backend
docker compose up -d --build
```

### Step 4: Reverse Proxy with SSL (Nginx / Caddy / Cloudflare Tunnel)
Example Caddyfile for automatic SSL:
```caddy
api.yourdomain.com {
    reverse_proxy localhost:3001
}
```

Or Cloudflare Tunnel:
```bash
cloudflared tunnel create cbt-ai-backend
cloudflared tunnel route dns cbt-ai-backend api.yourdomain.com
cloudflared tunnel run --url http://localhost:3001 cbt-ai-backend
```

---

## 5. Security Verification & Health Check Endpoints

```bash
# 1. Public Student Health (Returns clean, sanitized status only)
curl -i https://api.yourdomain.com/api/health

# Response:
# {
#   "status": "ok",
#   "service": "CBT.AI Universal Platform",
#   "version": "2.0.0",
#   "uptimeSeconds": 1420,
#   "ai": { "status": "ready", "headline": "AI Service: Ready", "subtext": "..." }
# }

# 2. Protected Admin Diagnostics (Requires Admin API Key)
curl -i -H "Authorization: Bearer <ADMIN_API_KEY>" https://api.yourdomain.com/api/health/diagnostics

# 3. Queue Concurrency Status
curl -i https://api.yourdomain.com/api/health/queue
```

---

## 6. Update & Redeployment Workflow

Future updates require **zero rebuilds from scratch**. The standard developer workflow is:

```bash
# 1. Make code changes in Antigravity or local editor
# 2. Run automated validation:
npm run test:run        # Verify all unit and integration tests pass
npx tsc --noEmit        # Typecheck frontend
npm run build           # Verify clean production bundle

# 3. Commit and push to Git:
git add .
git commit -m "feat: description of update"
git push origin main

# 4. Frontend auto-deploys via Cloudflare Pages GitHub integration.
# 5. If backend was changed, SSH to VPS and pull:
cd /opt/cbt-ai-backend && git pull && docker compose up -d --build
```

---

## 7. Rollback Workflow

- **Frontend Rollback**: In Cloudflare Pages dashboard > **Deployments**, find the previously healthy deployment and click **Rollback to this deployment**. Instant zero-downtime rollback.
- **Backend Rollback**:
  ```bash
  cd /opt/cbt-ai-backend
  git checkout <previous-commit-hash>
  docker compose up -d --build
  ```
