# Fonctionnalité Litiges (backend)

**Ce document explique la fonctionnalité Litiges d'Eco-Relais (backend).**

---

## 1. Ce que fait cette fonctionnalité

Les litiges permettent aux **clients et partenaires** de soulever un problème concernant une mission (ex. "colis jamais reçu", "mauvaise adresse"). Ils soumettent un mission_id et une raison ; le backend crée un enregistrement de litige. Les **admins** peuvent lister tous les litiges (optionnellement par statut) et **résoudre** un litige en fournissant un texte de résolution. La fonctionnalité ne change pas le statut de la mission ou les paiements par elle-même ; elle sert au suivi et à la résolution par l'admin.

---

## 2. Fichiers impliqués

| Fichier | Rôle |
|---------|------|
| `backend/src/routes/index.ts` | POST /disputes (create), GET /admin/disputes, PATCH /admin/disputes/:id/resolve |
| `backend/src/controllers/disputesController.ts` | createDispute |
| `backend/src/controllers/adminController.ts` | listDisputes, resolveDispute |
| `backend/src/models/Dispute.ts` | createDispute, getById, listAll, resolveDispute |
| `backend/src/models/Mission.ts` | getById (pour vérifier la mission et la propriété) |
| `backend/src/validators/disputeValidators.ts` | createDisputeValidator, resolveDisputeValidator |
| `backend/src/middleware/auth.ts` | requireAuth, requireRole('client'|'partner' pour create ; 'admin' pour les routes admin) |
| `backend/src/middleware/validation.ts` | validate() |
| `backend/src/utils/errors.ts` | ForbiddenError, NotFoundError |
| `backend/src/utils/helpers.ts` | generateId (utilisé dans le modèle Dispute) |

---

## 3. Explication fichier par fichier

### `backend/src/routes/index.ts`

- POST `/api/disputes` — requireAuth, requireRole('client', 'partner'), validate(createDisputeValidator), disputesCreateDispute
- GET `/api/admin/disputes` — requireAuth, requireRole('admin'), adminListDisputes
- PATCH `/api/admin/disputes/:id/resolve` — requireAuth, requireRole('admin'), validate(resolveDisputeValidator), adminResolveDispute

### `backend/src/controllers/disputesController.ts`

- **createDispute(req, res, next)** — Assure que l'utilisateur est client ou partenaire. Lit mission_id et reason depuis le body. Charge la mission (MissionModel.getById) ; 404 si non trouvée. Vérifie que l'utilisateur est le client ou le partenaire de la mission ; 403 sinon. DisputeModel.createDispute({ mission_id, raised_by: req.user.userId, reason }). Retourne 201 { success, dispute }.

### `backend/src/controllers/adminController.ts`

- **listDisputes(req, res, next)** — Admin uniquement. Lit le statut optionnel de la query. DisputeModel.listAll(status ? { status } : undefined). Retourne 200 { success, disputes }.
- **resolveDispute(req, res, next)** — Admin uniquement. Paramètres id, body resolution. DisputeModel.getById(id) ; 404 si non trouvé. DisputeModel.resolveDispute(id, resolution, req.user.userId). Retourne 200 { success, dispute: updated }.

### `backend/src/models/Dispute.ts`

- **createDispute(data)** — generateId(), INSERT dans disputes (id, mission_id, raised_by, reason). Retourne la ligne créée (SELECT par id).
- **getById(id)** — SELECT * FROM disputes WHERE id = $1.
- **listAll(options?)** — Si options.status : SELECT * FROM disputes WHERE status = $1 ORDER BY created_at DESC. Sinon : SELECT * FROM disputes ORDER BY created_at DESC.
- **resolveDispute(id, resolution, resolved_by)** — UPDATE disputes SET status = 'resolved', resolution = $2, resolved_by = $3, resolved_at = NOW() WHERE id = $1. Retourne getById(id).

### `backend/src/validators/disputeValidators.ts`

- **createDisputeValidator** — body mission_id (UUID), reason (trim, notEmpty).
- **resolveDisputeValidator** — param id (UUID), body resolution (trim, notEmpty).

---

## 4. Endpoints API

| Méthode | Chemin | Qui | Requête | Réponse |
|---------|--------|-----|---------|---------|
| POST | `/api/disputes` | Client ou Partenaire | Body : mission_id (UUID), reason (string) | 201 : { success, dispute }. 403 si pas client/partenaire ou pas votre mission. 404 si mission non trouvée. |
| GET | `/api/admin/disputes` | Admin | Query : statut optionnel (open, in_review, resolved) | 200 : { success, disputes }. 403 si pas admin. |
| PATCH | `/api/admin/disputes/:id/resolve` | Admin | Body : resolution (string) | 200 : { success, dispute }. 400 si validation échoue. 403/404. |

---

## 5. Flux de données

**Créer un litige (client ou partenaire)**

1. POST `/api/disputes` avec token Bearer et { mission_id, reason }.
2. requireAuth → requireRole('client', 'partner') → validate(createDisputeValidator).
3. createDispute : MissionModel.getById(mission_id) → vérifie mission.client_id ou mission.partner_id === req.user.userId → DisputeModel.createDispute({ mission_id, raised_by, reason }) → 201 { dispute }.

**Lister les litiges (admin)**

1. GET `/api/admin/disputes` ou `?status=open` avec Bearer (admin).
2. requireAuth → requireRole('admin') → listDisputes : DisputeModel.listAll({ status } ou undefined) → 200 { disputes }.

**Résoudre un litige (admin)**

1. PATCH `/api/admin/disputes/:id/resolve` avec Bearer (admin) et body { resolution }.
2. requireAuth → requireRole('admin') → validate(resolveDisputeValidator).
3. resolveDispute : DisputeModel.getById(id) → DisputeModel.resolveDispute(id, resolution, req.user.userId) → 200 { dispute }.

---

## 6. Comment tester

**Créer un litige** (remplacez TOKEN et MISSION_ID) :

```bash
curl -s -X POST http://localhost:3001/api/disputes \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mission_id": "MISSION_UUID", "reason": "Package was never delivered"}'
```

**Lister les litiges (admin) :**

```bash
curl -s -X GET "http://localhost:3001/api/admin/disputes" -H "Authorization: Bearer ADMIN_TOKEN"
curl -s -X GET "http://localhost:3001/api/admin/disputes?status=open" -H "Authorization: Bearer ADMIN_TOKEN"
```

**Résoudre un litige (admin) :**

```bash
curl -s -X PATCH "http://localhost:3001/api/admin/disputes/DISPUTE_UUID/resolve" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resolution": "Refund issued to client. Partner warned."}'
```

---

Documentation liée : [auth-feature.md](auth-feature.md), [missions-feature.md](missions-feature.md), [admin-feature.md](admin-feature.md).
