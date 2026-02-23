# Base de données Eco-Relais

Schéma PostgreSQL utilisé par l’API. Les tables sont créées par `npm run migrate` (voir `src/scripts/migrate.ts`).

**Extensions :** `uuid-ossp` (génération d’UUID), `postgis` (optionnel, pour la géolocalisation des missions à proximité).

---

## Tables

### 1. `users`

Utilisateurs de la plateforme (clients, partenaires, admins).

| Colonne            | Type              | Contraintes / remarques                          |
|--------------------|-------------------|---------------------------------------------------|
| id                 | UUID              | PK, `uuid_generate_v4()`                          |
| email              | VARCHAR(255)      | UNIQUE NOT NULL                                   |
| password_hash      | VARCHAR(255)      | NOT NULL                                          |
| role               | VARCHAR(20)       | NOT NULL, `'client' \| 'partner' \| 'admin'`     |
| first_name         | VARCHAR(100)      | NOT NULL                                          |
| last_name          | VARCHAR(100)      | NOT NULL                                          |
| phone              | VARCHAR(50)       | nullable                                          |
| address_lat        | DOUBLE PRECISION  | nullable (partenaires : zone de distribution)     |
| address_lng        | DOUBLE PRECISION  | nullable                                          |
| created_at         | TIMESTAMPTZ       | DEFAULT NOW()                                     |
| verified           | BOOLEAN           | DEFAULT FALSE (ex. vérification email)            |
| stripe_account_id  | VARCHAR(255)     | nullable (Connect pour les partenaires)          |

**Index :** `idx_users_role` sur `role`.

---

### 2. `missions`

Missions de livraison (colis) créées par les clients et réalisées par les partenaires.

| Colonne            | Type              | Contraintes / remarques                          |
|--------------------|-------------------|---------------------------------------------------|
| id                 | UUID              | PK, `uuid_generate_v4()`                          |
| client_id          | UUID              | NOT NULL, FK → users(id) ON DELETE CASCADE       |
| partner_id         | UUID              | nullable, FK → users(id) ON DELETE SET NULL      |
| package_photo_url  | TEXT              | nullable (URL S3)                                |
| package_title      | VARCHAR(255)      | NOT NULL                                          |
| package_size       | VARCHAR(20)       | NOT NULL, `'small' \| 'medium' \| 'large'`       |
| pickup_address     | TEXT              | NOT NULL                                          |
| pickup_lat         | DOUBLE PRECISION  | NOT NULL                                          |
| pickup_lng         | DOUBLE PRECISION  | NOT NULL                                          |
| delivery_address   | TEXT              | NOT NULL                                          |
| delivery_lat       | DOUBLE PRECISION  | NOT NULL                                          |
| delivery_lng       | DOUBLE PRECISION  | NOT NULL                                          |
| pickup_time_slot   | VARCHAR(100)      | NOT NULL (créneau d’enlèvement)                   |
| status             | VARCHAR(30)       | NOT NULL, DEFAULT `'pending'`                     |
| price              | DECIMAL(10,2)     | NOT NULL (prix client)                           |
| commission         | DECIMAL(10,2)     | NOT NULL (part partenaire)                        |
| qr_code            | TEXT              | nullable (image QR en base64)                   |
| created_at         | TIMESTAMPTZ       | DEFAULT NOW()                                     |
| completed_at       | TIMESTAMPTZ       | nullable (date de livraison)                     |

**Statuts :** `pending` \| `accepted` \| `collected` \| `in_transit` \| `delivered` \| `cancelled`.

**Index :** `idx_missions_client_id`, `idx_missions_partner_id`, `idx_missions_status`.

---

### 3. `transactions`

Paiements liés aux missions (rémunération partenaire, historique client).

| Colonne               | Type              | Contraintes / remarques                    |
|-----------------------|-------------------|--------------------------------------------|
| id                    | UUID              | PK, `uuid_generate_v4()`                    |
| mission_id            | UUID              | NOT NULL, FK → missions(id) ON DELETE CASCADE |
| partner_id            | UUID              | NOT NULL, FK → users(id) ON DELETE CASCADE  |
| amount                | DECIMAL(10,2)     | NOT NULL (montant versé au partenaire)     |
| stripe_payment_intent | VARCHAR(255)      | nullable                                   |
| status                | VARCHAR(20)       | NOT NULL, DEFAULT `'pending'`              |
| created_at            | TIMESTAMPTZ       | DEFAULT NOW()                               |

**Statuts :** `pending` \| `completed` \| `failed`.

---

### 4. `notifications`

Notifications in-app envoyées aux utilisateurs.

| Colonne    | Type             | Contraintes / remarques                    |
|------------|------------------|--------------------------------------------|
| id         | UUID             | PK, `uuid_generate_v4()`                    |
| user_id    | UUID             | NOT NULL, FK → users(id) ON DELETE CASCADE  |
| type       | VARCHAR(50)      | NOT NULL (ex. type de notification)       |
| message    | TEXT             | NOT NULL                                   |
| read       | BOOLEAN          | DEFAULT FALSE                              |
| created_at | TIMESTAMPTZ      | DEFAULT NOW()                               |

**Index :** `idx_notifications_user_id` sur `user_id`.

---

### 5. `disputes`

Litiges liés aux missions (ouverture par client/partenaire, résolution par l’admin).

| Colonne      | Type              | Contraintes / remarques                          |
|--------------|-------------------|---------------------------------------------------|
| id           | UUID              | PK, `uuid_generate_v4()`                          |
| mission_id   | UUID              | NOT NULL, FK → missions(id) ON DELETE CASCADE   |
| raised_by    | UUID              | NOT NULL, FK → users(id) ON DELETE CASCADE      |
| reason       | TEXT              | NOT NULL                                         |
| status       | VARCHAR(20)       | NOT NULL, DEFAULT `'open'`                       |
| resolution   | TEXT              | nullable (rempli à la résolution)               |
| resolved_by  | UUID              | nullable, FK → users(id) ON DELETE SET NULL      |
| created_at   | TIMESTAMPTZ       | DEFAULT NOW()                                    |
| resolved_at  | TIMESTAMPTZ       | nullable                                         |

**Statuts :** `open` \| `in_review` \| `resolved`.

**Index :** `idx_disputes_mission_id` sur `mission_id`, `idx_disputes_status` sur `status`.

---

## Relations

```
users
  ├── missions (client_id)   — missions créées par le client
  ├── missions (partner_id)  — missions acceptées par le partenaire
  ├── transactions (partner_id) — rémunérations du partenaire
  ├── notifications (user_id)   — notifications reçues
  ├── disputes (raised_by)      — litiges ouverts par l’utilisateur
  └── disputes (resolved_by)    — litiges résolus par l’admin

missions
  ├── transactions (mission_id) — une transaction par mission livrée
  ├── disputes (mission_id)     — litiges liés à la mission
  └── users (client_id, partner_id)

disputes
  └── users (raised_by, resolved_by), missions (mission_id)
```

---

## À noter

- **Litiges :** la table `disputes` est utilisée par `POST /disputes` (création client/partenaire), `GET /admin/disputes` et `PATCH /admin/disputes/:id/resolve`.
- **PostGIS :** si l’extension est activée, les requêtes « missions à proximité » peuvent s’appuyer sur des fonctions spatiales ; sinon le backend utilise une approximation en degrés.

*Schéma défini dans `src/scripts/migrate.ts`.*
