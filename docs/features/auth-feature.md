# Fonctionnalité d'authentification (backend)

**Ce document explique la fonctionnalité d'authentification d'Eco-Relais (backend).**

---

## 1. Ce que fait cette fonctionnalité

L'authentification permet aux utilisateurs de **s'inscrire** (créer un compte avec email, mot de passe, rôle et nom), de **se connecter** (obtenir un token JWT à utiliser pour les requêtes suivantes), et de **vérifier leur email** (cliquer sur un lien avec un token pour marquer le compte comme vérifié). Les mots de passe sont hachés avec bcrypt et jamais stockés en clair. Après la connexion ou l'inscription, l'API retourne un JWT que le frontend envoie dans l'en-tête `Authorization` sur chaque requête protégée.

---

## 2. Fichiers impliqués

| Fichier | Rôle |
|---------|------|
| `backend/src/routes/index.ts` | Définit POST `/api/auth/register`, `/api/auth/login`, `/api/auth/verify-email` et connecte validate + controller |
| `backend/src/controllers/authController.ts` | Handlers register, login, verifyEmail ; signature JWT ; stockage des tokens de vérification |
| `backend/src/models/User.ts` | createUser, getById, getByEmail, updateUser (utilisés pour créer/trouver l'utilisateur et définir verified) |
| `backend/src/validators/authValidators.ts` | registerValidator, loginValidator, verifyEmailValidator (chaînes express-validator) |
| `backend/src/middleware/validation.ts` | validate() – exécute les validateurs et retourne 400 en cas d'échec |
| `backend/src/services/emailService.ts` | sendVerificationEmail() – envoie (ou log) le lien de vérification |
| `backend/src/utils/errors.ts` | BadRequestError, UnauthorizedError (utilisés par le controller) |
| `backend/src/utils/helpers.ts` | generateId() – UUID pour le token de vérification |

---

## 3. Explication fichier par fichier

### `backend/src/routes/index.ts`

- **Ce qu'il fait :** Monte les trois routes d'authentification sous `/api` (donc les chemins complets sont `/api/auth/register`, etc.). Pas de `requireAuth` – ces endpoints sont publics.
- **Lignes pertinentes :**  
  - `router.post('/auth/register', validate(authRegisterValidator), authRegister);`  
  - `router.post('/auth/login', validate(authLoginValidator), authLogin);`  
  - `router.post('/auth/verify-email', validate(authVerifyEmailValidator), authVerifyEmail);`  
  Le corps de la requête est validé en premier ; si la validation échoue, le controller n'est jamais appelé.

### `backend/src/controllers/authController.ts`

- **Ce qu'il fait :** Implémente register, login et verify-email. Hache les mots de passe, crée/récupère les utilisateurs via le modèle User, signe les JWTs, et gère les tokens de vérification en mémoire.
- **Fonctions clés :**
  - **signToken(payload)** — Signe un JWT avec `JWT_SECRET`, expiration 7 jours. Utilisé après register et login.
  - **toPayload(user)** — Construit `{ userId, email, role }` à partir d'une ligne utilisateur pour le payload JWT.
  - **register(req, res, next)** — Lit email, password, role, first_name, last_name, phone depuis le body. Vérifie que l'email n'est pas déjà utilisé (UserModel.getByEmail), hache le mot de passe (bcrypt, 12 rounds), crée l'utilisateur (UserModel.createUser), génère un token de vérification (generateId), stocke token→userId en mémoire (setVerificationToken), envoie l'email de vérification (sendVerificationEmail), puis signe le JWT et retourne 201 avec token et user (sans password_hash).
  - **verifyEmail(req, res, next)** — Lit token depuis le body. Recherche userId par token (getUserIdByVerificationToken) ; si absent, retourne Unauthorized. Met à jour le flag verified de l'utilisateur (UserModel.updateUser(userId, { verified: true })), efface le token, retourne 200 avec message de succès.
  - **login(req, res, next)** — Lit email et password. Charge l'utilisateur par email (UserModel.getByEmail) ; si aucun ou si le mot de passe ne correspond pas (bcrypt.compare), retourne Unauthorized. Construit le payload, signe le JWT, retourne 200 avec token et user (sans password_hash).
- **Tokens de vérification :** Stockés dans une `Map` en mémoire (token → userId). Un redémarrage du serveur les perd ; en production, utiliser Redis ou la DB.

### `backend/src/models/User.ts`

- **Ce qu'il fait :** Tous les accès à la base de données pour la table users (create, get by id, get by email, update).
- **Fonctions utilisées par l'authentification :**
  - **createUser(data)** — Insère un utilisateur avec id généré, email, password_hash, role, first_name, last_name, phone, etc. Retourne l'utilisateur créé (getById).
  - **getByEmail(email)** — SELECT par LOWER(email). Utilisé pour éviter les inscriptions en double et trouver l'utilisateur à la connexion.
  - **getById(id)** — Retourne une ligne utilisateur ou null.
  - **updateUser(id, data)** — Mise à jour partielle (first_name, last_name, phone, address, verified, etc.). L'authentification l'utilise pour définir `verified: true` après la vérification de l'email.

### `backend/src/validators/authValidators.ts`

- **Ce qu'il fait :** Définit les règles express-validator pour les corps de requête d'authentification.
- **Exports clés :**
  - **registerValidator** — email (isEmail, normalizeEmail), password (longueur min 8), role (un parmi client, partner, admin), first_name et last_name (trim, notEmpty), phone optionnel.
  - **loginValidator** — email (isEmail, normalizeEmail), password (notEmpty).
  - **verifyEmailValidator** — token (notEmpty).

### `backend/src/middleware/validation.ts`

- **Ce qu'il fait :** Middleware générique qui exécute un tableau de chaînes express-validator. Si l'une échoue, il appelle `next(BadRequestError)` avec le premier message d'erreur (le client reçoit 400). Sinon, il appelle `next()` pour que le controller s'exécute.

### `backend/src/services/emailService.ts`

- **Ce qu'il fait :** Envoie (ou dans le stub actuel, log) l'email de vérification.
- **sendVerificationEmail(email, token)** — Construit le lien à partir de `VERIFY_EMAIL_BASE_URL` et du token, le log. En production, appellerait SendGrid/SES pour envoyer l'email.

### `backend/src/utils/errors.ts` et `backend/src/utils/helpers.ts`

- **errors :** Le controller lance `BadRequestError` (ex. email déjà enregistré, token requis) et `UnauthorizedError` (connexion invalide, token de vérification invalide/expiré). Le gestionnaire d'erreurs central transforme ces erreurs en JSON 400/401.
- **helpers :** `generateId()` retourne un UUID utilisé comme token de vérification.

---

## 4. Endpoints API

| Méthode | Chemin | Qui peut appeler | Requête | Réponse |
|---------|--------|------------------|---------|---------|
| POST | `/api/auth/register` | N'importe qui (public) | Body : `email`, `password` (min 8), `role` (client\|partner\|admin), `first_name`, `last_name`, `phone` (optionnel) | 201 : `{ success: true, token, user: { id, email, role, first_name, last_name, verified } }`. 400 si email déjà enregistré ou validation échoue. |
| POST | `/api/auth/login` | N'importe qui (public) | Body : `email`, `password` | 200 : `{ success: true, token, user: { id, email, role, first_name, last_name, verified } }`. 401 si email ou mot de passe invalide. |
| POST | `/api/auth/verify-email` | N'importe qui (public) | Body : `token` (token de vérification depuis le lien email) | 200 : `{ success: true, message: 'Email verified' }`. 400 si token manquant. 401 si token invalide ou expiré. |

Toutes les réponses d'erreur suivent la forme JSON d'erreur de l'app (ex. `{ success: false, error: '...', code: '...' }`).

---

## 5. Flux de données

**Inscription**

1. Le client envoie POST `/api/auth/register` avec un body JSON (email, password, role, first_name, last_name, phone).
2. Express exécute `validate(authRegisterValidator)` → les validateurs s'exécutent sur le body ; si invalide, 400 et arrêt.
3. `authRegister` s'exécute : UserModel.getByEmail(email) → si existe, lance BadRequestError → bcrypt.hash(password) → UserModel.createUser(...) → generateId() pour le token de vérification → setVerificationToken(token, userId) → sendVerificationEmail(email, token) → toPayload(user) → signToken(payload) → res.status(201).json({ success, token, user }).
4. La réponse revient ; le frontend stocke le token et l'utilisateur.

**Connexion**

1. Le client envoie POST `/api/auth/login` avec { email, password }.
2. validate(authLoginValidator) s'exécute ; si invalide, 400.
3. authLogin : UserModel.getByEmail(email) → si !user lance UnauthorizedError → bcrypt.compare(password, user.password_hash) → si !match lance UnauthorizedError → signToken(toPayload(user)) → res.json({ success, token, user }).
4. La réponse revient ; le frontend stocke le token et l'utilisateur.

**Vérification de l'email**

1. Le client (ou l'utilisateur cliquant sur le lien) envoie POST `/api/auth/verify-email` avec { token }.
2. validate(verifyEmailValidator) s'exécute ; si token vide, 400.
3. verifyEmail : getUserIdByVerificationToken(token) → si !userId lance UnauthorizedError → UserModel.updateUser(userId, { verified: true }) → clearVerificationToken(token) → res.json({ success, message }).
4. La base de données a user.verified = true ; le token est retiré de la mémoire.

---

## 6. Comment tester

**Inscription**

```bash
curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123",
    "role": "client",
    "first_name": "Jane",
    "last_name": "Doe"
  }'
```

**Connexion**

```bash
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "SecurePass123"}'
```

**Vérification de l'email** (utilisez le token qui a été logué par sendVerificationEmail en développement, ou celui que votre frontend reçoit depuis le lien) :

```bash
curl -s -X POST http://localhost:3001/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "VOTRE_TOKEN_DE_VERIFICATION_UUID"}'
```

---

Documentation liée : [users-feature.md](users-feature.md) (le profil utilise le même modèle User et JWT de la connexion), [missions-feature.md](missions-feature.md) (les missions nécessitent l'authentification), [LEARN-THE-CODEBASE.md](../../LEARN-THE-CODEBASE.md) (guide général du codebase).
