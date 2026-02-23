# Fonctionnalité Notifications (backend)

**Ce document explique la fonctionnalité Notifications d'Eco-Relais (backend).**

---

## 1. Ce que fait cette fonctionnalité

Les notifications permettent au backend de stocker des messages pour les utilisateurs (ex. "Votre mission a été acceptée", "Maintenance ce soir"). **N'importe quel utilisateur authentifié** peut **lister** ses propres notifications et **marquer une comme lue**. Les **admins** peuvent **envoyer** une notification à un utilisateur (user_id) ou plusieurs (user_ids), avec un type et un message. Les notifications sont stockées dans la base de données ; l'intégration Firebase (FCM) optionnelle pour les push est préparée mais non connectée (nécessiterait de stocker les tokens d'appareil par utilisateur).

---

## 2. Fichiers impliqués

| Fichier | Rôle |
|---------|------|
| `backend/src/routes/index.ts` | GET /notifications, PUT /notifications/:id/read, POST /notifications/send |
| `backend/src/controllers/notificationsController.ts` | list, markRead, send |
| `backend/src/models/Notification.ts` | create, getById, listByUserId, markAsRead |
| `backend/src/validators/notificationValidators.ts` | notificationIdValidator, sendNotificationValidator |
| `backend/src/middleware/auth.ts` | requireAuth, requireRole('admin') pour send |
| `backend/src/middleware/validation.ts` | validate() |
| `backend/src/config/firebase.ts` | getFirebaseAdmin (push optionnel) |
| `backend/src/utils/errors.ts` | BadRequestError, ForbiddenError, NotFoundError |
| `backend/src/utils/helpers.ts` | generateId (utilisé dans le modèle Notification) |

---

## 3. Explication fichier par fichier

### `backend/src/routes/index.ts`

- GET `/api/notifications` — requireAuth, notificationsList
- PUT `/api/notifications/:id/read` — requireAuth, validate(notificationIdValidator), notificationsMarkRead
- POST `/api/notifications/send` — requireAuth, requireRole('admin'), validate(sendNotificationValidator), notificationsSend

### `backend/src/controllers/notificationsController.ts`

- **list(req, res, next)** — Utilise req.user.userId. NotificationModel.listByUserId(userId). Retourne 200 { success, notifications }.
- **markRead(req, res, next)** — NotificationModel.getById(params.id). 404 si non trouvé. Vérifie notification.user_id === req.user.userId ; 403 si non. NotificationModel.markAsRead(id, req.user.userId). Retourne 200 { success, notification: updated }.
- **send(req, res, next)** — Admin uniquement. Body : user_id (unique) ou user_ids (tableau), type, message. Construit la liste des ids utilisateur depuis user_ids si présent, sinon [user_id]. Si pas d'ids ou type/message manquant, 400. Pour chaque uid, NotificationModel.create({ user_id: uid, type, message }) et pousse dans le tableau notifications. Optionnel : getFirebaseAdmin() pour FCM futur. Retourne 201 { success, notifications }.

### `backend/src/models/Notification.ts`

- **create(data)** — user_id, type, message. generateId(), INSERT dans notifications, retourne SELECT par id.
- **getById(id)** — SELECT * FROM notifications WHERE id = $1.
- **listByUserId(userId)** — SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC.
- **markAsRead(id, userId)** — UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2. Retourne getById(id).

### `backend/src/validators/notificationValidators.ts`

- **notificationIdValidator** — param('id').isUUID().
- **sendNotificationValidator** — user_id UUID optionnel, user_ids tableau optionnel d'UUIDs, type trim notEmpty, message trim notEmpty.

### `backend/src/config/firebase.ts`

- getFirebaseAdmin() — Retourne l'app Firebase Admin ou null. Utilisé dans send pour push FCM optionnel (commenté dans le controller).

---

## 4. Endpoints API

| Méthode | Chemin | Qui | Requête | Réponse |
|---------|--------|-----|---------|---------|
| GET | `/api/notifications` | Authentifié | — | 200 : { success, notifications }. 401 si non authentifié. |
| PUT | `/api/notifications/:id/read` | Authentifié (propriétaire) | — | 200 : { success, notification }. 403 si pas propriétaire. 404 si non trouvé. |
| POST | `/api/notifications/send` | Admin | Body : user_id (UUID) ou user_ids (UUID[]), type, message | 201 : { success, notifications }. 400 si ids/type/message manquant. 403 si pas admin. |

---

## 5. Flux de données

**Lister les notifications**

1. GET `/api/notifications` avec token Bearer.
2. requireAuth → list : NotificationModel.listByUserId(req.user.userId) → 200 { notifications }.

**Marquer comme lue**

1. PUT `/api/notifications/:id/read` avec token Bearer.
2. requireAuth → validate(notificationIdValidator) → markRead : getById(id), vérifie la propriété → markAsRead(id, userId) → 200 { notification }.

**Envoyer (admin)**

1. POST `/api/notifications/send` avec Bearer (admin) et body { user_id } ou { user_ids: [...], type, message }.
2. requireAuth → requireRole('admin') → validate(sendNotificationValidator).
3. send : construit le tableau ids → pour chaque uid crée NotificationModel.create({ user_id: uid, type, message }) → Firebase optionnel → 201 { notifications }.

---

## 6. Comment tester

**Lister les notifications :**

```bash
curl -s -X GET http://localhost:3001/api/notifications -H "Authorization: Bearer TOKEN"
```

**Marquer comme lue :**

```bash
curl -s -X PUT "http://localhost:3001/api/notifications/NOTIFICATION_UUID/read" \
  -H "Authorization: Bearer TOKEN"
```

**Envoyer (admin) :**

```bash
curl -s -X POST http://localhost:3001/api/notifications/send \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "USER_UUID", "type": "info", "message": "Your mission was accepted"}'
```

**Envoyer à plusieurs utilisateurs :**

```bash
curl -s -X POST http://localhost:3001/api/notifications/send \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_ids": ["UUID1", "UUID2"], "type": "maintenance", "message": "Scheduled maintenance tonight 22:00-23:00"}'
```

---

Documentation liée : [auth-feature.md](auth-feature.md), [admin-feature.md](admin-feature.md).
