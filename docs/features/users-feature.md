# Fonctionnalité Utilisateurs (backend)

**Ce document explique la fonctionnalité Utilisateurs (profil) d'Eco-Relais (backend).**

---

## 1. Ce que fait cette fonctionnalité

La fonctionnalité Utilisateurs permet à un utilisateur authentifié de **lire son propre profil** (GET profile) et de **mettre à jour son profil** (PUT profile). Le profil inclut le nom, le téléphone, l'adresse et les coordonnées. Les deux endpoints nécessitent un JWT valide ; l'identité vient de `req.user` défini par le middleware d'authentification, donc les utilisateurs ne peuvent voir et modifier que leurs propres données.

---

## 2. Fichiers impliqués

| Fichier | Rôle |
|---------|------|
| `backend/src/routes/index.ts` | Définit GET et PUT `/api/users/profile` avec requireAuth et validate |
| `backend/src/controllers/usersController.ts` | getProfile, updateProfile |
| `backend/src/models/User.ts` | getById, updateUser |
| `backend/src/validators/userValidators.ts` | updateProfileValidator |
| `backend/src/middleware/auth.ts` | requireAuth – attache req.user depuis le JWT |
| `backend/src/middleware/validation.ts` | validate() – exécute les validateurs pour PUT |

---

## 3. Explication fichier par fichier

### `backend/src/routes/index.ts`

- **Ce qu'il fait :** Enregistre les routes de profil. Les deux utilisent `requireAuth` (pas de restriction de rôle – n'importe quel utilisateur authentifié).
- **Lignes pertinentes :**
  - `router.get('/users/profile', requireAuth, getProfile);`
  - `router.put('/users/profile', requireAuth, validate(updateProfileValidator), updateProfile);`

### `backend/src/controllers/usersController.ts`

- **Ce qu'il fait :** Sert le profil de l'utilisateur actuel et applique les mises à jour depuis le body.
- **Fonctions clés :**
  - **getProfile(req, res, next)** — Utilise `req.user.userId` du middleware d'authentification. Charge l'utilisateur avec UserModel.getById. Retourne 200 avec un objet utilisateur nettoyé (pas de password_hash ; stripe_account_id affiché comme '[REDACTED]' si présent). 404 si utilisateur non trouvé.
  - **updateProfile(req, res, next)** — Lit first_name, last_name, phone, address, address_lat, address_lng depuis le body. Appelle UserModel.updateUser(req.user.userId, { ... }). Retourne 200 avec l'utilisateur mis à jour (nettoyé). 404 si utilisateur non trouvé.

### `backend/src/models/User.ts`

- **Ce qu'il fait :** Accès aux données pour la table users.
- **Fonctions utilisées par cette fonctionnalité :**
  - **getById(id)** — SELECT * FROM users WHERE id = $1. Retourne une ligne ou null.
  - **updateUser(id, data)** — Mise à jour partielle de first_name, last_name, phone, address, address_lat, address_lng, verified, stripe_account_id. Seuls les champs fournis sont mis à jour. Retourne l'utilisateur mis à jour via getById.

### `backend/src/validators/userValidators.ts`

- **Ce qu'il fait :** Règles de validation pour PUT profile.
- **updateProfileValidator** — first_name, last_name, phone optionnels (trim ; first/last notEmpty si présents). address_lat, address_lng optionnels, floats dans des plages valides. Tous les champs sont optionnels pour que le client puisse envoyer uniquement ce qui a changé.

### `backend/src/middleware/auth.ts`

- **Ce qu'il fait :** requireAuth lit le token Bearer, vérifie le JWT, et définit `req.user` (userId, email, role). Utilisé sur les deux routes de profil pour que le controller ait toujours l'id de l'utilisateur actuel.

---

## 4. Endpoints API

| Méthode | Chemin | Qui peut appeler | Requête | Réponse |
|---------|--------|------------------|---------|---------|
| GET | `/api/users/profile` | Authentifié (n'importe quel rôle) | Aucune (token Bearer dans l'en-tête) | 200 : `{ success: true, user: { id, email, role, first_name, last_name, phone, address, address_lat, address_lng, verified, stripe_account_id?, created_at } }`. 401 si pas de token/token invalide. 404 si utilisateur pas dans la DB. |
| PUT | `/api/users/profile` | Authentifié (n'importe quel rôle) | Body (tous optionnels) : `first_name`, `last_name`, `phone`, `address`, `address_lat`, `address_lng` | 200 : `{ success: true, user: { ... } }` (utilisateur mis à jour, pas de password). 400 si validation échoue. 401/404 comme ci-dessus. |

---

## 5. Flux de données

**GET profile**

1. Le client envoie GET `/api/users/profile` avec l'en-tête `Authorization: Bearer <token>`.
2. requireAuth s'exécute : vérifie le JWT, définit req.user (userId, email, role).
3. getProfile : UserModel.getById(req.user.userId) → construit l'objet de réponse (pas de password_hash, stripe masqué) → res.json({ success, user }).
4. La réponse est retournée au client.

**PUT profile**

1. Le client envoie PUT `/api/users/profile` avec le token Bearer et un body JSON (ex. { first_name, phone }).
2. requireAuth s'exécute → req.user défini.
3. validate(updateProfileValidator) s'exécute sur le body ; si invalide, 400 et arrêt.
4. updateProfile : lit les champs du body → UserModel.updateUser(req.user.userId, { ... }) → UPDATE users SET ... WHERE id = $n → getById → res.json({ success, user }).
5. La réponse est retournée au client.

---

## 6. Comment tester

**GET profile** (remplacez TOKEN par un JWT de connexion) :

```bash
curl -s -X GET http://localhost:3001/api/users/profile \
  -H "Authorization: Bearer TOKEN"
```

**PUT profile** :

```bash
curl -s -X PUT http://localhost:3001/api/users/profile \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"first_name": "Jane", "phone": "+33600000000"}'
```

---

Documentation liée : [auth-feature.md](auth-feature.md) (le JWT vient de la connexion), [missions-feature.md](missions-feature.md) (les missions utilisent l'id utilisateur), [payments-feature.md](payments-feature.md) (le profil peut exposer le statut stripe).
