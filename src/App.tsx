import { AuthProvider } from './hooks/useAuth';
import { AppRouter } from './routes/AppRouter';

function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

export default App;
