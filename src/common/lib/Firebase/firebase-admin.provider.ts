import * as admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';
import appConfig from 'src/config/app.config';

/**
 * Firebase Admin provider for NestJS.
 *
 * Expects FIREBASE_SERVICE_ACCOUNT_JSON env var to contain the full
 * service account JSON string.
 */
export const FirebaseAdminProvider = {
  provide: 'FIREBASE_ADMIN',
  useFactory: () => {
    if (admin.apps.length > 0) {
      return admin.app();
    }

    const raw = appConfig().firebase.serviceAccountJson;
    if (!raw) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set.',
      );
    }

    let serviceAccount: ServiceAccount;
    try {
      serviceAccount = JSON.parse(raw);
    } catch (error) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Make sure to stringify the service account JSON.',
      );
    }

    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  },
};


