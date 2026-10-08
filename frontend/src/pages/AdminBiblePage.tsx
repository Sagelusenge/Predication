import { BookCheck, Check, Database, ExternalLink, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import type { BibleBook, BibleChapter, BibleTranslation, FeaturedBiblePassage } from '../types';

export function AdminBiblePage() {
  const { notify } = useToast();
  const [translations, setTranslations] = useState<BibleTranslation[]>([]);
  const [featured, setFeatured] = useState<FeaturedBiblePassage | null>(null);
  const [translationCode, setTranslationCode] = useState('fraLSG');
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [bookCode, setBookCode] = useState('JOH');
  const [chapterNumber, setChapterNumber] = useState(3);
  const [chapter, setChapter] = useState<BibleChapter | null>(null);
  const [selectedVerse, setSelectedVerse] = useState(16);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = async () => {
    const response = await api.adminBibleStatus();
    setTranslations(response.data.translations);
    setFeatured(response.data.featured);
  };

  useEffect(() => {
    void loadStatus().catch(() => setError('Impossible de charger l’état des traductions.')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    void api.bibleBooks(translationCode).then((response) => {
      if (!active) return;
      setBooks(response.data);
      if (!response.data.some((book) => book.code === bookCode)) {
        setBookCode(response.data.find((book) => book.code === 'JOH')?.code || response.data[0]?.code || 'GEN');
        setChapterNumber(1);
      }
    }).catch(() => { if (active) setError('Impossible de charger les livres.'); });
    return () => { active = false; };
  }, [bookCode, translationCode]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void api.bibleChapter(translationCode, bookCode, chapterNumber)
      .then((response) => {
        if (!active) return;
        setChapter(response.data);
        setSelectedVerse((current) => response.data.verses.some((verse) => verse.verseStart === current)
          ? current
          : response.data.verses[0]?.verseStart || 1);
      })
      .catch(() => { if (active) setError('Impossible de charger ce chapitre.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookCode, chapterNumber, translationCode]);

  const selectedBook = useMemo(() => books.find((book) => book.code === bookCode), [bookCode, books]);

  const saveFeatured = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await api.saveFeaturedBiblePassage({
        translationCode,
        bookCode,
        chapter: chapterNumber,
        verseStart: selectedVerse,
        verseEnd: selectedVerse,
      });
      setFeatured(response.data);
      notify('Le verset de l’accueil a été mis à jour.');
    } catch {
      setError('Le passage n’a pas pu être enregistré.');
    } finally {
      setSaving(false);
    }
  };

  const synchronize = async () => {
    setSyncing(true);
    setError('');
    try {
      const response = await api.importBible();
      setTranslations(response.data);
      notify('Les traductions et l’accès à la Bible kinande ont été vérifiés.');
    } catch {
      setError('La synchronisation des traductions a échoué.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="admin-bible-page">
      <div className="admin-page-heading">
        <div><span className="admin-kicker">Contenu biblique</span><h1>Bibliothèque de la Bible</h1><p>Consultez les traductions et choisissez le verset affiché sur l’accueil.</p></div>
        <button className="button button--soft" onClick={synchronize} disabled={syncing}><RefreshCw size={17} className={syncing ? 'is-spinning' : ''} /> {syncing ? 'Synchronisation…' : 'Vérifier les textes'}</button>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}

      <div className="bible-admin-stats" data-reveal data-stagger>
        {translations.map((translation) => (
          <article className={translation.accessMode === 'external' ? 'bible-admin-external' : ''} key={translation.code}>
            <span><Database size={21} /></span>
            <div>
              <small>{translation.languageName}</small>
              <strong>{translation.title}</strong>
              {translation.accessMode === 'external'
                ? <em><ExternalLink size={13} /> Bible complète · source autorisée</em>
                : <em><Check size={13} /> {translation.verseCount.toLocaleString('fr-FR')} versets</em>}
            </div>
          </article>
        ))}
      </div>

      {featured && <section className="admin-featured-verse" data-reveal>
        <span><BookCheck size={25} /></span><div><small>Actuellement sur l’accueil · {featured.translation.abbreviation}</small><blockquote>« {featured.text} »</blockquote><strong>{featured.reference}</strong></div>
      </section>}

      <section className="admin-bible-editor" data-reveal>
        <header><div><span className="admin-kicker">Sélection</span><h2>Choisir un verset pour l’accueil</h2></div><button className="button button--primary" onClick={saveFeatured} disabled={saving || !chapter}>{saving ? 'Enregistrement…' : 'Afficher sur l’accueil'}</button></header>
        <div className="admin-bible-controls">
          <label>Traduction<select value={translationCode} onChange={(event) => setTranslationCode(event.target.value)}>{translations.filter((item) => item.isComplete && item.accessMode === 'database').map((item) => <option key={item.code} value={item.code}>{item.languageName} · {item.abbreviation}</option>)}</select></label>
          <label>Livre<select value={bookCode} onChange={(event) => { setBookCode(event.target.value); setChapterNumber(1); }}>{books.map((book) => <option key={book.code} value={book.code}>{book.name}</option>)}</select></label>
          <label>Chapitre<select value={chapterNumber} onChange={(event) => setChapterNumber(Number(event.target.value))}>{Array.from({ length: selectedBook?.chapterCount || 1 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
        </div>
        <div className="admin-bible-verses" aria-busy={loading}>
          {loading ? <div className="bible-loading"><span className="data-loader" /> Chargement…</div> : chapter?.verses.map((verse) => (
            <button className={selectedVerse === verse.verseStart ? 'active' : ''} key={verse.verseStart} onClick={() => setSelectedVerse(verse.verseStart)}>
              <span>{verse.verseStart}</span><p>{verse.text}</p>{selectedVerse === verse.verseStart && <Check size={18} />}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

