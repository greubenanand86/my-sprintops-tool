# SprintOps Console

Internal Azure DevOps (ADO) operations tool for Readiness Tracking and Release Management.

## 🔐 Authentication Architecture

The application uses **Server-Side Personal Access Token (PAT)** authentication. 
- The PAT is stored securely in Netlify environment variables.
- Authentication headers are constructed within serverless functions.
- **No credentials or tokens are ever exposed to the browser.**

## 🛠 Configuration Setup

### 1. Azure DevOps PAT Scopes
To function correctly, the PAT requires the following minimum scopes:
- **Work Items**: `Read & Write` (Required for creating tasks, adding approval comments, and linking items).
- **Project and Team**: `Read` (Required for fetching iterations, team members, and field metadata).

### 2. Environment Variables
Configure the following variables in your Netlify dashboard (`Site settings` > `Environment variables`):

| Variable | Description | Example |
| :--- | :--- | :--- |
| `ADO_ORG_URL` | Full URL of the ADO Org | `https://dev.azure.com/my-org/` |
| `ADO_PROJECT` | Default ADO Project Name | `MyProject` |
| `ADO_PAT` | Personal Access Token | `[REDACTED]` |

> **⚠️ Critical Security Note**: Do not use the `VITE_` prefix for these variables. Variables with the `VITE_` prefix are automatically injected into the client-side JavaScript bundle by Vite.

### 3. Deployment
Any change to the environment variables in Netlify requires a **new deployment** to take effect. You can trigger this manually via `Deploys` > `Trigger deploy` > `Clear cache and deploy site`.

## 🚀 Local Development
1. Copy `.env.example` to `.env`.
2. Add your development PAT and Org details.
3. Run `yarn install` and `yarn dev`.
