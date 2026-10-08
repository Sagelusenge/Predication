import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AdminLayout } from './components/AdminLayout';
import { PublicLayout } from './components/PublicLayout';
import { AboutPage } from './pages/AboutPage';
import { AdminBiblePage } from './pages/AdminBiblePage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminMediaPage, AdminSettingsPage, AdminStatisticsPage, AdminTestimonialsPage, AdminUsersPage } from './pages/AdminManagementPages';
import { AdminPublishPage } from './pages/AdminPublishPage';
import { AdminSermonsPage } from './pages/AdminSermonsPage';
import { ContactPage } from './pages/ContactPage';
import { BiblePage } from './pages/BiblePage';
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

function ScrollAnimations() {
  const { pathname } = useLocation();

  useEffect(() => {
    const selector = '[data-reveal], .section-heading, .sermon-card, .dashboard-card, .management-card, .admin-page-heading';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const observed = new WeakSet<Element>();
    const observer = reduceMotion ? null : new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer?.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -36px' });

    const register = (root: ParentNode) => {
      const elements = [
        ...(root instanceof Element && root.matches(selector) ? [root] : []),
        ...Array.from(root.querySelectorAll(selector)),
      ];
      elements.forEach((element) => {
        if (observed.has(element)) return;
        observed.add(element);
        element.setAttribute('data-motion', '');
        if (reduceMotion) element.classList.add('is-visible');
        else observer?.observe(element);
      });
    };

    register(document);
    const mutations = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node instanceof Element) register(node);
    })));
    mutations.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true });
    return () => { observer?.disconnect(); mutations.disconnect(); };
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <ScrollAnimations />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/predications" element={<SermonsPage />} />
          <Route path="/predications/:slug" element={<SermonDetailPage />} />
          <Route path="/bible" element={<BiblePage />} />
          <Route path="/a-propos" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Route>
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/reinitialiser-mot-de-passe" element={<PasswordActionPage />} />
        <Route path="/accepter-invitation" element={<PasswordActionPage invitation />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="predications" element={<AdminSermonsPage />} />
          <Route path="bible" element={<AdminBiblePage />} />
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
