import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  X,
  ExternalLink,
  Search,
  Globe,
  BookMarked,
  Sparkles,
  RefreshCw,
  AlertCircle,
  BookmarkPlus,
  CheckCircle2,
  FileText,
  ShieldCheck
} from 'lucide-react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { useAuth } from './FirebaseAuthProvider';
import { academyService } from '../services/academyService';
import { auth } from '../firebase';

type SearchMode = 'all' | 'wikipedia' | 'google' | 'library';

interface WikiSearchResult {
  pageid: number;
  title: string;
  extract: string;
  fullurl: string;
  thumbnailUrl?: string | null;
}

interface GoogleSource {
  title: string;
  uri: string;
  domain: string;
}

interface GoogleSearchData {
  summary: string;
  sources: GoogleSource[];
  searchQueries: string[];
}

interface LibraryPortalProps {
  userRole?: string;
}

const SUGGESTED_TOPICS = [
  'Artificial Intelligence in Media',
  'Cinematography Lighting',
  'Digital Journalism',
  'React Web Architecture',
  'Color Grading & VFX',
];

export default function LibraryPortal({ userRole }: LibraryPortalProps) {
  const { isAdmin: isFirebaseAdmin } = useAuth();
  const canManageLibrary =
    isFirebaseAdmin ||
    ['SUPER_ADMIN', 'MD', 'PRINCIPAL', 'ADMIN', 'ACADEMIC_ADMIN'].includes(
      String(userRole || '').toUpperCase()
    );

  // Curated Firestore library posts
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [postForm, setEditForm] = useState({
    title: '',
    content: '',
    type: 'POST' as 'POST' | 'BROCHURE',
    imageUrl: '',
    externalLink: '',
  });

  // Wikipedia & Google Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchedTerm, setActiveSearchedTerm] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('all');
  const [searchingWiki, setSearchingWiki] = useState(false);
  const [searchingGoogle, setSearchingGoogle] = useState(false);

  const [wikiResults, setWikiResults] = useState<WikiSearchResult[]>([]);
  const [wikiError, setWikiError] = useState<string | null>(null);

  const [googleData, setGoogleData] = useState<GoogleSearchData | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Full Wikipedia Reader Modal state
  const [readerArticle, setReaderArticle] = useState<WikiSearchResult | null>(null);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerError, setReaderError] = useState<string | null>(null);

  // Notice, Firebase Admin connection & Save state
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingTitle, setSavingTitle] = useState<string | null>(null);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(Boolean(auth.currentUser));

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseConnected(Boolean(fbUser));
    });
    return () => unsub();
  }, []);

  const handleConnectGoogleAdmin = async (): Promise<boolean> => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      const authed = Boolean(cred?.user || auth.currentUser);
      setFirebaseConnected(authed);
      return authed;
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Google Admin connection was cancelled or failed.',
      });
      return false;
    }
  };

  const loadPosts = async () => {
    setLoadingPosts(true);
    try {
      const fetched = await academyService.getLibraryPosts();
      if (fetched) setPosts(fetched);
    } catch {
      // handled gracefully
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    void loadPosts();
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      const connected = await handleConnectGoogleAdmin();
      if (!connected) return;
    }
    try {
      await academyService.createLibraryPost(postForm);
      setIsModalOpen(false);
      setEditForm({ title: '', content: '', type: 'POST', imageUrl: '', externalLink: '' });
      setNotice({ type: 'success', text: 'Resource published to Swanaya Public Library.' });
      await loadPosts();
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Sign in with a verified Admin Google account to publish to Cloud Library.',
      });
    }
  };

  const handleSaveExternalToLibrary = async (payload: {
    title: string;
    content: string;
    imageUrl?: string | null;
    externalLink: string;
  }) => {
    setNotice(null);
    if (!auth.currentUser) {
      const connected = await handleConnectGoogleAdmin();
      if (!connected) return;
    }
    setSavingTitle(payload.title);
    try {
      await academyService.createLibraryPost({
        title: payload.title,
        content: payload.content,
        type: 'POST',
        imageUrl: payload.imageUrl || '',
        externalLink: payload.externalLink,
      });
      setNotice({
        type: 'success',
        text: `Saved "${payload.title}" to the Swanaya Academy Library collection.`,
      });
      await loadPosts();
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Unable to save resource. Ensure you are authenticated with Admin permissions.',
      });
    } finally {
      setSavingTitle(null);
    }
  };

  const runSearch = async (rawTerm: string, overrideMode?: SearchMode) => {
    const q = rawTerm.trim();
    const mode = overrideMode || searchMode;
    setActiveSearchedTerm(q);
    setNotice(null);

    if (!q || mode === 'library') {
      return;
    }

    const wantWiki = mode === 'all' || mode === 'wikipedia';
    const wantGoogle = mode === 'all' || mode === 'google';

    if (wantWiki) {
      setSearchingWiki(true);
      setWikiError(null);
    }
    if (wantGoogle) {
      setSearchingGoogle(true);
      setGoogleError(null);
    }

    const tasks: Promise<void>[] = [];

    if (wantWiki) {
      tasks.push(
        fetch(`/api/library/wikipedia?q=${encodeURIComponent(q)}`)
          .then(async (res) => {
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || `Wikipedia error (${res.status})`);
            setWikiResults(Array.isArray(json.results) ? json.results : []);
          })
          .catch((err: any) => {
            setWikiResults([]);
            setWikiError(err?.message || 'Failed to fetch Wikipedia articles.');
          })
          .finally(() => setSearchingWiki(false))
      );
    }

    if (wantGoogle) {
      tasks.push(
        fetch('/api/library/google-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q }),
        })
          .then(async (res) => {
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || `Google Search error (${res.status})`);
            setGoogleData({
              summary: json.summary || '',
              sources: Array.isArray(json.sources) ? json.sources : [],
              searchQueries: Array.isArray(json.searchQueries) ? json.searchQueries : [],
            });
          })
          .catch((err: any) => {
            setGoogleData(null);
            setGoogleError(err?.message || 'Failed to perform Google Search query.');
          })
          .finally(() => setSearchingGoogle(false))
      );
    }

    await Promise.all(tasks);
  };

  const handleOpenWikiReader = async (article: WikiSearchResult) => {
    setReaderArticle(article);
    setReaderLoading(true);
    setReaderError(null);
    try {
      const res = await fetch(`/api/library/wikipedia/article?title=${encodeURIComponent(article.title)}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Could not load full article.');
      }
      if (json.article) {
        setReaderArticle(json.article);
      }
    } catch (err: any) {
      setReaderError(err?.message || 'Unable to load full Wikipedia extract.');
    } finally {
      setReaderLoading(false);
    }
  };

  const filteredLocalPosts = activeSearchedTerm
    ? posts.filter(
        (p) =>
          String(p.title || '').toLowerCase().includes(activeSearchedTerm.toLowerCase()) ||
          String(p.content || '').toLowerCase().includes(activeSearchedTerm.toLowerCase())
      )
    : posts;

  const isSearching = searchingWiki || searchingGoogle;

  return (
    <div className="space-y-6">
      {/* Header & Search Bar */}
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 font-serif">
              <BookOpen className="w-6 h-6 text-amber-500" />
              Swanaya Public Library &amp; Research Hub
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Connected to <span className="text-slate-200 font-semibold">Wikipedia Encyclopedia</span>,{' '}
              <span className="text-amber-400 font-semibold">Google Search</span>, and the Swanaya curated archive.
            </p>
          </div>
          {canManageLibrary && (
            <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
              {!firebaseConnected && (
                <button
                  type="button"
                  onClick={() => void handleConnectGoogleAdmin()}
                  className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase rounded flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  Connect Google Admin
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Create Resource
              </button>
            </div>
          )}
        </div>

        {/* Unified Search Input & Source Tabs */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch(searchQuery);
          }}
          className="space-y-3"
        >
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-grow">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Wikipedia articles, Google web references, or library topics..."
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || (!searchQuery.trim() && searchMode !== 'library')}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shrink-0"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Search Library
                </>
              )}
            </button>
          </div>

          {/* Source Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'All Sources (Wikipedia + Google)' },
                  { id: 'wikipedia', label: 'Wikipedia Encyclopedia' },
                  { id: 'google', label: 'Google Search' },
                  { id: 'library', label: 'Academy Collection' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setSearchMode(tab.id);
                    if (searchQuery.trim() && tab.id !== 'library') {
                      void runSearch(searchQuery, tab.id);
                    }
                  }}
                  className={`px-3 py-1.5 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer border ${
                    searchMode === tab.id
                      ? 'bg-amber-500 text-black border-amber-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeSearchedTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveSearchedTerm('');
                  setWikiResults([]);
                  setGoogleData(null);
                  setWikiError(null);
                  setGoogleError(null);
                }}
                className="text-[11px] font-mono text-slate-400 hover:text-amber-400 cursor-pointer"
              >
                Clear search
              </button>
            )}
          </div>

          {/* Quick Academic Topic Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] font-mono uppercase text-slate-500 mr-1">Quick Topics:</span>
            {SUGGESTED_TOPICS.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => {
                  setSearchQuery(topic);
                  if (searchMode === 'library') setSearchMode('all');
                  void runSearch(topic, searchMode === 'library' ? 'all' : searchMode);
                }}
                className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-[11px] text-slate-300 hover:text-amber-300 transition-colors cursor-pointer"
              >
                {topic}
              </button>
            ))}
          </div>
        </form>
      </div>

      {notice && (
        <div
          className={`rounded-lg p-3.5 flex items-center justify-between gap-3 text-xs border ${
            notice.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          }`}
        >
          <span className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            {notice.text}
          </span>
          <button type="button" onClick={() => setNotice(null)} className="p-1 hover:bg-black/20 rounded cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* LIVE EXTERNAL RESEARCH RESULTS: WIKIPEDIA + GOOGLE SEARCH */}
      {activeSearchedTerm && searchMode !== 'library' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* WIKIPEDIA PANEL */}
          {(searchMode === 'all' || searchMode === 'wikipedia') && (
            <div className={`${searchMode === 'wikipedia' ? 'lg:col-span-12' : 'lg:col-span-6'} space-y-4`}>
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookMarked className="w-4 h-4 text-sky-400" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
                    Wikipedia Encyclopedia Results
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {searchingWiki ? 'Searching...' : `${wikiResults.length} articles`}
                </span>
              </div>

              {searchingWiki ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-xs font-mono text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" />
                  <span>Querying Wikipedia for &ldquo;{activeSearchedTerm}&rdquo;...</span>
                </div>
              ) : wikiError ? (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-5 text-xs text-rose-300 space-y-2">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> Wikipedia Lookup Error
                  </p>
                  <p>{wikiError}</p>
                </div>
              ) : wikiResults.length === 0 ? (
                <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-500">
                  No Wikipedia articles matched &ldquo;{activeSearchedTerm}&rdquo;. Try broader keywords.
                </div>
              ) : (
                <div className="space-y-3">
                  {wikiResults.map((article) => (
                    <div
                      key={article.pageid}
                      className="bg-slate-900 border border-slate-800 hover:border-sky-500/30 rounded-xl p-4 flex gap-4 transition-colors"
                    >
                      {article.thumbnailUrl && (
                        <img
                          src={article.thumbnailUrl}
                          alt={article.title}
                          className="w-20 h-20 rounded-lg object-cover border border-slate-800 shrink-0 bg-slate-950"
                        />
                      )}
                      <div className="min-w-0 flex-grow space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-bold text-white leading-snug">{article.title}</h4>
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/25 text-sky-300 shrink-0">
                            Wikipedia
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{article.extract}</p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => void handleOpenWikiReader(article)}
                            className="px-2.5 py-1 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-[11px] font-semibold rounded flex items-center gap-1 cursor-pointer"
                          >
                            <FileText className="w-3 h-3" /> Read Article
                          </button>
                          <a
                            href={article.fullurl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[11px] font-semibold rounded flex items-center gap-1"
                          >
                            Wikipedia <ExternalLink className="w-3 h-3" />
                          </a>
                          {canManageLibrary && (
                            <button
                              type="button"
                              disabled={savingTitle === article.title}
                              onClick={() =>
                                void handleSaveExternalToLibrary({
                                  title: article.title,
                                  content: article.extract,
                                  imageUrl: article.thumbnailUrl,
                                  externalLink: article.fullurl,
                                })
                              }
                              className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-semibold rounded flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <BookmarkPlus className="w-3 h-3" />
                              {savingTitle === article.title ? 'Saving...' : 'Save to Library'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* GOOGLE SEARCH GROUNDED PANEL */}
          {(searchMode === 'all' || searchMode === 'google') && (
            <div className={`${searchMode === 'google' ? 'lg:col-span-12' : 'lg:col-span-6'} space-y-4`}>
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
                    Google Web Search &amp; Citations
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {searchingGoogle
                    ? 'Searching Google...'
                    : `${googleData?.sources?.length || 0} cited sources`}
                </span>
              </div>

              {searchingGoogle ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-xs font-mono text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>Fetching live Google Search results for &ldquo;{activeSearchedTerm}&rdquo;...</span>
                </div>
              ) : googleError ? (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-5 text-xs text-rose-300 space-y-3">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" /> Google Search Error
                  </p>
                  <p className="leading-relaxed">{googleError}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(activeSearchedTerm)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-700 text-amber-400 text-[11px] font-bold uppercase rounded inline-flex items-center gap-1.5"
                    >
                      Open on Google Search <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={`https://scholar.google.com/scholar?q=${encodeURIComponent(activeSearchedTerm)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-700 text-sky-300 text-[11px] font-bold uppercase rounded inline-flex items-center gap-1.5"
                    >
                      Search Google Scholar <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ) : googleData ? (
                <div className="space-y-4">
                  {/* Synthesized Web Briefing */}
                  {googleData.summary && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          Google Search Research Briefing
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">Live Web Grounded</span>
                      </div>
                      <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto pr-1">
                        {googleData.summary}
                      </div>
                      {googleData.searchQueries.length > 0 && (
                        <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-1.5">
                          {googleData.searchQueries.map((sq, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[10px] font-mono text-slate-400"
                            >
                              {sq}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Grounded Web Sources */}
                  <div className="space-y-2.5">
                    <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                      Google Search Web Sources ({googleData.sources.length})
                    </h4>
                    {googleData.sources.length === 0 ? (
                      <p className="text-xs text-slate-500 bg-slate-900/40 border border-slate-800 rounded-lg p-4">
                        No external web source links returned for this query.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {googleData.sources.map((src, i) => (
                          <div
                            key={`${src.uri}-${i}`}
                            className="bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <span className="text-[10px] font-mono text-emerald-400 uppercase">{src.domain}</span>
                              <p className="text-xs font-semibold text-white truncate">{src.title}</p>
                              <p className="text-[10px] font-mono text-slate-500 truncate">{src.uri}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={src.uri}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-amber-400 text-[11px] font-bold uppercase rounded flex items-center gap-1"
                              >
                                Visit <ExternalLink className="w-3 h-3" />
                              </a>
                              {canManageLibrary && (
                                <button
                                  type="button"
                                  disabled={savingTitle === src.title}
                                  onClick={() =>
                                    void handleSaveExternalToLibrary({
                                      title: src.title,
                                      content: `Google Search Reference (${src.domain}) for "${activeSearchedTerm}".`,
                                      externalLink: src.uri,
                                    })
                                  }
                                  className="px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-semibold rounded flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <BookmarkPlus className="w-3 h-3" /> Save
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-500">
                  Submit a query to run live Google Web Search.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CURATED ACADEMY LIBRARY COLLECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
            Curated Academy Library Archive ({filteredLocalPosts.length})
          </h3>
          {activeSearchedTerm && (
            <span className="text-[11px] font-mono text-amber-400">
              Filtered by &ldquo;{activeSearchedTerm}&rdquo;
            </span>
          )}
        </div>

        {loadingPosts ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs animate-pulse">
            CONNECTING TO SWANAYA CLOUD LIBRARY...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLocalPosts.map((post) => (
              <div
                key={post.id}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-amber-500/30 transition-all flex flex-col"
              >
                {post.imageUrl && (
                  <img
                    src={post.imageUrl}
                    alt={post.title}
                    className="w-full h-40 object-cover border-b border-slate-800"
                  />
                )}
                <div className="p-5 flex-grow space-y-3">
                  <div className="flex justify-between items-start">
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono ${
                        post.type === 'BROCHURE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {post.type}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white leading-tight">{post.title}</h3>
                  <p className="text-xs text-slate-400 line-clamp-3">{post.content}</p>
                </div>
                {post.externalLink && (
                  <div className="p-4 bg-slate-950 border-t border-slate-800">
                    <a
                      href={post.externalLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-500 hover:text-amber-400 text-[11px] font-bold uppercase flex items-center gap-2"
                    >
                      Access Resource <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            ))}
            {filteredLocalPosts.length === 0 && (
              <div className="col-span-full py-14 text-center bg-slate-900/30 border border-slate-800 rounded-xl">
                <p className="text-slate-500 text-sm italic">
                  {activeSearchedTerm
                    ? `No curated academy archive cards match "${activeSearchedTerm}". Check Wikipedia & Google Search results above.`
                    : 'Library collection is being indexed. Use the Wikipedia & Google Search bar above to explore live references.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* WIKIPEDIA IN-APP ARTICLE READER MODAL */}
      {readerArticle && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl my-auto">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                  WIKIPEDIA ENCYCLOPEDIA READER
                </span>
                <h3 className="text-lg font-serif font-bold text-white mt-0.5">{readerArticle.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setReaderArticle(null)}
                className="p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {readerArticle.thumbnailUrl && (
              <img
                src={readerArticle.thumbnailUrl}
                alt={readerArticle.title}
                className="w-full max-h-56 object-cover rounded-lg border border-slate-800 bg-slate-900"
              />
            )}

            {readerLoading ? (
              <div className="py-10 text-center text-xs font-mono text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" />
                <span>Loading full Wikipedia article summary...</span>
              </div>
            ) : readerError ? (
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300">
                {readerError}
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto pr-2 text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {readerArticle.extract}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <a
                href={readerArticle.fullurl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-black text-xs font-bold uppercase rounded flex items-center gap-1.5"
              >
                Read Full Page on Wikipedia <ExternalLink className="w-3.5 h-3.5" />
              </a>
              {canManageLibrary && (
                <button
                  type="button"
                  disabled={savingTitle === readerArticle.title}
                  onClick={() =>
                    void handleSaveExternalToLibrary({
                      title: readerArticle.title,
                      content: readerArticle.extract.slice(0, 800),
                      imageUrl: readerArticle.thumbnailUrl,
                      externalLink: readerArticle.fullurl,
                    })
                  }
                  className="px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase rounded flex items-center gap-1.5 cursor-pointer"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" /> Save to Academy Library
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADMIN CREATE RESOURCE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Add Library Resource</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-500 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreatePost} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Title</label>
                <input
                  required
                  value={postForm.title}
                  onChange={(e) => setEditForm({ ...postForm, title: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Content / Summary</label>
                <textarea
                  required
                  value={postForm.content}
                  onChange={(e) => setEditForm({ ...postForm, content: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white text-xs h-24"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Resource Type</label>
                  <select
                    value={postForm.type}
                    onChange={(e) => setEditForm({ ...postForm, type: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white text-xs"
                  >
                    <option value="POST">Announcement</option>
                    <option value="BROCHURE">Course Brochure</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Image URL</label>
                  <input
                    value={postForm.imageUrl}
                    onChange={(e) => setEditForm({ ...postForm, imageUrl: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white text-xs"
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">External Link (Optional)</label>
                <input
                  value={postForm.externalLink}
                  onChange={(e) => setEditForm({ ...postForm, externalLink: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white text-xs"
                  placeholder="https://..."
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase rounded text-xs shadow-lg cursor-pointer"
              >
                Publish to Library
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
