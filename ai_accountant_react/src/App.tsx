import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage }    from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { UploadPage }       from './pages/UploadPage';
import { AnalyticsPage }    from './pages/AnalyticsPage';
import { AccountsPage }     from './pages/AccountsPage';
import { BudgetsPage }      from './pages/BudgetsPage';
import { LoginPage }        from './pages/LoginPage';
import { RegisterPage }     from './pages/RegisterPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<Layout />}>
          <Route path="/"             element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/upload"       element={<UploadPage />} />
          <Route path="/analytics"    element={<AnalyticsPage />} />
          <Route path="/accounts"     element={<AccountsPage />} />
          <Route path="/budgets"      element={<BudgetsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
