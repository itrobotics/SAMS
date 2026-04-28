// app_options 服務層（Task 045）

import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import {
  APP_OPTIONS_COLLECTION,
  OPTION_DEFAULTS,
  type AppOptionsDoc,
  type OptionKey,
} from '../types/appOptions';

function optionRef(key: OptionKey) {
  return doc(db, APP_OPTIONS_COLLECTION, key);
}

export function subscribeOptions(
  key: OptionKey,
  onChange: (values: string[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    optionRef(key),
    (snap) => {
      if (!snap.exists()) {
        onChange(OPTION_DEFAULTS[key]);
      } else {
        onChange((snap.data() as AppOptionsDoc).values ?? []);
      }
    },
    (err) => onError?.(err),
  );
}

export async function fetchOptions(key: OptionKey): Promise<string[]> {
  const snap = await getDoc(optionRef(key));
  if (!snap.exists()) return OPTION_DEFAULTS[key];
  return (snap.data() as AppOptionsDoc).values ?? [];
}

export async function saveOptions(key: OptionKey, values: string[]): Promise<void> {
  await setDoc(
    optionRef(key),
    { key, values, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
