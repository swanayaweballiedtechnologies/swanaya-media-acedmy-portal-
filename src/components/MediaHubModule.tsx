import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from './FirebaseAuthProvider';
import { academyService as mediaHubService } from '../services/academyService';
import { SwanayaDatabase, User } from '../db/mockDb';
import {
  FileText, Plus, CheckCircle2, Trash2, Edit, Save,
  Upload, Image as ImageIcon, Video, Film, Eye, Search, X, Globe,
  BookOpen, Bold, List, Heading2, Quote, Code2, Sparkles, Tag, AlertCircle
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { auth, db } from '../firebase';

export type MediaContentType =
  | 'Blog Article'
  | 'Study Notes & Guides'
  | 'Creative Showcase'
  | 'Project Story'
  | 'Campus Update';

interface MediaHubModuleProps {
  currentUser?: User | null;
}

const CONTENT_TYPES: MediaContentType[] = [
  'Blog Article',
  'Study Notes & Guides',
  'Creative Showcase',
  'Project Story',
  'Campus Update',
];

const CATEGORIES = [
  'Digital Media',
  'AI & Vibe Coding',
  'Academy News',
  'Tech Insights',
  'Student Spotlights',
  'Design & VFX',
  'Events',
];

export default function MediaHubModule({ currentUser }: MediaHubModuleProps) {
  const { profile, isAdmin: authIsAdmin } = useAuth();

  const activeAuthor = useMemo(() => {
    if (profile) {
      return {
        id: profile.id || auth.currentUser?.uid || 'author-local',
        name: profile.name || 'Academy Member',
        role: profile.role || 'STUDENT',
        email: profile.email || '',
      };
    }
    if (currentUser) {
      return {
        id: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
        email: currentUser.email,
      };
    }
    return null;
  }, [profile, currentUser]);

  const isAdminUser =
    authIsAdmin ||
    activeAuthor?.role === 'SUPER_ADMIN' ||
    activeAuthor?.role === 'MD' ||
    activeAuthor?.role === 'ADMIN' ||
    activeAuthor?.role === 'ACADEMIC_ADMIN';

  const [cloudBlogs, setCloudBlogs] = useState<any[]>([]);
  const [localBlogs, setLocalBlogs] = useState<any[]>(() => {
    const saved = SwanayaDatabase.get<any[]>('blogs');
    return Array.isArray(saved) ? saved : [];
  });
  const [mediaAssets, setMediaAssets] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'blogs' | 'my-posts' | 'writing' | 'gallery'>('blogs');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedBlog, setSelectedBlog] = useState<any>(null);
  const [readingBlog, setReadingBlog] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [blogForm, setBlogForm] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    thumbnailUrl: '',
    category: 'Digital Media',
    contentType: 'Blog Article' as MediaContentType,
    tagsInput: '',
    status: 'PUBLISHED' as 'DRAFT' | 'PUBLISHED',
    isFeatured: false,
  });

  const [isUploading, setIsUploading] = useState(false);

  // Merge cloud + local posts cleanly (cloud takes precedence by id)
  const blogs = useMemo(() => {
    const map = new Map<string, any>();
    localBlogs.forEach((b) => {
      if (b?.id) map.set(b.id, b);
    });
    cloudBlogs.forEach((b) => {
      if (b?.id) map.set(b.id, b);
    });
    return Array.from(map.values()).sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    );
  }, [cloudBlogs, localBlogs]);

  useEffect(() => {
    let unsubscribeBlogs: (() => void) | null = null;
    let unsubscribeMedia: (() => void) | null = null;

    setLoading(true);
    const savedLocal = SwanayaDatabase.get<any[]>('blogs');
    if (Array.isArray(savedLocal)) {
      setLocalBlogs(savedLocal);
    }

    if (auth.currentUser) {
      try {
        const blogsQuery = isAdminUser
          ? query(collection(db, 'blogs'), orderBy('createdAt', 'desc'))
          : query(collection(db, 'blogs'), where('status', '==', 'PUBLISHED'), orderBy('createdAt', 'desc'));

        unsubscribeBlogs = onSnapshot(
          blogsQuery,
          (snapshot) => {
            const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as any[];
            setCloudBlogs(list);
            setLoading(false);
          },
          (error) => {
            console.warn('Blogs listener note:', error.message);
            setLoading(false);
          }
        );
      } catch (err: any) {
        console.warn('Blogs listener init note:', err?.message);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }

    if (profile && auth.currentUser) {
      try {
        const mediaQuery = query(collection(db, 'media_assets'), orderBy('createdAt', 'desc'));
        unsubscribeMedia = onSnapshot(
          mediaQuery,
          (snapshot) => {
            setMediaAssets(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
          },
          (error) => {
            console.warn('Media assets listener note:', error.message);
          }
        );
      } catch (err: any) {
        console.warn('Media assets listener init note:', err?.message);
      }
    }

    return () => {
      if (unsubscribeBlogs) unsubscribeBlogs();
      if (unsubscribeMedia) unsubscribeMedia();
    };
  }, [isAdminUser, profile]);

  const resetEditor = () => {
    setSelectedBlog(null);
    setPreviewMode(false);
    setBlogForm({
      title: '',
      slug: '',
      content: '',
      excerpt: '',
      thumbnailUrl: '',
      category: 'Digital Media',
      contentType: 'Blog Article',
      tagsInput: '',
      status: 'PUBLISHED',
      isFeatured: false,
    });
  };

  const insertFormatting = (snippet: string) => {
    setBlogForm((prev) => ({
      ...prev,
      content: prev.content ? `${prev.content}\n${snippet}` : snippet,
    }));
  };

  const handleSaveBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!activeAuthor) {
      setStatusMessage({ type: 'error', text: 'Please sign in to write and save posts.' });
      return;
    }

    if (!blogForm.title.trim() || !blogForm.content.trim()) {
      setStatusMessage({ type: 'error', text: 'Please provide both a title and content.' });
      return;
    }

    setIsSaving(true);
    const parsedTags = blogForm.tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);

    const slug = blogForm.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const nowIso = new Date().toISOString();
    const payload = {
      title: blogForm.title.trim(),
      slug: slug || `post-${Date.now()}`,
      content: blogForm.content.trim(),
      excerpt:
        blogForm.excerpt.trim() ||
        blogForm.content.trim().slice(0, 140) + (blogForm.content.trim().length > 140 ? '...' : ''),
      thumbnailUrl: blogForm.thumbnailUrl.trim(),
      category: blogForm.category,
      contentType: blogForm.contentType,
      tags: parsedTags,
      status: blogForm.status,
      isFeatured: isAdminUser ? blogForm.isFeatured : false,
      authorId: auth.currentUser?.uid || activeAuthor.id,
      authorName: activeAuthor.name,
    };

    try {
      let savedId = selectedBlog?.id;

      // Persist to Firestore if authenticated via Firebase Auth
      if (auth.currentUser) {
        if (selectedBlog && !String(selectedBlog.id).startsWith('local-')) {
          await mediaHubService.updateBlog(selectedBlog.id, payload);
        } else {
          savedId = await mediaHubService.createBlog(payload);
        }
      }

      // Always sync to local database so demo & offline/local sessions work immediately
      const existingLocal = SwanayaDatabase.get<any[]>('blogs');
      const currentList = Array.isArray(existingLocal) ? existingLocal : [];
      const finalId = savedId || `local-${Date.now()}`;
      const localRecord = {
        ...payload,
        id: finalId,
        createdAt: selectedBlog?.createdAt || nowIso,
        updatedAt: nowIso,
      };

      const nextLocalList = selectedBlog
        ? currentList.some((item) => item.id === selectedBlog.id)
          ? currentList.map((item) => (item.id === selectedBlog.id ? localRecord : item))
          : [localRecord, ...currentList]
        : [localRecord, ...currentList];

      SwanayaDatabase.set('blogs', nextLocalList);
      setLocalBlogs(nextLocalList);

      SwanayaDatabase.log(
        activeAuthor.email || 'member@swanayamedia.com',
        activeAuthor.name,
        selectedBlog ? 'MEDIA_HUB_UPDATE_POST' : 'MEDIA_HUB_CREATE_POST',
        `${payload.contentType}: ${payload.title} (${payload.status})`
      );

      setStatusMessage({
        type: 'success',
        text:
          payload.status === 'PUBLISHED'
            ? `"${payload.title}" is now published in the Academy Media Hub.`
            : `"${payload.title}" saved to your drafts.`,
      });
      resetEditor();
      setActiveTab('blogs');
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Unable to save article. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditBlog = (blog: any) => {
    setSelectedBlog(blog);
    setPreviewMode(false);
    setStatusMessage(null);
    setBlogForm({
      title: blog.title || '',
      slug: blog.slug || '',
      content: blog.content || '',
      excerpt: blog.excerpt || '',
      thumbnailUrl: blog.thumbnailUrl || '',
      category: blog.category || 'Digital Media',
      contentType: blog.contentType || 'Blog Article',
      tagsInput: Array.isArray(blog.tags) ? blog.tags.join(', ') : '',
      status: blog.status || 'PUBLISHED',
      isFeatured: Boolean(blog.isFeatured),
    });
    setActiveTab('writing');
  };

  const handleConfirmDeleteBlog = async (id: string) => {
    try {
      if (auth.currentUser && !String(id).startsWith('local-')) {
        await mediaHubService.deleteBlog(id);
      }
      const existingLocal = SwanayaDatabase.get<any[]>('blogs');
      const currentList = Array.isArray(existingLocal) ? existingLocal : [];
      const nextList = currentList.filter((item) => item.id !== id);
      SwanayaDatabase.set('blogs', nextList);
      setLocalBlogs(nextList);
      setCloudBlogs((prev) => prev.filter((item) => item.id !== id));
      setDeleteConfirmId(null);
      setStatusMessage({ type: 'success', text: 'Post removed successfully.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to delete post.' });
      setDeleteConfirmId(null);
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  ) => {
    const file = e.target.files?.[0];
    if (!file || !profile) {
      setStatusMessage({
        type: 'error',
        text: 'Cloud media uploads require a Google/Firebase authenticated session.',
      });
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);
    try {
      await mediaHubService.uploadMedia(file, type, profile.id);
      setStatusMessage({ type: 'success', text: `Uploaded "${file.name}" to Media Gallery.` });
    } catch {
      setStatusMessage({ type: 'error', text: 'Media upload failed. Please try again.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteMedia = async (asset: any) => {
    try {
      await mediaHubService.deleteMedia(asset.id, asset.storagePath);
      setStatusMessage({ type: 'success', text: 'Media asset deleted.' });
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to delete media asset.' });
    }
  };

  const canManagePost = (blog: any) => {
    if (isAdminUser) return true;
    const uid = auth.currentUser?.uid || activeAuthor?.id;
    return Boolean(uid && blog.authorId === uid);
  };

  const visibleBlogs = useMemo(() => {
    return blogs.filter((blog) => {
      if (activeTab === 'my-posts') {
        const uid = auth.currentUser?.uid || activeAuthor?.id;
        if (!uid || blog.authorId !== uid) return false;
      } else if (activeTab === 'blogs') {
        if (!isAdminUser && blog.status !== 'PUBLISHED' && !canManagePost(blog)) return false;
      }

      if (typeFilter !== 'ALL' && (blog.contentType || 'Blog Article') !== typeFilter) {
        return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchesTitle = String(blog.title || '').toLowerCase().includes(q);
        const matchesExcerpt = String(blog.excerpt || '').toLowerCase().includes(q);
        const matchesAuthor = String(blog.authorName || '').toLowerCase().includes(q);
        const matchesCat = String(blog.category || '').toLowerCase().includes(q);
        return matchesTitle || matchesExcerpt || matchesAuthor || matchesCat;
      }

      return true;
    });
  }, [blogs, activeTab, typeFilter, searchTerm, isAdminUser, activeAuthor]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-semibold uppercase tracking-wider mb-1">
            <Film className="w-4 h-4 text-amber-400" />
            <span>Swanaya Media Hub &amp; Publishing</span>
          </div>
          <h2 className="text-xl font-serif font-bold text-white">
            Blogs, Study Notes &amp; Creative Things
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Write and publish articles, study guides, project stories, and campus media updates.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              resetEditor();
              setStatusMessage(null);
              setActiveTab('writing');
            }}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider rounded-lg shadow-lg shadow-amber-500/10 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Write Blog / Post</span>
          </button>

          {isAdminUser && (
            <label className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs uppercase tracking-wider rounded-lg border border-slate-700 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap">
              <Upload className="w-4 h-4 text-amber-400" />
              <span>Upload Media</span>
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'IMAGE')}
              />
            </label>
          )}
        </div>
      </div>

      {/* Inline Feedback Banner */}
      {statusMessage && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border text-xs font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('blogs')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'blogs'
                ? 'bg-amber-500 text-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            All Published &amp; Feed
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('my-posts')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'my-posts'
                ? 'bg-amber-500 text-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            My Writings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('writing')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'writing'
                ? 'bg-amber-500 text-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Edit className="w-3.5 h-3.5" />
            <span>{selectedBlog ? 'Edit Entry' : 'Write New'}</span>
          </button>
          {isAdminUser && (
            <button
              type="button"
              onClick={() => setActiveTab('gallery')}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'gallery'
                  ? 'bg-amber-500 text-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Media Gallery
            </button>
          )}
        </div>

        {(activeTab === 'blogs' || activeTab === 'my-posts') && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search posts..."
                className="bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400 w-44"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="ALL">All Types</option>
              {CONTENT_TYPES.map((ct) => (
                <option key={ct} value={ct}>
                  {ct}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-4">
          <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Loading Media Hub...
          </p>
        </div>
      ) : (
        <>
          {(activeTab === 'blogs' || activeTab === 'my-posts') && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleBlogs.map((blog) => (
                <article
                  key={blog.id}
                  className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden group flex flex-col h-full hover:border-amber-500/40 transition-all"
                >
                  <div
                    onClick={() => setReadingBlog(blog)}
                    className="aspect-video relative overflow-hidden cursor-pointer bg-slate-950"
                  >
                    {blog.thumbnailUrl ? (
                      <img
                        src={blog.thumbnailUrl}
                        alt={blog.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-950 flex flex-col items-center justify-center gap-2 p-4">
                        <BookOpen className="w-8 h-8 text-amber-500/50" />
                        <span className="text-[11px] font-medium text-slate-500 text-center line-clamp-1">
                          {blog.contentType || 'Blog Article'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-5 flex-grow flex flex-col space-y-3">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span className="font-medium text-amber-400 truncate">
                        {blog.contentType || 'Blog Article'} · {blog.category}
                      </span>
                      <span className="font-mono tabular-nums shrink-0 text-slate-500">
                        {String(blog.createdAt || '').substring(0, 10)}
                      </span>
                    </div>

                    <h3
                      onClick={() => setReadingBlog(blog)}
                      className="text-base font-bold font-serif text-white group-hover:text-amber-300 transition-colors line-clamp-2 cursor-pointer"
                    >
                      {blog.title}
                    </h3>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {blog.excerpt}
                    </p>

                    <div className="pt-3 border-t border-slate-800 flex justify-between items-center mt-auto gap-2">
                      <div className="text-[11px] text-slate-400 truncate">
                        <span>{blog.authorName || 'Academy Contributor'}</span>
                        <span aria-hidden="true"> · </span>
                        <span
                          className={
                            blog.status === 'PUBLISHED' ? 'text-emerald-400' : 'text-amber-400'
                          }
                        >
                          {blog.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setReadingBlog(blog)}
                          title="Read full article"
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors cursor-pointer"
                        >
                          <Globe className="w-3.5 h-3.5" />
                        </button>
                        {canManagePost(blog) && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEditBlog(blog)}
                              title="Edit post"
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded transition-colors cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {deleteConfirmId === blog.id ? (
                              <button
                                type="button"
                                onClick={() => handleConfirmDeleteBlog(blog.id)}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded cursor-pointer"
                              >
                                Confirm
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(blog.id)}
                                title="Delete post"
                                className="p-1.5 bg-slate-800 hover:bg-rose-950 text-rose-400 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}

              {visibleBlogs.length === 0 && (
                <div className="col-span-full py-16 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-xl space-y-4">
                  <FileText className="w-10 h-10 text-slate-600 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-200">
                      {activeTab === 'my-posts'
                        ? 'You have not written any posts yet'
                        : 'No matching articles or notes found'}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Share your blogs, study summaries, project stories, or campus highlights with the academy.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      resetEditor();
                      setActiveTab('writing');
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded-md cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Write First Entry</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Gallery Tab */}
          {activeTab === 'gallery' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isUploading && (
                <div className="col-span-full py-12 flex flex-col items-center justify-center bg-slate-900/50 border border-dashed border-amber-500/30 rounded-xl space-y-3">
                  <div className="w-8 h-8 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                  <p className="text-[11px] font-mono text-amber-400 uppercase font-bold">
                    Uploading to Cloud Storage...
                  </p>
                </div>
              )}
              {mediaAssets.map((asset) => (
                <div key={asset.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden group">
                  <div className="aspect-square relative bg-slate-950">
                    {asset.type === 'IMAGE' ? (
                      <img src={asset.url} alt={asset.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-12 h-12 text-slate-700" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <a
                        href={asset.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"
                      >
                        <Eye className="w-5 h-5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteMedia(asset)}
                        className="p-2 bg-rose-500/20 hover:bg-rose-500/40 rounded-full text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-[11px] font-mono text-slate-400 truncate" title={asset.title}>
                      {asset.title}
                    </p>
                    <div className="flex justify-between items-center mt-1 text-[10px] text-slate-500">
                      <span>{(asset.size / 1024 / 1024).toFixed(2)} MB</span>
                      <span className="text-amber-400 font-semibold">{asset.type}</span>
                    </div>
                  </div>
                </div>
              ))}
              {mediaAssets.length === 0 && !isUploading && (
                <div className="col-span-full py-16 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-xl">
                  <ImageIcon className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No cloud media assets uploaded yet.</p>
                </div>
              )}
            </div>
          )}

          {/* Writer / Editor Studio */}
          {activeTab === 'writing' && (
            <form
              onSubmit={handleSaveBlog}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 sm:p-8 space-y-6 max-w-4xl mx-auto"
            >
              <div className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-serif font-bold text-white">
                    {selectedBlog ? 'Edit Entry' : 'Write Blog, Note, or Showcase'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Compose and publish directly to the Swanaya Media Hub.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPreviewMode(!previewMode)}
                    className="px-3 py-2 bg-slate-950 border border-slate-700 hover:border-amber-400 text-slate-200 text-xs font-medium rounded-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    <span>{previewMode ? 'Back to Editor' : 'Preview'}</span>
                  </button>

                  <select
                    value={blogForm.status}
                    onChange={(e) => setBlogForm({ ...blogForm, status: e.target.value as 'DRAFT' | 'PUBLISHED' })}
                    className={`px-3 py-2 rounded-md text-xs font-semibold border cursor-pointer ${
                      blogForm.status === 'PUBLISHED'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-slate-950 border-slate-700 text-slate-300'
                    }`}
                  >
                    <option value="PUBLISHED">Publish Now</option>
                    <option value="DRAFT">Save as Draft</option>
                  </select>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded-md shadow-lg shadow-amber-500/10 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'Saving...' : blogForm.status === 'PUBLISHED' ? 'Publish' : 'Save Draft'}</span>
                  </button>
                </div>
              </div>

              {previewMode ? (
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-6 space-y-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-amber-400">
                    <span>{blogForm.contentType}</span>
                    <span aria-hidden="true">·</span>
                    <span>{blogForm.category}</span>
                    {blogForm.tagsInput && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-400">{blogForm.tagsInput}</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-2xl font-serif font-bold text-white">
                    {blogForm.title || 'Untitled Entry'}
                  </h2>
                  {blogForm.thumbnailUrl && (
                    <img
                      src={blogForm.thumbnailUrl}
                      alt={blogForm.title}
                      referrerPolicy="no-referrer"
                      className="w-full max-h-72 object-cover rounded-lg border border-slate-800"
                    />
                  )}
                  {blogForm.excerpt && (
                    <p className="text-sm text-slate-300 italic border-b border-slate-800 pb-4">
                      {blogForm.excerpt}
                    </p>
                  )}
                  <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {blogForm.content || 'Start writing your content to preview it here.'}
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Content Type *
                      </label>
                      <select
                        value={blogForm.contentType}
                        onChange={(e) =>
                          setBlogForm({ ...blogForm, contentType: e.target.value as MediaContentType })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-md px-3.5 py-2.5 text-sm text-white focus:border-amber-400 outline-none"
                      >
                        {CONTENT_TYPES.map((ct) => (
                          <option key={ct} value={ct}>
                            {ct}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Topic Category
                      </label>
                      <select
                        value={blogForm.category}
                        onChange={(e) => setBlogForm({ ...blogForm, category: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-md px-3.5 py-2.5 text-sm text-white focus:border-amber-400 outline-none"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Title / Headline *
                      </label>
                      <input
                        type="text"
                        required
                        value={blogForm.title}
                        onChange={(e) => setBlogForm({ ...blogForm, title: e.target.value })}
                        placeholder="Enter your headline..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-md px-3.5 py-2.5 text-sm text-white focus:border-amber-400 outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Cover Image URL (Optional)
                      </label>
                      <input
                        type="url"
                        value={blogForm.thumbnailUrl}
                        onChange={(e) => setBlogForm({ ...blogForm, thumbnailUrl: e.target.value })}
                        placeholder="https://..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-md px-3.5 py-2.5 text-sm text-white focus:border-amber-400 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Short Summary (Optional)
                      </label>
                      <input
                        type="text"
                        value={blogForm.excerpt}
                        onChange={(e) => setBlogForm({ ...blogForm, excerpt: e.target.value })}
                        placeholder="Brief overview for the card feed..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-md px-3.5 py-2.5 text-sm text-white focus:border-amber-400 outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-400" />
                        <span>Tags (Comma separated)</span>
                      </label>
                      <input
                        type="text"
                        value={blogForm.tagsInput}
                        onChange={(e) => setBlogForm({ ...blogForm, tagsInput: e.target.value })}
                        placeholder="e.g. AI, Editing, Notes, Portfolio"
                        className="w-full bg-slate-950 border border-slate-800 rounded-md px-3.5 py-2.5 text-sm text-white focus:border-amber-400 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-2">
                          Body *
                        </span>
                        <button
                          type="button"
                          onClick={() => insertFormatting('## Section Heading')}
                          title="Insert Heading"
                          className="p-1.5 bg-slate-950 border border-slate-800 hover:border-amber-400 rounded text-slate-300 cursor-pointer"
                        >
                          <Heading2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting('**Bold Highlight**')}
                          title="Insert Bold Text"
                          className="p-1.5 bg-slate-950 border border-slate-800 hover:border-amber-400 rounded text-slate-300 cursor-pointer"
                        >
                          <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting('- Key takeaway point')}
                          title="Insert Bullet List"
                          className="p-1.5 bg-slate-950 border border-slate-800 hover:border-amber-400 rounded text-slate-300 cursor-pointer"
                        >
                          <List className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting('> Notable quote or insight')}
                          title="Insert Quote"
                          className="p-1.5 bg-slate-950 border border-slate-800 hover:border-amber-400 rounded text-slate-300 cursor-pointer"
                        >
                          <Quote className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting('```\n// Code or prompt snippet\n```')}
                          title="Insert Code Snippet"
                          className="p-1.5 bg-slate-950 border border-slate-800 hover:border-amber-400 rounded text-slate-300 cursor-pointer"
                        >
                          <Code2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {isAdminUser && (
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-400 font-medium">
                          <input
                            type="checkbox"
                            checked={blogForm.isFeatured}
                            onChange={(e) => setBlogForm({ ...blogForm, isFeatured: e.target.checked })}
                            className="accent-amber-500"
                          />
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Feature on Home Page</span>
                        </label>
                      )}
                    </div>

                    <textarea
                      required
                      rows={11}
                      value={blogForm.content}
                      onChange={(e) => setBlogForm({ ...blogForm, content: e.target.value })}
                      placeholder="Write your blog article, lecture summary, project breakdown, or creative post here..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-sm text-slate-200 focus:border-amber-400 outline-none leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </form>
          )}
        </>
      )}

      {/* Full Article / Post Reader Modal */}
      {readingBlog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B0F17] border border-slate-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-6 py-4 flex items-center justify-between gap-4">
              <div className="text-xs text-amber-400 font-medium truncate">
                {readingBlog.contentType || 'Blog Article'} · {readingBlog.category}
              </div>
              <button
                type="button"
                onClick={() => setReadingBlog(null)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <div className="space-y-3">
                <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white leading-snug">
                  {readingBlog.title}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span>By {readingBlog.authorName || 'Academy Contributor'}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {String(readingBlog.createdAt || '').substring(0, 10)}
                  </span>
                  {Array.isArray(readingBlog.tags) && readingBlog.tags.length > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-400">{readingBlog.tags.join(', ')}</span>
                    </>
                  )}
                </div>
              </div>

              {readingBlog.thumbnailUrl && (
                <img
                  src={readingBlog.thumbnailUrl}
                  alt={readingBlog.title}
                  referrerPolicy="no-referrer"
                  className="w-full max-h-80 object-cover rounded-lg border border-slate-800"
                />
              )}

              <div className="text-sm sm:text-base text-slate-200 leading-relaxed whitespace-pre-wrap">
                {readingBlog.content}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
