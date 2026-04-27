# Event Management Platform

A full-stack event & attendee management application.

## Repo layout

```
event-management/
├── docker-compose.yml    ← postgres + api + web (single-command boot)
├── event-be/             ← NestJS API (Prisma + Postgres)
│   └── README.md
└── event-fe/             ← Next.js dashboard (Tailwind + shadcn/ui)
    └── README.md
```

## Quickstart

The whole stack boots with one command. Migrations run automatically on the
API container's startup.

```bash
docker compose up --build
```

Note :

- **Web UI** → http://localhost:3000
- **API**    → http://localhost:3001/api/v1
- **Postgres** → `localhost:5432`, user `eventmgmt`, db `eventmgmt`