# Fonctionnalité Missions (backend)

**Ce document explique la fonctionnalité Missions d'Eco-Relais (backend).**

---

## 1. Ce que fait cette fonctionnalité

Les missions sont des tâches de livraison : un **client** crée une mission (adresses de ramassage et de livraison, taille du colis, créneau horaire, photo optionnelle). Le backend calcule le prix et la commission, stocke la mission, et génère un code QR pour la vérification. Un **partenaire** peut lister les missions en attente à proximité (par localisation) ou ses missions assignées, puis **accepter**, **collecter** (avec QR optionnel), définir **en_transit**, et **livrer**. À la livraison, le partenaire est payé via Stripe Connect (si lié). Les clients ou partenaires assignés (ou admins) peuvent **annuler** une mission quand autorisé. Tous les changements d'état de mission sont stockés dans la base de données et pilotent le cycle de vie de pending → accepted → collected → in_transit → delivered (ou cancelled).

---

## 2. Fichiers impliqués

| Fichier | Rôle |
|---------|------|
| `backend/src/routes/index.ts` | Routes de mission : POST/GET/PUT avec requireAuth, requireRole, upload, validate |
| `backend/src/controllers/missionsController.ts` | create, list, getById, accept, collect, deliver, cancel, updateStatus |
| `backend/src/models/Mission.ts` | createMission, getById, listByClientId, listNearbyAvailable, listByPartnerId, updateMissionStatus, setPartner, updateMissionQr |
| `backend/src/models/User.ts` | getById (pour le détail mission partenaire/client et le paiement à la livraison) |
| `backend/src/models/Transaction.ts` | createTransaction, updateStatus (utilisé à la livraison pour le paiement partenaire) |
| `backend/src/validators/missionValidators.ts` | createMissionValidator, missionIdValidator, collectValidator, statusValidator |
| `backend/src/middleware/auth.ts` | requireAuth, requireRole |
| `backend/src/middleware/validation.ts` | validate() |
| `backend/src/middleware/upload.ts` | uploadPackagePhoto (multer, fichier unique pour create) |
| `backend/src/services/qrService.ts` | generateMissionQR, verifyQRPayload (optionnel) |
| `backend/src/services/uploadService.ts` | uploadToS3, uploadLimits, uploadFilter |
| `backend/src/services/geoService.ts` | clampRadius (pour le rayon de liste) |
| `backend/src/services/paymentService.ts` | createTransferToPartner (à la livraison) |
| `backend/src/utils/helpers.ts` | calculateMissionPricing, generateId, eurosToCents |
| `backend/src/utils/errors.ts` | BadRequestError, ForbiddenError, NotFoundError |

---

## 3. Explication fichier par fichier

### `backend/src/routes/index.ts`

- **Ce qu'il fait :** Définit tous les endpoints de mission et l'ordre des middlewares.
- **Routes pertinentes :**
  - POST `/missions` — requireAuth, requireRole('client'), uploadPackagePhoto, validate(createMissionValidator), missionCreate
  - GET `/missions` — requireAuth, missionList
  - GET `/missions/:id` — requireAuth, validate(missionIdValidator), missionGetById
  - PUT `/missions/:id/accept` — requireAuth, requireRole('partner'), validate(missionIdValidator), missionAccept
  - PUT `/missions/:id/collect` — requireAuth, requireRole('partner'), validate(collectValidator), missionCollect
  - PUT `/missions/:id/deliver` — requireAuth, requireRole('partner'), validate(missionIdValidator), missionDeliver
  - PUT `/missions/:id/cancel` — requireAuth, validate(missionIdValidator), missionCancel
  - PUT `/missions/:id/status` — requireAuth, requireRole('partner'), validate(statusValidator), missionUpdateStatus

### `backend/src/controllers/missionsController.ts`

- **create** — Client uniquement. Lit le body (package_title, package_size, addresses, lat/lng, pickup_time_slot). Si req.file (depuis uploadPackagePhoto), upload vers S3 et définit package_photo_url. Calcule prix/commission avec calculateMissionPricing. MissionModel.createMission(...). generateMissionQR(mission.id), puis MissionModel.updateMissionQr. Retourne 201 avec la mission.
- **list** — Si client : MissionModel.listByClientId(req.user.userId). Si partenaire : lit query lat, lng, radius ; si lat/lng ne sont pas des nombres valides, MissionModel.listByPartnerId ; sinon clampRadius(radius) et MissionModel.listNearbyAvailable(lat, lng, radius). Retourne { success, missions }.
- **getById** — MissionModel.getById(params.id). 404 si manquant. Accès : seulement si l'utilisateur est le client, le partenaire, ou un admin de cette mission. Charge les utilisateurs partenaire et client et les attache à la mission dans la réponse.
- **accept** — Partenaire uniquement. La mission doit exister et avoir le statut 'pending'. MissionModel.setPartner(mission.id, req.user.userId). Retourne la mission mise à jour.
- **collect** — Partenaire uniquement. La mission doit être assignée à ce partenaire et avoir le statut 'accepted'. qr_payload optionnel dans le body. MissionModel.updateMissionStatus(mission.id, 'collected').
- **deliver** — Partenaire uniquement. La mission doit être assignée et avoir le statut 'in_transit'. Crée une Transaction (pending). Si le partenaire a stripe_account_id, createTransferToPartner (paymentService) ; en cas de succès, TransactionModel.updateStatus(transaction.id, 'completed'). MissionModel.updateMissionStatus(mission.id, 'delivered', undefined, completedAt). Retourne la mission mise à jour.
- **cancel** — L'appelant doit être le client, le partenaire assigné, ou un admin. La mission ne doit pas être livrée ou déjà annulée. MissionModel.updateMissionStatus(mission.id, 'cancelled').
- **updateStatus** — Partenaire uniquement. Le statut du body doit être 'collected' ou 'in_transit'. La mission doit être assignée à ce partenaire. MissionModel.updateMissionStatus(mission.id, status).

### `backend/src/models/Mission.ts`

- **createMission(data)** — generateId(), INSERT dans missions, retourne getById(id).
- **getById(id)** — SELECT * FROM missions WHERE id = $1.
- **listByClientId(clientId)** — SELECT * FROM missions WHERE client_id = $1 ORDER BY created_at DESC.
- **listNearbyAvailable(lat, lng, radiusMeters)** — Essaie PostGIS (ST_DWithin, ST_Distance) pour status='pending' dans le rayon, limite 50. Fallback : distance basée sur les degrés si PostGIS non disponible.
- **listByPartnerId(partnerId)** — SELECT * FROM missions WHERE partner_id = $1 ORDER BY created_at DESC.
- **updateMissionStatus(id, status, partnerId?, completedAt?)** — UPDATE dynamique (status ; partner_id, completed_at optionnels), puis getById(id).
- **setPartner(id, partnerId)** — UPDATE missions SET partner_id = $2, status = 'accepted' WHERE id = $1 AND status = 'pending'. Retourne getById(id).
- **updateMissionQr(id, qr_code)** — UPDATE missions SET qr_code = $2 WHERE id = $1, retourne getById(id).

### `backend/src/models/User.ts` et `backend/src/models/Transaction.ts`

- User : getById utilisé dans getById (détail mission) et deliver (stripe_account_id du partenaire).
- Transaction : createTransaction et updateStatus utilisés dans deliver pour enregistrer et compléter le paiement du partenaire.

### `backend/src/validators/missionValidators.ts`

- **createMissionValidator** — package_title, package_size (small|medium|large), adresses pickup/delivery et lat/lng (floats dans la plage), pickup_time_slot.
- **missionIdValidator** — param('id').isUUID().
- **collectValidator** — param('id').isUUID(), body('qr_payload').optional().isString().
- **statusValidator** — param('id').isUUID(), body('status').isIn(['collected', 'in_transit']).

### `backend/src/middleware/upload.ts`

- **uploadPackagePhoto** — Multer avec stockage mémoire, champ fichier unique 'package_photo'. Utilise uploadLimits et uploadFilter depuis uploadService. Met le fichier dans req.file (buffer, mimetype) pour le controller.

### `backend/src/services/qrService.ts`

- **generateMissionQR(missionId)** — Crée un token (UUID), payload = missionId:token, retourne { token, qrDataUrl } (image data URL). Le controller sauvegarde qrDataUrl sur la mission.
- **verifyQRPayload(payload, missionId)** — Vérification optionnelle que le payload commence par missionId:.

### `backend/src/services/uploadService.ts` et `backend/src/services/geoService.ts`

- uploadService : uploadToS3 (buffer → URL), uploadLimits, uploadFilter pour multer.
- geoService : clampRadius(meters) limite à 500–1000 m pour le rayon de liste.

### `backend/src/services/paymentService.ts` et `backend/src/utils/helpers.ts`

- paymentService.createTransferToPartner : transfert Stripe vers le compte Connect du partenaire (utilisé dans deliver).
- helpers : calculateMissionPricing(packageSize), generateId(), eurosToCents().

---

## 4. Endpoints API

| Méthode | Chemin | Qui | Requête | Réponse |
|---------|--------|-----|---------|---------|
| POST | `/api/missions` | Client | Body : package_title, package_size, pickup_address, pickup_lat, pickup_lng, delivery_address, delivery_lat, delivery_lng, pickup_time_slot ; fichier multipart optionnel `package_photo` | 201 : { success, mission }. 400 validation. 403 si pas client. |
| GET | `/api/missions` | Client ou Partenaire | Query (partenaire) : lat, lng, radius (mètres) optionnels | 200 : { success, missions }. Client : ses propres missions. Partenaire : avec lat/lng = missions en attente à proximité (rayon limité) ; sans = missions assignées. |
| GET | `/api/missions/:id` | Client, Partenaire ou Admin (doit être impliqué ou admin) | — | 200 : { success, mission } (avec objets partenaire/client). 403/404. |
| PUT | `/api/missions/:id/accept` | Partenaire | — | 200 : { success, mission }. 400 si pas pending. 403/404. |
| PUT | `/api/missions/:id/collect` | Partenaire (assigné) | Body : qr_payload optionnel | 200 : { success, mission }. 400 si status != accepted. 403/404. |
| PUT | `/api/missions/:id/deliver` | Partenaire (assigné) | — | 200 : { success, mission }. 400 si status != in_transit. Crée une transaction et peut transférer au partenaire. 403/404. |
| PUT | `/api/missions/:id/cancel` | Client, Partenaire assigné ou Admin | — | 200 : { success, mission }. 400 si delivered/cancelled. 403/404. |
| PUT | `/api/missions/:id/status` | Partenaire (assigné) | Body : status = 'collected' \| 'in_transit' | 200 : { success, mission }. 400 statut invalide. 403/404. |

---

## 5. Flux de données

**Créer une mission (client)**

1. POST `/api/missions` avec token Bearer et body (et fichier optionnel).
2. requireAuth → requireRole('client') → uploadPackagePhoto (parse multipart, req.file) → validate(createMissionValidator).
3. create : uploadToS3(req.file) optionnel → calculateMissionPricing(package_size) → MissionModel.createMission(...) → generateMissionQR(id) → MissionModel.updateMissionQr(id, qrDataUrl) → getById → 201 { mission }.

**Lister les missions (partenaire, à proximité)**

1. GET `/api/missions?lat=48.8&lng=2.3&radius=1000` avec Bearer (partenaire).
2. requireAuth → missionList : clampRadius(1000) → MissionModel.listNearbyAvailable(48.8, 2.3, 1000) → 200 { missions }.

**Accepter → Collecter → Status (in_transit) → Livrer**

1. PUT `/api/missions/:id/accept` (partenaire) → setPartner(id, partnerId) → status 'accepted'.
2. PUT `/api/missions/:id/collect` (partenaire, qr_payload optionnel) → updateMissionStatus(id, 'collected').
3. PUT `/api/missions/:id/status` body { status: 'in_transit' } → updateMissionStatus(id, 'in_transit').
4. PUT `/api/missions/:id/deliver` (partenaire) → createTransaction (pending) → createTransferToPartner (si Stripe) → updateStatus(transaction, 'completed') → updateMissionStatus(id, 'delivered', undefined, completedAt) → 200 { mission }.

---

## 6. Comment tester

**Créer une mission** (remplacez TOKEN par un JWT client) :

```bash
curl -s -X POST http://localhost:3001/api/missions \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "package_title": "Docs",
    "package_size": "medium",
    "pickup_address": "1 Rue de Rivoli, Paris",
    "pickup_lat": 48.86,
    "pickup_lng": 2.35,
    "delivery_address": "10 Avenue des Champs-Élysées, Paris",
    "delivery_lat": 48.87,
    "delivery_lng": 2.31,
    "pickup_time_slot": "14:00-16:00"
  }'
```

**Lister les missions (client) :**

```bash
curl -s -X GET "http://localhost:3001/api/missions" -H "Authorization: Bearer TOKEN"
```

**Lister à proximité (partenaire) :**

```bash
curl -s -X GET "http://localhost:3001/api/missions?lat=48.86&lng=2.35&radius=1000" -H "Authorization: Bearer TOKEN"
```

**Obtenir une mission :**

```bash
curl -s -X GET "http://localhost:3001/api/missions/MISSION_UUID" -H "Authorization: Bearer TOKEN"
```

**Accepter (partenaire) :**

```bash
curl -s -X PUT "http://localhost:3001/api/missions/MISSION_UUID/accept" -H "Authorization: Bearer TOKEN"
```

**Collecter :**

```bash
curl -s -X PUT "http://localhost:3001/api/missions/MISSION_UUID/collect" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"qr_payload": "MISSION_UUID:some-token"}'
```

**Définir in_transit :**

```bash
curl -s -X PUT "http://localhost:3001/api/missions/MISSION_UUID/status" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_transit"}'
```

**Livrer :**

```bash
curl -s -X PUT "http://localhost:3001/api/missions/MISSION_UUID/deliver" -H "Authorization: Bearer TOKEN"
```

**Annuler :**

```bash
curl -s -X PUT "http://localhost:3001/api/missions/MISSION_UUID/cancel" -H "Authorization: Bearer TOKEN"
```

---

Documentation liée : [auth-feature.md](auth-feature.md), [users-feature.md](users-feature.md), [payments-feature.md](payments-feature.md), [disputes-feature.md](disputes-feature.md), [admin-feature.md](admin-feature.md).
