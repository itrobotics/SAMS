import { useParams } from 'react-router-dom';

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return (
    <main style={{ padding: '2rem' }}>
      <h1>班級報到頁</h1>
      <p>sessionId: {sessionId}</p>
      <p>應到名單與手動報到將於 Phase 6 / Task 025-026 實作。</p>
    </main>
  );
}
