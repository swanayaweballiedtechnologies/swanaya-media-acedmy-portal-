/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowLeft, MapPin, Mail, Phone, Code, Award, Star, Github, Linkedin, Briefcase, ArrowUpRight } from 'lucide-react';
import { SwanayaDatabase, Student, Project, AcademyReview, HackathonRegistration } from '../db/mockDb';
import ThemeToggle from './ThemeToggle';

interface StudentPortfolioPublicProps {
  student: Student;
  projects: Project[];
  hackathons: HackathonRegistration[];
  onBack: () => void;
}

export default function StudentPortfolioPublic({ student, projects, hackathons, onBack }: StudentPortfolioPublicProps) {
  const studentProjects = projects.filter(p => p.studentId === student.id);
  const studentReviews = (SwanayaDatabase.get<AcademyReview[]>('reviews') || []).filter(
    r => r.status === 'PUBLISHED' && (r.authorId === student.userId || r.authorName === student.name)
  );
  const studentHacks = hackathons.filter(h => h.studentId === student.id);

  return (
    <div className="min-h-screen bg-[#F4F3F7] dark:bg-[#151521] text-[#25263A] dark:text-[#F5F3FA] font-sans selection:bg-[#529B78]/25 dark:selection:bg-[#76BD99]/30 transition-colors">
      
      {/* Portfolio Header Bar */}
      <div className="border-b border-[#E5E1EA] dark:border-[#38384B] bg-[#FFFFFF]/95 dark:bg-[#1D1D2B]/95 sticky top-0 z-50 backdrop-blur-md py-4 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <button 
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#555770] dark:text-[#B8B5C5] hover:text-[#529B78] dark:hover:text-[#76BD99] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </button>
          
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-[10px] text-[#555770] dark:text-[#B8B5C5] font-mono tracking-widest uppercase">
              <span>PUBLIC PORTFOLIO</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#529B78] dark:bg-[#76BD99]"></span>
              <span>{student.studentId}</span>
            </div>
            <ThemeToggle compact />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        
        {/* Profile Card Section */}
        <div className="bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] rounded-xl p-8 relative overflow-hidden flex flex-col md:flex-row gap-8 items-center md:items-start shadow-xs">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#529B78]/10 dark:bg-[#76BD99]/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <img 
            src={student.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.name}`} 
            alt={student.name}
            className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-[#F4F3F7] dark:bg-[#1D1D2B] border border-[#E5E1EA] dark:border-[#38384B] shadow-md shrink-0 object-cover"
          />

          <div className="flex-grow text-center md:text-left space-y-4">
            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-bold font-serif text-[#25263A] dark:text-[#F5F3FA] tracking-wide">{student.name}</h1>
              <p className="text-xs text-[#529B78] dark:text-[#76BD99] font-mono font-bold tracking-wider">SWANAYA MEDIA ACADEMY · VERIFIED SCHOLAR</p>
            </div>

            <p className="text-[#555770] dark:text-[#B8B5C5] text-sm max-w-2xl leading-relaxed">
              Highly motivated learner with a strong background in {student.academicBackground}. Specializing in modern web interfaces, prompt-driven system architecture, and integrated digital strategies.
            </p>

            <div className="flex flex-wrap gap-y-2 gap-x-4 justify-center md:justify-start text-xs text-[#555770] dark:text-[#B8B5C5] font-mono">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-[#529B78] dark:text-[#76BD99]" /> Thiruvananthapuram, Kerala</span>
              <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-[#529B78] dark:text-[#76BD99]" /> {student.email}</span>
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-[#529B78] dark:text-[#76BD99]" /> {student.phone}</span>
            </div>

            <div className="flex gap-3 justify-center md:justify-start pt-2">
              <a href="https://github.com" target="_blank" rel="noreferrer" className="p-2 bg-[#F4F3F7] dark:bg-[#1D1D2B] hover:bg-[#529B78]/10 rounded-lg border border-[#E5E1EA] dark:border-[#38384B] text-[#555770] dark:text-[#B8B5C5] hover:text-[#25263A] dark:hover:text-[#F5F3FA] transition-colors">
                <Github className="w-4 h-4" />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="p-2 bg-[#F4F3F7] dark:bg-[#1D1D2B] hover:bg-[#529B78]/10 rounded-lg border border-[#E5E1EA] dark:border-[#38384B] text-[#555770] dark:text-[#B8B5C5] hover:text-[#25263A] dark:hover:text-[#F5F3FA] transition-colors">
                <Linkedin className="w-4 h-4" />
              </a>
              <span className="text-xs bg-[#529B78]/10 dark:bg-[#76BD99]/15 border border-[#529B78]/30 dark:border-[#76BD99]/35 text-[#2E7051] dark:text-[#A5DFC1] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1">
                Career Readiness: {student.careerReadinessScore}%
              </span>
            </div>
          </div>
        </div>

        {/* Skills inventory */}
        <div className="space-y-4">
          <h2 className="text-lg font-serif font-semibold text-[#25263A] dark:text-[#F5F3FA] border-b border-[#E5E1EA] dark:border-[#38384B] pb-2 flex items-center gap-2">
            <Code className="w-4 h-4 text-[#529B78] dark:text-[#76BD99]" />
            Verified Technical Skills &amp; Tools
          </h2>
          <div className="flex flex-wrap gap-2">
            {student.skills && student.skills.length > 0 ? (
              student.skills.map((skill, idx) => (
                <span 
                  key={idx}
                  className="px-3 py-1 bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg text-xs text-[#25263A] dark:text-[#F5F3FA] font-mono"
                >
                  {skill}
                </span>
              ))
            ) : (
              <span className="text-xs text-[#555770] dark:text-[#B8B5C5]">No skills published yet.</span>
            )}
          </div>
        </div>

        {/* Projects Showcase */}
        <div className="space-y-4">
          <h2 className="text-lg font-serif font-semibold text-[#25263A] dark:text-[#F5F3FA] border-b border-[#E5E1EA] dark:border-[#38384B] pb-2 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#529B78] dark:text-[#76BD99]" />
            Academic &amp; Independent Projects
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {studentProjects.length > 0 ? (
              studentProjects.map((proj) => (
                <div key={proj.id} className="bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] rounded-xl p-5 flex flex-col justify-between shadow-xs">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[#25263A] dark:text-[#F5F3FA]">{proj.title}</h3>
                      <span className="text-[10px] uppercase tracking-wider text-[#529B78] dark:text-[#76BD99] font-mono font-bold">
                        {proj.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#555770] dark:text-[#B8B5C5] leading-relaxed">{proj.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#E5E1EA] dark:border-[#38384B] text-xs">
                    <span className="text-[#555770] dark:text-[#B8B5C5]">Status: {proj.status}</span>
                    <div className="flex gap-3 font-mono text-[10px]">
                      {proj.repoUrl && (
                        <a href={proj.repoUrl} target="_blank" rel="noreferrer" className="text-[#477DBB] dark:text-[#75A7E0] hover:underline flex items-center gap-0.5">
                          Repo <ArrowUpRight className="w-3 h-3" />
                        </a>
                      )}
                      {proj.liveUrl && (
                        <a href={proj.liveUrl} target="_blank" rel="noreferrer" className="text-[#529B78] dark:text-[#76BD99] hover:underline flex items-center gap-0.5">
                          Live Demo <ArrowUpRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-[#555770] dark:text-[#B8B5C5] col-span-2">No projects recorded.</p>
            )}
          </div>
        </div>

        {/* Hackathon participation */}
        {studentHacks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-serif font-semibold text-[#25263A] dark:text-[#F5F3FA] border-b border-[#E5E1EA] dark:border-[#38384B] pb-2 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#7652A8] dark:text-[#A985D6]" />
              Hackathon Placements &amp; Awards
            </h2>
            <div className="space-y-3">
              {studentHacks.map((hack) => (
                <div key={hack.id} className="bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] p-4 rounded-xl flex justify-between items-center text-xs shadow-xs">
                  <div>
                    <h4 className="font-bold text-[#25263A] dark:text-[#F5F3FA]">Team: {hack.teamName}</h4>
                    <p className="text-[#555770] dark:text-[#B8B5C5] mt-0.5">Project: {hack.projectName || 'TBD'}</p>
                    <p className="text-[#555770] dark:text-[#B8B5C5] text-[10px] mt-1">{hack.projectDescription}</p>
                  </div>
                  {hack.rank && (
                    <span className="px-2.5 py-1 bg-[#7652A8]/10 dark:bg-[#A985D6]/15 border border-[#7652A8]/30 dark:border-[#A985D6]/35 text-[#7652A8] dark:text-[#A985D6] rounded-lg font-bold font-mono">
                      {hack.rank}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Academy & Program Reviews */}
        <div className="space-y-4">
          <h2 className="text-lg font-serif font-semibold text-[#25263A] dark:text-[#F5F3FA] border-b border-[#E5E1EA] dark:border-[#38384B] pb-2 flex items-center gap-2">
            <Star className="w-4 h-4 text-[#529B78] dark:text-[#76BD99]" />
            Academy &amp; Program Reviews
          </h2>
          
          <div className="space-y-3">
            {studentReviews.length > 0 ? (
              studentReviews.map((rev) => (
                <div key={rev.id} className="bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs shadow-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-[#25263A] dark:text-[#F5F3FA]">{rev.title}</p>
                    <p className="text-[#555770] dark:text-[#B8B5C5] text-[11px]">{rev.comment}</p>
                    <p className="text-[#555770] dark:text-[#B8B5C5] text-[11px]">{rev.courseName} · {rev.createdAt?.substring(0, 10)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 self-end sm:self-auto font-mono tabular-nums text-xs text-[#529B78] dark:text-[#76BD99] shrink-0 font-bold">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>{Number(rev.rating).toFixed(1)} / 5.0</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-[#555770] dark:text-[#B8B5C5]">Course and academy reviews authored by this student will appear here.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
