import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HomePage from './pages/HomePage';
import PanelPage, { AdminPanelPage, BankPanelPage } from './pages/PanelPage';
import UserPanelPage from './pages/UserPanelPage';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5 * 60 * 1000 } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage authenticationFirst />} />
        <Route path="/login" element={<HomePage authenticationFirst />} />
        <Route path="/marketplace" element={<HomePage />} />
        <Route path="/user-panel" element={<UserPanelPage />} />
        <Route path="/admin-panel" element={<AdminPanelPage />} />
        <Route path="/bank-panel" element={<BankPanelPage />} />
        <Route path="/panel" element={<PanelPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
