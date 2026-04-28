// useWebcam — getUserMedia 包裝（Task 030）
//
// 提供：
//   - videoRef：掛到 <video> 上自動播放鏡頭預覽
//   - status：'pending' | 'ready' | 'denied' | 'error' | 'stopped'
//   - capture()：擷取目前幀為 ImageData / dataURL，給 face-api.js / Storage 用
//   - stop()：明確釋放鏡頭
//
// 元件 unmount 時會自動 stop，避免攝影機 LED 一直亮。
// 約定使用 facingMode='user'（前鏡頭）；Kiosk 通常會接外接相機 — 沒指定就抓
// 預設裝置即可。

import { useCallback, useEffect, useRef, useState } from 'react';

export type WebcamStatus = 'pending' | 'ready' | 'denied' | 'error' | 'stopped';

interface UseWebcamOptions {
  width?: number;
  height?: number;
  facingMode?: 'user' | 'environment';
  enabled?: boolean; // false 時不啟動鏡頭（節能 / 等使用者按下開始）
}

export interface CapturedFrame {
  dataUrl: string;       // image/jpeg base64
  width: number;
  height: number;
  takenAt: Date;
}

export function useWebcam({
  width = 640,
  height = 480,
  facingMode = 'user',
  enabled = true,
}: UseWebcamOptions = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<WebcamStatus>('pending');
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus('stopped');
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }
    let cancelled = false;
    setStatus('pending');
    setError(null);

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('瀏覽器不支援 getUserMedia');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            width: { ideal: width },
            height: { ideal: height },
            facingMode,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        const err = e as DOMException;
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setStatus('denied');
          setError('使用者拒絕了攝影機權限');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setStatus('error');
          setError('找不到攝影機裝置');
        } else {
          setStatus('error');
          setError(e instanceof Error ? e.message : '攝影機啟動失敗');
        }
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled, width, height, facingMode, stop]);

  // 擷取一張畫面為 dataURL — face-api.js 接受 HTMLVideoElement 直接做偵測，
  // 但 Storage 上傳需要 Blob/dataURL，所以也提供這個。
  const capture = useCallback((quality = 0.9): CapturedFrame | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return {
      dataUrl: canvas.toDataURL('image/jpeg', quality),
      width: w,
      height: h,
      takenAt: new Date(),
    };
  }, []);

  return { videoRef, status, error, capture, stop };
}

// 把 dataURL 轉成 Blob（給 Storage uploadBytes 用）
export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mimeMatch = /data:(.+?);/.exec(meta);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(b64);
  const len = binary.length;
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; i++) buf[i] = binary.charCodeAt(i);
  return new Blob([buf], { type: mime });
}
