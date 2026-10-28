/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Briefcase, ArrowRight, Star, GraduationCap, Github, ExternalLink, RefreshCw } from 'lucide-react';
import { SwanayaDatabase, Student, Project, Course } from '../db/mockDb';

interface CareerPortalProps {
  onSelectPortfolio: (student: Student) => void;
  onRefreshAllData: () => void;
}

export default function CareerPortal({ onSelectPortfolio, onRefreshAllData }: CareerPortalProps) {
  const [students, setStudents] = useState<Student[]>(() => SwanayaDatabase.get<Student[]>("students"));
  const [courses] = useState<Course[]>(() => SwanayaDatabase.get<Course[]>("courses"));
  const [projects] = useState<Project[]>(() => SwanayaDatabase.get<Project[]>("projects"));

  const handleRecalculateScores = () => {
    const updated = students.map(st => {
      // Math model for career readiness score
      // Base on skills length, project counts, attendance, outstanding balance
      const skillsWeight = Math.min((st.skills.length * 8), 40);
      const projectWeight = Math.min((st.projectsCount * 20), 40);
      const attendanceFactor = st.attendancePercentage >= 90 ? 20 : st.attendancePercentage >= 75 ? 10 : 0;
      const score = Math.min(skillsWeight + projectWeight + attendanceFactor, 100);
      return {
        ...st,
        careerReadinessScore: score
      };
    });
    
    SwanayaDatabase.set("students", updated);
    setStudents(updated);
    onRefreshAllData();
  };

  const getScoreRatingColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
    if (score >= 60) return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
    return 'text-rose-400 border-rose-500/20 bg-rose-500/5';
  };

  return (
    <div className="space-y-6">
      
      {/* Overview Block */}
      <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-200 font-serif flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-amber-500" />
            Swanaya Career Development & Placements Hub
          </h3>
          <p className="text-[10px] text-slate-500">Formulate placement plans, calculate student competency index scores, and review public directories.</p>
        </div>

        <button
          onClick={handleRecalculateScores}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-bold uppercase rounded cursor-pointer transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin-slow" />
          Recalculate Readiness Scores
        </button>
      </div>

      {/* Student Directory List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {students.map((student) => {
          const courseCode = courses.find(c => c.id === student.courseId)?.code || 'SMA';
          const studentProjects = projects.filter(p => p.studentId === student.id);
          return (
            <div key={student.id} className="bg-slate-900/40 border border-slate-800 rounded-lg p-6 space-y-4 hover:border-amber-500/20 transition-all flex flex-col justify-between">
              
              <div className="space-y-3">
                <div className="flex justify-between items-start border-b border-slate-850 pb-3">
                  <div className="flex items-center gap-3">
                    <img 
                      src={student.avatarUrl} 
                      alt={student.name} 
                      className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 shrink-0" 
                    />
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 font-serif">{student.name}</h4>
                      <p className="text-[10px] text-slate-500 font-mono">ID: {student.studentId} · {courseCode}</p>
                    </div>
                  </div>

                  <div className={`text-center px-2 py-1 rounded border font-mono ${getScoreRatingColor(student.careerReadinessScore)}`}>
                    <span className="text-[9px] block text-slate-500 uppercase font-bold">Readiness Index</span>
                    <strong className="text-xs font-bold">{student.careerReadinessScore}%</strong>
                  </div>
                </div>

                {/* Skills representation (unboxed!) */}
                <div className="space-y-1">
                  <p className="text-[9px] text-slate-600 uppercase font-bold font-mono">Syllabus Skills verified</p>
                  <div className="flex flex-wrap gap-1.5">
                    {student.skills.map((sk, idx) => (
                      <span key={idx} className="text-[10px] text-slate-400 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                        {sk}
                      </span>
                    ))}
                    {student.skills.length === 0 && (
                      <span className="text-[10px] text-slate-500 italic">No skills validated yet</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-500 bg-slate-950/40 p-2.5 rounded border border-slate-850/60">
                  <p>Attendance: <span className="text-slate-300 font-bold">{student.attendancePercentage}%</span></p>
                  <p>Verified Projects: <span className="text-slate-300 font-bold">{student.projectsCount}</span></p>
                  <p className="col-span-2 truncate">Highest qualification: <span className="text-slate-300">{student.academicBackground}</span></p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-850/60 flex justify-between items-center">
                <span className="text-[9px] text-slate-500 font-mono">Last Recalc: 2026-10-05</span>
                <button
                  onClick={() => onSelectPortfolio(student)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 hover:border-amber-500/20 hover:text-amber-300 rounded text-slate-300 text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer"
                >
                  Simulate Public Portfolio URL <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                </button>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
