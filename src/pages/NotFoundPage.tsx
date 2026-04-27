import { Link } from 'react-router-dom';
import { ROUTES } from '../routes/paths';

export function NotFoundPage() {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>404 - 找不到頁面</h1>
      <Link to={ROUTES.login}>回登入頁</Link>
    </main>
  );
}
