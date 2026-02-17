## Eco-Relais API (Backend) — Documentation du projet

Ce dépôt contient l’**API REST Eco-Relais** (Express + TypeScript) utilisée par le dashboard frontend.

### Vue d’ensemble

Eco-Relais est une plateforme de livraison hyperlocale avec 3 rôles :

- **client** : crée les missions (enlèvement + livraison), paie, suit l’avancement
- **partner** : accepte les missions à proximité, collecte, livre, gagne
- **admin** : vue opérationnelle (stats, utilisateurs, missions, litiges)

Concept central : une **mission** (demande de livraison de colis) avec les statuts :  
`pending → accepted → collected → in_transit → delivered` (ou `cancelled`).

### Stack technique

- Node.js 18+, Express, TypeScript
- PostgreSQL (+ PostGIS si disponible)
- Auth JWT + autorisation par rôle
- Stripe (checkout + paiements partenaires)
- Intégrations optionnelles : S3 (uploads), Firebase (push), Redis

### Installation en local

1. Créer le fichier d’environnement :

```bash
cp .env.example .env
```

2. Exécuter les migrations :

```bash
npm run migrate
```

3. Données de démo (optionnel mais recommandé pour tester l’interface) :

```bash
npm run seed
```

Le seed crée des comptes de démo (mot de passe : `Password123!`) :

- `client@eco-relais.test`
- `partner@eco-relais.test`
- `admin@eco-relais.test`

4. Démarrer l’API :

```bash
npm run dev
```

Base API : `http://localhost:3000/api`  
Santé : `GET http://localhost:3000/health`

### Intégration avec le frontend

Le frontend appelle ce backend via une URL de base d’API (exemple) :

- `NEXT_PUBLIC_API_URL=http://localhost:3000/api`

Si le frontend tourne sur un autre port, configurer CORS :

- `CORS_ORIGIN=http://localhost:3001` (ou liste séparée par des virgules)
- `DASHBOARD_URL=http://localhost:3001` (utilisé pour les URLs de repli Stripe)

### Authentification et rôles

Les clients s’authentifient via `POST /api/auth/login` et reçoivent un **JWT**.  
Pour les endpoints protégés, envoyer :

```http
Authorization: Bearer <token>
```

Les contrôles de rôle sont assurés par `requireRole(...)` (voir `src/middleware/auth.ts`).

### Principales routes API (résumé)

Référence complète dans `docs/API.md`. Groupes principaux :

- **Auth** : `/auth/register`, `/auth/login`
- **Users** : `/users/profile`
- **Missions** : `/missions`, `/missions/:id`, accept/collect/status/deliver/cancel
- **Payments** : `/payments/create-checkout`, `/payments/earnings`, `/payments/payout`
- **Notifications** : `/notifications`, `/notifications/:id/read`, `/notifications/send`
- **Admin** : `/admin/stats`, `/admin/users`, `/admin/missions`, `/admin/disputes`

### Modèle de données (tables)

Créées par `src/scripts/migrate.ts` :

- `users`
- `missions`
- `transactions`
- `notifications`

Il n’y a pas actuellement de table **disputes** ; `/api/admin/disputes` renvoie un tableau vide (stub).

### État des endpoints admin

- Implémentés : `GET /api/admin/stats`, `GET /api/admin/users`, `GET /api/admin/missions`, `GET /api/admin/disputes` (stub)
- Non implémentés dans ce dépôt : actions admin sur les utilisateurs (`PATCH /admin/users/:id/...`), résolution des litiges (`PATCH /admin/disputes/:id/resolve`)

### Tests

Tests d’intégration (Vitest + Supertest) :

```bash
npm run test
```

Les tests appellent l’API et la base réelles. Utiliser une base de test dédiée via les variables d’environnement si besoin.

### Carte du code

Points d’entrée :

- `src/server.ts` — démarrage du serveur, vérification de la connexion DB
- `src/app.ts` — middleware, CORS, routes, gestionnaire d’erreurs

Dossiers principaux :

- `src/routes/` — enregistrement des routes (montées sous `/api`)
- `src/controllers/` — gestionnaires de requêtes
- `src/models/` — requêtes base de données
- `src/middleware/` — auth/rôle, validation, upload, gestionnaire d’erreurs
- `src/scripts/` — migrations + seed
