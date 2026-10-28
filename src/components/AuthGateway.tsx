/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Mail, Lock, ArrowLeft, ArrowRight, Sparkles, Check, Key } from 'lucide-react';
import { User, SwanayaDatabase } from '../db/mockDb';

interface AuthGatewayProps {
  onLoginSuccess: (user: User) => void;
  onBack: () => void;
}

export default function AuthGateway({ onLoginSuccess, onBack }: AuthGatewayProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const usersList = SwanayaDatabase.get<User[]>("users");
      const found = usersList.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
      
      if (found) {
        if (found.status === 'INACTIVE') {
          setError('This account has been deactivated. Please contact admin.');
          setLoading(false);
          return;
        }
        onLoginSuccess(found);
      } else {
        setError('Invalid credentials. Check user accounts below for active reviewers.');
        setLoading(false);
      }
    }, 1000);
  };

  const activeReviewUsers = [
    { name: "Suresh Pillai (MD)", email: "superadmin@swanayamedia.com", role: "Super Admin", color: "border-rose-500/20 text-rose-400 bg-rose-500/5" },
    { name: "Ananya Nair (Principal)", email: "admin@swanayamedia.com", role: "Admin", color: "border-amber-500/20 text-amber-400 bg-amber-500/5" },
    { name: "Ananthakrishnan S.", email: "instructor1@swanayamedia.com", role: "Instructor", color: "border-emerald-500/20 text-emerald-400 bg-emerald-500/5" },
    { name: "Aravind K. Kumar", email: "student1@swanayamedia.com", role: "Student", color: "border-indigo-500/20 text-indigo-400 bg-indigo-500/5" },
    { name: "Harisankar P.", email: "finance@swanayamedia.com", role: "Finance", color: "border-teal-500/20 text-teal-400 bg-teal-500/5" },
    { name: "Lakshmi S. Bose", email: "counsellor@swanayamedia.com", role: "Counsellor", color: "border-purple-500/20 text-purple-400 bg-purple-500/5" }
  ];

  return (
    <div className="min-h-screen bg-[#07090D] text-slate-100 flex flex-col justify-center py-12 px-6 lg:px-8 selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* Header Back button */}
      <div className="absolute top-6 left-6">
        <button 
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Website
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 bg-slate-900 border border-slate-800 rounded-lg">
          <span className="text-xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200 font-serif">
            SWANAYA
          </span>
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-serif font-bold text-white tracking-wide">Enter Academy Workspace</h2>
          <p className="text-xs text-slate-500">Sign in securely using separate account credentials.</p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-8 shadow-2xl space-y-6">
          
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <p className="text-xs text-rose-400 font-semibold bg-rose-500/5 border border-rose-500/20 p-2.5 rounded">
                {error}
              </p>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@swanayamedia.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded pl-9 pr-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Password</label>
                <span className="text-[10px] text-amber-500 font-semibold cursor-pointer hover:underline">Forgot?</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded pl-9 pr-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold uppercase text-xs tracking-wider rounded transition-all cursor-pointer shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5"
            >
              {loading ? 'Authenticating Gateway...' : (
                <>
                  Authenticate <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Pre-populated Review Swapper (Essential for reviewer convenience!) */}
          <div className="space-y-3 pt-4 border-t border-slate-850">
            <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase font-mono flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-500" />
              Pre-Populated Reviewer Accounts
            </p>
            <p className="text-[9px] text-slate-600">Click any account below to populate credentials instantly.</p>
            
            <div className="grid grid-cols-2 gap-2">
              {activeReviewUsers.map((u) => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => {
                    setEmail(u.email);
                    setPassword('swanaya2026');
                    setError('');
                  }}
                  className={`text-left p-2 border rounded hover:bg-slate-900 transition-colors shrink-0 cursor-pointer text-[10px] ${u.color}`}
                >
                  <p className="font-bold text-slate-200 truncate">{u.name}</p>
                  <span className="text-[8px] opacity-80 uppercase block">{u.role}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
