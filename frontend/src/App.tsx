import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AdminLayout } from './components/AdminLayout';
import { PublicLayout } from './components/PublicLayout';
import { AboutPage } from './pages/AboutPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminMediaPage, AdminSettingsPage, AdminStatisticsPage, AdminTestimonialsPage, AdminUsersPage } from './pages/AdminManagementPages';
import { AdminPublishPage } from './pages/AdminPublishPage';
import { AdminSermonsPage } from './pages/AdminSermonsPage';
import { ContactPage } from './pages/ContactPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PasswordActionPage } from './pages/PasswordActionPage';
import { SermonDetailPage } from './pages/SermonDetailPage';
import { SermonsPage } from './pages/SermonsPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/predications" element={<SermonsPage />} />
          <Route path="/predications/:slug" element={<SermonDetailPage />} />
          <Route path="/a-propos" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Route>
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/reinitialiser-mot-de-passe" element={<PasswordActionPage />} />
        <Route path="/accepter-invitation" element={<PasswordActionPage invitation />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="predications" element={<AdminSermonsPage />} />
          <Route path="publier" element={<AdminPublishPage />} />
          <Route path="medias" element={<AdminMediaPage />} />
          <Route path="temoignages" element={<AdminTestimonialsPage />} />
          <Route path="statistiques" element={<AdminStatisticsPage />} />
          <Route path="utilisateurs" element={<AdminUsersPage />} />
          <Route path="parametres" element={<AdminSettingsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
