# Orbit CLI

Command-line interface for deploying applications on [Orbit](frontend url or demo) — your self-hosted PaaS.

## Installation

```bash
npm install -g orbit-cli
```

Or run it directly without installing:

```bash
npx orbit-cli
```

## Configuration

The Orbit CLI stores its configuration at `~/.orbit/config.json`.

### API URL

Point the CLI to your self-hosted Orbit instance by setting the API URL. You only need to do this once — the value persists across sessions.

```bash
# Option 1: Environment variable
export ORBIT_API_URL=https://orbit.example.com/api

# Option 2: Pass it to any command
orbit --api-url https://orbit.example.com/api deploy

# Option 3: Set it during login
orbit auth login --api-url https://orbit.example.com/api
```

The default fallback is `http://localhost:3000/api`.

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
http://localhost:3000/api/auth/github?redirect_uri=http://localhost:58493/callback
✔ Logged in successfully.
```

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

This triggers an automatic redeploy of your application.

### Delete a variable

```bash
orbit env rm DATABASE_URL
```

You'll be asked to confirm, since this triggers a redeploy.

### Import from a .env file

Bulk-import variables are parsed from a `.env` file. Existing keys are updated, new keys are created — all in a single deployment:

```bash
orbit env import .env
```

Output:

```bash
Importing 3 variables...
DATABASE_URL ✔ (updated)
REDIS_URL ✔ (new)
SECRET_KEY ✔ (new)
Import complete. Deployment triggered: dep-abc123

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
```

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
Status:      [ready] (30/07/2026, 14:35:22)
Commit:      abc1234
URLs:
             https://my-app.192.168.1.55.sslip.io
```

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

This automatically picks the second-to-last deployment. To rollback to a specific one:

```bash
orbit rollback <deployment-id>
```

Add `--follow` to stream logs:

```bash
orbit rollback --follow
```

## Complete Workflow

```bash
# 1. Point to your Orbit instance
export ORBIT_API_URL=https://orbit.example.com/api

# 2. Log in
orbit auth login

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
