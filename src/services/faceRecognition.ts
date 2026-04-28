// 人臉辨識服務（Task 035）
//
// 用 face-api.js（瀏覽器端 TensorFlow.js）取代規格的 Python face_recognition
// 後端。所有公開介面與規格的 confidence / threshold 概念一致，未來若要換成
// 真正的 Python REST API，只要重做這個檔的內容即可。
//
// 模型來源：face-api.js 官方 GitHub model CDN（jsDelivr）— 約 6 MB，
// 第一次呼叫 loadFaceModels() 時下載，瀏覽器本身會 cache。
// 為了 Kiosk 離線可用性，未來可改成 self-host 至 /models/ 目錄。
//
// 三個關鍵 export：
//   loadFaceModels()           → 確保模型已載入（idempotent）
//   extractEmbedding(input)    → 從 video/image 取出 128-D embedding + score
//   findBestMatch(query, ...)  → 對一組 face_profiles 找距離最小者

import * as faceapi from 'face-api.js';

import {
  FACE_EMBEDDING_LENGTH,
  euclideanDistance,
  type FaceProfileDoc,
} from '../types/faceProfile';

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    // tinyFaceDetector：偵測；faceLandmark68Net：對齊；faceRecognitionNet：embedding
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  })();
  try {
    await loadingPromise;
  } catch (e) {
    loadingPromise = null;
    throw e;
  }
}

export interface ExtractResult {
  embedding: number[];
  qualityScore: number; // 0-1，detection confidence
  box: { x: number; y: number; width: number; height: number };
}

// 從一個 video / image / canvas 抓「最大臉」的 embedding。
// 若沒偵測到臉 → null
// 若多張臉 → 取最大的（人離鏡頭最近通常最大）
export async function extractEmbedding(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<ExtractResult | null> {
  await loadFaceModels();
  const opts = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.5,
  });

  const detections = await faceapi
    .detectAllFaces(input, opts)
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (detections.length === 0) return null;

  // 取面積最大的
  let best = detections[0];
  let bestArea = best.detection.box.area;
  for (let i = 1; i < detections.length; i++) {
    const area = detections[i].detection.box.area;
    if (area > bestArea) {
      best = detections[i];
      bestArea = area;
    }
  }

  const descriptor = Array.from(best.descriptor) as number[];
  if (descriptor.length !== FACE_EMBEDDING_LENGTH) {
    throw new Error(`face-api.js descriptor length ${descriptor.length} ≠ ${FACE_EMBEDDING_LENGTH}`);
  }

  return {
    embedding: descriptor,
    qualityScore: Number(best.detection.score.toFixed(4)),
    box: {
      x: best.detection.box.x,
      y: best.detection.box.y,
      width: best.detection.box.width,
      height: best.detection.box.height,
    },
  };
}

export interface FaceMatch {
  profile: FaceProfileDoc;
  distance: number;
  confidence: number; // 1 - distance, clamped 0-1
}

// 對一組 profiles 找距離最近的（同學生有多張照片時取最佳那張）
export function findBestMatch(
  query: number[],
  profiles: FaceProfileDoc[],
): FaceMatch | null {
  if (profiles.length === 0) return null;
  let best: FaceMatch | null = null;
  for (const p of profiles) {
    const d = euclideanDistance(query, p.embedding);
    const c = Math.max(0, Math.min(1, 1 - d));
    if (!best || d < best.distance) {
      best = { profile: p, distance: d, confidence: c };
    }
  }
  return best;
}
