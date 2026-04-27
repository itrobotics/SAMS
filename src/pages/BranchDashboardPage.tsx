import { useParams } from 'react-router-dom';

export function BranchDashboardPage() {
  const { branchId } = useParams<{ branchId: string }>();
  return (
    <main style={{ padding: '2rem' }}>
      <h1>分校今日班級看板</h1>
      <p>branchId: {branchId}</p>
      <p>今日班級列表將於 Phase 6 / Task 024 實作。</p>
    </main>
  );
}
