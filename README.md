# Eco-Relais API

API REST Node.js pour **Eco-Relais**, plateforme de livraison hyperlocale.

**Développement :** La branche `dev` est la branche d’intégration ; les branches de fonctionnalités y sont fusionnées avec `--no-ff`. Ne pas pousser sur `main` dans ce workflow.

## Documentation du projet

- **Vue d’ensemble et guide du code :** `docs/PROJECT.md`
- **Référence API complète :** `docs/API.md`

## Stack technique

- **Runtime :** Node.js 18+ avec TypeScript
- **Framework :** Express.js
- **Base de données :** PostgreSQL avec PostGIS (requêtes géospatiales)
- **Auth :** JWT + bcrypt
- **Paiements :** Stripe Connect
- **Stockage :** Multer + AWS S3
- **Push :** Firebase Admin SDK
- **Cache / sessions :** Redis
- **Sécurité :** Helmet, CORS, rate limiting (express-rate-limit), express-validator
- **Documentation :** Swagger (swagger-jsdoc + swagger-ui-express)

## Installation et démarrage

1. **Environnement**

   ```bash
   cp .env.example .env
   # Éditer .env avec vos secrets (JWT_SECRET, PG_*, STRIPE_*, AWS_*, etc.)
   ```

2. **PostgreSQL + PostGIS**

   Créer une base et activer PostGIS :

   ```sql
   CREATE DATABASE eco_relais;
   \c eco_relais
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

3. **Migrations**

   ```bash
   npm run migrate
   ```

4. **Seed (optionnel)**

   ```bash
   npm run seed
   ```

   Crée des utilisateurs de test : `client@eco-relais.test`, `partner@eco-relais.test`, `admin@eco-relais.test` (mot de passe : `Password123!`).

5. **Démarrer**

   ```bash
   npm run dev   # développement
   npm start    # production (après npm run build)
   ```

- Base API : `http://localhost:3000/api`
- Si le frontend tourne sur un autre port (ex. Next.js sur 3001), définir `CORS_ORIGIN=http://localhost:3001` (ou plusieurs origines séparées par des virgules) dans `.env` pour que la connexion fonctionne.
- Santé : `GET /health`
- Swagger : `http://localhost:3000/api-docs` (quand `NODE_ENV !== 'production'` ou `SWAGGER_ENABLED=true`)
- **Référence API détaillée (endpoints, requêtes/réponses, codes de statut) :** [docs/API.md](docs/API.md)

## Tests

Les tests d’intégration API utilisent **Vitest** et **Supertest**. Ils appellent l’app et la base réelles.

1. S’assurer que PostgreSQL tourne et que les migrations ont été appliquées (étapes 2–3 ci-dessus). Les tests utilisent les mêmes variables `PG_*` que le dev ; vous pouvez utiliser une base dédiée, ex. `PG_DATABASE=eco_relais_test`.
2. Lancer les tests :

   ```bash
   npm run test        # une exécution
   npm run test:watch  # mode watch
   ```

   Couverture : health, auth (register/login/validation), profil utilisateur, missions (création/liste/acceptation/collecte/livraison/annulation), paiements (auth et validation), notifications. Stripe/AWS/Firebase sont optionnels ; les tests qui en dépendent peuvent être ignorés ou échouer avec un message clair si non configurés.

## Principaux endpoints

| Méthode | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Inscription (client/partenaire/admin) |
| POST | `/api/auth/login` | Connexion, renvoie un JWT |
| POST | `/api/auth/verify-email` | Vérification email par token |
| GET | `/api/users/profile` | Utilisateur courant (auth) |
| PUT | `/api/users/profile` | Mise à jour du profil (auth) |
| POST | `/api/missions` | Créer une mission + photo optionnelle (client) |
| GET | `/api/missions` | Liste : client = les siennes ; partenaire = à proximité (lat, lng, rayon) ou assignées |
| GET | `/api/missions/:id` | Détail d’une mission |
| PUT | `/api/missions/:id/accept` | Le partenaire accepte |
| PUT | `/api/missions/:id/collect` | Le partenaire marque comme collecté |
| PUT | `/api/missions/:id/status` | Le partenaire met à jour (collecté / en transit) |
| PUT | `/api/missions/:id/deliver` | Le partenaire livre (déclenche le paiement) |
| PUT | `/api/missions/:id/cancel` | Annuler une mission |
| POST | `/api/payments/create-checkout` | Checkout Stripe pour la mission (client) |
| POST | `/api/payments/webhook` | Webhook Stripe (body brut) |
| GET | `/api/payments/earnings` | Gains partenaire (auth) |
| POST | `/api/payments/payout` | Demande de paiement partenaire (Stripe Connect) |
| GET | `/api/notifications` | Liste des notifications (auth) |
| PUT | `/api/notifications/:id/read` | Marquer comme lu |
| POST | `/api/notifications/send` | Envoi de notification (admin) |

## Tarification

- Petit : 3 €, Moyen : 5 €, Grand : 8 €
- Commission plateforme : 20 %

## Géolocalisation

Les partenaires voient les missions **disponibles** dans un rayon de 500 m à 1 km autour de `lat`/`lng` (PostGIS `ST_DWithin`). Paramètres de requête : `?lat=48.85&lng=2.35&radius=1000` (rayon en mètres).

## Structure des fichiers

```
src/
  config/       db, stripe, aws, firebase, redis
  controllers/  auth, users, missions, payments, notifications
  middleware/   auth, validation, errorHandler, upload
  models/       User, Mission, Transaction, Notification
  routes/       index (toutes les routes)
  services/     geoService, qrService, emailService, paymentService, uploadService
  utils/        logger, helpers, errors
  validators/   chaînes express-validator
  scripts/      migrate, seed
  app.ts
  server.ts
  swagger.ts
```

## Licence

ISC
