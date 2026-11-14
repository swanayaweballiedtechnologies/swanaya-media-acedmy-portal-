import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Image as ImageIcon, X, ExternalLink } from 'lucide-react';
import { useAuth } from './FirebaseAuthProvider';
import { academyService } from '../services/academyService';

export default function LibraryPortal() {
  const { isAdmin } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [postForm, setEditForm] = useState({
    title: '',
    content: '',
    type: 'POST' as 'POST' | 'BROCHURE',
    imageUrl: '',
    externalLink: ''
  });

  useEffect(() => {
    const loadPosts = async () => {
      setLoading(true);
      const fetched = await academyService.getLibraryPosts();
      if (fetched) setPosts(fetched);
      setLoading(false);
    };
    loadPosts();
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    await academyService.createLibraryPost(postForm);
    setIsModalOpen(false);
    setEditForm({ title: '', content: '', type: 'POST', imageUrl: '', externalLink: '' });
    const fetched = await academyService.getLibraryPosts();
    if (fetched) setPosts(fetched);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-lg flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-amber-500" />
            Swanaya Public Library
          </h2>
          <p className="text-sm text-slate-400 mt-2">Digital brochures, announcements, and academic resource library.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create Resource
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 font-mono text-xs animate-pulse">CONNECTING TO SWANAYA CLOUD...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map(post => (
            <div key={post.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-amber-500/30 transition-all flex flex-col">
              {post.imageUrl && (
                <img src={post.imageUrl} alt={post.title} className="w-full h-40 object-cover border-b border-slate-800" />
              )}
              <div className="p-5 flex-grow space-y-3">
                <div className="flex justify-between items-start">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono ${
                    post.type === 'BROCHURE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    {post.type}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white leading-tight">{post.title}</h3>
                <p className="text-xs text-slate-400 line-clamp-3">{post.content}</p>
              </div>
              {post.externalLink && (
                <div className="p-4 bg-slate-950 border-t border-slate-800">
                  <a href={post.externalLink} target="_blank" rel="noreferrer" className="text-amber-500 hover:text-amber-400 text-[11px] font-bold uppercase flex items-center gap-2">
                    Access Resource <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          ))}
          {posts.length === 0 && (
            <div className="col-span-full py-20 text-center bg-slate-900/30 border border-slate-800 rounded-xl">
               <p className="text-slate-500 text-sm italic">Library collection is being indexed. Check back soon.</p>
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Add Library Resource</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreatePost} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Title</label>
                <input required value={postForm.title} onChange={e => setEditForm({...postForm, title: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Content / Summary</label>
                <textarea required value={postForm.content} onChange={e => setEditForm({...postForm, content: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white text-xs h-24" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Resource Type</label>
                  <select value={postForm.type} onChange={e => setEditForm({...postForm, type: e.target.value as any})} className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white text-xs">
                    <option value="POST">Announcement</option>
                    <option value="BROCHURE">Course Brochure</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Image URL</label>
                  <input value={postForm.imageUrl} onChange={e => setEditForm({...postForm, imageUrl: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white text-xs" placeholder="https://..." />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">External Link (Optional)</label>
                <input value={postForm.externalLink} onChange={e => setEditForm({...postForm, externalLink: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white text-xs" placeholder="https://..." />
              </div>
              <button type="submit" className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase rounded text-xs shadow-lg">Publish to Library</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
