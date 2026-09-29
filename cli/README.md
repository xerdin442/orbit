# Orbit CLI

Command-line interface for Orbit, a self-hosted PaaS. Orbit has no hosted service: you run your own instance (backend + dashboard), and this CLI talks to that instance's API.

## Requirements

- Node.js 22.12 or later
- A running Orbit instance, and its API URL

## Installation

```bash
npm install -g @xerdin442/orbit-cli
```

This installs the `orbit` command. Or run it directly without installing:

```bash
npx @xerdin442/orbit-cli <command>
```

## Configuration

### API URL (required)

The CLI has **no default server**. Until you point it at your Orbit instance's API, every command stops with a notice explaining how to set it up (only `orbit auth logout` and `orbit auth reset` run without one).

```bash
# Option 1: set it while logging in (saved for later commands)
orbit auth login --api-url https://orbit.example.com/api

# Option 2: pass it to any command (also saved for later commands)
orbit --api-url https://orbit.example.com/api info

# Option 3: environment variable (applies while set, not saved; use this in CI)
export ORBIT_API_URL=https://orbit.example.com/api
```

`ORBIT_API_URL` takes precedence over a saved URL. Use `https://`: the CLI warns if a non-local URL uses plain `http://`, because your session and project tokens would be sent unencrypted.

### Where configuration is stored

The saved API URL, your session token and the linked project live in a config file readable only by your user:

| OS | Path |
| --- | --- |
| Linux | `~/.config/orbit-nodejs/config.json` |
| macOS | `~/Library/Preferences/orbit-nodejs/config.json` |
| Windows | `%APPDATA%\orbit-nodejs\Config\config.json` |

`orbit auth reset` clears it. To keep the config somewhere else (for example a separate profile per Orbit instance), set `ORBIT_CONFIG_DIR` to a directory; the file is then `$ORBIT_CONFIG_DIR/config.json`.

## Authentication

Orbit uses GitHub OAuth to authenticate. No passwords, no API keys.

### Login

```bash
orbit auth login
```

This opens your browser to GitHub. Once you authorize, the token is stored locally and you're ready to go.

```bash
$ orbit auth login
Opening browser for authentication...
If the browser doesn't open, visit:
https://github.com/login/oauth/authorize?client_id=...&state=...
✔ Logged in successfully.
```

If the browser doesn't open automatically, open the printed URL yourself in a browser **on the same machine**: GitHub redirects back to a temporary `localhost` port that the CLI is listening on.

### See your profile

```bash
orbit auth whoami
```

```bash
Logged in as octocat
Email: octocat@github.com
```

### Logout

```bash
orbit auth logout
```

### Reset everything

Clears your auth token and all linked project context:

```bash
orbit auth reset
```

## Getting Started

### Creating a new project

`orbit init` walks you through setting up a project from a GitHub repository:

```bash
orbit init
```

The interactive flow asks for:

1. **GitHub installation** — pick the org or account where you installed the Orbit GitHub App (if none, visit the dashboard to initiate the installation flow)
2. **Repository** — choose from repos accessible to that installation
3. **Default branch** — pick the branch to deploy from (e.g. `main`)
4. **Project name** — defaults to the repo name, must be lowercase with optional hyphens
5. **.env file** _(optional)_ — path to a `.env` file to preload environment variables
6. **Deploy now?** — trigger the first deployment immediately

After the project is created, the CLI prints its project access token (needed for [CI/CD deploys](#deploying-from-cicd)). Store it as a secret right away; you can also find it later on the project's page in the dashboard.

At the end, the CLI links your current directory to the project. Subsequent commands (`deploy`, `logs`, `list`, `env`, `domains`, `info`) work without specifying project IDs.

### Linking an existing project

If a project already exists (created via the dashboard), link your local directory to it:

```bash
orbit link
```

You'll be prompted to pick a project and environment.

## Deploying

Trigger a deployment from the linked environment:

```bash
orbit deploy
```

To stream logs as the deployment progresses:

```bash
orbit deploy --follow
# or
orbit deploy -f
```

After deployment, the CLI reminds you that managed databases can be created via the Orbit dashboard.

### Deploying from CI/CD

For pipelines that aren't logged in (`orbit auth login`), deploy with a project-scoped access token instead. `orbit init` prints it when the project is created, and it's also shown on the project's page in your Orbit dashboard.

Pass the token, project ID and API URL as environment variables, so the secret stays out of the command line and CI logs:

```bash
ORBIT_API_URL=https://orbit.example.com/api \
ORBIT_TOKEN=<secretAccessToken> \
ORBIT_PROJECT_ID=<projectId> \
orbit deploy
```

`--token` and `--project` flags also work and take precedence over the variables.

A GitHub Actions workflow in your app's repository:

```yaml
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx -y @xerdin442/orbit-cli@1 deploy --follow
        env:
          ORBIT_API_URL: ${{ secrets.ORBIT_API_URL }}
          ORBIT_TOKEN: ${{ secrets.ORBIT_TOKEN }}
          ORBIT_PROJECT_ID: ${{ secrets.ORBIT_PROJECT_ID }}
```

No checkout step is needed: Orbit builds from GitHub on its own server, and the branch comes from `GITHUB_REF_NAME`.

This bypasses the locally linked context entirely. The environment to deploy is resolved from the current git branch (or `GITHUB_REF_NAME` / `CI_COMMIT_REF_NAME` / `BRANCH_NAME` in CI) — it must match the branch of an existing environment on the project, or the deploy is rejected.

With `--follow`, the CLI can't stream logs without a login session, so it instead polls the build status every 5 seconds for up to 5 minutes. On success it reports the live URL; on failure or abort it exits non-zero. If the build hasn't resolved within 5 minutes, the CLI warns that the status check timed out and to check the dashboard, then exits non-zero — the deployment itself may still complete.

## Deployment Logs

Stream real-time logs for a specific deployment:

```bash
orbit logs <deployment-id>
```

Or stream the latest deployment for the linked environment:

```bash
orbit logs
```

Log levels are color-coded: green for success, white for info, yellow for warnings, red for errors.

## Listing Deployments

View recent deployments as a table:

```bash
orbit list
# or
orbit ls

orbit list --limit 5
```

Output:

```bash
Status     Commit    Message         Trigger   Duration
[ready]    abc1234   Initial commit  manual    2m 15s
[failed]   def5678   Add login       webhook   30s
```

## Environment Variables

### List variables

```bash
orbit env ls
```

### Set a variable

```bash
orbit env set DATABASE_URL "postgresql://localhost:5432/db"
```

This triggers an automatic redeploy of your application. If nothing is live yet, the change is saved and applies on the next deploy.

### Delete a variable

```bash
orbit env rm DATABASE_URL
```

You'll be asked to confirm. Like `set`, this triggers a redeploy if something is live.

### Import from a .env file

Bulk-import variables are parsed from a `.env` file. Existing keys are updated, new keys are created — all in a single redeploy (reusing the live image), or a full deployment if nothing is live yet. Variables with empty values are skipped with a warning, and if a key appears more than once, the last value wins:

```bash
orbit env import .env
```

Output:

```bash
Importing 3 variables...
DATABASE_URL ✔ (updated)
REDIS_URL ✔ (new)
SECRET_KEY ✔ (new)
Import complete. Redeploy triggered: dep-abc123

Run `orbit logs dep-abc123` to follow.
```

## Custom Domains

### List domains

```bash
orbit domains ls
```

### Add a domain

```bash
orbit domains add app.example.com
```

The CLI displays the exact DNS record to configure:

```bash
  Domain "app.example.com" added. Configure this DNS record:
  Type:  CNAME
  Host:  app
  Value: 192.168.1.55.sslip.io
⚠ The record must not be proxied. If your DNS provider offers a proxy (e.g. Cloudflare's orange cloud), set it to DNS only.
```

For a multi-level subdomain such as `api.staging.example.com`, the host is everything left of the apex (`api.staging`).

### Remove a domain

```bash
orbit domains rm app.example.com
```

## Project Info

View the current project status at a glance:

```bash
orbit info
```

```bash
Project:     my-app
Environment: production (branch: main)
Live:        [ready] abc1234 (30/07/2026, 14:35:22)
URLs:
             https://my-app.192.168.1.55.sslip.io
```

`Live` is the deployment currently serving traffic. If a newer deployment is in progress or failed, it's shown on an extra `Latest:` line.

If no domains are active yet:

```bash
URLs:        No active domains
```

## Redeploy

Redeploy the environment's current deployment without rebuilding the Docker image (reuses the existing image):

```bash
orbit redeploy
```

Add `--follow` to stream logs:

```bash
orbit redeploy --follow
```

## Rollback

Rollback to a previous deployment:

```bash
orbit rollback
```

This automatically picks the most recent successful deployment that isn't currently live. Only successful, inactive deployments can be rolled back to. To rollback to a specific one:

```bash
orbit rollback <deployment-id>
```

Add `--follow` to stream logs:

```bash
orbit rollback --follow
```

## Abort

Stop an in-progress deployment:

```bash
orbit abort
```

This targets the latest deployment of the linked environment, and fails if it has already finished. To abort a specific one:

```bash
orbit abort <deployment-id>
```

You'll be asked to confirm. Only deployments that are still in progress (pending, cloning, building or deploying) can be aborted.

## Complete Workflow

```bash
# 1–2. Point the CLI at your Orbit instance and log in (the URL is saved for later commands)
orbit auth login --api-url https://orbit.example.com/api

# 3. Create and deploy a project
orbit init
# → pick GitHub org → pick repo → pick branch → name it → optionally import .env → deploy

# 4. Check deployment status
orbit info

# 5. Follow the deployment logs
orbit logs

# 6. Add environment variables
orbit env import .env.production

# 7. Add a custom domain
orbit domains add api.myapp.com

# 8. View recent deployments
orbit list

# 9. Rollback if something goes wrong
orbit rollback
```

## Help

Every command has a `--help` flag:

```bash
orbit --help
orbit deploy --help
orbit env --help
```

## Reference

| Command | Description |
| --- | --- |
| `orbit auth login` | Authenticate with GitHub |
| `orbit auth logout` | Clear stored credentials |
| `orbit auth whoami` | Show authenticated user |
| `orbit auth reset` | Clear all config and data |
| `orbit init` | Create a new project and deploy |
| `orbit link` | Link to an existing project |
| `orbit deploy` | Trigger a deployment |
| `orbit deploy -f` | Deploy and stream logs |
| `orbit deploy --token <t> --project <id>` | Deploy from CI/CD via project access token (or `ORBIT_TOKEN` / `ORBIT_PROJECT_ID`) |
| `orbit logs [id]` | Stream or view deployment logs |
| `orbit list` | List recent deployments |
| `orbit env ls` | List environment variables |
| `orbit env set <key> <value>` | Set an environment variable |
| `orbit env rm <key>` | Delete an environment variable |
| `orbit env import <file>` | Import variables from a .env file |
| `orbit domains ls` | List domains |
| `orbit domains add <hostname>` | Add a custom domain |
| `orbit domains rm <hostname>` | Remove a custom domain |
| `orbit info` | Show project and deployment status |
| `orbit redeploy` | Redeploy with existing image |
| `orbit rollback [id]` | Rollback to a previous deployment |
| `orbit abort [id]` | Abort an in-progress deployment |
