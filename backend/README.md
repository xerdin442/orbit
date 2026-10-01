# Orbit Backend

Orbit is a self-hosted platform-as-a-service in the spirit of Railway, Vercel and Render. Connect a GitHub repository and Orbit builds it, runs it in a container and serves it on a live HTTPS URL, with managed databases, custom domains, request logs and one-click rollbacks included.

This is the API and deployment engine. The [dashboard](../frontend) and the [CLI](../cli) are both clients of it.

## Features

- **Git-to-URL Deployments**: Point Orbit at a repository and branch, and it clones, builds and starts the app, then serves it on a generated `https://` address. No Dockerfile needed: builds are detected automatically.
  > If the repo contains a Dockerfile, Orbit builds from there instead.
- **Auto-Deploy on Push**: Every push to a connected branch triggers a new deployment through the Orbit GitHub App.
- **Branch Environments**: Each project can have several environments (e.g. `production` on `main`, `staging` on `develop`), each with its own URL, variables, databases and domains.
- **Live Build Logs**: Follow every step of a deployment as it happens, from `git clone` to when your app is live.
- **Instant Rollbacks & Redeploys**: Roll back to any earlier successful deployment, or restart the current one, without rebuilding. Old builds are kept for 14 days, and older ones are rebuilt from the exact commit if needed.
- **Abort**: Stop a deployment that's still in progress. The currently live version keeps serving.
- **Managed Databases**: Provision PostgreSQL, MySQL, Redis or MongoDB alongside an app. Connection details are injected into the app's environment automatically.
- **Database Workbench**: Browse tables and run read-only queries against a managed database from the dashboard.
- **Custom Domains**: Attach your own domain with step-by-step DNS instructions and automatic verification. HTTPS certificates are issued and renewed automatically.
- **Request Logs**: See live HTTP traffic for every environment (method, path, status, latency), with bot and vulnerability-scanner noise filtered out.
- **Environment Variables**: Encrypted at rest. Changing one redeploys the environment so the app picks it up.
- **CI/CD Deploys**: Deploy from any pipeline with a per-project access token, no user login required.
- **Slack Integration**: Deploy, roll back and check status with slash commands, and follow deployments on live-updating status cards.
- **Import from Railway & Vercel**: Connect an account and pull in a project's repository, variables, domains and build settings.
- **Activity Log**: An immutable, per-user audit trail of sign-ins, deployments, rollbacks, variable changes, domains and databases.

## Tech Stack

- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL via Prisma
- **Queues & Background Jobs**: BullMQ on Redis
- **Caching & Short-Lived State**: Redis
- **Container Runtime**: Docker (via Dockerode)
- **Builds**: Railpack on BuildKit
- **Reverse Proxy & TLS**: Caddy (configured at runtime through its admin API), with ZeroSSL and Let's Encrypt
- **Auth**: GitHub OAuth (sessions) and a GitHub App (repository access and push webhooks)
- **Integrations**: Slack (Bolt, socket mode), Railway and Vercel APIs
- **Logging**: Winston
- **Tests**: Jest

## Prerequisites

- Node.js 22+
- Docker (with the daemon socket accessible to the user running the backend)
- Git
- [Railpack](https://railpack.com) CLI on the `PATH`
- A GitHub OAuth App and a GitHub App ([setup](#github-setup))
- A Slack app, if you want the Slack integration ([setup](#slack-setup))

## Getting Started

Clone this repository and follow the instructions to set up the backend locally:

### 1. Installation

- From the `backend` directory, run `npm ci` to install the dependencies.

### 2. Environment Variables

- Create a `.env` file using the variables in [`.env.example`](.env.example). Every variable is required: the server refuses to start if any is missing.
- See [Configuration](#configuration) for what each one does.

### 3. Infrastructure

- Start Postgres, Redis, Caddy and BuildKit: `docker compose up -d`
  > Caddy binds ports `80` and `443` on the host, and its admin API is only exposed on `127.0.0.1:2019`.

### 4. Database Migrations

- Apply the schema: `npx prisma migrate deploy`
- The Prisma client is committed in [`prisma/generated`](prisma/generated). After changing [`schema.prisma`](prisma/schema.prisma), create a migration with `npx prisma migrate dev` and regenerate the client with `npx prisma generate`.
  > `migrate dev` needs a direct database connection (it creates a shadow database), so it won't work through a connection pooler.

### 5. Start the Server

- Run `npm run dev` (watch mode).
- The API is available at `http://localhost:<PORT>/api`, and `GET /` returns a quick liveness check.
  > The backend runs on the host, not in Docker: it drives the Docker daemon, spawns `git` and `railpack`, and tails Caddy's logs.

### 6. Tests

- Run `npm test`. The suite has 500+ unit tests across 57 files, covering the deployment pipeline, abort races, request-log filtering, domain verification, the Workbench guards and more.

<br>

> **Local development tips**
>
> - GitHub only delivers push webhooks to a public URL, so use a tunnel (e.g. [smee.io](https://smee.io) or ngrok) pointed at `/api/github/webhook` to test auto-deploys.
> - For managed hostnames without a real domain, set `INGRESS_HOST` to an [sslip.io](https://sslip.io) name such as `192.168.1.55.sslip.io`, which resolves to that IP.

## Configuration

| Variable | Description |
| -------- | ----------- |
| `NODE_ENV`, `PORT` | Runtime mode and the API port (default `3000`) |
| `DATABASE_URL` | Orbit's own Postgres database |
| `ORBIT_POSTGRES_USER`, `ORBIT_POSTGRES_PASSWORD`, `ORBIT_POSTGRES_DB` | Credentials for the Postgres container in `docker-compose.yml` |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_URL` | Redis for queues, caching and short-lived state |
| `JWT_SECRET` | Signs session tokens (valid for 3 days) |
| `ENCRYPTION_KEY` | Encrypts secrets at rest (AES-256-GCM, key derived with scrypt). Use a long random string, and never change it once data exists |
| `FRONTEND_URL` | Dashboard URL: the only allowed CORS origin, and where OAuth flows return |
| `RATE_LIMITING_PER_SECOND`, `RATE_LIMITING_PER_MINUTE` | Global API rate limits per client |
| `MAX_CUSTOM_DOMAINS` | Custom domains allowed per environment |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI` | GitHub OAuth App, for signing in |
| `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET` | GitHub App, for repository access and push webhooks |
| `DOCKER_SOCKET` | Path to the Docker socket, usually `/var/run/docker.sock` |
| `BUILDKIT_HOST` | BuildKit address Railpack builds against, e.g. `docker-container://buildkit` |
| `CADDY_ADMIN_URL`, `CADDY_CONTAINER_NAME` | Caddy's admin API (`http://localhost:2019`) and container name (`orbit-caddy`) |
| `CADDY_ON_DEMAND_ASK` | URL Caddy calls before issuing a certificate: `http://host.docker.internal:<PORT>/api/internal/caddy/tls-check` |
| `ACME_EMAIL`, `ZEROSSL_API_KEY` | Certificate issuance: ZeroSSL first, Let's Encrypt as the fallback |
| `INGRESS_HOST`, `INGRESS_IP` | Base domain for generated app URLs (e.g. `apps.example.com`) and the server's public IP |
| `POSTGRES_IMAGE_TAG`, `MYSQL_IMAGE_TAG`, `REDIS_IMAGE_TAG`, `MONGO_IMAGE_TAG` | Docker images used for managed databases |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, `SLACK_REDIRECT_URI`, `SLACK_BOT_SCOPES`, `SLACK_APP_TOKEN` | Slack app credentials (socket mode) |

## Endpoints

All endpoints are prefixed with `/api`. Responses are wrapped as `{ "data": ... }`, and paginated lists as `{ "data": [...], "meta": { total, page, limit, totalPages } }`.

**Auth** column: **JWT** is a session token (`Authorization: Bearer <token>`). **Project token** is a project access token (`x-project-token` header). **Signature** is a GitHub webhook HMAC.

### Auth API

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/auth/github?redirect_uri=` | None | Get the GitHub sign-in URL (`redirect_uri` lets the CLI receive the token on `localhost`) |
| GET | `/auth/github/callback` | None | OAuth callback: creates or signs in the user and redirects with a session token |
| GET | `/auth/me` | JWT | Get the signed-in user's profile |

### Projects API

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| POST | `/projects` | JWT | Create a project from a repository, with a `production` environment and optional variables |
| GET | `/projects` | JWT | List the user's projects |
| GET | `/projects/:id` | JWT | Get a project, including its access token |
| PATCH | `/projects/:id` | JWT | Update project settings (name, health check, build directory, start command) |
| DELETE | `/projects/:id` | JWT | Delete a project and all its containers, images, databases and routes |
| GET | `/projects/:id/branches` | JWT | List the repository's branches other than the default, for new environments |
| POST | `/projects/:id/tokens/rotate` | JWT | Rotate the project access token |

### Environments API

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| POST | `/projects/:projectId/environments` | JWT | Create an environment for a branch and deploy it |
| GET | `/projects/:projectId/environments` | JWT | List a project's environments |
| GET | `/projects/:projectId/environments/:id` | JWT | Get an environment |
| PATCH | `/projects/:projectId/environments/:id` | JWT | Update an environment (changing the branch redeploys it) |
| DELETE | `/projects/:projectId/environments/:id` | JWT | Delete an environment and its resources |
| GET | `/projects/:projectId/environments/:id/variables` | JWT | List variables (decrypted) |
| POST | `/projects/:projectId/environments/:id/variables?skip_redeploy=` | JWT | Add a variable |
| POST | `/projects/:projectId/environments/:id/variables/bulk?skip_redeploy=` | JWT | Add several variables at once |
| PATCH | `/projects/:projectId/environments/variables/:id?skip_redeploy=` | JWT | Update a variable |
| DELETE | `/projects/:projectId/environments/variables/:id?skip_redeploy=` | JWT | Delete a variable |

### Deployments API

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| POST | `/environments/:environmentId/deploy?resource_count=` | JWT | Deploy the branch's latest commit |
| POST | `/environments/:environmentId/redeploy` | JWT | Restart the live deployment without rebuilding |
| GET | `/environments/:environmentId/deployments?page=&limit=&status=&trigger=` | JWT | List deployments |
| GET | `/deployments/:id` | JWT | Get a deployment |
| POST | `/deployments/:id/rollback` | JWT | Roll back to this deployment |
| POST | `/deployments/:id/abort` | JWT | Abort an in-progress deployment |
| GET | `/deployments/:id/logs` | JWT | Get the deployment's logs |
| GET | `/deployments/:id/logs/stream` | JWT | Stream logs live (Server-Sent Events) |
| POST | `/projects/:projectId/deploy?branch=` | Project token | CI/CD: deploy the environment tracking `branch` |
| GET | `/projects/:projectId/deploy/:deploymentId` | Project token | CI/CD: poll a deployment's status and URL |

### Domains API

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| POST | `/environments/:id/domains` | JWT | Add a custom domain; returns the DNS record to create |
| GET | `/environments/:id/domains` | JWT | List an environment's domains |
| GET | `/domains/:id` | JWT | Get a domain |
| GET | `/domains/:id/instructions` | JWT | Get a domain's DNS instructions again |
| POST | `/domains/:id/retry-verification` | JWT | Restart verification for a failed domain |
| DELETE | `/domains/:id` | JWT | Remove a custom domain |

### Resources API (Managed Databases)

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/resources/defaults?type=` | JWT | List the variables each database type will inject |
| POST | `/environments/:environmentId/resources` | JWT | Provision a database |
| GET | `/environments/:environmentId/resources` | JWT | List an environment's databases |
| GET | `/resources/:id` | JWT | Get a database |
| POST | `/resources/:id/clear` | JWT | Wipe a database's data |
| DELETE | `/resources/:id` | JWT | Delete a database and its volume |

### Workbench API

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/resources/:id/schema` | JWT | Get tables/collections with their columns and indexes |
| GET | `/resources/:id/tables` | JWT | List tables or collections |
| GET | `/resources/:id/tables/:name?page=&limit=` | JWT | Browse rows or documents |
| POST | `/resources/:id/query` | JWT | Run a read-only query |

### Request Logs API

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/environments/:id/requests?method=&path=&statusCode=&statusClass=` | JWT | List HTTP requests to an environment |
| GET | `/environments/:id/requests/stream` | JWT | Stream requests live (SSE) |

### GitHub API

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/github/install` | JWT | Get the GitHub App installation URL |
| GET | `/github/install/callback` | None | App installation callback (the GitHub App's Setup URL) |
| GET | `/github/installations` | JWT | List the user's installations |
| DELETE | `/github/installations/:installationId` | JWT | Remove an installation |
| GET | `/github/installations/:installationId/repositories` | JWT | List repositories an installation can access |
| GET | `/github/installations/:installationId/branches?repo=` | JWT | List a repository's branches |
| GET | `/github/installations/:installationId/update-access` | JWT | Get the URL to change which repositories the app can access |
| POST | `/github/webhook` | Signature | Push events that trigger auto-deploys |

### Integrations API

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/slack/install` | JWT | Get the Slack connection URL |
| GET | `/slack/callback` | None | Slack OAuth callback |
| DELETE | `/slack/installation` | JWT | Disconnect Slack |
| POST | `/migrations/:provider/connect` | JWT | Connect a Railway or Vercel account with an API token |
| DELETE | `/migrations/:provider/connect` | JWT | Disconnect the provider |
| GET | `/migrations/:provider/projects` | JWT | List projects on the connected provider |
| GET | `/migrations/:provider/projects/:externalId` | JWT | Get a project's repository, variables, domains and build settings |

### Other

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/activity?projectId=&environmentId=&type=` | JWT | Get the user's activity log |
| GET | `/internal/caddy/tls-check?domain=` | None | Caddy asks this before issuing a certificate |

## Deployment Lifecycle

Every deployment is a BullMQ job that runs a fixed sequence of steps, each with its own build status:

1. **Clone** (`cloning`): the repository is cloned with a short-lived GitHub App installation token.
2. **Resolve commit** (`building`): the commit SHA and message are recorded. A rollback checks out its exact commit instead of the branch tip.
3. **Build image** (`building`): Railpack detects the language and framework and builds an image tagged `<project>-<id>:<commit>`, with the environment's variables available at build time.
4. **Create container** (`building`): the container is created on the project's private Docker network, with its start command and runtime variables (including managed database credentials).
5. **Start** (`deploying`): the container must reach a running state within 120 seconds.
6. **Health check** (`deploying`): optionally, the app must answer HTTP on its configured port and path.
7. **Configure proxy** (`deploying`): the environment's domains are routed to the new container through Caddy's admin API.
8. **Activate** (`ready`): in one transaction, the new deployment goes live and the previous one is marked inactive.
9. **Clean up**: the previous deployment's container is stopped and removed. Its image is kept for rollbacks.

Build logs are written to the database and pushed to open log streams at the same time. A viewer who connects mid-deployment gets the backlog first, then live lines, with no duplicates. Failures inside a step are shown to the user as-is. Anything unexpected is logged as a system error and shown as "Internal server error".

**Redeploys and rollbacks skip the first four steps** by reusing the image of the deployment they restart. A rollback can only target a deployment that succeeded and isn't currently live.

**Images are pruned daily.** An image is only removed once it's older than 14 days *and* isn't used by the live deployment or any deployment still inside that window. Per-deployment cleanup never deletes images, because an image that just went inactive is exactly what a rollback needs. If you roll back to a deployment whose image was pruned, the full pipeline runs again from that deployment's exact commit.

## Aborting Safely

An abort and a running pipeline race to update the same deployment row, so every status change is a conditional update rather than a read followed by a write:

- **Abort** only succeeds if the deployment is still `pending`, `cloning`, `building` or `deploying`. A deployment that finishes a moment earlier can't be flipped to "aborted".
- **Each pipeline step** only advances the status if the deployment hasn't been aborted in the meantime. If it has, the pipeline stops and cleans up its container and workspace.
- **A step that fails after an abort** leaves the deployment "aborted" rather than "failed", since the failure is a side effect of the abort.
- **Activation** promotes the new deployment first, inside a transaction, and only if it wasn't aborted. Otherwise the transaction rolls back and the previous deployment is never taken offline.

## Domains & HTTPS

- **Managed domains**: every environment gets a generated hostname such as `my-app-k3j9x2a.apps.example.com`. Non-default branches include the environment name (`my-app-staging-…`). The random suffix is needed because project names aren't unique across users, but hostnames must be.
- **Custom domains**: adding one returns a DNS record to create:
  - A **CNAME** to `INGRESS_HOST` for subdomains.
  - An **A record** to `INGRESS_IP` for apex domains.
  - For multi-level subdomains (`api.staging.example.com`), the record host is everything left of the apex (`api.staging`).
- **Verification** runs every minute for up to 30 minutes, resolving the domain's CNAME or A record and checking it points at Orbit. The record must be **DNS only**: a proxied record (e.g. Cloudflare's orange cloud) resolves to the proxy's IPs and never verifies.
- **Certificates** are issued on demand the first time a hostname is visited. Before issuing, Caddy asks `/internal/caddy/tls-check`, which approves only hostnames backed by an active domain. That stops anyone from pointing arbitrary domains at the server to mint certificates.
- **Routing** is written to Caddy at runtime through its admin API, and Caddy runs with `--resume`, so routes survive restarts.

## Managed Databases

- Each database runs as its own container with a persistent volume, a generated password and a Docker health check. Provisioning happens in the background, and the database is marked `ready` once it reports healthy.
- It joins the project's private network, where the project's apps reach it by container name. Its port is only published on `127.0.0.1` on the host, so it's reachable by Orbit itself (for the Workbench) and never from the internet.
- Once ready, its connection variables (e.g. `DATABASE_URL`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`) are merged into the app's environment on every deploy. Resource credentials win over user-defined variables with the same name.
- If provisioning fails, its container and volume are removed straight away, so failed attempts don't leave orphaned data behind. A database can't be deleted while it's still provisioning, which closes a race where the background job could create a volume after the record was gone.

## Database Workbench

The Workbench gives the dashboard read-only access to managed Postgres, MySQL and MongoDB databases:

- **SQL** queries must start with `SELECT`, `SHOW`, `DESCRIBE` or `EXPLAIN`.
- **MongoDB** queries must be read-only shell calls such as `db.<collection>.find(...)`, `aggregate`, `countDocuments` or `distinct`. Write stages and server-side JavaScript operators are rejected.
- Every query times out after **30 seconds**. Table browsing is paginated, with table names validated before they reach SQL.
- Redis isn't supported, since it is a key-value store and has no tables to browse.

## Request Logs

- Caddy writes a JSON access log for every request. The backend follows the `orbit-caddy` container's log output, maps each hostname to its environment, and stores method, path, query, status and latency. New entries are pushed to open log streams as they arrive, and rows are kept for 7 days.
- Public servers get constant scanner traffic, and it would drown out real requests. Before storing anything, the ingester filters:
  - **Framework internals and static assets**: `/_next/`, `.js`, `.css`, images and fonts.
  - **Known probe patterns**: dotfiles such as `.env` and `.git`, WordPress paths, `.php`, cloud credential files.
  - **Scripted clients**: curl, python-requests and scanner user agents.
  - **Background browser requests**: CORS preflights and speculative prefetches.
- Some sweeps get past all of that. A **burst detector** keeps a short sliding window per client IP. An IP that makes 15+ requests in 10 seconds, with at least 80% of them errors, is treated as a scanner. Its requests are dropped, and anything it stored in the last 15 seconds is deleted.
- Client IPs are stored only so a burst can be cleaned up. They're never returned by the API.
- The burst detector runs in memory. That's deliberate: the backend runs as a single process, which sees all traffic. Moving the counters to Redis only becomes necessary if the backend is scaled to several instances.

## CI/CD & Webhooks

- **Auto-deploys**: a GitHub push webhook deploys every environment whose branch matches and has auto-deploy on. Webhooks are verified with an HMAC-SHA256 signature, compared in constant time.
- **Project access tokens** let a pipeline deploy without a user session: `POST /projects/:id/deploy?branch=<branch>` with the `x-project-token` header. Tokens are stored twice:
  - as a **SHA-256 hash**, for fast lookup on every request;
  - **encrypted**, so the dashboard can show the token again to its owner.
- The [CLI](../cli) wraps this as `orbit deploy`, reading `ORBIT_TOKEN` and `ORBIT_PROJECT_ID` from the pipeline's environment.

## Slack Integration

- A workspace connects through "Add to Slack". Whoever installed it can authorize teammates with `/slack add @user` and `/slack revoke @user`.
- **Commands**:
  - `/deploy <project> [environment]` and `/rollback <project> [environment]`, with a confirmation step.
  - `/ping <project> [environment]` for the environment's current status.
- Each deployment posts a status card that updates in place as it moves through the pipeline, ending with the commit, the outcome and an **Open Deployment** button.
- Commands are rate-limited per user: 10 per minute, of which at most 2 can be deploys or rollbacks.
- Installations that have been inactive for 20 days are cleaned up daily.

## Security

- **Secrets at rest**: environment variables, database credentials, provider tokens and project access tokens are encrypted with AES-256-GCM.
- **Ownership checks**: every lookup by id is scoped to the requesting user's projects in the query itself. Another user's resource is indistinguishable from a missing one, and returns the same "not found" exception.
- **Input validation**: every request body and query is validated against a whitelist. Unknown fields are rejected rather than ignored.
- **Transport and headers**: Helmet sets security headers. CORS allows only the dashboard's origin, and the API has global per-second and per-minute rate limits.
- **Isolation**: apps and databases run on per-project Docker networks. Database ports are published only on `127.0.0.1`, and Caddy's admin API is only reachable from the host.
- **OAuth state**: GitHub and Slack flows use one-time state values stored in Redis for 10 minutes. Login redirects are limited to the dashboard and `localhost` (for the CLI).

## Production Deployment

### DNS

Point these records at the server's IP (`INGRESS_IP`), all **DNS only** (unproxied):

| Type | Name | Purpose |
| ---- | ---- | ------- |
| A | `api` | The Orbit API (e.g. `api.example.com`) |
| A | `apps` | The bare `INGRESS_HOST`, which custom-domain CNAMEs point to |
| A | `*.apps` | Generated app hostnames (`*.apps.example.com`) |

> The bare `apps` record is easy to miss: a wildcard (`*.apps`) never matches its own parent name, so custom domains CNAMEd to `apps.example.com` would resolve to nothing.

### GitHub Setup

- **OAuth App** (sign-in): set the callback URL to `https://<api-host>/api/auth/github/callback` (`GITHUB_REDIRECT_URI`).
- **GitHub App** (repositories):
  - **Setup URL:** `https://<api-host>/api/github/install/callback`
  - **Webhook URL:** `https://<api-host>/api/github/webhook`, with a secret (`GITHUB_WEBHOOK_SECRET`)
  - **Repository permissions:** Contents (read) and Metadata (read)
  - **Subscribe to:** Push events
  - Generate a private key and set it as `GITHUB_APP_PRIVATE_KEY`.

### Slack Setup

- Create an app with **Socket Mode** enabled, and generate an app-level token (`SLACK_APP_TOKEN`).
- Add the bot scopes from `SLACK_BOT_SCOPES` (see [`.env.example`](.env.example) for required scopes) and the slash commands `/deploy`, `/rollback`, `/ping` and `/slack`.
- Set the OAuth redirect URL to `https://<api-host>/api/slack/callback`.

### Serving the API

Caddy serves the API itself as well as the apps. Its on-demand certificates are only approved for app domains, so the API host needs its own route and certificate policy. Add both once through the admin API; Caddy's `--resume` keeps them across restarts:

```bash
# Certificate policy for the API host (inserted before the on-demand policy)
curl -X PUT http://localhost:2019/config/apps/tls/automation/policies/0 \
  -H "Content-Type: application/json" \
  -d '{"subjects":["api.example.com"],"issuers":[{"module":"zerossl","api_key":"{env.ZEROSSL_API_KEY}"},{"module":"acme","email":"{env.ACME_EMAIL}"}]}'

# Route the API host to the backend on the host machine
curl -X PUT http://localhost:2019/config/apps/http/servers/srv0/routes/0 \
  -H "Content-Type: application/json" \
  -d '{"@id":"orbit-api","match":[{"host":["api.example.com"]}],"handle":[{"handler":"reverse_proxy","upstreams":[{"dial":"host.docker.internal:3000"}]}]}'
```

### Running and Updating

- Run the backend as a `systemd` service (e.g. `orbit-backend`) that starts `npm run prod` from the `backend` directory, with the user in the `docker` group.
- [`scripts/deploy.sh`](scripts/deploy.sh) updates a running server:
  1. pull, and install with `npm ci`
  2. apply migrations
  3. **run the tests**: a failing suite stops the update before anything restarts
  4. build and restart the service
- [`.github/workflows/deploy-backend.yml`](../.github/workflows/deploy-backend.yml) runs `deploy.sh` over SSH on every push to `main` that touches `backend/`. It needs the `DEPLOY_HOST`, `DEPLOY_USER` and `DEPLOY_SSH_KEY` secrets, and passwordless `sudo` for `systemctl restart orbit-backend` only.
- **Disk usage**: build images and BuildKit's cache are the main consumers. Images are pruned automatically after 14 days. Check usage with `docker system df`, and reclaim build cache with `docker builder prune`.
