/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowLeft, MapPin, Mail, Phone, Code, Award, ExternalLink, Github, Linkedin, Briefcase, FileText, ArrowUpRight } from 'lucide-react';
import { Student, Project, Certificate, HackathonRegistration } from '../db/mockDb';

interface StudentPortfolioPublicProps {
  student: Student;
  projects: Project[];
  certificates: Certificate[];
  hackathons: HackathonRegistration[];
  onBack: () => void;
}

export default function StudentPortfolioPublic({ student, projects, certificates, hackathons, onBack }: StudentPortfolioPublicProps) {
  // Filter relevant student's items
  const studentProjects = projects.filter(p => p.studentId === student.id);
  const studentCerts = certificates.filter(c => c.studentId === student.id);
  const studentHacks = hackathons.filter(h => h.studentId === student.id);

  return (
    <div className="min-h-screen bg-[#070A0F] text-slate-100 font-sans selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* Portfolio Header Bar */}
      <div className="border-b border-slate-900 bg-[#0A0D14]/80 sticky top-0 z-50 backdrop-blur-md py-4 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </button>
          
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono tracking-widest uppercase">
            <span>PUBLIC PORTFOLIO DEMO</span>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
            <span>{student.studentId}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        
        {/* Profile Card Section */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-lg p-8 relative overflow-hidden flex flex-col md:flex-row gap-8 items-center md:items-start">
          <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl"></div>
          
          <img 
            src={student.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.name}`} 
            alt={student.name}
            className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-slate-850 border border-slate-700 shadow-xl shrink-0"
          />

          <div className="flex-grow text-center md:text-left space-y-4">
            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-bold font-serif text-white tracking-wide">{student.name}</h1>
              <p className="text-xs text-amber-400 font-mono tracking-wider">SWANAYA MEDIA ACADEMY · PROFESSIONAL CANDIDATE</p>
            </div>

            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              Highly motivated learner with a strong background in {student.academicBackground}. Specializing in modern web interfaces, prompt-driven system architecture, and integrated digital strategies.
            </p>

            <div className="flex flex-wrap gap-y-2 gap-x-4 justify-center md:justify-start text-xs text-slate-500 font-mono">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-amber-500" /> Thiruvananthapuram, Kerala</span>
              <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-amber-500" /> {student.email}</span>
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-amber-500" /> {student.phone}</span>
            </div>

            <div className="flex gap-3 justify-center md:justify-start pt-2">
              <a href="https://github.com" target="_blank" rel="noreferrer" className="p-2 bg-slate-950 hover:bg-slate-850 rounded border border-slate-800 text-slate-400 hover:text-white transition-colors">
                <Github className="w-4 h-4" />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="p-2 bg-slate-950 hover:bg-slate-850 rounded border border-slate-800 text-slate-400 hover:text-white transition-colors">
                <Linkedin className="w-4 h-4" />
              </a>
              <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold px-3 py-1.5 rounded flex items-center gap-1">
                Career Readiness: {student.careerReadinessScore}%
              </span>
            </div>
          </div>
        </div>

        {/* Skills inventory */}
        <div className="space-y-4">
          <h2 className="text-lg font-serif font-semibold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
            <Code className="w-4 h-4 text-amber-400" />
            Verified Technical Skills & Tools
          </h2>
          <div className="flex flex-wrap gap-2">
            {student.skills && student.skills.length > 0 ? (
              student.skills.map((skill, idx) => (
                <span 
                  key={idx}
                  className="px-3 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-300 font-mono"
                >
                  {skill}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500">No skills published yet.</span>
            )}
          </div>
        </div>

        {/* Projects Showcase */}
        <div className="space-y-4">
          <h2 className="text-lg font-serif font-semibold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-amber-400" />
            Academic & Independent Projects
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {studentProjects.length > 0 ? (
              studentProjects.map((proj) => (
                <div key={proj.id} className="bg-slate-900/40 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-200">{proj.title}</h3>
                      <span className="text-[10px] uppercase tracking-wider text-amber-400 font-mono font-bold">
                        {proj.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{proj.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800/60 text-xs">
                    <span className="text-slate-500">Status: {proj.status}</span>
                    <div className="flex gap-3 font-mono text-[10px]">
                      {proj.repoUrl && (
                        <a href={proj.repoUrl} target="_blank" rel="noreferrer" className="text-amber-400 hover:underline flex items-center gap-0.5">
                          Repo <ArrowUpRight className="w-3 h-3" />
                        </a>
                      )}
                      {proj.liveUrl && (
                        <a href={proj.liveUrl} target="_blank" rel="noreferrer" className="text-amber-400 hover:underline flex items-center gap-0.5">
                          Live Demo <ArrowUpRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 col-span-2">No projects recorded.</p>
            )}
          </div>
        </div>

        {/* Hackathon participation */}
        {studentHacks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-serif font-semibold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              Hackathon Placements & Awards
            </h2>
            <div className="space-y-3">
              {studentHacks.map((hack) => (
                <div key={hack.id} className="bg-slate-900/30 border border-slate-850 p-4 rounded flex justify-between items-center text-xs">
                  <div>
                    <h4 className="font-bold text-slate-200">Team: {hack.teamName}</h4>
                    <p className="text-slate-500 mt-0.5">Project: {hack.projectName || 'TBD'}</p>
                    <p className="text-slate-500 text-[10px] mt-1">{hack.projectDescription}</p>
                  </div>
                  {hack.rank && (
                    <span className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded font-bold font-mono">
                      {hack.rank}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verified Credentials */}
        <div className="space-y-4">
          <h2 className="text-lg font-serif font-semibold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            Verifiable Academic Credentials
          </h2>
          
          <div className="space-y-3">
            {studentCerts.length > 0 ? (
              studentCerts.map((cert) => (
                <div key={cert.id} className="bg-slate-900/40 border border-slate-800 p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div>
                    <p className="font-semibold text-slate-200">{cert.courseName}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">Reference ID: <span className="font-mono">{cert.id}</span> · Completed {cert.completionDate}</p>
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-auto font-mono text-[10px]">
                    <span className="text-slate-500 font-bold uppercase">GRADE: {cert.grade}</span>
                    <a 
                      href={`/verify/${cert.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 bg-slate-950 border border-slate-800 text-amber-400 rounded hover:border-amber-500/30 transition-all flex items-center gap-1"
                    >
                      Verify <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">Course completed certificates will automatically render here upon graduation.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
