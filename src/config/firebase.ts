/**
 * Firebase Admin SDK for push notifications
 */

import admin from 'firebase-admin';

let firebaseApp: admin.app.App | null = null;

export function getFirebaseAdmin(): admin.app.App | null {
  if (firebaseApp) return firebaseApp;

  const credentialsJson = process.env.FIREBASE_CREDENTIALS;
  if (!credentialsJson) {
    console.warn('FIREBASE_CREDENTIALS is not set. Push notifications will be disabled.');
    return null;
  }

  try {
    const credentials = JSON.parse(credentialsJson) as admin.ServiceAccount;
    firebaseApp = admin.initializeApp({ credential: admin.credential.cert(credentials) });
    return firebaseApp;
  } catch (err) {
    console.error('Firebase Admin init error:', err);
    return null;
  }
}

export function isFirebaseConfigured(): boolean {
  return Boolean(process.env.FIREBASE_CREDENTIALS);
}
