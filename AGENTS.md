# AGENTS.md

Context and instructions for AI agents (Claude, Copilot, etc.) working in this repository.

---

## Project Overview

MC Server Manager is a self-hosted web dashboard for managing a Minecraft server. It is built with React + TanStack Router and runs on the same Ubuntu Server VM as the Minecraft server. The frontend is served as static files via nginx. CI/CD is handled by GitHub Actions — every push to `main` auto-deploys to the server via rsync over SSH.

This is a personal project with one developer. Keep things simple and pragmatic.

---

## Project Goals

1. Clean, modern web UI for Minecraft server management
2. Fully automated deployment: push to `main` → live on the server within minutes
3. Progressive feature additions without breaking existing functionality
4. No external hosting — entirely self-hosted on the user's Ubuntu VM

---

## Tech Stack

- **React 18 + TypeScript** — UI
- **TanStack Router v1** — client-side routing
- **TanStack Query** — server data fetching (to be added in Phase 2)
- **Vite** — build tool
- **Plain CSS** — no CSS framework (keep it lean)
- **GitHub Actions** — CI/CD
- **nginx** — static file serving on Ubuntu Server

---

## Repository Structure

```
src/
  pages/        # Route-level page components (one per route)
  components/   # Reusable UI components
  hooks/        # Custom React hooks
  utils/        # Utility/helper functions
  styles/       # CSS files
  types/        # Shared TypeScript type definitions
.github/
  workflows/    # GitHub Actions workflow files
```

---

## Coding Standards

- **TypeScript strict mode** — no `any`, no `@ts-ignore` without justification
- **Functional components only** — no class components
- **No inline styles** except for dynamic/computed values
- **No CSS frameworks** (MUI, Tailwind, shadcn, etc.) without explicit approval
- **No UI component libraries** without explicit approval
- Keep components small and focused — extract when a component exceeds ~100 lines
- Prefer named exports over default exports

---

## Agent Instructions

### Keeping the README Up to Date

**This is a standing requirement.** After every meaningful change, update `README.md`:

- **New feature implemented** → check it off the Planned Features list (change `[ ]` to `[x]`)
- **New feature not yet in the list** → add it under the appropriate phase and check it off
- **New dependency added** → update the Tech Stack table
- **Dev workflow changed** → update the Development section
- **Server setup steps changed** → update the Server Setup section

The README is the single source of truth for what this project does and how to run it. Keep it accurate.

### Branch Naming Convention

All feature branches should be named after their GitHub issue number:
- Format: `#<issue-number>-<issue-title>`
- Examples: `#4-server-status-header`, `#5-console-interface-command-input`

This makes it easy to trace code changes back to their requirements and track progress.

### When Adding a New Page / Route

1. Create the page component in `src/pages/`
2. Register the route in `src/main.tsx`
3. Update README Planned Features to reflect the new feature

### When Adding a New Dependency

1. Justify it — prefer native browser APIs and small focused packages
2. Update the Tech Stack table in README if it's a significant addition
3. Do not add packages that duplicate functionality already present

### CI/CD Awareness

The deploy workflow lives at `.github/workflows/deploy.yml`. It runs on every push to `main`. If you change the build output directory or build command, update the workflow file to match.

### Commit Messages

Write descriptive commit messages:
- `feat: add player list page with online/offline status`
- `fix: server status indicator not updating on reconnect`
- `chore: update README with Phase 2 features`

Do not write vague messages like `update stuff` or `fix bug`.

### What NOT to Do

- Do not push directly to `main` — use feature branches and PRs
- Do not add `TODO` comments in code — either implement it or leave it out
- Do not add placeholder/stub functionality without a clear comment explaining it's intentional
- Do not over-engineer — this is a personal project, keep it simple
- Do not add a backend framework without discussing architecture first (the MC server interaction strategy hasn't been decided yet)
