import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { FirebaseAuthProvider } from './components/FirebaseAuthProvider';
import { ThemeProvider } from './context/ThemeContext';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <FirebaseAuthProvider>
      <App />
    </FirebaseAuthProvider>
  </ThemeProvider>
);
