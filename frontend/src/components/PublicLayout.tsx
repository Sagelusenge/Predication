import { Outlet } from 'react-router-dom';
import { Footer } from './Footer';
import { Header } from './Header';
import { PersistentPlayer } from './PersistentPlayer';

export function PublicLayout() {
  return (
    <div className="site-shell">
      <Header />
      <main><Outlet /></main>
      <Footer />
      <PersistentPlayer />
    </div>
  );
}
