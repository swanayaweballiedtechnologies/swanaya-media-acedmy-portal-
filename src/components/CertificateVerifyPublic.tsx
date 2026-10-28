/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Award, CheckCircle, AlertTriangle, ArrowLeft, ArrowUpRight, ShieldCheck, Printer } from 'lucide-react';
import { SwanayaDatabase, Certificate } from '../db/mockDb';

interface CertificateVerifyPublicProps {
  initialCertId?: string;
  onBack: () => void;
}

export default function CertificateVerifyPublic({ initialCertId = '', onBack }: CertificateVerifyPublicProps) {
  const [certId, setCertId] = useState(initialCertId);
  const [searchResult, setSearchResult] = useState<Certificate | null>(() => {
    if (initialCertId) {
      const list = SwanayaDatabase.get<Certificate[]>("certificates");
      return list.find(c => c.id.toLowerCase() === initialCertId.toLowerCase()) || null;
    }
    return null;
  });
  const [searched, setSearched] = useState(!!initialCertId);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!certId.trim()) return;
    const list = SwanayaDatabase.get<Certificate[]>("certificates");
    const found = list.find(c => c.id.toLowerCase() === certId.trim().toLowerCase()) || null;
    setSearchResult(found);
    setSearched(true);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#06080D] text-slate-100 py-12 px-4 selection:bg-amber-500/30 selection:text-amber-200 print:bg-white print:text-black">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-5 print:hidden">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Public Website
          </button>
          
          <div className="flex items-center gap-2 text-slate-400 text-xs font-serif font-bold tracking-widest uppercase">
            <span>SWANAYA MEDIA ACADEMY</span>
          </div>
        </div>

        {/* Verification Search Form */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-6 max-w-xl mx-auto print:hidden">
          <h2 className="text-lg font-serif font-semibold text-white mb-2 text-center">Verify Digital Credentials</h2>
          <p className="text-slate-400 text-xs text-center mb-6">Input the 14-digit certificate reference ID below to query the registration database.</p>
          
          <form onSubmit={handleSearch} className="flex gap-2">
            <input 
              type="text" 
              placeholder="e.g. CERT-SMA-11202"
              value={certId}
              onChange={(e) => setCertId(e.target.value)}
              className="flex-grow bg-slate-950 border border-slate-800 rounded px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-amber-400 text-slate-100"
            />
            <button 
              type="submit"
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded transition-colors whitespace-nowrap cursor-pointer"
            >
              Verify
            </button>
          </form>
        </div>

        {/* Verification Results Display */}
        {searched && (
          <div className="max-w-2xl mx-auto space-y-6">
            {searchResult ? (
              <>
                {/* Result Status Banner */}
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4 flex items-center gap-3 text-emerald-400 print:hidden">
                  <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider">Authenticity Verified</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">This credentials ledger record matches a valid certificate issued by Swanaya Media Academy.</p>
                  </div>
                </div>

                {/* Printable Certificate Preview Container */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 md:p-12 relative overflow-hidden shadow-2xl space-y-8 print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
                  
                  {/* Decorative Borders */}
                  <div className="absolute inset-4 border border-amber-500/10 pointer-events-none print:border-amber-500/20"></div>
                  <div className="absolute inset-6 border border-amber-500/20 pointer-events-none print:border-amber-500/40"></div>

                  {/* Header */}
                  <div className="text-center space-y-3 relative z-10">
                    <p className="text-[10px] font-bold tracking-widest text-amber-500 uppercase print:text-amber-600">OFFICIAL RECOGNITION LEDGER RECORD</p>
                    <h1 className="text-2xl md:text-3xl font-serif font-bold text-white tracking-wide print:text-black">
                      Swanaya Media Academy
                    </h1>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto print:text-gray-600">
                      Training & Certification Wing of Swanaya Media Enterprises
                    </p>
                  </div>

                  {/* Body Statement */}
                  <div className="text-center space-y-5 relative z-10 py-4">
                    <p className="text-slate-400 text-xs font-serif italic print:text-gray-600">This certifies that</p>
                    <h2 className="text-xl md:text-2xl font-serif font-bold text-amber-300 tracking-wide print:text-amber-700">
                      {searchResult.studentName}
                    </h2>
                    <p className="text-slate-400 text-xs max-w-lg mx-auto leading-relaxed print:text-gray-600">
                      has successfully completed all academic syllabus requisites and corresponding project assessments for
                    </p>
                    <h3 className="text-lg font-bold text-white font-serif tracking-normal print:text-black">
                      {searchResult.courseName}
                    </h3>
                    <p className="text-slate-400 text-xs print:text-gray-600">
                      with grade of classification <strong className="text-amber-400 print:text-amber-600">{searchResult.grade}</strong>.
                    </p>
                  </div>

                  {/* Metadata Block & QR Code */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-800/60 relative z-10 print:border-gray-300">
                    
                    {/* Left: Certificate Details */}
                    <div className="space-y-2 text-xs font-mono text-slate-400 print:text-gray-600">
                      <p><span className="text-slate-600 font-sans uppercase font-bold text-[9px] block">Certificate Reference ID</span> {searchResult.id}</p>
                      <p><span className="text-slate-600 font-sans uppercase font-bold text-[9px] block">Completion Date</span> {searchResult.completionDate}</p>
                      <p><span className="text-slate-600 font-sans uppercase font-bold text-[9px] block">Authorized Signatory</span> {searchResult.signatory}</p>
                    </div>

                    {/* Right: QR Verification Simulation */}
                    <div className="flex items-center gap-3 md:justify-end">
                      <div className="bg-white p-2 rounded shrink-0">
                        {/* Simulated QR Code using SVG */}
                        <svg className="w-16 h-16 text-black" viewBox="0 0 100 100">
                          <rect width="100" height="100" fill="white" />
                          <rect x="10" y="10" width="30" height="30" fill="black" />
                          <rect x="15" y="15" width="20" height="20" fill="white" />
                          <rect x="20" y="20" width="10" height="10" fill="black" />
                          
                          <rect x="60" y="10" width="30" height="30" fill="black" />
                          <rect x="65" y="15" width="20" height="20" fill="white" />
                          <rect x="70" y="20" width="10" height="10" fill="black" />
                          
                          <rect x="10" y="60" width="30" height="30" fill="black" />
                          <rect x="15" y="65" width="20" height="20" fill="white" />
                          <rect x="75" y="65" width="15" height="15" fill="black" />
                          
                          <rect x="50" y="50" width="10" height="10" fill="black" />
                          <rect x="60" y="75" width="10" height="15" fill="black" />
                        </svg>
                      </div>
                      <div className="text-left font-mono text-[9px] text-slate-500 print:text-gray-500">
                        <p className="font-sans font-bold text-slate-400 uppercase text-[8px]">Verifiable Ledger</p>
                        <p className="font-bold text-amber-500 print:text-amber-700">VERIFIED STATUS</p>
                        <p className="mt-1">Swanaya Media Academy</p>
                      </div>
                    </div>

                  </div>

                </div>

                {/* Print button */}
                <div className="flex justify-center print:hidden">
                  <button 
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold uppercase text-white rounded transition-colors cursor-pointer border border-slate-700"
                  >
                    <Printer className="w-4 h-4" />
                    Print Certificate
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-8 text-center space-y-4">
                <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto" />
                <h3 className="text-lg font-serif font-bold text-rose-400">Credential Not Found</h3>
                <p className="text-slate-400 text-xs max-w-md mx-auto">
                  The Certificate Reference ID <code className="text-white bg-slate-950 px-1.5 py-0.5 rounded font-mono">{certId}</code> does not correspond to an active, authorized record. Please verify the code on the physical document and search again.
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
