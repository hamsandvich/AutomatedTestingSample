# Daymark

Daymark is a polished, responsive todo planner built for the small decisions that make a day feel manageable. It has a daily dashboard, productivity stats, and a drag-and-drop calendar—without needing an external service to get started.

## Stack

- **Next.js 15** with React and TypeScript
- **Tailwind CSS** for responsive UI styling
- **Prisma + SQLite** for a portable persistent database
- **Nixpacks** configuration included for straightforward Coolify deployment

## Features

- Create tasks with a title, due date, optional time, priority, category, and notes
- Complete, edit, delete, and reschedule tasks
- Clear derived task states: pending, completed, and missed/overdue
- Home dashboard for today, overdue tasks, upcoming tasks, and quick capture
- Search and filter by status, priority, and category
- Calendar with weekly/monthly modes, day details, and native drag-and-drop rescheduling
- Stats including completion rate, missed tasks, week activity, current streak, and best streak
- Priority colors, categories, dark mode, friendly empty states, confirmation before deletion, and a small completion confetti moment

## Run locally

Prerequisites: Node.js 20+ and npm.

```bash
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

Open the address shown by Next.js (normally `http://localhost:3000`). The default database file is created at `data/todo.db`.

For an existing database, apply the committed migrations with:

```bash
npm run db:migrate
npm run build
npm run start
```

Optional sample data can be added to an empty database:

```bash
npm run db:seed
```

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Prisma database URL. The included default is `file:../data/todo.db`. Prisma resolves SQLite paths from `prisma/schema.prisma`. |
| `NEXT_PUBLIC_APP_URL` | No | Public application URL; reserved for future links/integrations. It is not required for normal operation. |
| `PORT` | No | Supplied by Coolify/Nixpacks. Next.js automatically respects it. |

For a local SQLite database use:

```env
DATABASE_URL="file:../data/todo.db"
```

## Coolify + Nixpacks deployment

1. Push this project to a Git repository and create a **New Resource → Application** in Coolify.
2. Choose that repository and select **Nixpacks** as the build pack. `nixpacks.toml` is already included.
3. Add the environment variable below in Coolify:

   ```env
   DATABASE_URL=file:../data/todo.db
   ```

4. Add a persistent volume with **source** `daymark-data` (or any durable volume name) mounted at **`/app/data`**. This step matters: without it, a SQLite database is recreated when a container is replaced.
5. Deploy. Nixpacks runs `npm ci`, builds the Next.js app, creates the initial SQLite file on the mounted volume if needed, then runs `prisma migrate deploy` before starting the app.

Coolify injects the listening port, so do not set a hardcoded `localhost` URL or port in the application configuration.

### Using PostgreSQL instead

SQLite is intentionally the no-service default. For larger/multi-instance deployments, provision a Coolify PostgreSQL service, change the Prisma datasource provider to `postgresql`, set its connection string as `DATABASE_URL`, then create and commit a matching Prisma migration. The UI and API do not need any changes.

## Database commands

| Command | Purpose |
| --- | --- |
| `npm run db:generate` | Regenerate the Prisma client after schema changes. |
| `npm run db:setup` | Create the default local SQLite file and apply committed migrations. |
| `npm run db:push` | Synchronize a local development database without a migration. |
| `npm run db:migrate` | Apply committed migrations (used by deployment). |
| `npm run db:seed` | Add a few starter tasks to an empty database. |

## Project structure

```text
app/                    Pages, global styles, and REST API routes
components/dashboard.tsx  Client-side dashboard, stats, calendar, and dialogs
lib/                    Prisma singleton and todo validation/state helpers
prisma/                 Schema, migrations, and optional seed data
data/                   SQLite database location (mount this in Coolify)
nixpacks.toml           Nixpacks build/start configuration
```

## Useful scripts

```bash
npm run dev      # local development server
npm run build    # generate Prisma client and build Next.js
npm run start    # production server
```
