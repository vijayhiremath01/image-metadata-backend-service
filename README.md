# HALO — Wallpaper Backend API

Backend service for **HALO**, a wallpaper/photo sharing platform. Handles authentication,
image upload and delivery, social features (likes, follows, comments, boards), and a
Redis-backed write-behind pipeline that keeps engagement counters fast without hammering
Postgres.

> Service banner: `Halo Wallpaper Backend API 🚀` · Health service name: `HALO Backend`

---

## Table of contents

- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project layout](#project-layout)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Available scripts](#available-scripts)
- [Database](#database)
- [API reference](#api-reference)
- [Authentication flow](#authentication-flow)
- [Redis: caching, keys and TTLs](#redis-caching-keys-and-ttls)
- [Background jobs (BullMQ)](#background-jobs-bullmq)
- [Rate limiting](#rate-limiting)
- [CORS](#cors)
- [Docker & deployment](#docker--deployment)
- [Data model](#data-model)
- [Known gaps](#known-gaps)

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js 22+ (developed on v24), TypeScript 5.9, executed with `tsx` |
| HTTP | Express 4.18 with `helmet`, `cors`, `express-rate-limit` |
| Database | PostgreSQL via `postgres` (postgres.js) with **Drizzle ORM** + `drizzle-zod` |
| Cache / counters | Redis via `ioredis` |
| Queueing | **BullMQ** (5 queues, write-behind sync to Postgres) |
| Auth | `jsonwebtoken` (access + refresh), `bcryptjs` (passwords & refresh-token hashes) |
| Media | **ImageKit** (upload, CDN, transformations, blurhash, dominant colour) |
| Uploads | `multer` (in-memory storage, MIME/size filters) |
| Config | `dotenv` |
| Infra | Docker + Docker Compose, GitHub Actions → AWS EC2 |

---

## Architecture

The API follows a strict **router → controller → service → data** layering. Controllers only
translate HTTP to service calls and shape responses; all business logic and data access live
in `src/service`; all persistence schema lives in `src/db/schema`.

```
HTTP request
   │
   ├─ helmet  → security headers (CSP off, CORP cross-origin for ImageKit)
   ├─ cors    → origin allow-list, credentials: true
   ├─ logger  → method / url / status / duration (auth paths sanitised)
   ├─ global rate limiter (100 req/min)
   ├─ express.json()
   │
   └─ route match ──► authMiddleware / optionalAuthMiddleware ──► controller
                                                          │
                                                          ▼
                                                     service layer
                                              ┌───────────┴───────────┐
                                              ▼                       ▼
                                         Postgres               Redis + BullMQ
                                     (source of truth)      (fast reads & counters)
```

### The write-behind pattern (the core idea)

Engagement actions are **not** written to Postgres synchronously. They go to Redis first and a
BullMQ job is queued to reconcile Postgres in the background:

```
POST /api/photos/:id/like
      │
      ├─► Redis  SADD photo:{id}:likedUsers + INCR photo:{id}:likes   ← instant response
      └─► Queue  LIKE queue: { photoId, userId, action, timestamp }
                        │
                        ▼
                  like.worker → Postgres (photo_likes row + photos.likes_count)
```

Why: a like is a hot, high-frequency write. Redis answers in sub-millisecond time and the
worker absorbs the database load with retries and exponential backoff.

The `like` and `follow` workers carry a `timestamp` with each job and keep an in-memory map of
the last processed timestamp per `(photoId, userId)` / `(followerId, followingId)` pair, so an
out-of-order or stale job is skipped rather than applied twice. After applying, the worker
compares the Redis counter against the database counter and reconciles on mismatch.

### Read path

Feed endpoints (`/api/photos`, `/trending`, `/latest`) serve **page 1 for anonymous requests**
from Redis (10-minute TTL) and fall through to Postgres otherwise. Feed caches are invalidated
when a photo is uploaded or deleted; photo metadata and user profiles are cached separately
with shorter TTLs. `liked` / `saved` state is always computed per-request from Postgres so it
is never served stale from a shared cache.

---

## Project layout

```
backend/
├── index.ts                     # entrypoint — loads dotenv, starts the HTTP server
├── drizzle.config.ts            # Drizzle Kit config (schema + migrations paths)
├── docker-compose.yml           # redis + app services
├── Dockerfile                   # node:22-alpine image
├── .github/workflows/deploy.yaml# CI: push to main → SSH deploy to EC2
│
├── src/
│   ├── app.ts                   # Express app: middleware, CORS, limiter, route mounting
│   │
│   ├── config/
│   │   ├── auth.config.ts       # JWT signing/verification, bcrypt hashing, token TTLs
│   │   ├── bull.config.ts       # Queue + Worker + QueueEvents factories, retry policy
│   │   ├── imagekit.config.ts   # ImageKit client
│   │   └── redis.config.ts      # ioredis client, REDIS_KEYS map, TTL table, queue names
│   │
│   ├── router/                  # Express routers + per-route rate limiters
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── follow.routes.ts
│   │   ├── publicProfile.routes.ts
│   │   ├── photo.routes.ts
│   │   ├── comment.routes.ts
│   │   ├── board.routes.ts
│   │   └── category.routes.ts
│   │
│   ├── controller/              # HTTP layer — request parsing, status codes, messages
│   │
│   ├── service/                 # business logic + data access
│   │
│   ├── services/
│   │   └── redis.service.ts     # RedisService class — all cache & counter operations
│   │
│   ├── workers/                 # BullMQ workers (one per queue)
│   │   ├── index.ts             # imports all workers
│   │   ├── like.worker.ts
│   │   ├── follow.worker.ts
│   │   ├── view.worker.ts
│   │   ├── download.worker.ts
│   │   └── share.worker.ts
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts   # authMiddleware (required) + optionalAuthMiddleware
│   │   └── imagekit.middleware.ts # multer config (memory storage, 20MB, image/* only)
│   │
│   └── db/
│       ├── db-connection.ts     # postgres client + drizzle instance
│       ├── schema/              # table definitions, relations, zod schemas
│       └── migrations/          # generated SQL + drizzle meta
│
└── (root-level *.ts)            # one-off maintenance/debug scripts — see "Known gaps"
```

Path alias `@/*` → `src/*` is configured in `tsconfig.json`.

---

## Getting started

### Prerequisites

- Node.js 22 or newer
- A running PostgreSQL database
- A running Redis instance
- An ImageKit account (public key, private key, URL endpoint)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

Create a `.env` file in the project root (see [Environment variables](#environment-variables)):

```bash
cp .env.example .env   # or create it manually
```

### 3. Start Redis and Postgres

If you run Postgres and Redis elsewhere, skip this. Otherwise, Redis comes with the compose
file:

```bash
docker compose up -d redis
```

### 4. Run the migrations

```bash
npm run db:migrate
```

### 5. Start the dev server

```bash
npm run dev
```

The server listens on `PORT` (default `3000`):

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"HALO Backend","uptime":1.23}
```

---

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | no | HTTP port. Defaults to `3000`. |
| `POSTGRES_URL` | **yes** | PostgreSQL connection string, e.g. `postgres://user:pass@localhost:5432/halo`. |
| `REDIS_URL` | **yes** | Redis connection string, e.g. `redis://localhost:6379`. Throws at startup if missing. |
| `JWT_ACCESS_SECRET` | **yes** | Secret used to sign/verify access tokens. |
| `JWT_REFRESH_SECRET` | **yes** | Secret used to sign/verify refresh tokens. Must differ from the access secret. |
| `IMAGEKIT_PUBLIC_KEY` | **yes** | ImageKit public key. |
| `IMAGEKIT_PRIVATE_KEY` | **yes** | ImageKit private key (used for uploads and deletions). |
| `IMAGEKIT_URL_ENDPOINT` | **yes** | ImageKit CDN endpoint, e.g. `https://ik.imagekit.io/your_id`. |
| `FRONTEND_URL` | no | Production frontend origin added to the CORS allow-list at boot. |

> `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `POSTGRES_URL` and `REDIS_URL` are validated at
> startup — the process throws immediately with a descriptive error if any is missing.

`.env` is git-ignored. Note that no `.dockerignore` exists, so `.env` is currently copied into
the Docker image by `COPY . .` — see [Known gaps](#known-gaps).

---

## Available scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the server in watch mode (`tsx watch index.ts`). |
| `npm start` | Start the server (`tsx index.ts`). |
| `npm run build` | Type-check the project (`tsc --noEmit`). No emit — the app runs TypeScript directly. |
| `npm run db:generate` | Generate a new migration from the schema (`drizzle-kit generate`). |
| `npm run db:migrate` | Apply pending migrations (`drizzle-kit migrate`). |
| `npm run db:push` | Push the schema straight to the database without a migration file. |
| `npm run db:studio` | Open Drizzle Studio to browse the data. |

---

## Database

Schema is defined in `src/db/schema/*.ts` and exported through `src/db/schema/index.ts`.
Relations are declared in `relations.ts`; `drizzle-zod` generates select/insert validators
alongside each table.

Tables:

| Table | Purpose |
| --- | --- |
| `users` | Accounts — email, username, password hash, avatar, display name, bio, website. |
| `sessions` | One row per login — session id, bcrypt hash of the refresh token, expiry, revocation. |
| `photos` | Wallpaper metadata — URLs (original/display/thumbnail), dimensions, size, format, blurhash, dominant colour, camera info, and the four denormalised counters. |
| `categories` | Photo categories (unique slug, optional cover image). |
| `tags` | Free-form tags (unique name). |
| `photo_categories` / `photo_tags` | Many-to-many join tables. |
| `photo_likes` | Unique like rows per `(photo, user)`. |
| `photo_views` / `photo_downloads` | Event logs with IP address and user agent. |
| `photo_comments` | Comments with author, text, timestamps. |
| `boards` / `board_photos` | User collections ("boards") and their photos. Boards can be private. |
| `user_follows` | Follow edges between users. |
| `notifications` | Like/follow/comment/save notifications with a read flag. |
| `photo_analytics` | Per-photo impressions, views, downloads, shares, saves. |
| `user_interests` | Per-user topic affinity scores, used to build recommendations. |

Migrations live in `src/db/migrations/` (currently `0000_cold_greymalkin` and `0001_brainy_karma`).
Foreign keys cascade on delete, so removing a user removes their photos, likes, comments,
boards, sessions and follow edges.

---

## API reference

Base URL: `http://localhost:3000`

All responses use a consistent envelope:

```jsonc
// success
{ "success": true, "message": "…", "data": { … } }

// error
{ "success": false, "message": "…" }
```

Paginated endpoints accept `?page=` (default `1`) and `?limit=` (default `20`, max `100`) and
return:

```jsonc
{ "data": [ … ], "total": 128, "page": 1, "limit": 20, "hasNext": true }
```

**Auth column** — 🔒 requires `Authorization: Bearer <accessToken>` · 🔓 optional (works
authenticated or anonymous, and personalises `liked` / `saved` / `isFollowing` when a valid
token is present) · 🌐 public.

### System

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/` | 🌐 | Service banner. |
| `GET` | `/health` | 🌐 | Status, service name, uptime. |

### Auth — `/api/auth`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | 🌐 | Body `{ email, username, password }`. Returns tokens + user. `409` if email/username taken. |
| `POST` | `/api/auth/login` | 🌐 | Body `{ email, password }`. `401` on bad credentials or inactive account. |
| `POST` | `/api/auth/refresh` | 🌐 | Body `{ refreshToken }`. Rotates the session and returns a new token pair. |
| `POST` | `/api/auth/logout` | 🔒 | Deletes the current session. |
| `POST` | `/api/auth/logout-all` | 🔒 | Deletes every session for the user (all devices). |
| `GET` | `/api/auth/me` | 🔒 | Current user — id, email, username, avatar. |

### Users — `/api/users`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/users/me` | 🔒 | Full profile — bio, website, photo count, likes received. |
| `PATCH` | `/api/users/me` | 🔒 | Body `{ displayName?, bio?, website? }`. Validates lengths and that the website starts with `http://`/`https://`. |
| `POST` | `/api/users/me/avatar` | 🔒 | `multipart/form-data`, field `avatar`. JPEG/PNG/WebP/GIF, max 5 MB. |
| `GET` | `/api/users/me/photos` | 🔒 | The authenticated user's photos, paginated. |
| `DELETE` | `/api/users/me` | 🔒 | Deletes the account (and cascades). |
| `GET` | `/api/users/:username` | 🔓 | Public profile — follower/following counts, photo count, `isFollowing`. |
| `GET` | `/api/users/:username/photos` | 🔓 | A user's public photos, paginated. |

### Follows — `/api/users`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/users/:userId/follow` | 🔒 | Follow a user. `400` on self-follow, `404` if the target does not exist. |
| `DELETE` | `/api/users/:userId/follow` | 🔒 | Unfollow a user. |
| `GET` | `/api/users/:userId/followers` | 🔓 | Follower list, paginated. |
| `GET` | `/api/users/:userId/following` | 🔓 | Following list, paginated. |
| `GET` | `/api/users/:userId/follow/status` | 🔒 | `{ isFollowing: boolean }` for the current user. |

### Photos — `/api/photos`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/photos/upload` | 🔒 | `multipart/form-data`, field `image` (max 20 MB, `image/*`), plus optional `title` / `description` fields. Uploads to ImageKit and stores the record. |
| `GET` | `/api/photos` | 🔓 | Main feed, newest first. |
| `GET` | `/api/photos/trending` | 🔓 | Time-decayed engagement score — likes ×4, downloads ×3, shares ×5, views ×0.1, divided by an age factor. |
| `GET` | `/api/photos/latest` | 🔓 | Newest first (same ordering as the main feed, separate cache key). |
| `GET` | `/api/photos/search` | 🔓 | Query `?q=` — matches title, description, author username, or category name. `400` if `q` is empty. |
| `GET` | `/api/photos/:id` | 🔓 | A single photo with owner info and `liked` / `saved` state. |
| `POST` | `/api/photos/:id/like` | 🔒 | Like a photo. `409` if already liked. |
| `DELETE` | `/api/photos/:id/like` | 🔒 | Remove a like. `409` if not liked. |
| `POST` | `/api/photos/:id/share` | 🔒 | Record a share, returns the new count. |
| `POST` | `/api/photos/:id/view` | 🌐 | Record a view (captures IP + user agent). |
| `POST` | `/api/photos/:id/download` | 🌐 | Record a download and return the original URL. |
| `DELETE` | `/api/photos/:id` | 🔒 | Delete a photo (owner only) and remove the file from ImageKit. `403` if not the owner. |
| `GET` | `/api/photos/category/:slug` | 🔓 | Photos in a category, paginated. |

### Comments — `/api/photos`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/photos/:photoId/comments` | 🔓 | Comments on a photo, newest first, with author details. |
| `POST` | `/api/photos/:photoId/comments` | 🔒 | Body `{ text }` — max 2000 characters. |
| `DELETE` | `/api/photos/comments/:commentId` | 🔒 | Delete a comment (author only). `403` otherwise. |

### Boards — `/api/boards`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/boards` | 🔒 | Body `{ name, description?, isPrivate? }`. |
| `GET` | `/api/boards/user/:userId` | 🔓 | A user's public boards (private boards are hidden from non-owners). |
| `GET` | `/api/boards/:boardId` | 🔓 | A single board. Private boards return `404` for non-owners. |
| `PATCH` | `/api/boards/:boardId` | 🔒 | Rename a board — body `{ name }`. |
| `DELETE` | `/api/boards/:boardId` | 🔒 | Delete a board (owner only). |
| `POST` | `/api/boards/:boardId/photos/:photoId` | 🔒 | Save a photo to a board. |
| `DELETE` | `/api/boards/:boardId/photos/:photoId` | 🔒 | Remove a photo from a board. |
| `GET` | `/api/boards/:boardId/photos` | 🔓 | Photos in a board, paginated. |
| `GET` | `/api/boards/photo/:photoId/user-boards` | 🔒 | The current user's boards, each flagged with `isSaved` for that photo. |

### Categories — `/api/categories`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/categories` | 🌐 | All active categories. |
| `GET` | `/api/categories/:slug` | 🌐 | A single category. |
| `GET` | `/api/categories/:slug/photos` | 🔓 | Photos in a category (delegates to the photo router). |

---

## Authentication flow

Two-token scheme with server-side sessions:

| Token | Lifetime | Secret | Storage |
| --- | --- | --- | --- |
| Access | 15 minutes | `JWT_ACCESS_SECRET` | Client-side (send as `Authorization: Bearer …`) |
| Refresh | 30 days | `JWT_REFRESH_SECRET` | Client-side; only its **bcrypt hash** is stored in `sessions` |

- Tokens carry `{ sub, sessionId, type, username }`. The `type` claim is verified on every
  request, so a refresh token cannot be used as an access token and vice versa.
- Passwords are hashed with bcrypt at cost **12**; refresh tokens are hashed at cost **10**.
- **Refresh rotates the session**: the old session row is deleted and a new one inserted inside
  a transaction, so a refresh token is single-use.
- `POST /api/auth/logout` deletes the current session row; `POST /api/auth/logout-all` deletes
  every session for the user.
- `authMiddleware` rejects requests without a valid `Bearer` token (`401`);
  `optionalAuthMiddleware` silently ignores a missing or invalid token and continues, so
  public endpoints can still personalise their response.

---

## Redis: caching, keys and TTLs

`src/config/redis.config.ts` centralises every key. The client is lazy-connected, retries up
to 3 times with a capped backoff, and forces IPv4.

| Key pattern | Type | TTL | Contents |
| --- | --- | --- | --- |
| `feed:{type}:page:{page}` | string (JSON) | 600 s | Feed pages (`foryou`, `trending`, `latest`). |
| `feed:category:{slug}:page:{page}` | string (JSON) | 600 s | Category feed pages. |
| `photo:{id}` | string (JSON) | 300 s | Photo metadata. |
| `photo:{id}:likes` | string (counter) | — | Like count. |
| `photo:{id}:likedUsers` | set | — | User ids that liked the photo. |
| `photo:{id}:views` | string (counter) | 86 400 s | View count. |
| `photo:{id}:downloads` | string (counter) | 86 400 s | Download count. |
| `photo:{id}:shares` | string (counter) | 86 400 s | Share count. |
| `user:{id}:followers` | set | — | Follower ids. |
| `user:{id}:following` | set | — | Following ids. |
| `user:{id}:profile` | string (JSON) | 300 s | User profile. |
| `user:username:{name}:profile` | string (JSON) | 300 s | User profile by username. |

The counts and follow sets are the **source of truth for the live read path** — Postgres is
reconciled to match in the background, not the other way round.

---

## Background jobs (BullMQ)

Five queues, defined in `src/config/bull.config.ts`:

| Queue | Worker | What it syncs |
| --- | --- | --- |
| `like-sync` | `like.worker.ts` | `photo_likes` rows and `photos.likes_count`. |
| `follow-sync` | `follow.worker.ts` | `user_follows` rows. |
| `view-sync` | `view.worker.ts` | `photo_views` event rows and `photos.views_count`. |
| `download-sync` | `download.worker.ts` | `photo_downloads` event rows and `photos.downloads_count`. |
| `share-sync` | `share.worker.ts` | `photos.shares_count`. |

Shared job options: **3 attempts**, exponential backoff starting at 1 s, 100 completed jobs
retained, 50 failed jobs retained. Workers run with concurrency 5 and log completed/failed
jobs.

> **Important:** the workers are **not currently started by the app.** `src/workers/index.ts`
> imports all five workers, but nothing imports it — `index.ts` only boots the HTTP server.
> See [Known gaps](#known-gaps).

---

## Rate limiting

`express-rate-limit` is applied at two levels. A **global** limiter caps every request, and
sensitive routes add their own stricter limiter on top.

| Scope | Window | Max |
| --- | --- | --- |
| Global (all routes) | 1 min | 100 |
| Auth (register / login / refresh) | 1 min | 10 |
| Photo upload | 1 h | 30 |
| Avatar upload | 1 h | 10 |
| Photo delete | 1 h | 20 |
| Account delete | 1 h | 3 |
| Board create | 1 h | 20 |
| Like / unlike | 1 min | 60 |
| Share | 1 min | 30 |
| Comment | 1 min | 30 |
| Follow / unfollow | 1 min | 60 |
| Save to board | 1 min | 60 |

Exceeding a limit returns `429` with `{ success: false, message: "Too many …" }`. The app
trusts one proxy hop (`trust proxy = 1`), so limits are counted per client IP behind nginx.

---

## CORS

An explicit allow-list, evaluated per request:

- `http://localhost:3000`
- `http://localhost:5173`
- `http://13.60.74.79:3000`
- `process.env.FRONTEND_URL` (added at boot when set)

`credentials: true` is enabled, methods `GET, POST, PUT, PATCH, DELETE, OPTIONS` and headers
`Content-Type, Authorization` are allowed. Requests with **no** `Origin` header (curl, mobile
apps, server-to-server) are allowed through. A blocked origin is logged and rejected.

Helmet is configured with `contentSecurityPolicy: false` and
`crossOriginResourcePolicy: "cross-origin"` so that ImageKit-hosted images can be embedded.

---

## Docker & deployment

### Locally with Compose

```bash
docker compose up -d --build
```

`docker-compose.yml` defines two services:

- **redis** — `redis:7-alpine` on port 6379, persistent volume, `redis-cli ping` healthcheck.
- **app** — builds the `Dockerfile`, exposes port 3000, waits for Redis to be healthy, and
  overrides `REDIS_URL=redis://redis:6379`.

The Dockerfile is a single stage on `node:22-alpine`: install dependencies, copy the source,
expose 3000, `npm start`.

### CI/CD

`.github/workflows/deploy.yaml` runs on every push to `main`: it SSHes into the AWS EC2 host
(using the `SSH_HOST` / `SSH_KEY` secrets) and runs `git pull && docker compose up -d --build`
in `/home/ubuntu/ratelimiting-ci-cd-backend-app`.

---

## Known gaps

Things that exist in the repo but are not yet wired up, or that need attention. These are
listed so the next person does not have to rediscover them.

1. **Workers are never started.** `src/workers/index.ts` is not imported anywhere, so no
   BullMQ consumer runs and queued jobs accumulate in Redis without being processed. The
   like/follow/view/download/share counters therefore never reach Postgres. Fix: import
   `./src/workers` from `index.ts` (or run the workers as a separate process) and call
   `connectRedis()` at boot.
2. **Duplicate job enqueues, with different payloads.** `redis.service.ts` enqueues a job
   inside `likePhoto` / `unlikePhoto` / `followUser` / `unfollowUser` / `incrementViews` /
   `incrementDownloads` / `incrementShares`, and the calling service (`photo.service.ts`,
   `follow.service.ts`) enqueues **the same job again**. Every action therefore produces two
   queue entries. The two payloads are not identical: the `redis.service.ts` copy carries a
   `timestamp`, the service-level copy does **not** — although the workers' TypeScript types
   declare `timestamp` as required. Consequences:
   - The `like` / `follow` workers still apply the row change idempotently (they check whether
     the row already exists before inserting), so duplicate jobs are mostly harmless.
   - But the missing timestamp defeats the staleness guard: `undefined < lastProcessed` is
     `false`, so the timestampless job is never skipped, and it resets the per-key tracker to
     `undefined`, after which `map.get(key) || 0` reads back as `0` and genuinely stale jobs
     stop being filtered out.
   - The `view` / `download` / `share` workers increment unconditionally, so they are not
     protected at all.
   The fix is to enqueue in exactly one place — most naturally the service layer, with the
   timestamp included.
3. **View/download/share workers re-increment Redis, which re-enqueues the job.**
   `view.worker.ts` calls `redisService.incrementViews()`, which increments the counter *and*
   enqueues another view job — so processing one view job spawns exactly one successor job.
   The queue therefore never drains, the view/download/share counters climb forever, and
   `photo_views` / `photo_downloads` grow on every cycle. The `like` and `follow` workers do
   not have this problem because they write to Postgres directly instead of calling back into
   `redis.service.ts`.
4. **No global error-handling middleware.** Express's default handler returns HTML for
   uncaught errors, so an unexpected throw returns a non-JSON body. Add a final
   `(err, req, res, next)` handler that logs and responds with the standard JSON envelope.
5. **No `.dockerignore`.** `COPY . .` copies `.env` (with live secrets) into the image, plus
   `node_modules`, `.git` and the stray root-level scripts. Add a `.dockerignore` and pass
   secrets via Compose `env_file` or the host environment instead.
6. **Notification and analytics APIs are not exposed.** `notification.service.ts` and
   `photoAnalytics.service.ts` are implemented and partially called (like and save
   notifications are created; `recordSave` is called on board save), but there is **no router**
   for `/api/notifications` and no endpoint to read analytics. The `read` flag, `markAsRead`,
   `markAllAsRead` and `getUnreadCount` helpers are unreachable from HTTP.
7. **Comment and follow notifications are never created.** `createCommentNotification` and
   `createFollowNotification` exist but are not called from the comment/follow services.
8. **Analytics counters are mostly unwired.** Only `recordSave` is called; impressions, views,
   downloads and shares never reach the `photo_analytics` table. `userInterest` scores are only
   updated for likes, and with the topic set to `category:{photoId}` rather than the photo's
   category slug, so the recommendation signal is not meaningful yet.
9. **`like.service.ts` is dead code.** It is not imported anywhere.
10. **Root-level scripts are clutter.** `add-columns.ts`, `check_schema.ts`, `check_sessions.ts`,
    `check-tables.ts`, `debug_bcrypt.ts`, `debug_refresh.ts`, `debug_refresh2.ts`,
    `fix_schema.ts`, `migrate-via-db.ts`, `run_migration.ts`, `run_migration2.ts`,
    `run-migration.ts`, `test-db.ts`, `test_bcrypt2.ts`, `test_refresh_direct.ts` and
    `cookies.txt` are one-off debugging helpers. Consider moving them into a `scripts/`
    folder or deleting them.
11. **No test suite.** `npm run build` only type-checks; there are no unit or integration tests
    and no test runner configured.
12. **`package.json` metadata is stale.** The package is still named `express-rate-limiter` with
    an empty description, and `main` points at `index.js` although the project runs TypeScript
    directly.
13. **Redis follower/following pagination is inconsistent.** `getFollowers` / `getFollowing`
    in `redis.service.ts` use `zrange` against keys that are populated with `sadd` (a set), so
    the paged variant returns empty results while the count-based paths work. Neither method
    is called today — the follower/following *lists* are served from Postgres — so this is
    latent rather than user-visible.
14. **Several Redis cache paths are defined but unused.** `getPhoto`/`setPhoto`,
    `getUserProfile`/`setUserProfile`/`getUserProfileByUsername`,
    `getLikedUsers`/`hasUserLiked`, `getCategoryFeed`/`setCategoryFeed`,
    `invalidateCategoryFeed` and `healthCheck` have no callers. Only the feed cache, the
    counters and the follow sets are actually exercised, so the photo-metadata and
    user-profile caches described above are aspirational.
15. **`follow.service.ts` reads follower/following lists from Postgres, but
    `publicProfile.service.ts` reads the *counts* from Redis.** The two can disagree while
    the follow worker is still catching up on the queue.

---

## Licence

ISC
