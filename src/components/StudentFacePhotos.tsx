// 學生人臉照片管理（Task 034）
//
// 嵌入學生詳細頁的「人臉照片狀態」卡。
// 三個來源：
//   1) 用攝影機拍照
//   2) 上傳檔案
//   3) 既有照片預覽 + 停用 / 刪除 / 重產 embedding
//
// 流程：取得圖片 → face-api.js extractEmbedding → 上傳 Storage →
//      寫 face_profiles → realtime listener 自動更新清單。

import { useEffect, useRef, useState } from 'react';

import { Modal } from './Modal';
import { useWebcam, dataUrlToBlob } from '../hooks/useWebcam';
import {
  createFaceProfile,
  deleteFaceProfile,
  setFaceProfileActive,
  subscribeStudentFaceProfiles,
} from '../services/faceProfiles';
import {
  extractEmbedding,
  loadFaceModels,
} from '../services/faceRecognition';
import {
  deletePhoto,
  getPhotoUrl,
  uploadStudentFacePhoto,
} from '../services/storage';
import type { FaceProfileDoc } from '../types/faceProfile';
import type { StudentDoc } from '../types/student';

interface Props {
  student: StudentDoc;
}

export function StudentFacePhotos({ student }: Props) {
  const [profiles, setProfiles] = useState<FaceProfileDoc[]>([]);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeStudentFaceProfiles(student.studentId, setProfiles);
    return unsub;
  }, [student.studentId]);

  async function toggleActive(p: FaceProfileDoc) {
    setBusyId(p.profileId);
    try {
      await setFaceProfileActive(p.profileId, !p.active);
    } finally { setBusyId(null); }
  }

  async function removeProfile(p: FaceProfileDoc) {
    if (!window.confirm('確定要刪除此照片？此動作無法還原。')) return;
    setBusyId(p.profileId);
    try {
      // Firestore 先刪、Storage 再刪 — Storage 失敗不擋（只是孤兒檔，可日後清）
      await deleteFaceProfile(p.profileId);
      try { await deletePhoto(p.photoPath); } catch { /* ignore */ }
    } finally { setBusyId(null); }
  }

  const activeCount = profiles.filter((p) => p.active).length;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
          已啟用 {activeCount} / 共 {profiles.length} 張（建議 3–5 張）
        </span>
        <button type="button" style={btnPrimary} onClick={() => setAdding(true)}>＋ 新增照片</button>
      </div>

      {profiles.length === 0 && (
        <p style={{ color: '#9ca3af', fontStyle: 'italic', margin: 0 }}>尚未上傳任何人臉照片</p>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.6rem' }}>
        {profiles.map((p) => (
          <li key={p.profileId} style={{ ...thumbCard, opacity: p.active ? 1 : 0.45 }}>
            <Thumb path={p.photoPath} />
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.3rem' }}>
              品質 {(p.qualityScore * 100).toFixed(0)}%
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
              <button type="button" style={miniBtn} disabled={busyId === p.profileId} onClick={() => toggleActive(p)}>
                {p.active ? '停用' : '啟用'}
              </button>
              <button type="button" style={{ ...miniBtn, color: '#b91c1c' }} disabled={busyId === p.profileId} onClick={() => removeProfile(p)}>
                刪除
              </button>
            </div>
          </li>
        ))}
      </ul>

      {adding && (
        <AddPhotoDialog
          student={student}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}

function Thumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getPhotoUrl(path)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setError(true));
    return () => { cancelled = true; };
  }, [path]);
  if (error) return <div style={{ ...thumb, background: '#fee2e2', color: '#b91c1c', fontSize: '0.7rem' }}>讀取失敗</div>;
  if (!url) return <div style={{ ...thumb, background: '#f3f4f6' }} />;
  return <img src={url} alt="face" style={thumb} />;
}

function AddPhotoDialog({ student, onClose }: { student: StudentDoc; onClose: () => void }) {
  const [mode, setMode] = useState<'camera' | 'upload'>('camera');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const webcam = useWebcam({ enabled: mode === 'camera', width: 640, height: 480 });

  // 預先載模型（不阻塞 UI）
  useEffect(() => { loadFaceModels().catch(() => {}); }, []);

  function takeSnapshot() {
    setError(null); setInfo(null);
    const frame = webcam.capture();
    if (!frame) { setError('擷取失敗，請確認攝影機已就緒'); return; }
    setPreviewUrl(frame.dataUrl);
    setPreviewBlob(dataUrlToBlob(frame.dataUrl));
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { setError('請選擇圖片檔'); return; }
    setError(null); setInfo(null);
    setPreviewBlob(f);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(String(reader.result));
    reader.readAsDataURL(f);
  }

  async function save() {
    if (!previewBlob || !previewUrl) return;
    setWorking(true); setError(null); setInfo(null);
    try {
      // 1) 從預覽圖跑 embedding
      const img = await loadImage(previewUrl);
      setInfo('辨識人臉 / 產生 embedding…');
      const result = await extractEmbedding(img);
      if (!result) {
        setError('找不到清晰人臉，請重拍或換一張');
        setWorking(false);
        return;
      }
      // 2) 上傳 Storage
      setInfo('上傳照片…');
      const uploaded = await uploadStudentFacePhoto({
        branchId: student.branchId,
        studentId: student.studentId,
        blob: previewBlob,
      });
      // 3) 寫 face_profiles
      setInfo('寫入 face_profiles…');
      await createFaceProfile({
        studentId: student.studentId,
        branchId: student.branchId,
        photoPath: uploaded.path,
        embedding: result.embedding,
        qualityScore: result.qualityScore,
      });
      setInfo(null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setWorking(false);
    }
  }

  function reset() {
    setPreviewUrl(null);
    setPreviewBlob(null);
    setError(null); setInfo(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  return (
    <Modal open title={`新增 ${student.name} 的人臉照片`} onClose={onClose} width={560}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button type="button" style={modeBtn(mode === 'camera')} onClick={() => { setMode('camera'); reset(); }}>
          📷 拍照
        </button>
        <button type="button" style={modeBtn(mode === 'upload')} onClick={() => { setMode('upload'); reset(); }}>
          📁 上傳
        </button>
      </div>

      {error && <div style={errorBox}>{error}</div>}
      {info && <div style={infoBox}>{info}</div>}

      {mode === 'camera' && !previewUrl && (
        <>
          <div style={cameraBox}>
            <video ref={webcam.videoRef} muted autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            {webcam.status === 'denied' && <div style={cameraOverlay}>權限被拒絕</div>}
            {webcam.status === 'error' && <div style={cameraOverlay}>{webcam.error}</div>}
          </div>
          <button type="button" style={{ ...btnPrimary, width: '100%', marginTop: '0.75rem' }} onClick={takeSnapshot} disabled={webcam.status !== 'ready'}>
            擷取一張
          </button>
        </>
      )}

      {mode === 'upload' && !previewUrl && (
        <div style={{ padding: '2rem', border: '2px dashed #d1d5db', borderRadius: 8, textAlign: 'center' }}>
          <input ref={fileInput} type="file" accept="image/*" onChange={handleFile} />
          <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            建議：正面、自然光、僅一張臉
          </p>
        </div>
      )}

      {previewUrl && (
        <>
          <img src={previewUrl} alt="preview" style={{ width: '100%', maxHeight: 320, objectFit: 'contain', background: '#000', borderRadius: 8 }} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button type="button" style={btnSecondary} onClick={reset} disabled={working}>重來</button>
            <button type="button" style={{ ...btnPrimary, flex: 1 }} onClick={save} disabled={working}>
              {working ? '處理中…' : '產生 embedding 並儲存'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('圖片載入失敗'));
    img.src = url;
  });
}

const thumb: React.CSSProperties = { width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6 };
const thumbCard: React.CSSProperties = { padding: '0.4rem', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 };
const cameraBox: React.CSSProperties = { position: 'relative', background: '#000', borderRadius: 8, overflow: 'hidden', aspectRatio: '4/3' };
const cameraOverlay: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.9rem' };
const btnPrimary: React.CSSProperties = { padding: '0.55rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.95rem', fontWeight: 600 };
const btnSecondary: React.CSSProperties = { padding: '0.55rem 1rem', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.95rem' };
const miniBtn: React.CSSProperties = { padding: '0.2rem 0.4rem', background: 'transparent', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.75rem', flex: 1 };
const errorBox: React.CSSProperties = { padding: '0.6rem 0.75rem', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 6, marginBottom: '0.75rem', fontSize: '0.9rem' };
const infoBox: React.CSSProperties = { padding: '0.6rem 0.75rem', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: 6, marginBottom: '0.75rem', fontSize: '0.9rem' };
const modeBtn = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '0.5rem', background: active ? '#2563eb' : '#fff',
  color: active ? '#fff' : '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.9rem',
});
