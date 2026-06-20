# Misane Portal

Central client app for Misane Properties — `app.misaneproperties.com`.
One login for every client; one admin view for Greg. React + Vite frontend, FastAPI + SQLite backend, JWT auth.

See `MP.BusinessConcept/Client-Process-Blueprint.md` for the full lifecycle and billing model.

## Structure
- `backend/` — FastAPI API (`main.py`), SQLite DB, auth.
- `frontend/` — React + Vite app (login, admin, client dashboard).

## Milestones
- **M1 (this)** — auth, User/Client models, admin client list + invite, login, dashboards (shells).
- **M2** — intake form + photo uploads.
- **M3** — preview/approval flow.
- **M4** — Stripe checkout ($100/$500) + $100/mo subscription.
- **M5** — full maintenance dashboard (port 3545 plan page in).
- **M6** — auto-provisioning.

## First-time VPS setup
Run `setup.sh` (see comments inside) after pointing `app.misaneproperties.com` at the VPS.
