/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BookOpen, Award, CheckCircle2, Phone, Mail, MapPin, Sparkles, Send, GraduationCap, Code, Video, Globe, Terminal } from 'lucide-react';
import { SwanayaDatabase, Course, INITIAL_COURSES } from '../db/mockDb';

interface PublicLandingProps {
  onNavigateToPortal: () => void;
  onNavigateToVerify: (certId: string) => void;
  courses: Course[];
  onApplyLead: (leadData: { name: string; email: string; phone: string; courseId: string; qualification: string; preferredBatch: string; message: string }) => void;
}

export default function PublicLanding({ onNavigateToPortal, onNavigateToVerify, courses, onApplyLead }: PublicLandingProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    courseId: courses[0]?.id || 'c-1',
    qualification: '',
    preferredBatch: 'ADWDVC-2026-A',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [certSearchId, setCertSearchId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone) return;
    onApplyLead(formData);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        courseId: courses[0]?.id || 'c-1',
        qualification: '',
        preferredBatch: 'ADWDVC-2026-A',
        message: ''
      });
    }, 4000);
  };

  const courseIcons = (code: string) => {
    if (code.includes('WD')) return <Code className="w-6 h-6 text-amber-400" />;
    if (code.includes('DM')) return <Globe className="w-6 h-6 text-amber-400" />;
    if (code.includes('BC')) return <Terminal className="w-6 h-6 text-amber-400" />;
    return <Video className="w-6 h-6 text-amber-400" />;
  };

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* Premium Top Bar Contract (1 row, 3 zones) */}
      <header className="sticky top-0 z-50 bg-[#0A0D14]/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 font-serif">
              SWANAYA
            </span>
            <span className="text-[10px] tracking-widest text-amber-400 font-sans uppercase border-l border-slate-700 pl-3">
              ACADEMY
            </span>
          </div>

          {/* Zone 2: Nav Links (4-6 links) */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <a href="#about" className="hover:text-amber-400 transition-colors">About</a>
            <a href="#courses" className="hover:text-amber-400 transition-colors">Programs</a>
            <a href="#philosophy" className="hover:text-amber-400 transition-colors">Philosophy</a>
            <a href="#verify" className="hover:text-amber-400 transition-colors">Verify Credentials</a>
            <a href="#admissions" className="hover:text-amber-400 transition-colors">Admissions</a>
          </nav>

          {/* Zone 3: Direct Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={() => onNavigateToPortal()}
              className="px-4 py-2 text-xs font-semibold tracking-wider uppercase text-[#0A0D14] bg-gradient-to-r from-amber-400 to-amber-200 rounded hover:from-amber-300 hover:to-amber-100 transition-all cursor-pointer shadow-md shadow-amber-500/10"
            >
              Enterprise Portal
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow">
        
        {/* HERO SECTION */}
        <section className="relative overflow-hidden py-24 md:py-32 border-b border-slate-900 bg-radial-[at_top_right] from-amber-500/5 via-transparent to-transparent">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Info */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                <Sparkles className="w-4 h-4" />
                <span>Swanaya Media Enterprises Wing</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white font-serif leading-tight text-wrap">
                Training that builds <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">
                  job-ready professionals
                </span> <br />
                — not just certificates.
              </h1>
              <p className="text-slate-400 text-base md:text-lg max-w-xl leading-relaxed">
                Swanaya Media Academy delivers elite industry-focused certification programs in AI Media Production, High-Frequency Web Development, and Digital Strategy. Crafted by real professionals for high-caliber learners.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <a 
                  href="#admissions" 
                  className="px-6 py-3 text-center text-xs font-bold tracking-wider uppercase bg-amber-500 hover:bg-amber-400 text-black rounded transition-colors"
                >
                  Apply Online
                </a>
                <a 
                  href="#courses" 
                  className="px-6 py-3 text-center text-xs font-bold tracking-wider uppercase bg-slate-800/80 hover:bg-slate-700/80 text-white rounded border border-slate-700 transition-colors"
                >
                  Explore Curriculum
                </a>
              </div>
            </div>

            {/* Right Display Card - Premium visual details */}
            <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-lg p-8 relative overflow-hidden backdrop-blur-sm shadow-xl shadow-black/40">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl"></div>
              <h3 className="text-lg font-serif font-semibold text-amber-400 mb-6 flex items-center gap-2 border-b border-slate-800 pb-3">
                <GraduationCap className="w-5 h-5 text-amber-400" />
                Next Cohorts Starting Oct 2026
              </h3>
              <ul className="space-y-4">
                <li className="flex justify-between items-start text-xs border-b border-slate-800/50 pb-2">
                  <div>
                    <p className="font-semibold text-slate-200">Web Development & Vibe Coding</p>
                    <p className="text-slate-500">Duration: 12 Months · Advanced Diploma</p>
                  </div>
                  <span className="text-amber-500 font-medium">Limited Seats</span>
                </li>
                <li className="flex justify-between items-start text-xs border-b border-slate-800/50 pb-2">
                  <div>
                    <p className="font-semibold text-slate-200">AI Media & Integrated Marketing</p>
                    <p className="text-slate-500">Duration: 6 Months · Diploma</p>
                  </div>
                  <span className="text-slate-400 font-medium font-mono">Filling Fast</span>
                </li>
                <li className="flex justify-between items-start text-xs">
                  <div>
                    <p className="font-semibold text-slate-200">AI & Business Communication</p>
                    <p className="text-slate-500">Duration: 3 Months · Professional Certification</p>
                  </div>
                  <span className="text-amber-500 font-medium">Open</span>
                </li>
              </ul>
              <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
                <span>Location · Trivandrum & Online</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
            </div>

          </div>
        </section>

        {/* FEATURED PROGRAMS SECTION */}
        <section id="courses" className="py-20 max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-semibold tracking-widest text-amber-400 uppercase">ACADEMIC ECOSYSTEM</span>
            <h2 className="text-3xl md:text-4xl font-bold font-serif text-white">Programs of Swanaya Media Academy</h2>
            <p className="text-slate-400 text-sm">Strict industry curriculum engineered to elevate digital skills to corporate standards.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {courses.map((course) => (
              <div key={course.id} className="bg-slate-900/40 border border-slate-800/80 rounded-lg p-8 hover:border-amber-500/20 transition-all flex flex-col justify-between group">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded">
                      {courseIcons(course.code)}
                    </div>
                    <span className="text-[10px] font-mono tracking-widest text-amber-400 uppercase font-bold px-2 py-0.5 bg-amber-400/5 rounded border border-amber-500/10">
                      {course.code} · {course.level}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-100 group-hover:text-amber-300 transition-colors font-serif">
                    {course.name}
                  </h3>
                  <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">
                    {course.description}
                  </p>
                  
                  {/* Unboxed Metadata (Zero Pill Compliance) */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-2 border-t border-slate-800/40">
                    <span>Duration: {course.duration}</span>
                    <span aria-hidden="true" className="text-slate-700">·</span>
                    <span>Mode: {course.mode}</span>
                    <span aria-hidden="true" className="text-slate-700">·</span>
                    <span className="text-amber-500 font-semibold font-mono">₹{course.fee.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-800/40 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Coordinator: {course.coordinator}</span>
                  <a href="#admissions" className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors">
                    Enroll Now →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PHILOSOPHY & WHY SWANAYA */}
        <section id="philosophy" className="py-20 bg-slate-950/80 border-y border-slate-900">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            
            {/* Visual Block */}
            <div className="space-y-6">
              <span className="text-xs font-semibold tracking-widest text-amber-400 uppercase">THE COGNITIVE SHIFT</span>
              <h2 className="text-3xl md:text-4xl font-bold font-serif text-white">Why Swanaya Media Academy?</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Most educational systems teach outdated, generic documentation. At Swanaya, we build real code alongside LLMs in high-frequency vibe environments. We shoot real cinema on high-grade cameras. We deploy live, monetizable SaaS platforms.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">100% Industry Aligned</h4>
                    <p className="text-slate-500 text-xs mt-1">Direct integration with Swanaya Media Enterprise projects.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">Vibe Coding Mastery</h4>
                    <p className="text-slate-500 text-xs mt-1">Continuous AI collaboration tools to ship software at extreme speeds.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">Production Studio Access</h4>
                    <p className="text-slate-500 text-xs mt-1">Professional cameras, lighting sets, and audio post-suites.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">Digital Credentials</h4>
                    <p className="text-slate-500 text-xs mt-1">Secure online verifiable certificate architecture for employers.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Testimonial Panel */}
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-lg relative">
              <span className="text-6xl text-amber-500/20 font-serif absolute top-4 left-4">“</span>
              <div className="relative space-y-6">
                <p className="text-slate-300 text-sm font-serif italic leading-relaxed">
                  "Swanaya Media Academy transformed my perspective on engineering. I didn't just learn React; I learned how to build production-grade interfaces using advanced AI prompts. Within three weeks of completing my Advanced Diploma, I was hired by a major regional SaaS team."
                </p>
                <div className="flex items-center gap-3 border-t border-slate-800 pt-4">
                  <img 
                    src="https://api.dicebear.com/7.x/avataaars/svg?seed=Aravind" 
                    alt="Aravind K. Kumar" 
                    className="w-10 h-10 rounded-full border border-slate-700 bg-slate-850"
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Aravind K. Kumar</p>
                    <p className="text-[10px] text-slate-500">Lead Web Architect · Alumnus 2026</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* VERIFY CREDENTIAL SECTION */}
        <section id="verify" className="py-20 max-w-3xl mx-auto px-6 text-center">
          <div className="space-y-4 mb-8">
            <Award className="w-12 h-12 text-amber-400 mx-auto" />
            <h2 className="text-2xl md:text-3xl font-bold font-serif text-white">Verify Digital Certificate</h2>
            <p className="text-slate-400 text-sm">
              Our graduates carry enterprise-verifiable digital credentials. Input the unique Certificate ID below to instantly verify its authenticity.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
            <input 
              type="text" 
              placeholder="e.g. CERT-SMA-11202"
              value={certSearchId}
              onChange={(e) => setCertSearchId(e.target.value)}
              className="flex-grow bg-slate-900 border border-slate-800 rounded px-4 py-3 text-sm focus:outline-none focus:border-amber-400 text-slate-100 font-mono"
            />
            <button 
              onClick={() => {
                if (certSearchId.trim()) onNavigateToVerify(certSearchId.trim());
              }}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded transition-colors whitespace-nowrap"
            >
              Verify Now
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-3 font-mono">Example: CERT-SMA-11202</p>
        </section>

        {/* ADMISSIONS FORM SECTION */}
        <section id="admissions" className="py-20 border-t border-slate-900 bg-gradient-to-b from-transparent to-slate-950/90">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center space-y-3 mb-12">
              <span className="text-xs font-semibold tracking-widest text-amber-400 uppercase">ONLINE APPLICATION</span>
              <h2 className="text-3xl font-serif text-white">Join the Next Cohort</h2>
              <p className="text-slate-400 text-sm">No complex procedures. Fill in your details and an admission counselor will contact you within 24 hours.</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-8 backdrop-blur-sm shadow-xl">
              {submitted ? (
                <div className="text-center py-12 space-y-4">
                  <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-serif text-slate-100 font-semibold">Application Received!</h3>
                  <p className="text-slate-400 text-sm max-w-md mx-auto">
                    Thank you. We have saved your application. Lakshmi S. Bose (Admission Counselor) has been notified to guide you through the process.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-400 uppercase font-semibold">Full Name</label>
                      <input 
                        type="text" 
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="John Doe"
                        className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-400 uppercase font-semibold">Email Address</label>
                      <input 
                        type="email" 
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        placeholder="john@example.com"
                        className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-400 uppercase font-semibold">Phone Number</label>
                      <input 
                        type="tel" 
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        placeholder="+91 94460 00000"
                        className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-400 uppercase font-semibold">Highest Qualification</label>
                      <input 
                        type="text" 
                        required
                        value={formData.qualification}
                        onChange={(e) => setFormData({...formData, qualification: e.target.value})}
                        placeholder="Graduate / 12th Standard"
                        className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-400 uppercase font-semibold">Desired Program</label>
                      <select 
                        value={formData.courseId}
                        onChange={(e) => setFormData({...formData, courseId: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-400"
                      >
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>{course.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-400 uppercase font-semibold">Preferred Batch Start</label>
                      <select 
                        value={formData.preferredBatch}
                        onChange={(e) => setFormData({...formData, preferredBatch: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-400"
                      >
                        <option value="ADWDVC-2026-A">ADWDVC Batch A (Oct 2026)</option>
                        <option value="DAIMPIDM-2026-A">DAIMPIDM Cohort A (Nov 2026)</option>
                        <option value="AIBC-Weekend">AIBC Weekend Spec (Dec 2026)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-400 uppercase font-semibold">Message & Aspirations (Optional)</label>
                    <textarea 
                      rows={3}
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                      placeholder="Tell us about what you want to build or create..."
                      className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold uppercase text-xs tracking-wider rounded transition-all cursor-pointer shadow-md shadow-amber-500/10"
                  >
                    Submit Enrollment Proposal
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="bg-slate-950 border-t border-slate-900 py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          
          <div className="space-y-4">
            <span className="text-lg font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200 font-serif">
              SWANAYA MEDIA ACADEMY
            </span>
            <p className="text-slate-500 text-xs leading-relaxed">
              Swanaya Media Academy is the official elite training and certification division of Swanaya Media Enterprises. Providing expert corporate readiness in AI, design, and software systems.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Programs</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              <li><a href="#courses" className="hover:text-amber-400 transition-colors">Web Development & Vibe Coding</a></li>
              <li><a href="#courses" className="hover:text-amber-400 transition-colors">AI Media & Digital Marketing</a></li>
              <li><a href="#courses" className="hover:text-amber-400 transition-colors">AI & Business Communication</a></li>
              <li><a href="#courses" className="hover:text-amber-400 transition-colors">Videography & Creation Basics</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Verification</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              <li><a href="#verify" className="hover:text-amber-400 transition-colors">Certificate lookup</a></li>
              <li><a href="#philosophy" className="hover:text-amber-400 transition-colors">Alumni network</a></li>
              <li><a href="#admissions" className="hover:text-amber-400 transition-colors">Enterprise Partners</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Contact Academy</h4>
            <div className="space-y-2 text-xs text-slate-500">
              <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-amber-500" /> academy@swanayamedia.com</p>
              <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-amber-500" /> +91 94460 00000</p>
              <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-amber-500" /> Thiruvananthapuram, Kerala</p>
            </div>
          </div>

        </div>

        <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-slate-900/50 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-600">
          <p>© 2026 Swanaya Media Academy. Training & Certification Wing of Swanaya Media Enterprises. All Rights Reserved.</p>
          <div className="flex gap-4 mt-2 sm:mt-0 font-mono">
            <span>CURRENCY: INR (₹)</span>
            <span>TIMEZONE: IST (Kolkata)</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
