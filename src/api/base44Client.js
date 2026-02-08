import { auth, db } from '@/lib/firebase';
import { createPageUrl } from '@/utils';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as limitDocs,
  serverTimestamp,
  onSnapshot,
  documentId
} from 'firebase/firestore';
import {
  signOut,
  updateProfile
} from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const ENTITY_COLLECTIONS = {
  Game: 'games',
  GameGroup: 'game_groups',
  LeaderboardEntry: 'leaderboard_entries',
  User: 'users',
  PuttingKingMatch: 'putting_king_matches',
  PuttingKingPlayer: 'putting_king_players',
  PuttingKingStation: 'putting_king_stations',
  PuttingKingTournament: 'putting_king_tournaments',
  TournamentRules: 'tournament_rules',
  DuelGame: 'duel_games',
  ErrorLog: 'error_logs'
};

const buildFallbackProfile = (firebaseUser) => {
  const displayName = firebaseUser?.displayName || firebaseUser?.email || 'Külaline';
  return {
    id: firebaseUser?.uid,
    email: firebaseUser?.email || '',
    display_name: displayName,
    displayName,
    full_name: displayName,
    fullName: displayName,
    app_role: 'user',
    created_date: new Date().toISOString(),
    _auth_only: true
  };
};

const ensureUserProfile = async (firebaseUser) => {
  if (!firebaseUser) {
    const error = new Error('Authentication required');
    error.status = 401;
    throw error;
  }

  const userRef = doc(db, ENTITY_COLLECTIONS.User, firebaseUser.uid);
  const snapshot = await getDoc(userRef);
  if (snapshot.exists()) {
    const data = snapshot.data();
    const displayName = data.display_name || data.full_name || data.displayName || data.fullName;
    if (!displayName) {
      const fallback = buildFallbackProfile(firebaseUser);
      const patch = {
        email: fallback.email,
        display_name: fallback.display_name,
        displayName: fallback.displayName,
        full_name: fallback.full_name,
        fullName: fallback.fullName
      };
      await setDoc(userRef, patch, { merge: true });
      return { id: firebaseUser.uid, ...data, ...patch };
    }
    return { id: firebaseUser.uid, ...data };
  }

  const profile = buildFallbackProfile(firebaseUser);
  await setDoc(userRef, profile, { merge: true });
  return { ...profile, id: firebaseUser.uid };
};

const normalizeSort = (sort) => {
  if (!sort) return null;
  if (typeof sort === 'string') {
    if (sort.startsWith('-')) {
      return { field: sort.slice(1), direction: 'desc' };
    }
    return { field: sort, direction: 'asc' };
  }
  return null;
};

const matchesFilter = (row, filter) => {
  if (!filter) return true;
  return Object.entries(filter).every(([field, value]) => {
    if (value === undefined) return true;
    const rowValue = field === 'id' ? row?.id : row?.[field];

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (Object.prototype.hasOwnProperty.call(value, '$in')) {
        return value.$in?.includes(rowValue);
      }
      if (Object.prototype.hasOwnProperty.call(value, '$ne')) {
        return rowValue !== value.$ne;
      }
      if (Object.prototype.hasOwnProperty.call(value, '$gte')) {
        return rowValue >= value.$gte;
      }
      if (Object.prototype.hasOwnProperty.call(value, '$gt')) {
        return rowValue > value.$gt;
      }
      if (Object.prototype.hasOwnProperty.call(value, '$lte')) {
        return rowValue <= value.$lte;
      }
      if (Object.prototype.hasOwnProperty.call(value, '$lt')) {
        return rowValue < value.$lt;
      }
    }

    return rowValue === value;
  });
};

const sortRows = (rows, sortConfig) => {
  if (!sortConfig) return rows;
  const { field, direction } = sortConfig;
  return rows.sort((a, b) => {
    const aVal = a?.[field];
    const bVal = b?.[field];
    if (aVal === bVal) return 0;
    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;
    if (aVal < bVal) return direction === 'desc' ? 1 : -1;
    if (aVal > bVal) return direction === 'desc' ? -1 : 1;
    return 0;
  });
};

const applyFilterToQuery = (collectionRef, filter) => {
  const constraints = [];
  if (!filter) return { queryRef: collectionRef, constraints, idFilter: null };

  let idFilter = null;
  Object.entries(filter).forEach(([field, value]) => {
    if (field === 'id') {
      idFilter = value;
      return;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (Object.prototype.hasOwnProperty.call(value, '$in')) {
        constraints.push(where(field, 'in', value.$in));
      } else if (Object.prototype.hasOwnProperty.call(value, '$ne')) {
        constraints.push(where(field, '!=', value.$ne));
      } else if (Object.prototype.hasOwnProperty.call(value, '$gte')) {
        constraints.push(where(field, '>=', value.$gte));
      } else if (Object.prototype.hasOwnProperty.call(value, '$gt')) {
        constraints.push(where(field, '>', value.$gt));
      } else if (Object.prototype.hasOwnProperty.call(value, '$lte')) {
        constraints.push(where(field, '<=', value.$lte));
      } else if (Object.prototype.hasOwnProperty.call(value, '$lt')) {
        constraints.push(where(field, '<', value.$lt));
      }
    } else if (value !== undefined) {
      constraints.push(where(field, '==', value));
    }
  });

  return { queryRef: collectionRef, constraints, idFilter };
};

const readDocs = async (queryRef, skip, limit) => {
  const snapshot = await getDocs(queryRef);
  const docs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  if (typeof skip === 'number' && skip > 0) {
    return docs.slice(skip, limit ? skip + limit : undefined);
  }
  if (typeof limit === 'number') {
    return docs.slice(0, limit);
  }
  return docs;
};

const createEntityApi = (entityName) => {
  const collectionName = ENTITY_COLLECTIONS[entityName];
  if (!collectionName) {
    throw new Error(`Unknown entity: ${entityName}`);
  }

  const collectionRef = collection(db, collectionName);

  return {
    async list() {
      return readDocs(collectionRef);
    },
    async get(id) {
      if (!id) return null;
      const docRef = doc(db, collectionName, id);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) return null;
      return { id: snapshot.id, ...snapshot.data() };
    },
    async create(data = {}) {
      const payload = {
        ...data,
        created_date: data.created_date || new Date().toISOString(),
        updated_date: data.updated_date || new Date().toISOString(),
        _server_created_at: serverTimestamp()
      };
      const docRef = await addDoc(collectionRef, payload);
      return { id: docRef.id, ...payload };
    },
    async update(id, data = {}) {
      if (!id) return null;
      const docRef = doc(db, collectionName, id);
      const payload = {
        ...data,
        updated_date: new Date().toISOString(),
        _server_updated_at: serverTimestamp()
      };
      await updateDoc(docRef, payload);
      const snapshot = await getDoc(docRef);
      return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : { id, ...payload };
    },
    async delete(id) {
      if (!id) return null;
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
      return true;
    },
    async filter(filter = {}, sort, limit, skip) {
      const { constraints, idFilter } = applyFilterToQuery(collectionRef, filter);
      const sortConfig = normalizeSort(sort);

      if (idFilter && typeof idFilter === 'string') {
        const docRef = doc(db, collectionName, idFilter);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) return [];
        return [{ id: snapshot.id, ...snapshot.data() }];
      }

      if (idFilter && typeof idFilter === 'object' && Array.isArray(idFilter.$in)) {
        const ids = idFilter.$in.filter(Boolean);
        const batches = [];
        const chunkSize = 10;
        for (let i = 0; i < ids.length; i += chunkSize) {
          batches.push(ids.slice(i, i + chunkSize));
        }

        const results = [];
        for (const batch of batches) {
          const batchConstraints = [
            where(documentId(), 'in', batch),
            ...constraints
          ];
          if (sortConfig) {
            batchConstraints.push(orderBy(sortConfig.field, sortConfig.direction));
          }
          const batchQuery = query(collectionRef, ...batchConstraints);
          const batchDocs = await readDocs(batchQuery);
          results.push(...batchDocs);
        }

        if (sortConfig) {
          results.sort((a, b) => {
            const aVal = a?.[sortConfig.field];
            const bVal = b?.[sortConfig.field];
            if (aVal === bVal) return 0;
            if (aVal === undefined) return 1;
            if (bVal === undefined) return -1;
            return sortConfig.direction === 'desc'
              ? (aVal < bVal ? 1 : -1)
              : (aVal > bVal ? 1 : -1);
          });
        }

        if (typeof skip === 'number' && skip > 0) {
          return results.slice(skip, limit ? skip + limit : undefined);
        }
        if (typeof limit === 'number') {
          return results.slice(0, limit);
        }
        return results;
      }

      if (sortConfig) {
        constraints.push(orderBy(sortConfig.field, sortConfig.direction));
      }
      if (typeof limit === 'number') {
        constraints.push(limitDocs(limit + (skip || 0)));
      }

      const queryRef = constraints.length ? query(collectionRef, ...constraints) : collectionRef;
      try {
        return await readDocs(queryRef, skip, limit);
      } catch (error) {
        // Fallback when Firestore index is missing: client-side filter & sort.
        const snapshot = await getDocs(collectionRef);
        let rows = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        rows = rows.filter((row) => matchesFilter(row, filter));
        rows = sortRows(rows, sortConfig);
        if (typeof skip === 'number' && skip > 0) {
          rows = rows.slice(skip, limit ? skip + limit : undefined);
        } else if (typeof limit === 'number') {
          rows = rows.slice(0, limit);
        }
        return rows;
      }
    },
    subscribe(handler) {
      if (typeof handler !== 'function') return () => {};
      const unsubscribe = onSnapshot(collectionRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const type = change.type === 'added'
            ? 'create'
            : change.type === 'modified'
              ? 'update'
              : 'delete';
          handler({
            type,
            id: change.doc.id,
            data: { id: change.doc.id, ...change.doc.data() }
          });
        });
      });
      return unsubscribe;
    }
  };
};

const entities = Object.keys(ENTITY_COLLECTIONS).reduce((acc, entityName) => {
  acc[entityName] = createEntityApi(entityName);
  return acc;
}, {});

const authApi = {
  async me() {
    if (!auth.currentUser) {
      const error = new Error('Authentication required');
      error.status = 401;
      throw error;
    }
    try {
      return await ensureUserProfile(auth.currentUser);
    } catch (error) {
      return buildFallbackProfile(auth.currentUser);
    }
  },
  async updateMe(data = {}) {
    if (!auth.currentUser) {
      const error = new Error('Authentication required');
      error.status = 401;
      throw error;
    }
    const userRef = doc(db, ENTITY_COLLECTIONS.User, auth.currentUser.uid);
    const normalized = { ...data };
    if (data.display_name && !data.displayName) normalized.displayName = data.display_name;
    if (data.full_name && !data.fullName) normalized.fullName = data.full_name;
    if (data.displayName && !data.display_name) normalized.display_name = data.displayName;
    if (data.fullName && !data.full_name) normalized.full_name = data.fullName;
    await setDoc(userRef, normalized, { merge: true });
    if (normalized.displayName || normalized.display_name || normalized.full_name || normalized.fullName) {
      const displayName = normalized.displayName || normalized.display_name || normalized.fullName || normalized.full_name;
      await updateProfile(auth.currentUser, { displayName });
    }
    return ensureUserProfile(auth.currentUser);
  },
  async logout(returnTo) {
    await signOut(auth);
    if (returnTo) {
      window.location.href = createPageUrl('Login');
    }
  },
  redirectToLogin() {
    window.location.href = createPageUrl('Login');
  }
};

const appLogs = {
  async logEvent() {},
  async logUserInApp() {}
};

const integrations = {
  Core: {
    async UploadFile({ file, path = 'uploads' } = {}) {
      if (!file) throw new Error('No file provided');
      const storage = getStorage();
      const fileRef = ref(storage, `${path}/${Date.now()}-${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      return { file_url: url };
    },
    async InvokeLLM() {
      return { result: 'AI is disabled in migration build.' };
    }
  }
};

export const base44 = {
  auth: authApi,
  entities,
  appLogs,
  integrations
};
