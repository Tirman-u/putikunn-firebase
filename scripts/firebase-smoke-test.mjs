import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT
  || path.resolve(__dirname, '../firebase-service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Service account JSON not found:', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();

const run = async () => {
  const docRef = db.collection('_smoke_tests').doc(`test_${Date.now()}`);
  await docRef.set({
    status: 'ok',
    created_at: admin.firestore.FieldValue.serverTimestamp()
  });
  const snapshot = await docRef.get();
  console.log('Smoke test success:', snapshot.exists, snapshot.data());
};

run().catch((error) => {
  console.error('Smoke test failed:', error);
  process.exit(1);
});
