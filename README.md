# Event Management Platform

A full-stack event & attendee management application.

## Minimum Requirement
1. You should have docker for running this application.
2. You should have knowledge about javascript, python and dockerization technology to use this application.


## Repo layout

```
event-management/
├── docker-compose.yml    ← postgres + api + web (single-command boot)
├── event-be/             ← NestJS API (Prisma + Postgres)
│   └── README.md
└── event-fe/             ← Next.js dashboard (Tailwind + shadcn/ui)
│   └── README.md
└── score-match/          ← Python API for score matching using FastAPI
    └── README.md
```

## Quickstart

The whole stack boots with one command. Migrations run automatically on the
API container's startup.

```bash
docker compose up --build
```

You can use this command for restarting (will be drop data), I will recomended this command.
If you don't want to drop the data you can remove -v

```bash
docker compose up -v && docker compose up --build
```

Note :

- **Web UI** → http://localhost:3000
- **API**    → http://localhost:3001/api/v1
- **Postgres** → `localhost:5432`, user `eventmgmt`, db `eventmgmt`
- **Score Match API** → http://localhost:8000