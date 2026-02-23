# Fonctionnalité Paiements (backend)

**Ce document explique la fonctionnalité Paiements d'Eco-Relais (backend).**

---

## 1. Ce que fait cette fonctionnalité

La fonctionnalité Paiements gère le **paiement client** pour une mission (Stripe Checkout), les événements **webhook Stripe** (ex. checkout complété), les **gains partenaire** (liste et total des transactions complétées), et le **paiement partenaire** (transférer le solde vers le compte Stripe Connect du partenaire). Les clients obtiennent une URL de checkout pour payer ; quand un partenaire livre, le backend crée une transaction et peut transférer la part du partenaire via Stripe. Les partenaires peuvent également demander un paiement de leurs gains accumulés s'ils ont un compte Connect lié.

---

## 2. Fichiers impliqués

| Fichier | Rôle |
|---------|------|
| `backend/src/app.ts` | Monte la route webhook avec body brut **avant** express.json() |
| `backend/src/routes/index.ts` | Routes GET/POST de paiement (create-checkout, history, earnings, payout) |
| `backend/src/controllers/paymentsController.ts` | createCheckout, webhook, history, earnings, payout |
| `backend/src/services/paymentService.ts` | createCheckoutSession, createTransferToPartner, createPayout |
| `backend/src/config/stripe.ts` | client stripe, STRIPE_WEBHOOK_SECRET, isStripeConfigured |
| `backend/src/models/Mission.ts` | getById (pour createCheckout) |
| `backend/src/models/Transaction.ts` | listByClientId, listByPartnerId, sumPartnerEarnings |
| `backend/src/models/User.ts` | getById (email pour checkout, stripe_account_id pour payout) |
| `backend/src/validators/paymentValidators.ts` | createCheckoutValidator |
| `backend/src/middleware/auth.ts` | requireAuth, requireRole |
| `backend/src/middleware/validation.ts` | validate() |
| `backend/src/utils/helpers.ts` | eurosToCents, centsToEuros |

---

## 3. Explication fichier par fichier

### `backend/src/app.ts`

- **Ce qu'il fait :** Le webhook Stripe est enregistré **avant** `express.json()` pour que le body reste brut (Buffer). Stripe signe le body ; nous avons besoin des octets exacts pour vérifier. Route : POST `/api/payments/webhook` avec `express.raw({ type: 'application/json' })`, puis appelle paymentsController.webhook.

### `backend/src/routes/index.ts`

- GET `/payments` — requireAuth, requireRole('client'), paymentsHistory
- POST `/payments/create-checkout` — requireAuth, validate(createCheckoutValidator), paymentsCreateCheckout
- GET `/payments/earnings` — requireAuth, requireRole('partner'), paymentsEarnings
- POST `/payments/payout` — requireAuth, requireRole('partner'), paymentsPayout  
(Le webhook est dans app.ts, pas ici.)

### `backend/src/controllers/paymentsController.ts`

- **createCheckout** — Client uniquement. Body : mission_id, success_url optionnel, cancel_url optionnel. Charge la mission ; doit appartenir à l'utilisateur et ne pas être déjà payée/en cours. Charge l'utilisateur pour l'email. createCheckoutSession(missionId, amountEuros: mission.price, clientEmail, successUrl, cancelUrl). Retourne 200 { success, url, session_id }. Le frontend redirige l'utilisateur vers url.
- **webhook** — Lit l'en-tête stripe-signature et le body brut. Si pas de STRIPE_WEBHOOK_SECRET ou pas de sig, 400. stripe.webhooks.constructEvent(body, sig, secret). Sur checkout.session.completed, lit metadata.mission_id (gestion optionnelle ; le transfert se fait à la livraison). Répond toujours 200 { received: true } pour que Stripe ne réessaie pas.
- **history** — Client uniquement. TransactionModel.listByClientId(req.user.userId). Retourne 200 { success, data: [{ id, mission_id, amount, status, created_at }, ...] }.
- **earnings** — Partenaire uniquement. TransactionModel.sumPartnerEarnings et listByPartnerId. Retourne 200 { success, total_earnings, transactions }.
- **payout** — Partenaire uniquement. L'utilisateur doit avoir stripe_account_id. Somme des gains partenaire ; si <= 0, 400. createTransferToPartner(amountCents, stripeAccountId, missionId: 'payout'). Retourne 200 { success, payout_id, amount }.

### `backend/src/services/paymentService.ts`

- **createCheckoutSession(params)** — Vérifie isStripeConfigured. stripe.checkout.sessions.create : mode payment, card, un line_item (price_data depuis amountEuros en cents), customer_email, success_url, cancel_url, metadata.mission_id. Retourne { url, sessionId }. Lance une erreur si pas de session.url.
- **createTransferToPartner(params)** — stripe.transfers.create : amount (cents), currency eur, destination stripeAccountId, metadata.mission_id. Retourne l'id de transfert ou null si Stripe non configuré.
- **createPayout(stripeAccountId, amountCents)** — stripe.payouts.create avec option stripeAccount. Utilisé pour "retirer vers la banque" ; l'endpoint payout dans le controller utilise actuellement createTransferToPartner (transfert vers compte Connect), pas createPayout.

### `backend/src/config/stripe.ts`

- Exporte le client stripe (depuis STRIPE_SECRET_KEY), STRIPE_WEBHOOK_SECRET, isStripeConfigured(). Utilisé par paymentService et le handler webhook.

### `backend/src/models/Transaction.ts`

- **listByClientId(clientId)** — Joint les transactions avec les missions où client_id = clientId, triées par created_at.
- **listByPartnerId(partnerId)** — SELECT * FROM transactions WHERE partner_id = $1.
- **sumPartnerEarnings(partnerId)** — SUM(amount) WHERE partner_id AND status = 'completed'.

### `backend/src/validators/paymentValidators.ts`

- **createCheckoutValidator** — mission_id (UUID), success_url et cancel_url optionnels URL.

### `backend/src/utils/helpers.ts`

- eurosToCents(euros), centsToEuros(cents) — Utilisés lors de l'appel à Stripe (montants en cents) et lors de l'affichage.

---

## 4. Endpoints API

| Méthode | Chemin | Qui | Requête | Réponse |
|---------|--------|-----|---------|---------|
| POST | `/api/payments/create-checkout` | Client | Body : mission_id (UUID), success_url optionnel, cancel_url optionnel | 200 : { success, url, session_id }. 400 si mission invalide ou paiements non configurés. 403/404. |
| POST | `/api/payments/webhook` | Stripe (serveur-à-serveur) | Body brut + en-tête stripe-signature | 200 : { received: true }. 400 si signature invalide ou secret manquant. |
| GET | `/api/payments` | Client | — | 200 : { success, data: [{ id, mission_id, amount, status, created_at }, ...] }. 403 si pas client. |
| GET | `/api/payments/earnings` | Partenaire | — | 200 : { success, total_earnings, transactions }. 403 si pas partenaire. |
| POST | `/api/payments/payout` | Partenaire | — | 200 : { success, payout_id, amount }. 400 si pas de compte Connect, pas de solde, ou non configuré. 403 si pas partenaire. |

---

## 5. Flux de données

**Créer checkout (client)**

1. POST `/api/payments/create-checkout` avec token Bearer et { mission_id, success_url?, cancel_url? }.
2. requireAuth, validate(createCheckoutValidator).
3. createCheckout : obtenir la mission (doit être celle du client, pending/pas en cours), obtenir l'utilisateur → createCheckoutSession(...) → Stripe retourne URL → 200 { url, session_id }. Le frontend redirige vers url ; l'utilisateur paie sur Stripe.

**Webhook (Stripe → backend)**

1. Stripe POST vers `/api/payments/webhook` avec body JSON brut et stripe-signature.
2. app.ts sert cette route avec express.raw() ; le body est Buffer. paymentsController.webhook : constructEvent(body, sig, STRIPE_WEBHOOK_SECRET). Sur checkout.session.completed, lit metadata.mission_id (logique optionnelle). Répond 200 { received: true }.

**Gains (partenaire)**

1. GET `/api/payments/earnings` avec Bearer (partenaire).
2. earnings : sumPartnerEarnings(userId), listByPartnerId(userId) → 200 { total_earnings, transactions }.

**Paiement (partenaire)**

1. POST `/api/payments/payout` avec Bearer (partenaire).
2. payout : obtenir l'utilisateur (doit avoir stripe_account_id), sumPartnerEarnings (doit > 0), createTransferToPartner(amountCents, stripeAccountId, 'payout') → 200 { payout_id, amount }.

---

## 6. Comment tester

**Créer checkout** (remplacez TOKEN et MISSION_ID) :

```bash
curl -s -X POST http://localhost:3001/api/payments/create-checkout \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mission_id": "MISSION_UUID"}'
```

**Historique des paiements client :**

```bash
curl -s -X GET http://localhost:3001/api/payments -H "Authorization: Bearer CLIENT_TOKEN"
```

**Gains partenaire :**

```bash
curl -s -X GET http://localhost:3001/api/payments/earnings -H "Authorization: Bearer PARTNER_TOKEN"
```

**Paiement partenaire :**

```bash
curl -s -X POST http://localhost:3001/api/payments/payout -H "Authorization: Bearer PARTNER_TOKEN"
```

**Webhook** (normalement appelé par Stripe ; pour les tests locaux vous devez utiliser Stripe CLI ou un payload signé) :

```bash
# Exemple : Stripe CLI transfère les événements vers votre URL locale
# stripe listen --forward-to localhost:3001/api/payments/webhook
```

---

Documentation liée : [auth-feature.md](auth-feature.md), [missions-feature.md](missions-feature.md) (deliver crée une transaction et peut appeler createTransferToPartner), [users-feature.md](users-feature.md).
