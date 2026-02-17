# Référence API Eco-Relais

URL de base : `/api` (ex. `http://localhost:3000/api`)

**Authentification :** envoyer le JWT dans l’en-tête `Authorization` :
```http
Authorization: Bearer <token>
```

**Content-Type :** `application/json` pour tous les endpoints JSON (sauf le webhook Stripe, qui attend un body brut).

---

## Réponses d’erreur

Toutes les erreurs API (4xx/5xx) utilisent cette forme sauf indication contraire :

| Champ     | Type    | Description        |
|-----------|---------|--------------------|
| `success` | `false` | Toujours `false`   |
| `error`   | string  | Message lisible    |
| `code`    | string  | Code machine (ex. `UNAUTHORIZED`, `NOT_FOUND`) |

**Codes courants :** `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMIT` (429), `INTERNAL_ERROR` (500).

**404 (route non trouvée) :**
```json
{ "success": false, "error": "Not found", "code": "NOT_FOUND" }
```

---

## Santé (sans auth)

### GET /health

*Hors préfixe `/api`.* Contrôle de santé du serveur.

**Réponse :** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2026-02-17T10:00:00.000Z"
}
```

---

## Auth (public)

### POST /api/auth/register

Inscription d’un nouvel utilisateur (client, partenaire ou admin).

**Corps de la requête :**

| Champ        | Type   | Obligatoire | Description                          |
|-------------|--------|-------------|--------------------------------------|
| `email`     | string | oui         | Email valide                         |
| `password`  | string | oui         | Min. 8 caractères                   |
| `role`      | string | oui         | `"client"` \| `"partner"` \| `"admin"` |
| `first_name`| string | oui         | Non vide                             |
| `last_name` | string | oui         | Non vide                             |
| `phone`     | string | non         | Optionnel                            |

**Succès :** `201 Created`
```json
{
  "success": true,
  "token": "<JWT>",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "client",
    "first_name": "Jane",
    "last_name": "Doe",
    "verified": false
  }
}
```

**Erreurs :**

| Statut | Code / condition   | Signification                    |
|--------|--------------------|----------------------------------|
| 400    | Validation / BAD_REQUEST | Corps invalide ou « Email déjà enregistré » |

---

### POST /api/auth/login

Connexion par email et mot de passe.

**Corps de la requête :**

| Champ     | Type   | Obligatoire |
|----------|--------|-------------|
| `email`  | string | oui         |
| `password` | string | oui      |

**Succès :** `200 OK`
```json
{
  "success": true,
  "token": "<JWT>",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "client",
    "first_name": "Jane",
    "last_name": "Doe",
    "verified": true
  }
}
```

**Erreurs :**

| Statut | Signification              |
|--------|----------------------------|
| 401    | Email ou mot de passe invalide |

---

### POST /api/auth/verify-email

Marquer l’utilisateur comme vérifié via le token envoyé par email (stub).

**Corps de la requête :**

| Champ  | Type   | Obligatoire |
|--------|--------|-------------|
| `token`| string | oui         |

**Succès :** `200 OK`
```json
{ "success": true, "message": "Email verified" }
```

**Erreurs :**

| Statut | Signification                        |
|--------|--------------------------------------|
| 400    | Validation ou token requis          |
| 401    | Token invalide ou expiré             |

---

## Utilisateurs (authentifié)

### GET /api/users/profile

Récupérer le profil de l’utilisateur courant.

**En-têtes :** `Authorization: Bearer <token>` requis.

**Succès :** `200 OK`
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "client",
    "first_name": "Jane",
    "last_name": "Doe",
    "phone": "+33600000000",
    "address_lat": 48.85,
    "address_lng": 2.35,
    "verified": true,
    "stripe_account_id": null,
    "created_at": "2026-02-17T10:00:00.000Z"
  }
}
```
*`stripe_account_id` vaut `"[REDACTED]"` quand il est défini, sinon `null`.*

**Erreurs :** `401` token manquant/invalide, `404` utilisateur non trouvé.

---

### PUT /api/users/profile

Mettre à jour le profil de l’utilisateur courant.

**En-têtes :** `Authorization: Bearer <token>` requis.

**Corps de la requête :** tous les champs optionnels.

| Champ         | Type   | Description        |
|---------------|--------|--------------------|
| `first_name`  | string | Non vide           |
| `last_name`   | string | Non vide           |
| `phone`       | string |                    |
| `address_lat` | number | -90..90            |
| `address_lng` | number | -180..180          |

**Succès :** `200 OK`
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "client",
    "first_name": "Jane",
    "last_name": "Doe",
    "phone": "+33600000000",
    "address_lat": 48.85,
    "address_lng": 2.35,
    "verified": true,
    "created_at": "2026-02-17T10:00:00.000Z"
  }
}
```

**Erreurs :** `401` token manquant/invalide, `400` validation, `404` utilisateur non trouvé.

---

## Missions

### POST /api/missions

Créer une mission de livraison. **Rôle :** client uniquement. Optionnel : photo du colis en multipart.

**En-têtes :** `Authorization: Bearer <token>` (client).

**Corps (JSON ou multipart) :**

| Champ             | Type   | Obligatoire | Description                          |
|-------------------|--------|-------------|--------------------------------------|
| `package_title`   | string | oui         | Non vide                             |
| `package_size`    | string | oui         | `"small"` \| `"medium"` \| `"large"` |
| `pickup_address`  | string | oui         | Non vide                             |
| `pickup_lat`      | number | oui         | -90..90                              |
| `pickup_lng`      | number | oui         | -180..180                            |
| `delivery_address`| string | oui         | Non vide                             |
| `delivery_lat`    | number | oui         | -90..90                              |
| `delivery_lng`    | number | oui         | -180..180                            |
| `pickup_time_slot`| string | oui         | Non vide (ex. "14:00-16:00")         |

**Succès :** `201 Created`
```json
{
  "success": true,
  "mission": {
    "id": "uuid",
    "client_id": "uuid",
    "partner_id": null,
    "package_photo_url": null,
    "package_title": "Colis",
    "package_size": "medium",
    "pickup_address": "10 Rue de Rivoli, Paris",
    "pickup_lat": 48.8566,
    "pickup_lng": 2.3522,
    "delivery_address": "5 Avenue des Champs-Élysées, Paris",
    "delivery_lat": 48.8698,
    "delivery_lng": 2.3078,
    "pickup_time_slot": "14:00-16:00",
    "status": "pending",
    "price": "5.00",
    "commission": "1.00",
    "qr_code": "data:image/png;base64,...",
    "created_at": "2026-02-17T10:00:00.000Z",
    "completed_at": null
  }
}
```
*`price` et `commission` peuvent être renvoyés en chaîne par la base.*

**Erreurs :** `401` token manquant/invalide, `403` pas client, `400` validation.

---

### GET /api/missions

Lister les missions. Comportement selon le rôle :

- **Client :** uniquement ses missions.
- **Partenaire :** avec `lat` + `lng` (+ optionnel `radius`) → missions *disponibles* (pending) à proximité ; sans lat/lng → missions assignées.

**En-têtes :** `Authorization: Bearer <token>` requis.

**Query (partenaire, optionnel) :**

| Param   | Type   | Description                    |
|---------|--------|--------------------------------|
| `lat`   | number | Latitude pour la recherche     |
| `lng`   | number | Longitude pour la recherche    |
| `radius`| number | Rayon en mètres (défaut 1000)  |

**Succès :** `200 OK`
```json
{
  "success": true,
  "missions": [
    {
      "id": "uuid",
      "client_id": "uuid",
      "partner_id": null,
      "package_photo_url": null,
      "package_title": "Colis",
      "package_size": "medium",
      "pickup_address": "...",
      "pickup_lat": 48.85,
      "pickup_lng": 2.35,
      "delivery_address": "...",
      "delivery_lat": 48.86,
      "delivery_lng": 2.30,
      "pickup_time_slot": "14:00-16:00",
      "status": "pending",
      "price": "5.00",
      "commission": "1.00",
      "qr_code": null,
      "created_at": "2026-02-17T10:00:00.000Z",
      "completed_at": null
    }
  ]
}
```

**Erreurs :** `401` token manquant/invalide, `403` pas client/partenaire.

---

### GET /api/missions/:id

Récupérer une mission. Autorisé si l’utilisateur est le client, le partenaire assigné ou un admin.

**En-têtes :** `Authorization: Bearer <token>` requis.

**Params :** `id` — UUID de la mission.

**Succès :** `200 OK`
```json
{
  "success": true,
  "mission": { /* même objet mission qu’au-dessus */ }
}
```

**Erreurs :** `400` UUID invalide, `401` token manquant/invalide, `403` non autorisé, `404` mission non trouvée.

---

### PUT /api/missions/:id/accept

Le partenaire accepte une mission en attente. **Rôle :** partenaire uniquement.

**En-têtes :** `Authorization: Bearer <token>` (partenaire).

**Params :** `id` — UUID de la mission.

**Succès :** `200 OK`
```json
{ "success": true, "mission": { /* mission mise à jour avec partner_id, status "accepted" */ } }
```

**Erreurs :** `400` mission non disponible / déjà acceptée, `401`/`403`/`404`.

---

### PUT /api/missions/:id/collect

Le partenaire marque le colis comme collecté. **Rôle :** partenaire assigné à cette mission.

**En-têtes :** `Authorization: Bearer <token>` (partenaire).

**Params :** `id` — UUID de la mission.

**Corps (optionnel) :**
| Champ       | Type   | Description     |
|------------|--------|-----------------|
| `qr_payload` | string | Vérification QR optionnelle |

**Succès :** `200 OK`
```json
{ "success": true, "mission": { /* status "collected" */ } }
```

**Erreurs :** `400` statut invalide, `401`/`403`/`404`.

---

### PUT /api/missions/:id/status

Le partenaire met le statut à `collected` ou `in_transit`. **Rôle :** partenaire assigné.

**En-têtes :** `Authorization: Bearer <token>` (partenaire).

**Params :** `id` — UUID de la mission.

**Corps :**

| Champ   | Type   | Obligatoire | Valeurs           |
|---------|--------|-------------|-------------------|
| `status`| string | oui         | `"collected"` \| `"in_transit"` |

**Succès :** `200 OK`
```json
{ "success": true, "mission": { /* mission mise à jour */ } }
```

**Erreurs :** `400` statut invalide, `401`/`403`/`404`.

---

### PUT /api/missions/:id/deliver

Le partenaire marque la livraison comme effectuée ; peut déclencher le paiement partenaire. **Rôle :** partenaire assigné.

**En-têtes :** `Authorization: Bearer <token>` (partenaire).

**Params :** `id` — UUID de la mission.

**Succès :** `200 OK`
```json
{
  "success": true,
  "mission": { /* status "delivered", completed_at renseigné */ }
}
```

**Erreurs :** `400` statut invalide (ex. pas in_transit), `401`/`403`/`404`.

---

### PUT /api/missions/:id/cancel

Annuler une mission. Autorisé pour le client (propriétaire), le partenaire assigné ou un admin. Interdit si le statut est `delivered` ou `cancelled`.

**En-têtes :** `Authorization: Bearer <token>` requis.

**Params :** `id` — UUID de la mission.

**Succès :** `200 OK`
```json
{ "success": true, "mission": { /* status "cancelled" */ } }
```

**Erreurs :** `400` mission non annulable, `401`/`403`/`404`.

---

## Paiements

### POST /api/payments/create-checkout

Créer une session Stripe Checkout pour une mission. **Rôle :** client (propriétaire de la mission).

**En-têtes :** `Authorization: Bearer <token>` (client).

**Corps :**

| Champ        | Type   | Obligatoire | Description                |
|-------------|--------|-------------|----------------------------|
| `mission_id`| string | oui         | UUID de la mission         |
| `success_url` | string | non       | Redirection après succès   |
| `cancel_url`  | string | non       | Redirection en cas d’annulation |

**Succès :** `200 OK`
```json
{
  "success": true,
  "url": "https://checkout.stripe.com/...",
  "session_id": "cs_..."
}
```

**Erreurs :** `400` mission_id invalide ou mission déjà payée/en cours, `401`/`403`/`404`. Une mauvaise config Stripe peut donner 500.

---

### POST /api/payments/webhook

Webhook Stripe. **Sans auth.** Body JSON brut ; ne doit pas être parsé en `application/json` par l’app (géré à part).

**En-têtes :** `Stripe-Signature` requis quand `STRIPE_WEBHOOK_SECRET` est défini.

**Succès :** `200 OK`
```json
{ "received": true }
```

**Erreurs :** `400` — secret/signature manquant ou échec de vérification du webhook (body envoyé en texte brut).

---

### GET /api/payments/earnings

Gains du partenaire et liste des transactions. **Rôle :** partenaire uniquement.

**En-têtes :** `Authorization: Bearer <token>` (partenaire).

**Succès :** `200 OK`
```json
{
  "success": true,
  "total_earnings": 12.5,
  "transactions": [
    {
      "id": "uuid",
      "mission_id": "uuid",
      "amount": 4,
      "status": "completed",
      "created_at": "2026-02-17T10:00:00.000Z"
    }
  ]
}
```

**Erreurs :** `401` token manquant/invalide, `403` pas partenaire.

---

### POST /api/payments/payout

Demander un virement vers le compte Stripe Connect du partenaire. **Rôle :** partenaire uniquement. Nécessite un compte Connect lié et un solde > 0.

**En-têtes :** `Authorization: Bearer <token>` (partenaire).

**Succès :** `200 OK`
```json
{
  "success": true,
  "payout_id": "...",
  "amount": 12.5
}
```

**Erreurs :** `400` Connect non lié / pas de solde / payout non configuré, `401`/`403`.

---

## Notifications

### GET /api/notifications

Lister les notifications de l’utilisateur courant.

**En-têtes :** `Authorization: Bearer <token>` requis.

**Succès :** `200 OK`
```json
{
  "success": true,
  "notifications": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "type": "mission_update",
      "message": "Votre mission a été acceptée.",
      "read": false,
      "created_at": "2026-02-17T10:00:00.000Z"
    }
  ]
}
```

**Erreurs :** `401` token manquant/invalide, `404` utilisateur non trouvé.

---

### PUT /api/notifications/:id/read

Marquer une notification comme lue. L’utilisateur doit être propriétaire de la notification.

**En-têtes :** `Authorization: Bearer <token>` requis.

**Params :** `id` — UUID de la notification.

**Succès :** `200 OK`
```json
{
  "success": true,
  "notification": { /* notification complète avec read: true */ }
}
```

**Erreurs :** `401`/`403`/`404`.

---

### POST /api/notifications/send

Envoyer des notifications à un ou plusieurs utilisateurs. **Rôle :** admin uniquement.

**En-têtes :** `Authorization: Bearer <token>` (admin).

**Corps :**

| Champ      | Type     | Obligatoire | Description                    |
|------------|----------|-------------|--------------------------------|
| `user_id`  | string   | non*        | UUID d’un utilisateur          |
| `user_ids` | string[] | non*       | UUID de plusieurs utilisateurs |
| `type`     | string   | oui         | Type non vide                  |
| `message`  | string   | oui         | Message non vide               |

*Un seul parmi `user_id` ou `user_ids` (non vide) est requis.

**Succès :** `201 Created`
```json
{
  "success": true,
  "notifications": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "type": "announcement",
      "message": "Nouvelle fonctionnalité disponible.",
      "read": false,
      "created_at": "2026-02-17T10:00:00.000Z"
    }
  ]
}
```

**Erreurs :** `400` validation / user_id ou user_ids manquant, `401`/`403` (pas admin).

---

## Admin

Tous les endpoints ci-dessous nécessitent **JWT** et **rôle admin**.

### GET /api/admin/stats

Statistiques globales (nombre d’utilisateurs, missions actives, revenus plateforme).

**Succès :** `200 OK` — objet avec des champs agrégés (ex. `usersCount`, `missionsCount`, `revenue`).

**Erreurs :** `401`/`403` (pas admin).

---

### GET /api/admin/users

Liste des utilisateurs (avec filtres optionnels par rôle).

**Succès :** `200 OK` — `{ "success": true, "users": [...] }`.

**Erreurs :** `401`/`403`.

---

### GET /api/admin/missions

Liste de toutes les missions (avec filtres optionnels par statut).

**Succès :** `200 OK` — `{ "success": true, "missions": [...] }`.

**Erreurs :** `401`/`403`.

---

### GET /api/admin/disputes

Liste des litiges. Actuellement en stub (tableau vide si aucune table dédiée).

**Succès :** `200 OK` — `{ "success": true, "disputes": [] }`.

**Erreurs :** `401`/`403`.

---

## Tableau récapitulatif

| Méthode | Endpoint | Auth | Rôle | Statut (succès) |
|--------|----------|------|------|------------------|
| GET | /health | non | — | 200 |
| POST | /api/auth/register | non | — | 201 |
| POST | /api/auth/login | non | — | 200 |
| POST | /api/auth/verify-email | non | — | 200 |
| GET | /api/users/profile | JWT | tout | 200 |
| PUT | /api/users/profile | JWT | tout | 200 |
| POST | /api/missions | JWT | client | 201 |
| GET | /api/missions | JWT | client/partner | 200 |
| GET | /api/missions/:id | JWT | client/partner/admin | 200 |
| PUT | /api/missions/:id/accept | JWT | partner | 200 |
| PUT | /api/missions/:id/collect | JWT | partner | 200 |
| PUT | /api/missions/:id/status | JWT | partner | 200 |
| PUT | /api/missions/:id/deliver | JWT | partner | 200 |
| PUT | /api/missions/:id/cancel | JWT | client/partner/admin | 200 |
| POST | /api/payments/create-checkout | JWT | client | 200 |
| POST | /api/payments/webhook | Stripe-Signature | — | 200 |
| GET | /api/payments/earnings | JWT | partner | 200 |
| POST | /api/payments/payout | JWT | partner | 200 |
| GET | /api/notifications | JWT | tout | 200 |
| PUT | /api/notifications/:id/read | JWT | tout | 200 |
| POST | /api/notifications/send | JWT | admin | 201 |
| GET | /api/admin/stats | JWT | admin | 200 |
| GET | /api/admin/users | JWT | admin | 200 |
| GET | /api/admin/missions | JWT | admin | 200 |
| GET | /api/admin/disputes | JWT | admin | 200 |

---

*Documentation générée à partir du backend Eco-Relais. Tous les endpoints sont couverts par les tests d’intégration (`npm run test`).*
