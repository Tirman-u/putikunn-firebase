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

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  return args[idx + 1];
};

const email = getArg('--email');
const uid = getArg('--uid');
const role = getArg('--role') || 'admin';

if (!email && !uid) {
  console.error('Usage: node scripts/set-user-role.mjs --email "user@example.com" --role super_admin');
  console.error('   or: node scripts/set-user-role.mjs --uid "<uid>" --role admin');
  process.exit(1);
}

const resolveUserDoc = async () => {
  if (uid) {
    return { ref: db.collection('users').doc(uid), uid };
  }

  const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();
  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    return { ref: doc.ref, uid: doc.id };
  }

  try {
    const authUser = await admin.auth().getUserByEmail(email);
    return { ref: db.collection('users').doc(authUser.uid), uid: authUser.uid, authUser };
  } catch (error) {
    return null;
  }
};

const run = async () => {
  const userDoc = await resolveUserDoc();
  if (!userDoc) {
    console.error('User not found. Check email/uid in Firebase Auth or Firestore users collection.');
    process.exit(1);
  }

  if (userDoc.authUser) {
    const displayName = userDoc.authUser.displayName || userDoc.authUser.email || 'Külaline';
    await userDoc.ref.set({
      email: userDoc.authUser.email || '',
      display_name: displayName,
      displayName,
      full_name: displayName,
      fullName: displayName
    }, { merge: true });
  }

  await userDoc.ref.set({ app_role: role }, { merge: true });
  console.log(`Updated ${userDoc.uid} -> app_role=${role}`);
};

run().catch((error) => {
  console.error('Failed to update role:', error);
  process.exit(1);
});
