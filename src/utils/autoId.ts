// 自動遞增代碼工具（Task 047）
// 查詢 collection 中符合 `${prefix}\d+` 格式的最大編號，回傳下一個（補零至 3 位）。

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

export async function getNextId(prefix: string, collectionName: string): Promise<string> {
  const snap = await getDocs(collection(db, collectionName));
  const re = new RegExp(`^${prefix}(\\d+)$`, 'i');
  let max = 0;
  snap.docs.forEach((d) => {
    const m = d.id.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  });
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}
