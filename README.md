# Eco-Relais API

Production-ready Node.js REST API for Eco-Relais, a hyperlocal package delivery platform.

## Project documentation

- **Project overview & codebase guide:** `docs/PROJECT.md`
- **Full API reference:** `docs/API.md`

## Tech stack

- **Runtime:** Node.js 18+ with TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL with PostGIS (geospatial queries)
- **Auth:** JWT + bcrypt
- **Payments:** Stripe Connect
- **Storage:** Multer + AWS S3
- **Push:** Firebase Admin SDK
- **Cache/Sessions:** Redis
- **Security:** Helmet, CORS, rate limiting (express-rate-limit), express-validator
- **Docs:** Swagger (swagger-jsdoc + swagger-ui-express)

## Setup

1. **Environment**

   ```bash
   cp .env.example .env
   # Edit .env with your secrets (JWT_SECRET, PG_*, STRIPE_*, AWS_*, etc.)
   ```

2. **PostgreSQL + PostGIS**

   Create a database and enable PostGIS:

   ```sql
   CREATE DATABASE eco_relais;
   \c eco_relais
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

3. **Run migrations**

   ```bash
   npm run migrate
   ```

4. **Seed (optional)**

   ```bash
   npm run seed
   ```

   Creates test users: `client@eco-relais.test`, `partner@eco-relais.test`, `admin@eco-relais.test` (password: `Password123!`).

5. **Start**

   ```bash
   npm run dev   # development
   npm start     # production (after npm run build)
   ```

- API base: `http://localhost:3000/api`
- If the frontend runs on another port (e.g. Next.js on 3001), set `CORS_ORIGIN=http://localhost:3001` (or add it comma-separated) in `.env` so login works.
- Health: `GET /health`
- Swagger: `http://localhost:3000/api-docs` (when `NODE_ENV !== 'production'` or `SWAGGER_ENABLED=true`)
- **Full API reference (endpoints, request/response, status codes):** [docs/API.md](docs/API.md)

## Testing

API integration tests use **Vitest** and **Supertest**. They hit the real app and database.

1. Ensure PostgreSQL is running and migrations have been applied (steps 2–3 above). Tests use the same `PG_*` env vars as development; you can use a separate DB, e.g. `PG_DATABASE=eco_relais_test`.
2. Run tests:

   ```bash
   npm run test        # single run
   npm run test:watch  # watch mode
   ```

   Tests cover: health, auth (register/login/validation), users profile, missions (create/list/accept/collect/deliver/cancel), payments (auth and validation), notifications. Stripe/AWS/Firebase are optional; tests that need them may be skipped or fail with a clear error if not configured.

## Main endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register (client/partner/admin) |
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/verify-email` | Verify email with token |
| GET | `/api/users/profile` | Current user (auth) |
| PUT | `/api/users/profile` | Update profile (auth) |
| POST | `/api/missions` | Create mission + optional photo (client) |
| GET | `/api/missions` | List: client = own; partner = nearby (lat, lng, radius) or assigned |
| GET | `/api/missions/:id` | Mission details |
| PUT | `/api/missions/:id/accept` | Partner accepts |
| PUT | `/api/missions/:id/collect` | Partner marks collected |
| PUT | `/api/missions/:id/status` | Partner sets collected / in_transit |
| PUT | `/api/missions/:id/deliver` | Partner delivers (triggers payment) |
| PUT | `/api/missions/:id/cancel` | Cancel mission |
| POST | `/api/payments/create-checkout` | Stripe checkout for mission (client) |
| POST | `/api/payments/webhook` | Stripe webhook (raw body) |
| GET | `/api/payments/earnings` | Partner earnings (auth) |
| POST | `/api/payments/payout` | Partner request payout (Stripe Connect) |
| GET | `/api/notifications` | List notifications (auth) |
| PUT | `/api/notifications/:id/read` | Mark read |
| POST | `/api/notifications/send` | Admin send notification |

## Pricing

- Small: 3€, Medium: 5€, Large: 8€
- Platform commission: 20%

## Geospatial

Partners see **available** missions within 500 m–1 km of `lat`/`lng` (PostGIS `ST_DWithin`). Use query params: `?lat=48.85&lng=2.35&radius=1000` (radius in meters).

## File structure

```
src/
  config/       db, stripe, aws, firebase, redis
  controllers/  auth, users, missions, payments, notifications
  middleware/   auth, validation, errorHandler, upload
  models/       User, Mission, Transaction, Notification
  routes/       index (all routes)
  services/     geoService, qrService, emailService, paymentService, uploadService
  utils/        logger, helpers, errors
  validators/   express-validator chains
  scripts/       migrate, seed
  app.ts
  server.ts
  swagger.ts
```

## License

ISC
