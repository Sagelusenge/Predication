import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Filter, Headphones, ListFilter, Play, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SermonCard } from '../components/SermonCard';
import { Waveform } from '../components/Waveform';
import { InstallButton } from '../components/InstallButton';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { demoSermons } from '../data/demo';
import { api } from '../lib/api';
import { formatDate, formatDuration } from '../lib/format';
import type { Sermon } from '../types';

const themes = ['Tous', 'Foi', 'Famille', 'Prière', 'Espérance', 'Service'];

export function SermonsPage() {
  const [searchParams] = useSearchParams();
  const initialTheme = searchParams.get('theme');
  const [sermons, setSermons] = useState<Sermon[]>(demoSermons);
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState(initialTheme ? initialTheme.charAt(0).toUpperCase() + initialTheme.slice(1) : 'Tous');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const player = useAudioPlayer();

  useEffect(() => {
    void api.sermons('limit=24&sort=newest').then((response) => {
      if (response.data.length) setSermons(response.data);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const next = searchParams.get('theme');
    setTheme(next ? next.charAt(0).toUpperCase() + next.slice(1) : 'Tous');
  }, [searchParams]);

  const visible = useMemo(() => sermons.filter((sermon) => {
    const matchesQuery = `${sermon.title} ${sermon.excerpt} ${sermon.scriptureReference}`.toLowerCase().includes(query.toLowerCase());
    const matchesTheme = theme === 'Tous' || sermon.categoryName?.toLowerCase() === theme.toLowerCase();
    return matchesQuery && matchesTheme;
  }).sort((a, b) => {
    if (sort === 'ecoute') return (b.playCount ?? 0) - (a.playCount ?? 0);
    if (sort === 'ancien') return a.preachedOn.localeCompare(b.preachedOn);
    return b.preachedOn.localeCompare(a.preachedOn);
  }), [query, sermons, sort, theme]);
  const perPage = 6;
  const pageCount = Math.max(1, Math.ceil(visible.length / perPage));
  const pageItems = visible.slice((page - 1) * perPage, page * perPage);
  useEffect(() => setPage(1), [query, sort, theme]);

  const featured = sermons.find((sermon) => sermon.isFeatured) || sermons[0] || demoSermons[0];

  return (
    <>
      <section className="page-hero sermons-page-hero">
        <div className="container page-heading">
          <span className="eyebrow"><i /> Médiathèque audio</span>
          <h1>Des messages pour <em>nourrir votre foi.</em></h1>
          <p>Écoutez, méditez et partagez les prédications du ministère pastoral CBCA.</p>
        </div>
        <div className="container featured-sermon">
          <div className="featured-cover">
            <img src={featured.coverUrl || '/brand-mark.svg'} alt="" />
            <span>Message à la une</span>
          </div>
          <div className="featured-copy">
            <span className="sermon-category">{featured.categoryName || 'Espérance'}</span>
            <h2>{featured.title}</h2>
            <p>{featured.excerpt}</p>
            <div className="featured-details"><span><CalendarDays size={15} /> {formatDate(featured.preachedOn)}</span><span><Headphones size={15} /> {formatDuration(featured.durationSeconds ?? 0)}</span></div>
            <Link to={`/predications/${featured.slug}`} className="text-link">Voir les notes du message <ArrowRight size={16} /></Link>
          </div>
          <div className="featured-player">
            <button onClick={() => player.play(featured)} aria-label="Lire la prédication"><Play size={26} fill="currentColor" /></button>
            <div><Waveform active={player.playing && player.current?.id === featured.id} /><span><b>0:00</b><b>{formatDuration(featured.durationSeconds ?? 0)}</b></span></div>
          </div>
        </div>
      </section>

      <section className="section sermons-library">
        <div className="container">
          <div className="library-toolbar">
            <label className="search-field"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un titre, un passage…" /></label>
            <button className="filter-button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}><SlidersHorizontal size={18} /> Filtres</button>
            <label className="sort-field"><ListFilter size={18} /><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Plus récentes</option><option value="ecoute">Plus écoutées</option><option value="ancien">Plus anciennes</option></select></label>
          </div>
          <div className={`theme-chips ${filtersOpen ? 'is-open' : ''}`} aria-label="Filtrer par thème">
            {themes.map((item) => <button key={item} className={theme === item ? 'active' : ''} onClick={() => setTheme(item)}>{item}</button>)}
          </div>
          <div className="library-title"><div><h2>Toutes les prédications</h2><p>{visible.length} message{visible.length > 1 ? 's' : ''} disponible{visible.length > 1 ? 's' : ''}</p></div><span><Filter size={16} /> {theme === 'Tous' ? 'Tous les thèmes' : theme}</span></div>
          {visible.length ? <div className="sermon-grid sermon-grid--library">{pageItems.map((sermon) => <SermonCard key={sermon.id} sermon={sermon} />)}</div> : <div className="empty-state"><Search size={34} /><h3>Aucun message trouvé</h3><p>Essayez un autre mot-clé ou choisissez « Tous ».</p></div>}
          {visible.length > perPage && <nav className="pagination" aria-label="Pagination"><button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Page précédente"><ChevronLeft size={17} /></button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button key={number} className={page === number ? 'active' : ''} onClick={() => setPage(number)}>{number}</button>)}<button disabled={page === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} aria-label="Page suivante"><ChevronRight size={17} /></button></nav>}
        </div>
      </section>

      <section className="recommended-section">
        <div className="container recommended-grid">
          <div><span className="eyebrow"><i /> Pour commencer</span><h2>Une sélection pour votre semaine</h2><p>Trois messages courts à écouter dans l’ordre, autour de la confiance et de la persévérance.</p><Link to="/predications?theme=foi" className="button button--ghost">Voir la sélection <ArrowRight size={17} /></Link></div>
          <ol>{demoSermons.slice(1, 4).map((sermon, index) => <li key={sermon.id}><b>0{index + 1}</b><button onClick={() => player.play(sermon)}><Play size={15} fill="currentColor" /></button><span><strong>{sermon.title}</strong><small>{sermon.scriptureReference} · {formatDuration(sermon.durationSeconds ?? 0)}</small></span></li>)}</ol>
        </div>
      </section>

      <section className="subscription-cta">
        <div className="container"><div className="subscription-icon"><Headphones size={30} /></div><div><h2>Ne manquez aucune prédication</h2><p>Ajoutez l’application à votre écran d’accueil et retrouvez les nouveaux messages dès leur publication.</p></div><InstallButton /></div>
      </section>
    </>
  );
}
