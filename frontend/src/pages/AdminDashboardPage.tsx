import { Activity, AlertCircle, ArrowRight, CalendarDays, CheckCircle2, Clock3, Eye, Headphones, MessageSquareQuote, Plus, Radio, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import type { User } from '../types';

type Row = Record<string, unknown>;
type DashboardData = {
  summary?: Row;
  trend?: Row[];
  topSermons?: Row[];
  recentSermons?: Row[];
  pendingTestimonials?: Row[];
  activeAudioJob?: Row | null;
  nextScheduledSermon?: Row | null;
  devices?: Row[];
  range?: { from: string; to: string; days: number };
};

const number = (value: unknown) => Number(value ?? 0);
const displayNumber = (value: unknown) => number(value).toLocaleString('fr-FR');
const localToday = () => {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Lubumbashi', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const daysAgo = (days: number) => {
  const date = new Date(`${localToday()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

export function AdminDashboardPage() {
  const { profile } = useOutletContext<{ profile: User | null }>();
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'today' | '7' | '30' | 'custom'>('30');
  const [customFrom, setCustomFrom] = useState(daysAgo(29));
  const [customTo, setCustomTo] = useState(localToday());

  const selectedRange = useMemo(() => {
    if (period === 'today') return { from: localToday(), to: localToday() };
    if (period === '7') return { from: daysAgo(6), to: localToday() };
    if (period === '30') return { from: daysAgo(29), to: localToday() };
    return { from: customFrom, to: customTo };
  }, [customFrom, customTo, period]);

  useEffect(() => {
    setLoading(true);
    setError('');
    void api.dashboard(selectedRange)
      .then((response) => setData(response.data as DashboardData))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Le tableau de bord n’a pas pu être chargé.'))
      .finally(() => setLoading(false));
  }, [selectedRange.from, selectedRange.to]);

  const summary = data.summary ?? {};
  const recent = data.recentSermons ?? [];
  const pending = data.pendingTestimonials ?? [];
  const trendRows = data.trend ?? [];
  const trend = trendRows.map((item) => number(item.playStarts));
  const max = Math.max(...trend, 1);
  const deviceTotal = useMemo(() => (data.devices ?? []).reduce((sum, item) => sum + number(item.eventCount), 0), [data.devices]);
  const attentionCount = number(summary.pendingTestimonials) + number(summary.activeAudioJobs);
  const chartLabels = trendRows.length ? [trendRows[0], trendRows[Math.floor((trendRows.length - 1) / 2)], trendRows[trendRows.length - 1]] : [];
  const periodLabel = period === 'today' ? 'Aujourd’hui' : period === '7' ? '7 derniers jours' : period === '30' ? '30 derniers jours' : `${formatDate(selectedRange.from)} – ${formatDate(selectedRange.to)}`;
  const firstName = profile?.firstName || profile?.displayName?.split(/\s+/)[0] || profile?.email?.split('@')[0] || 'Innocent';

  if (loading) return <div className="management-empty"><span className="data-loader" /> Chargement des statistiques depuis la base de données…</div>;
  if (error) return <div className="management-empty" role="alert"><AlertCircle size={22} /> {error}</div>;

  return (
    <div className="dashboard-page">
      <div className="admin-page-heading"><div><span>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(new Date())}</span><h1>Bonjour {firstName}</h1><p>Voici l’activité réelle enregistrée sur votre plateforme pastorale.</p></div><div className="dashboard-period-actions"><label className="dashboard-period-select"><CalendarDays size={17} /><select value={period} onChange={(event) => setPeriod(event.target.value as typeof period)}><option value="today">Aujourd’hui</option><option value="7">7 derniers jours</option><option value="30">30 derniers jours</option><option value="custom">Période personnalisée</option></select></label><Link className="button button--primary" to="/admin/publier"><Plus size={18} /> Nouvelle prédication</Link></div></div>

      {period === 'custom' && <div className="dashboard-custom-range"><label>Du<input type="date" value={customFrom} max={customTo} onChange={(event) => setCustomFrom(event.target.value)} /></label><label>Au<input type="date" value={customTo} min={customFrom} max={localToday()} onChange={(event) => setCustomTo(event.target.value)} /></label><span>{periodLabel}</span></div>}

      {attentionCount > 0 && <div className="attention-banner"><div><AlertCircle size={21} /><p><strong>{attentionCount} élément{attentionCount > 1 ? 's' : ''} demande{attentionCount > 1 ? 'nt' : ''} votre attention.</strong> {displayNumber(summary.activeAudioJobs)} audio(s) en traitement et {displayNumber(summary.pendingTestimonials)} témoignage(s) à valider.</p></div><a href="#actions">Voir les actions <ArrowRight size={16} /></a></div>}

      <section className="stat-grid">
        <article><span className="stat-icon stat-icon--navy"><Headphones size={21} /></span><div><small>Écoutes · {periodLabel}</small><strong>{displayNumber(summary.rangePlays)}</strong><em>{displayNumber(summary.totalPlays)} au total</em></div><p>Période sélectionnée</p></article>
        <article><span className="stat-icon stat-icon--gold"><UsersRound size={21} /></span><div><small>Auditeurs · {periodLabel}</small><strong>{displayNumber(summary.rangeUniqueListeners)}</strong><em>mesure quotidienne</em></div><p>Somme des auditeurs uniques</p></article>
        <article><span className="stat-icon stat-icon--blue"><Radio size={21} /></span><div><small>Prédications publiées</small><strong>{displayNumber(summary.publishedSermons)}</strong><em>{displayNumber(summary.totalSermons)} au total</em></div><p>Messages visibles en ligne</p></article>
        <article><span className="stat-icon stat-icon--purple"><MessageSquareQuote size={21} /></span><div><small>À modérer</small><strong>{displayNumber(summary.pendingTestimonials)}</strong><em>témoignages</em></div><p>En attente de validation</p></article>
        <article><span className="stat-icon stat-icon--green"><Activity size={21} /></span><div><small>Taux d’écoute moyen</small><strong>{displayNumber(summary.rangeCompletionRate)}%</strong><em>lectures terminées</em></div><p>Sur {periodLabel.toLowerCase()}</p></article>
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-card listening-chart-card"><header><div><h2>Évolution des écoutes</h2><p>{periodLabel}</p></div><span><i /> Écoutes</span></header><div className="chart-summary"><strong>{displayNumber(summary.rangePlays)}</strong><small>données PostgreSQL</small></div>{trend.length ? <><div className="bar-chart" aria-label="Graphique des écoutes">{trend.map((value, index) => <i key={index} style={{ height: `${Math.max(5, value / max * 100)}%` }} title={String(value)} />)}</div><div className="chart-labels">{chartLabels.map((item, index) => <span key={index}>{item.statsDate ? formatDate(String(item.statsDate)) : '—'}</span>)}</div></> : <div className="management-empty">Le graphique apparaîtra après les premières écoutes.</div>}</article>
        <article className="dashboard-card devices-card"><header><div><h2>Appareils utilisés</h2><p>Répartition des lectures enregistrées</p></div></header>{deviceTotal > 0 ? <div className="donut-wrap"><div className="donut"><span><strong>{displayNumber(deviceTotal)}</strong><small>lectures</small></span></div><ul>{(data.devices ?? []).map((item) => { const type = String(item.deviceType); const percent = Math.round(number(item.eventCount) / deviceTotal * 100); return <li key={type}><i className={type === 'mobile' || type === 'tablet' ? type : 'desktop'} /><span>{type}</span><b>{percent}%</b></li>; })}</ul></div> : <div className="management-empty">Aucune donnée d’appareil enregistrée.</div>}</article>
      </section>

      <section className="dashboard-grid dashboard-grid--bottom">
        <article className="dashboard-card recent-table-card"><header><div><h2>Prédications récentes</h2><p>Dernières publications et brouillons</p></div><Link to="/admin/predications">Tout afficher <ArrowRight size={15} /></Link></header><div className="responsive-table"><table><thead><tr><th>Prédication</th><th>Statut</th><th>Date</th><th>Écoutes</th><th /></tr></thead><tbody>{recent.slice(0, 5).map((item, index) => <tr key={String(item.id ?? index)}><td>{item.slug ? <Link className="table-play" to={`/predications/${String(item.slug)}`} target="_blank"><Eye size={14} /></Link> : <span className="table-play"><Eye size={14} /></span>}<span><strong>{String(item.title ?? 'Sans titre')}</strong><small>{String(item.scriptureReference ?? 'Prédication')}</small></span></td><td><Status status={String(item.status ?? 'draft')} /></td><td>{item.preachedOn ? formatDate(String(item.preachedOn)) : '—'}</td><td><Eye size={14} /> {displayNumber(item.playCount)}</td><td><Link to="/admin/predications" aria-label="Gérer"><ArrowRight size={18} /></Link></td></tr>)}</tbody></table>{!recent.length && <div className="management-empty">Aucune prédication enregistrée.</div>}</div></article>
        <article className="dashboard-card moderation-card" id="actions"><header><div><h2>À modérer</h2><p>Témoignages en attente</p></div><span>{displayNumber(summary.pendingTestimonials)}</span></header>{pending.map((item) => <div className="moderation-item" key={String(item.id)}><div><span>{String(item.authorName ?? '?').charAt(0)}</span><p><strong>{String(item.authorName)}</strong><small>{String(item.authorRole ?? 'Auditeur')}</small></p></div><blockquote>« {String(item.quote).slice(0, 116)}{String(item.quote).length > 116 ? '…' : ''} »</blockquote><div><Link className="button approve" to="/admin/temoignages"><CheckCircle2 size={15} /> Modérer</Link></div></div>)}{!pending.length && <div className="management-empty">Aucun témoignage en attente.</div>}<Link to="/admin/temoignages">Voir les témoignages <ArrowRight size={15} /></Link></article>
      </section>

      <section className="quick-actions">
        {data.activeAudioJob ? <article><span><Clock3 size={21} /></span><div><strong>Audio en cours de traitement</strong><small>{String(data.activeAudioJob.originalFilename)} · {displayNumber(data.activeAudioJob.progressPercent)} %</small></div><div className="mini-progress"><i style={{ width: `${number(data.activeAudioJob.progressPercent)}%` }} /></div><Link to="/admin/medias">Suivre</Link></article> : <article><span><CheckCircle2 size={21} /></span><div><strong>Aucun audio en attente</strong><small>La file de traitement est à jour.</small></div><Link to="/admin/medias">Médiathèque</Link></article>}
        {data.nextScheduledSermon ? <article><span><CalendarDays size={21} /></span><div><strong>Prochaine publication programmée</strong><small>{String(data.nextScheduledSermon.title)} · {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(String(data.nextScheduledSermon.scheduledFor)))}</small></div><Link to="/admin/predications">Modifier</Link></article> : <article><span><CalendarDays size={21} /></span><div><strong>Aucune publication programmée</strong><small>Planifiez un message depuis la liste des prédications.</small></div><Link to="/admin/predications">Voir la liste</Link></article>}
      </section>
    </div>
  );
}

function Status({ status }: { status: string }) {
  const labels: Record<string, string> = { published: 'Publié', processing: 'Traitement', draft: 'Brouillon', ready: 'Prêt', scheduled: 'Programmé' };
  return <span className={`status status--${status}`}><i /> {labels[status] || status}</span>;
}
