// instructors 服務層（Task 046）

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import { INSTRUCTORS_COLLECTION, type InstructorDoc, type NewInstructorInput, type UpdateInstructorInput } from '../types/instructor';

function instRef(instructorId: string) {
  return doc(db, INSTRUCTORS_COLLECTION, instructorId);
}

function snapToDoc(snap: { id: string; data: () => Record<string, unknown> }): InstructorDoc {
  return { instructorId: snap.id, ...(snap.data() as Omit<InstructorDoc, 'instructorId'>) };
}

export function subscribeInstructors(
  options: { activeOnly?: boolean },
  onChange: (list: InstructorDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const constraints = options.activeOnly ? [where('active', '==', true)] : [];
  const q = query(collection(db, INSTRUCTORS_COLLECTION), ...constraints);
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(snapToDoc)),
    (err) => onError?.(err),
  );
}

export async function fetchInstructor(instructorId: string): Promise<InstructorDoc | null> {
  const snap = await getDoc(instRef(instructorId));
  if (!snap.exists()) return null;
  return snapToDoc(snap);
}

export async function createInstructor(input: NewInstructorInput): Promise<void> {
  const existing = await getDoc(instRef(input.instructorId));
  if (existing.exists()) throw new Error(`講師編號 ${input.instructorId} 已存在`);
  await setDoc(instRef(input.instructorId), { ...input, createdAt: serverTimestamp() });
}

export async function updateInstructor(instructorId: string, patch: UpdateInstructorInput): Promise<void> {
  await updateDoc(instRef(instructorId), patch as Record<string, unknown>);
}

export async function setInstructorActive(instructorId: string, active: boolean): Promise<void> {
  await updateDoc(instRef(instructorId), { active });
}
