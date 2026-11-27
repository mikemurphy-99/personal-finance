# Personal Finance App

Clean, minimal personal finance tracker. Runs in Docker on Raspberry Pi 5 (or any Linux host).

## Features (v1)

- Multiple accounts with running balances
- Transaction register (income & expenses)
- Categories
- Recurring transactions (monthly bills) with one-click "Post" to an account

## Quick Start (Docker)

```bash
# Build and run
git clone https://github.com/mikemurphy-99/personal-finance.git
cd personal-finance
docker compose up -d --build

# App will be available at http://localhost:3000
# (or http://your-pi-ip:3000)
```

Data is stored in a Docker volume (`finance-data`). To back up:

```bash
docker run --rm -v finance-app_finance-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/finance-backup.tar.gz -C /data .
```

## Development

```bash
# Terminal 1 – backend
cd backend
npm install
npm run dev

# Terminal 2 – frontend
cd frontend
npm install
npm run dev
# Frontend at http://localhost:5173 (proxies API to :3000)
```

## Tech

- Backend: Node.js + Express + SQLite
- Frontend: React + Vite + Tailwind CSS
- Dark mode by default, fully responsive
