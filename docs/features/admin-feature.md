# Fonctionnalité Admin (backend)

**Ce document explique la fonctionnalité Admin d'Eco-Relais (backend).**

---

## 1. Ce que fait cette fonctionnalité

La fonctionnalité Admin donne aux **utilisateurs admin** une API backend pour voir les **stats** de la plateforme (total utilisateurs, missions actives, revenus, croissance sur 6 mois pour utilisateurs et revenus), **gérer les utilisateurs** (liste paginée avec filtre de rôle optionnel), **gérer les missions** (lister toutes avec filtre de statut optionnel), et **gérer les litiges** (lister tous avec statut optionnel, résoudre un litige avec un texte de résolution). Tous les endpoints admin nécessitent un JWT valide avec le rôle `admin`. Les champs sensibles (password_hash, stripe_account_id complet) sont masqués dans les réponses.

---

## 2. Fichiers impliqués

| Fichier | Rôle |
|---------|------|
| `backend/src/routes/index.ts` | GET /admin/stats, /admin/users, /admin/missions, /admin/disputes ; PATCH /admin/disputes/:id/resolve |
| `backend/src/controllers/adminController.ts` | stats, listUsers, listMissions, listDisputes, resolveDispute |
| `backend/src/models/Dispute.ts` | listAll, getById, resolveDispute |
| `backend/src/config/db.ts` | pool (utilisé directement pour les queries users, missions, stats) |
| `backend/src/validators/disputeValidators.ts` | resolveDisputeValidator |
| `backend/src/middleware/auth.ts` | requireAuth, requireRole('admin') |
| `backend/src/middleware/validation.ts` | validate() pour resolve |
| `backend/src/utils/errors.ts` | ForbiddenError, NotFoundError |
| `backend/src/types/index.ts` | DisputeStatus (optionnel) |

---

## 3. Explication fichier par fichier

### `backend/src/routes/index.ts`

- GET `/api/admin/stats` — requireAuth, requireRole('admin'), adminStats
- GET `/api/admin/users` — requireAuth, requireRole('admin'), adminListUsers
- GET `/api/admin/missions` — requireAuth, requireRole('admin'), adminListMissions
- GET `/api/admin/disputes` — requireAuth, requireRole('admin'), adminListDisputes
- PATCH `/api/admin/disputes/:id/resolve` — requireAuth, requireRole('admin'), validate(resolveDisputeValidator), adminResolveDispute

### `backend/src/controllers/adminController.ts`

- **stats(req, res, next)** — Admin uniquement. Exécute 6 queries en parallèle : COUNT users ; COUNT missions où status pas dans (delivered, cancelled) ; SUM(commission) depuis les missions delivered ; COUNT users créés avant il y a 6 mois ; nouveaux utilisateurs par mois sur les 6 derniers mois ; revenus par mois (delivered, completed_at dans la fenêtre). Construit le tableau `growth` de { month, users (cumulatif), revenue } pour les 6 derniers mois. Retourne 200 { success, total_users, active_missions, revenue, growth }.
- **listUsers(req, res, next)** — Admin uniquement. Query : role (optionnel), page (défaut 1), limit (défaut 15, max 100). Rôles valides : client, partner, admin. Exécute COUNT avec filtre de rôle optionnel ; exécute SELECT avec LIMIT/OFFSET (pas de password_hash dans SELECT ; stripe_account_id masqué comme '[REDACTED]' dans la réponse). Retourne 200 { success, data, total, page, limit }.
- **listMissions(req, res, next)** — Admin uniquement. Query : statut optionnel (pending, accepted, collected, in_transit, delivered, cancelled). SELECT * FROM missions avec filtre de statut optionnel, ORDER BY created_at DESC, LIMIT 500. Retourne 200 { success, data, total, page: 1, limit: 500 }.
- **listDisputes(req, res, next)** — Admin uniquement. Query : statut optionnel (open, in_review, resolved). DisputeModel.listAll({ status } ou undefined). Retourne 200 { success, disputes }.
- **resolveDispute(req, res, next)** — Admin uniquement. Paramètres id, body resolution. DisputeModel.getById(id) ; 404 si non trouvé. DisputeModel.resolveDispute(id, resolution, req.user.userId). Retourne 200 { success, dispute: updated }.

### `backend/src/models/Dispute.ts`

- **listAll(options?)** — Si options.status : SELECT * FROM disputes WHERE status = $1 ORDER BY created_at DESC. Sinon : SELECT * FROM disputes ORDER BY created_at DESC.
- **getById(id)** — SELECT * FROM disputes WHERE id = $1.
- **resolveDispute(id, resolution, resolved_by)** — UPDATE disputes SET status = 'resolved', resolution = $2, resolved_by = $3, resolved_at = NOW() WHERE id = $1. Retourne getById(id).

### `backend/src/validators/disputeValidators.ts`

- **resolveDisputeValidator** — param id UUID, body resolution trim notEmpty.

### `backend/src/config/db.ts`

- **pool** — Utilisé par adminController pour SQL brut (stats, listUsers, listMissions) et par le modèle Dispute.

---

## 4. Endpoints API

| Méthode | Chemin | Qui | Requête | Réponse |
|---------|--------|-----|---------|---------|
| GET | `/api/admin/stats` | Admin | — | 200 : { success, total_users, active_missions, revenue, growth: [{ month, users, revenue }, ...] }. 403 si pas admin. |
| GET | `/api/admin/users` | Admin | Query : role optionnel, page, limit | 200 : { success, data: users[], total, page, limit }. password_hash omis ; stripe_account_id masqué. 403 si pas admin. |
| GET | `/api/admin/missions` | Admin | Query : statut optionnel | 200 : { success, data: missions[], total, page: 1, limit: 500 }. 403 si pas admin. |
| GET | `/api/admin/disputes` | Admin | Query : statut optionnel (open, in_review, resolved) | 200 : { success, disputes }. 403 si pas admin. |
| PATCH | `/api/admin/disputes/:id/resolve` | Admin | Body : resolution (string) | 200 : { success, dispute }. 400 si validation échoue. 403/404. |

---

## 5. Flux de données

**Stats**

1. GET `/api/admin/stats` avec Bearer (admin).
2. requireAuth → requireRole('admin') → stats : 6 pool.query en parallèle (counts, sums, agrégats 6 mois) → construit le tableau growth → 200 { total_users, active_missions, revenue, growth }.

**Lister les utilisateurs**

1. GET `/api/admin/users?role=partner&page=1&limit=15` avec Bearer (admin).
2. requireAuth → requireRole('admin') → listUsers : COUNT (avec rôle optionnel), SELECT avec LIMIT/OFFSET, masque les champs sensibles → 200 { data, total, page, limit }.

**Lister les missions**

1. GET `/api/admin/missions?status=pending` avec Bearer (admin).
2. requireAuth → requireRole('admin') → listMissions : pool.query avec statut optionnel, LIMIT 500 → 200 { data, total, page, limit }.

**Lister les litiges**

1. GET `/api/admin/disputes` ou `?status=open` avec Bearer (admin).
2. requireAuth → requireRole('admin') → listDisputes : DisputeModel.listAll(...) → 200 { disputes }.

**Résoudre un litige**

1. PATCH `/api/admin/disputes/:id/resolve` avec Bearer (admin) et body { resolution }.
2. requireAuth → requireRole('admin') → validate(resolveDisputeValidator) → resolveDispute : getById → resolveDispute(id, resolution, userId) → 200 { dispute }.

---

## 6. Comment tester

**Stats :**

```bash
curl -s -X GET http://localhost:3001/api/admin/stats -H "Authorization: Bearer ADMIN_TOKEN"
```

**Lister les utilisateurs :**

```bash
curl -s -X GET "http://localhost:3001/api/admin/users?page=1&limit=10" -H "Authorization: Bearer ADMIN_TOKEN"
curl -s -X GET "http://localhost:3001/api/admin/users?role=partner" -H "Authorization: Bearer ADMIN_TOKEN"
```

**Lister les missions :**

```bash
curl -s -X GET "http://localhost:3001/api/admin/missions" -H "Authorization: Bearer ADMIN_TOKEN"
curl -s -X GET "http://localhost:3001/api/admin/missions?status=delivered" -H "Authorization: Bearer ADMIN_TOKEN"
```

**Lister les litiges :**

```bash
curl -s -X GET "http://localhost:3001/api/admin/disputes" -H "Authorization: Bearer ADMIN_TOKEN"
```

**Résoudre un litige :**

```bash
curl -s -X PATCH "http://localhost:3001/api/admin/disputes/DISPUTE_UUID/resolve" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resolution": "Refund issued. Partner warned."}'
```

---

Documentation liée : [auth-feature.md](auth-feature.md), [missions-feature.md](missions-feature.md), [disputes-feature.md](disputes-feature.md), [notifications-feature.md](notifications-feature.md) (l'admin peut envoyer des notifications).
