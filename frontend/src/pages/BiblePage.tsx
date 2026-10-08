import { ArrowLeft, ArrowRight, BookHeart, BookOpen, ExternalLink, Languages, Search, ShieldCheck, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { BibleBook, BibleChapter, BibleSearchResult, BibleTranslation } from '../types';

const defaultSelection = { translation: 'fraLSG', book: 'JOH', chapter: 3 };

export function BiblePage() {
  const [params, setParams] = useSearchParams();
  const translationCode = params.get('translation') || defaultSelection.translation;
  const bookCode = params.get('book') || defaultSelection.book;
  const chapterNumber = Math.max(1, Number(params.get('chapter') || defaultSelection.chapter));
  const highlightedVerse = Number(params.get('verse') || 0);
  const [translations, setTranslations] = useState<BibleTranslation[]>([]);
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [chapter, setChapter] = useState<BibleChapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<BibleSearchResult[] | null>(null);
  const selectedTranslation = useMemo(
    () => translations.find((translation) => translation.code === translationCode),
    [translationCode, translations],
  );
  const isExternalTranslation = selectedTranslation?.accessMode === 'external';

  useEffect(() => {
    void api.bibleTranslations()
      .then((response) => setTranslations(response.data))
      .catch(() => setError('Les traductions bibliques ne sont pas encore disponibles.'));
  }, []);

  useEffect(() => {
    if (!selectedTranslation) return;
    if (selectedTranslation.accessMode === 'external') {
      setBooks([]);
      setChapter(null);
      setLoading(false);
      setError('');
      return;
    }
    let active = true;
    setError('');
    void api.bibleBooks(translationCode)
      .then((response) => {
        if (!active) return;
        setBooks(response.data);
        if (!response.data.some((book) => book.code === bookCode)) {
          const fallback = response.data.find((book) => book.code === defaultSelection.book) || response.data[0];
          if (fallback) setParams({ translation: translationCode, book: fallback.code, chapter: '1' }, { replace: true });
        }
      })
      .catch(() => { if (active) setError('Impossible de charger les livres de cette traduction.'); });
    return () => { active = false; };
  }, [bookCode, selectedTranslation, setParams, translationCode]);

  useEffect(() => {
    if (!selectedTranslation || selectedTranslation.accessMode === 'external') return;
    let active = true;
    setLoading(true);
    setError('');
    void api.bibleChapter(translationCode, bookCode, chapterNumber)
      .then((response) => { if (active) setChapter(response.data); })
      .catch(() => { if (active) setError('Ce chapitre n’a pas pu être chargé.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookCode, chapterNumber, selectedTranslation, translationCode]);

  useEffect(() => {
    if (!highlightedVerse || loading) return;
    document.getElementById(`verse-${highlightedVerse}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedVerse, loading]);

  const selectedBook = useMemo(() => books.find((book) => book.code === bookCode), [bookCode, books]);
  const currentBookIndex = books.findIndex((book) => book.code === bookCode);

  const goTo = (nextBook: string, nextChapter: number, verse?: number) => {
    const next: Record<string, string> = { translation: translationCode, book: nextBook, chapter: String(nextChapter) };
    if (verse) next.verse = String(verse);
    setParams(next);
    setResults(null);
  };

  const move = (direction: -1 | 1) => {
    if (!selectedBook) return;
    const targetChapter = chapterNumber + direction;
    if (targetChapter >= 1 && targetChapter <= selectedBook.chapterCount) {
      goTo(bookCode, targetChapter);
      return;
    }
    const nextBook = books[currentBookIndex + direction];
    if (nextBook) goTo(nextBook.code, direction === 1 ? 1 : nextBook.chapterCount);
  };

  const submitSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setError('');
    try {
      const response = await api.searchBible(translationCode, query.trim());
      setResults(response.data);
    } catch {
      setError('La recherche biblique a échoué.');
    } finally {
      setSearching(false);
    }
  };

  const selectTranslation = (translation: BibleTranslation) => {
    setError('');
    setResults(null);
    setQuery('');
    setParams(translation.accessMode === 'external'
      ? { translation: translation.code }
      : { translation: translation.code, book: defaultSelection.book, chapter: '3' });
  };

  return (
    <div className="bible-page">
      <section className="bible-hero">
        <div className="container" data-reveal>
          <div className="bible-hero-grid">
            <div><h1>Lire toute la <em>Bible.</em></h1><p>Parcourez les 66 livres en français, anglais, swahili et kinande, puis recherchez un mot dans les traductions indexées.</p></div>
            <BookHeart size={94} strokeWidth={1.1} aria-hidden="true" />
          </div>
        </div>
      </section>

      <section className="section bible-reader-section">
        <div className="container">
          <div className="bible-language-tabs" data-reveal aria-label="Choisir une traduction">
            {translations.map((translation) => (
              <button
                key={translation.code}
                className={translation.code === translationCode ? 'active' : ''}
                onClick={() => selectTranslation(translation)}
              >
                <Languages size={18} /><span>{translation.languageName}<small>{translation.abbreviation}</small></span>
              </button>
            ))}
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}

          {isExternalTranslation && selectedTranslation ? (
            <article className="bible-external-reader" data-reveal>
              <header>
                <span><ShieldCheck size={25} /></span>
                <div>
                  <small>Bible complète · 66 livres</small>
                  <h2>Lire la Bible en kinande</h2>
                  <p>{selectedTranslation.attribution}</p>
                </div>
                <a className="button button--primary" href={selectedTranslation.externalUrl || selectedTranslation.sourceUrl} target="_blank" rel="noreferrer">
                  Ouvrir en plein écran <ExternalLink size={17} />
                </a>
              </header>
              <iframe
                src={selectedTranslation.externalUrl || selectedTranslation.sourceUrl}
                title="Bible complète en kinande — KB80"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
              <footer>
                <span>Le texte reste diffusé par YouVersion avec l’autorisation des Sociétés bibliques.</span>
                <a href={selectedTranslation.sourceUrl} target="_blank" rel="noreferrer">Licence et détails de la version <ExternalLink size={14} /></a>
              </footer>
            </article>
          ) : <>
            <form className="bible-search" onSubmit={submitSearch} data-reveal>
              <Search size={20} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un mot ou une expression dans cette traduction…" aria-label="Rechercher dans la Bible" />
              {results && <button type="button" className="bible-search-clear" onClick={() => { setResults(null); setQuery(''); }} aria-label="Fermer les résultats"><X size={18} /></button>}
              <button className="button button--primary" disabled={searching || query.trim().length < 2}>{searching ? 'Recherche…' : 'Rechercher'}</button>
            </form>

            {results ? (
            <div className="bible-search-results" data-reveal>
              <header><div><span className="eyebrow"><i /> Résultats</span><h2>{results.length ? `${results.length} passages trouvés` : 'Aucun passage trouvé'}</h2></div><button onClick={() => setResults(null)}><X size={18} /> Retour à la lecture</button></header>
              <div>
                {results.map((result) => (
                  <button key={`${result.bookCode}-${result.chapter}-${result.verseStart}`} onClick={() => goTo(result.bookCode, result.chapter, result.verseStart)}>
                    <strong>{result.bookName} {result.chapter}:{result.verseStart}</strong>
                    <span>{result.verseText}</span>
                    <ArrowRight size={18} />
                  </button>
                ))}
              </div>
            </div>
            ) : (
            <article className="bible-reader" data-reveal>
              <header className="bible-reader-toolbar">
                <label>Livre<select value={bookCode} onChange={(event) => goTo(event.target.value, 1)}>{books.map((book) => <option key={book.code} value={book.code}>{book.name}</option>)}</select></label>
                <label>Chapitre<select value={chapterNumber} onChange={(event) => goTo(bookCode, Number(event.target.value))}>{Array.from({ length: selectedBook?.chapterCount || 1 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
                <div className="bible-reader-actions">
                  <button onClick={() => move(-1)} disabled={currentBookIndex === 0 && chapterNumber === 1} aria-label="Chapitre précédent"><ArrowLeft size={18} /></button>
                  <button onClick={() => move(1)} disabled={currentBookIndex === books.length - 1 && chapterNumber === selectedBook?.chapterCount} aria-label="Chapitre suivant"><ArrowRight size={18} /></button>
                </div>
              </header>

              <div className="bible-chapter">
                {loading ? <div className="bible-loading"><span className="data-loader" /> Chargement du chapitre…</div> : chapter && <>
                  <div className="bible-chapter-title"><BookOpen size={27} /><div><small>{chapter.translation.title}</small><h2>{chapter.book.name} <span>{chapter.chapter}</span></h2></div></div>
                  <div className="bible-verses">
                    {chapter.verses.map((verse) => (
                      <p id={`verse-${verse.verseStart}`} className={highlightedVerse === verse.verseStart ? 'is-highlighted' : ''} key={verse.verseStart}>
                        <sup>{verse.verseStart}</sup>{verse.text}
                      </p>
                    ))}
                  </div>
                  <footer><span>{chapter.translation.attribution}</span><a href={chapter.translation.sourceUrl} target="_blank" rel="noreferrer">Licence : {chapter.translation.licenseName}</a></footer>
                </>}
              </div>
            </article>
            )}
          </>}
        </div>
      </section>
    </div>
  );
}

