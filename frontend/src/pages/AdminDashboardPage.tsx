import { Activity, AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, Clock3, Eye, Headphones, MessageSquareQuote, Plus, Radio, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { demoSermons, demoTestimonials } from '../data/demo';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';

type DashboardData = {
  summary?: Record<string, unknown>;
  trend?: Array<Record<string, unknown>>;
  topSermons?: Array<Record<string, unknown>>;
  recentSermons?: Array<Record<string, unknown>>;
};

const fallbackBars = [35, 48, 42, 61, 57, 72, 66, 83, 74, 90, 78, 96, 81, 88, 92, 73, 85, 67, 78, 89, 94, 84, 98, 88];

export function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData>({});
  useEffect(() => { void api.dashboard().then((response) => setData(response.data as DashboardData)).catch(() => undefined); }, []);
  const summary = data.summary ?? {};
  const recent = data.recentSermons?.length ? data.recentSermons : demoSermons.slice(0, 5).map((item, index) => ({ ...item, status: index === 3 ? 'processing' : index === 4 ? 'draft' : 'published', publishedAt: item.preachedOn }));
  const trend = data.trend?.length ? data.trend.map((item) => Number(item.playStarts ?? item.playCount ?? 20)) : fallbackBars;
  const max = Math.max(...trend.map(Number), 1);

  return (
    <div className="dashboard-page">
      <div className="admin-page-heading"><div><span>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(new Date())}</span><h1>Bonjour, Pasteur Leki</h1><p>Voici l’activité récente de votre plateforme pastorale.</p></div><div><span className="button button--soft"><CalendarDays size={17} /> 30 derniers jours</span><Link className="button button--primary" to="/admin/publier"><Plus size={18} /> Nouvelle prédication</Link></div></div>

      <div className="attention-banner"><div><AlertCircle size={21} /><p><strong>2 éléments demandent votre attention.</strong> Un fichier audio est en traitement et trois témoignages attendent une validation.</p></div><a href="#actions">Voir les actions <ArrowRight size={16} /></a></div>

      <section className="stat-grid">
        <article><span className="stat-icon stat-icon--navy"><Headphones size={21} /></span><div><small>Écoutes totales</small><strong>{String(summary.totalPlays ?? '12 480')}</strong><em className="up"><ArrowUpRight size={14} /> 12,4 %</em></div><p>sur les 30 derniers jours</p></article>
        <article><span className="stat-icon stat-icon--gold"><UsersRound size={21} /></span><div><small>Auditeurs uniques</small><strong>{String(summary.uniqueListeners ?? '3 284')}</strong><em className="up"><ArrowUpRight size={14} /> 8,2 %</em></div><p>depuis le mois dernier</p></article>
        <article><span className="stat-icon stat-icon--blue"><Radio size={21} /></span><div><small>Prédications publiées</small><strong>{String(summary.publishedSermons ?? '128')}</strong><em className="up"><ArrowUpRight size={14} /> +4</em></div><p>dont 4 ce mois-ci</p></article>
        <article><span className="stat-icon stat-icon--purple"><MessageSquareQuote size={21} /></span><div><small>Témoignages</small><strong>{String(summary.pendingTestimonials ?? '46')}</strong><em className="down"><ArrowDownRight size={14} /> 3 à valider</em></div><p>reçus par la plateforme</p></article>
        <article><span className="stat-icon stat-icon--green"><Activity size={21} /></span><div><small>Taux d’écoute moyen</small><strong>{String(summary.averageCompletionRate ?? '68')}%</strong><em className="up"><ArrowUpRight size={14} /> 3,1 %</em></div><p>des audios commencés</p></article>
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-card listening-chart-card"><header><div><h2>Évolution des écoutes</h2><p>Nombre de lectures sur les 30 derniers jours</p></div><span><i /> Écoutes</span></header><div className="chart-summary"><strong>12 480</strong><em><ArrowUpRight size={14} /> +12,4 %</em><small>vs période précédente</small></div><div className="bar-chart" aria-label="Graphique des écoutes">{trend.slice(-24).map((value, index) => <i key={index} style={{ height: `${Math.max(8, Number(value) / max * 100)}%` }} title={String(value)} />)}</div><div className="chart-labels"><span>08 sept.</span><span>15 sept.</span><span>22 sept.</span><span>29 sept.</span><span>07 oct.</span></div></article>
        <article className="dashboard-card devices-card"><header><div><h2>Appareils utilisés</h2><p>Répartition des écoutes</p></div></header><div className="donut-wrap"><div className="donut"><span><strong>3 284</strong><small>auditeurs</small></span></div><ul><li><i className="mobile" /><span>Mobile</span><b>72%</b></li><li><i className="desktop" /><span>Ordinateur</span><b>19%</b></li><li><i className="tablet" /><span>Tablette</span><b>9%</b></li></ul></div><div className="device-note"><CheckCircle2 size={16} /> La PWA représente 41 % des écoutes mobiles.</div></article>
      </section>

      <section className="dashboard-grid dashboard-grid--bottom">
        <article className="dashboard-card recent-table-card"><header><div><h2>Prédications récentes</h2><p>Dernières publications et brouillons</p></div><Link to="/admin/predications">Tout afficher <ArrowRight size={15} /></Link></header><div className="responsive-table"><table><thead><tr><th>Prédication</th><th>Statut</th><th>Date</th><th>Écoutes</th><th /></tr></thead><tbody>{recent.slice(0, 5).map((item, index) => <tr key={String(item.id ?? index)}><td>{item.slug ? <Link className="table-play" to={`/predications/${String(item.slug)}`} target="_blank"><Eye size={14} /></Link> : <span className="table-play"><Eye size={14} /></span>}<span><strong>{String(item.title ?? 'Sans titre')}</strong><small>{String(item.scriptureReference ?? item.categoryName ?? 'Enseignement')}</small></span></td><td><Status status={String(item.status ?? 'published')} /></td><td>{item.preachedOn ? formatDate(String(item.preachedOn)) : '—'}</td><td><Eye size={14} /> {String(item.playCount ?? [1248, 968, 817, 756, 1104][index])}</td><td><Link to="/admin/predications" aria-label="Gérer"><ArrowRight size={18} /></Link></td></tr>)}</tbody></table></div></article>
        <article className="dashboard-card moderation-card" id="actions"><header><div><h2>À modérer</h2><p>Témoignages en attente</p></div><span>3</span></header>{demoTestimonials.slice(0, 2).map((item) => <div className="moderation-item" key={item.id}><div><span>{item.authorName.charAt(0)}</span><p><strong>{item.authorName}</strong><small>{item.authorLocation} · il y a 2 h</small></p></div><blockquote>« {item.content.slice(0, 116)}… »</blockquote><div><Link className="button approve" to="/admin/temoignages"><CheckCircle2 size={15} /> Modérer</Link></div></div>)}<Link to="/admin/temoignages">Voir les témoignages <ArrowRight size={15} /></Link></article>
      </section>

      <section className="quick-actions"><article><span><Clock3 size={21} /></span><div><strong>1 audio en cours de traitement</strong><small>La paix au milieu de la tempête · 64 %</small></div><div className="mini-progress"><i /></div><Link to="/admin/medias">Suivre</Link></article><article><span><CalendarDays size={21} /></span><div><strong>Prochaine publication programmée</strong><small>Dimanche 11 octobre à 08:00</small></div><Link to="/admin/predications">Modifier</Link></article></section>
    </div>
  );
}

function Status({ status }: { status: string }) {
  const labels: Record<string, string> = { published: 'Publié', processing: 'Traitement', draft: 'Brouillon', ready: 'Prêt', scheduled: 'Programmé' };
  return <span className={`status status--${status}`}><i /> {labels[status] || status}</span>;
}
