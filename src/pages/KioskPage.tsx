import { useParams } from 'react-router-dom';

export function KioskPage() {
  const { branchId } = useParams<{ branchId: string }>();
  return (
    <main style={{ padding: '2rem' }}>
      <h1>Kiosk 自助報到</h1>
      <p>branchId: {branchId}</p>
      <p>Webcam 與人臉辨識將於 Phase 7 / Task 029-031 實作。</p>
    </main>
  );
}
