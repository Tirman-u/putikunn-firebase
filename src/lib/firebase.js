import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const defaultFirebaseConfig = {
  apiKey: 'AIzaSyDA4OGltqsp_U9Bivk3Aj9ltxLYkW55pcs',
  authDomain: 'putikunn-migration.firebaseapp.com',
  projectId: 'putikunn-migration',
  storageBucket: 'putikunn-migration.firebasestorage.app',
  messagingSenderId: '357780391604',
  appId: '1:357780391604:web:93e37b1a5f15a52f45f9e1',
  measurementId: 'G-0X6V670FDZ'
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || defaultFirebaseConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || defaultFirebaseConfig.measurementId
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let db;
if (typeof window !== 'undefined') {
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (error) {
    db = getFirestore(app);
  }
} else {
  db = getFirestore(app);
}

const analyticsPromise = typeof window === 'undefined'
  ? Promise.resolve(null)
  : isSupported()
      .then((supported) => (supported ? getAnalytics(app) : null))
      .catch(() => null);

export { app, auth, db, analyticsPromise };
