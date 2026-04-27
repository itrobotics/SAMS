// users collection 存取（Task 006）

import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { USERS_COLLECTION, type UserDoc } from '../types/user';

export async function fetchUserDoc(uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
  if (!snap.exists()) return null;
  return { userId: snap.id, ...(snap.data() as Omit<UserDoc, 'userId'>) };
}
