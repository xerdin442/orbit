# Orbit Dashboard

The web dashboard for Orbit, a self-hosted platform-as-a-service. Sign in with GitHub, pick a repository, and follow the build from first commit to a live HTTPS URL. From the same UI, you can manage environments, databases, domains, variables and traffic.

The dashboard is a client of the [Orbit API](../backend). Everything it does is also available to scripts and pipelines through the [CLI](../cli).

## Features

- **Guided Project Setup**: A step-by-step wizard creates a project from any repository the Orbit GitHub App can access, or imports one from Railway or Vercel with its variables and build settings filled in.
- **Project Overview**: The live URL, the latest deployment, recent deployments and recent activity at a glance, with one-click redeploy, rollback and manual deploy.
- **Deployments**: Every deployment with its commit, trigger, status and duration. Open any one for a timeline of its build stages, container details, full logs and the actions taken on it.
- **Live Build Logs**: Logs stream into a terminal-style viewer while a deployment is in progress.
- **Rollback, Redeploy & Abort**: Each is offered only where it's valid: rollback only to successful earlier deployments, and abort only while a build is running.
- **Environments**: Deploy several branches of the same project side by side (e.g. `production` and `staging`), and switch between them from the top bar.
- **Environment Variables**: Add, edit, delete or bulk-import from a `.env` file. For each change, choose to redeploy immediately or save it for the next deployment. Credentials from managed databases are shown alongside, read-only.
- **Managed Databases**: Add PostgreSQL, MySQL, Redis or MongoDB to an environment, review the connection variables it will inject, and browse its tables and documents.
- **Database Workbench**: A SQL and MongoDB editor with schema-aware autocomplete, a table explorer and result grids, for read-only queries against a managed database.
- **Custom Domains**: Add a domain and get the exact DNS record to create, follow its verification status, and retry verification if it fails.
- **Request Logs**: Live HTTP traffic for an environment, filterable by method, path and status.
- **Integrations**: Connect GitHub installations, a Slack workspace, and Railway or Vercel accounts from Account Settings.
- **Project Settings**: Rename the project, set the build directory and start command, rotate the CI/CD access token, change the deployment branch, manage environments, or delete the project.
- **Activity Log**: A timeline of what happened across your projects: deployments, rollbacks, variable and domain changes, databases and sign-ins.
- **Mock Mode**: Run the whole dashboard on realistic mock data, with no backend at all.

## Tech Stack

- **Framework**: Next.js 16 (App Router) and React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui on Base UI
- **Server State**: TanStack Query
- **Client State**: Zustand
- **Tables**: TanStack Table
- **Forms & Validation**: React Hook Form and Zod
- **Query Editor**: Monaco (the editor behind VS Code)
- **Animation**: Framer Motion
- **Notifications**: Sonner
- **Icons**: Lucide, Solar and Font Awesome (brand logos)

## Prerequisites

- Node.js 20.9+ (required by Next.js 16)
- A running [Orbit API](../backend) instance, or none at all with [Mock Mode](#mock-mode)

## Getting Started

Clone this repository and follow the instructions to set up the dashboard locally:

### 1. Installation

- From the `frontend` directory, run `npm ci` to install the dependencies.

### 2. Environment Variables

- Create a `.env.local` file using the variables in [`.env.example`](.env.example).

### 3. Connect to the API

- Start the [backend](../backend#getting-started).
- In the backend's `.env`, set `FRONTEND_URL` variable. It's the only origin the API accepts, and where GitHub sign-in returns to.

### 4. Start the Dashboard

- Run `npm run dev`, then open `http://localhost:3000`.
- To try it without a backend, set `NEXT_PUBLIC_MOCK_MODE=true` and restart. See [Mock Mode](#mock-mode).

### 5. Lint and Build

- Lint with `npm run lint`.
- Create a production build with `npm run build`, and serve it with `npm start`.

## Configuration

| Variable | Description |
| -------- | ----------- |
| `NEXT_PUBLIC_API_URL` | Base URL of the Orbit API, including the `/api` prefix (default `http://localhost:3001/api`) |
| `NEXT_PUBLIC_MOCK_MODE` | `true` to serve mock data from [`src/mocks`](src/mocks) instead of calling the API |

> `NEXT_PUBLIC_` variables are built into the JavaScript bundle, so changing one requires a rebuild (or a dev server restart).

## Pages

| Path | Page |
| ---- | ---- |
| `/login` | Sign in with GitHub |
| `/projects` | All your projects |
| `/projects/new` | New project wizard |
| `/projects/:id` | Project overview for the selected environment |
| `/projects/:id/deployments` | Deployment history, with manual deploy |
| `/projects/:id/deployments/:deploymentId` | Deployment summary, timeline, container details, logs and activity |
| `/projects/:id/resources` | Managed databases |
| `/projects/:id/resources/:resourceId` | A database's overview, connection variables and table browser |
| `/projects/:id/resources/:resourceId/workbench` | Query editor |
| `/projects/:id/domains` | Managed and custom domains, with DNS instructions and verification status |
| `/projects/:id/environment-variables` | Variables, and credentials injected by databases |
| `/projects/:id/logs` | Live HTTP request logs |
| `/projects/:id/settings/general` | Name, build directory, start command and access token |
| `/projects/:id/settings/git` | Connected repository and deployment branch |
| `/projects/:id/settings/environments` | Create and delete environments |
| `/projects/:id/settings/danger` | Delete the project |
| `/activity` | Activity across all your projects |
| `/settings` | GitHub installations, Slack and Railway/Vercel connections |

## Signing In

- **Login** asks the API for a GitHub authorization URL and sends the browser there.
- **The return trip**: after the user approves, the API creates or finds their account and redirects back to the dashboard with a session token in the URL. The token is stored in the browser, and the user lands on their projects.
- **Every request** after that carries the token in an `Authorization: Bearer` header.
- **Expired or invalid sessions**: any `401` clears the token and returns the user to `/login`, and a `403` shows an "Access denied" page.
- **Other API errors** appear as a toast with the message from the API, so every page handles failures the same way.

## Creating a Project

The wizard at `/projects/new` works in one of two ways.

**From scratch:**

1. **Installation**: pick the GitHub account or organization to deploy from. If the Orbit GitHub App isn't installed yet, the wizard links to its installation page.
2. **Repository**: search the repositories that installation can access.
3. **Configure**:
   - name the project and choose the branch;
   - optionally set a build directory (for monorepos, e.g. `apps/web`) and a start command, both detected automatically if left blank;
   - add environment variables.
4. **Resources**: attach any databases the app needs, and adjust the variable names they'll inject if the app expects different ones.
5. **Deploy**: review everything and start the first deployment.

**Importing from Railway or Vercel:** after connecting an account in Account Settings, choose **Import**, then pick a project. Its repository, variables and build settings are carried into the same steps, pre-filled, so nothing has to be copied over by hand.

## Live Data

- **Build logs**: while a deployment is in progress, its logs stream over Server-Sent Events. Lines already written arrive first, then new ones as they happen. Finished deployments load their stored logs instead.
- **Deployment status**: an in-progress deployment's page polls every 3 seconds until the build finishes, so the timeline and status stay current without a refresh.
- **Request logs**: the **Live** toggle streams new requests in as they arrive, on top of the paginated history and filters.
- **After an action**: deploying, rolling back or changing a variable refreshes every affected view (deployments, overview, activity) straight away.

> Browsers' `EventSource` can't send an `Authorization` header, so live streams pass the session token as a `?token=` query parameter, which the API also accepts. The CLI streams with a header instead.

## Environment Variables

- Most changes only take effect after a redeploy. So adding, editing or deleting a variable asks whether to **redeploy now** or just save the change.
  - **Save and redeploy**: the change goes live, and the dashboard takes you to the new deployment.
  - **Save only**: the change is stored and picked up by the next deployment. Useful for making several changes and redeploying once.
- **Bulk import**: upload a `.env` file, review the parsed variables, then apply them all at once.
- **Values are masked** in the list until revealed.
- **Database credentials** from managed databases appear in their own read-only section. They're injected at deploy time, and take precedence over a user variable with the same name.

## Database Workbench

- The editor is **Monaco**, VS Code's editor, set to SQL or MongoDB shell syntax depending on the database.
- **Autocomplete** knows the database's schema: table and collection names, columns after a table name, SQL keywords and MongoDB methods.
- **`Cmd/Ctrl + Enter`** runs the query. A resizable side panel lists tables, collections and their columns.
- **Results** appear in a grid for SQL, and as documents for MongoDB.
- **Read-only** access is enforced by the API, not the editor: only `SELECT`, `SHOW`, `DESCRIBE` and `EXPLAIN` (or MongoDB reads), with a 30-second timeout. The editor surfaces the API's error if a query is rejected.

## Mock Mode

With `NEXT_PUBLIC_MOCK_MODE=true`, the API client never touches the network:

- Each request is matched against a route table in [`src/mocks/handler.ts`](src/mocks/handler.ts): 54 routes covering every endpoint the dashboard uses.
- The matching handler answers with mock data from the files alongside it: projects, deployments, logs, domains, databases, Workbench results and more.
- Responses use the same shape as the real API, including errors, so pages behave the same either way.
- Live streams are switched off in mock mode, and pages show the stored data instead.

This makes the whole dashboard explorable without Docker, GitHub or a server, and lets UI work run ahead of the API.

## Project Structure

```
src/
├── app/            # Routes (App Router). (app)/ holds the signed-in pages behind the sidebar layout
├── components/
│   ├── ui/         # shadcn/ui primitives
│   ├── shared/     # Reusable building blocks: data table, status badge, terminal viewer, dialogs
│   ├── wizard/     # New project wizard steps
│   ├── deployment/ # Deploy, redeploy, rollback and abort buttons, timeline, logs dialog
│   ├── environment/, domain/, resource/, settings/
│   └── layout/, sidebar/, auth/
├── hooks/          # useSSE, pagination, confirmation dialogs, selected environment
├── lib/            # API client, types, Zustand store, editor autocomplete
└── mocks/          # Mock Mode route table and mock data
```

- **One API client**: [`src/lib/api.ts`](src/lib/api.ts) is the only place that talks to the backend. It unwraps the API's `{ data }` envelope, attaches the session token, maps `401`/`403` to navigation and other errors to toasts, and switches to mocks in Mock Mode.
- **Separate state**: server data lives in TanStack Query. Zustand only holds UI state: the selected project and environment, the sidebar, and the signed-in user.

## Deployment

The dashboard is a standard Next.js app, so it runs on any Next.js host (e.g. Vercel), or on your own server with `npm run build` and `npm start`.

- Set `NEXT_PUBLIC_API_URL` to your API, e.g. `https://api.example.com/api`, before building.
- Set the backend's `FRONTEND_URL` to the dashboard's public URL. It's used for CORS and as the landing page after GitHub sign-in and Slack or GitHub App installs.
