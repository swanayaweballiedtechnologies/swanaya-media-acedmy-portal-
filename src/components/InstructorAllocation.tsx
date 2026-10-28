/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ShieldCheck, UserPlus, BookOpen, Layers, CheckCircle2, 
  Trash2, Plus, Sparkles, User, GraduationCap, Phone, Mail, Award 
} from 'lucide-react';
import { 
  SwanayaDatabase, Instructor, Subject, Course, Semester, User as DbUser 
} from '../db/mockDb';

interface InstructorAllocationProps {
  currentUser: any;
  onRefreshAllData: () => void;
}

export default function InstructorAllocation({ currentUser, onRefreshAllData }: InstructorAllocationProps) {
  // Load database arrays
  const [instructors, setInstructors] = useState<Instructor[]>(() => SwanayaDatabase.get<Instructor[]>("instructors"));
  const [subjects, setSubjects] = useState<Subject[]>(() => SwanayaDatabase.get<Subject[]>("subjects"));
  const [courses] = useState<Course[]>(() => SwanayaDatabase.get<Course[]>("courses"));
  const [semesters] = useState<Semester[]>(() => SwanayaDatabase.get<Semester[]>("semesters"));

  // Toggle for select vs manual create paper
  const [paperMode, setPaperMode] = useState<'SELECT' | 'CREATE'>('CREATE');

  // Allocation Form States
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || 'c-1');
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
  
  // Existing Subject Choice
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  // New Subject Input (e.g. CPMM)
  const [newSubjectCode, setNewSubjectCode] = useState('CPMM');
  const [newSubjectName, setNewSubjectName] = useState('Content Production & Media Management');
  const [newSubjectCredits, setNewSubjectCredits] = useState(4);
  const [newSubjectHours, setNewSubjectHours] = useState(60);

  // Instructor Choice
  const [instructorMode, setInstructorMode] = useState<'SELECT' | 'REGISTER'>('SELECT');
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>(instructors[0]?.id || 'inst-1');

  // New Instructor Input (e.g. Adithyan M)
  const [newInstName, setNewInstructorName] = useState('Adithyan M');
  const [newInstEmail, setNewInstructorEmail] = useState('adithyan@swanayamedia.com');
  const [newInstPhone, setNewInstructorPhone] = useState('+91 94460 77889');
  const [newInstQual, setNewInstructorQual] = useState('MBA in Media Management & Digital Marketing');
  const [newInstSpec, setNewInstructorSpec] = useState('Content Strategy, Digital Media & Branding Funnels');
  const [newInstExp, setNewInstructorExp] = useState('7 Years in Media Production Agencies');

  const [allocationSuccess, setAllocationSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Sync active semesters when course shifts
  React.useEffect(() => {
    const courseSems = semesters.filter(s => s.courseId === selectedCourseId);
    if (courseSems.length > 0) {
      setSelectedSemesterId(courseSems[0].id);
    } else {
      setSelectedSemesterId('s-1-1');
    }
  }, [selectedCourseId, semesters]);

  // Filter subjects for the selected semester
  const semesterSubjects = subjects.filter(s => s.semesterId === selectedSemesterId);
  React.useEffect(() => {
    if (semesterSubjects.length > 0) {
      setSelectedSubjectId(semesterSubjects[0].id);
    } else {
      setSelectedSubjectId('');
    }
  }, [selectedSemesterId, subjects]);

  const handleAllocate = (e: React.FormEvent) => {
    e.preventDefault();
    setAllocationSuccess(false);

    let finalInstructorId = selectedInstructorId;
    const allUsers = SwanayaDatabase.get<DbUser[]>("users");
    const allInstructors = SwanayaDatabase.get<Instructor[]>("instructors");

    // 1. If Registering New Instructor (e.g. Adithyan M)
    if (instructorMode === 'REGISTER') {
      if (!newInstName.trim() || !newInstEmail.trim()) {
        alert('Please fill out instructor name and email.');
        return;
      }

      // Check if user already exists
      const existingUser = allUsers.find(u => u.email.toLowerCase() === newInstEmail.trim().toLowerCase());
      if (existingUser) {
        alert('An account with this email address already exists.');
        return;
      }

      const newUserId = `usr-inst-${Date.now()}`;
      const newInstId = `inst-${Date.now()}`;

      const newDbUser: DbUser = {
        id: newUserId,
        email: newInstEmail.trim().toLowerCase(),
        name: newInstName.trim(),
        role: 'INSTRUCTOR',
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newInstName.trim()}`,
        status: 'ACTIVE',
        createdAt: new Date().toISOString().split('T')[0]
      };

      const newInstructor: Instructor = {
        id: newInstId,
        userId: newUserId,
        name: newInstName.trim(),
        email: newInstEmail.trim().toLowerCase(),
        phone: newInstPhone.trim(),
        qualification: newInstQual.trim(),
        specialization: newInstSpec.trim(),
        experience: newInstExp.trim(),
        bio: `${newInstName.trim()} is an expert specialist in ${newInstSpec.trim()}.`,
        avatarUrl: newDbUser.avatarUrl,
        status: 'ACTIVE',
        assignedSubjects: []
      };

      SwanayaDatabase.set("users", [...allUsers, newDbUser]);
      SwanayaDatabase.set("instructors", [...allInstructors, newInstructor]);

      finalInstructorId = newInstId;
      // Update local state temporarily to prevent stale reads
      setInstructors([...allInstructors, newInstructor]);
    }

    // 2. Identify or Create Subject Paper
    const allSubjects = SwanayaDatabase.get<Subject[]>("subjects");
    let targetSubjectId = selectedSubjectId;

    if (paperMode === 'CREATE') {
      if (!newSubjectCode.trim() || !newSubjectName.trim()) {
        alert('Please fill out subject paper code and name.');
        return;
      }

      const newSubId = `sub-${Date.now()}`;
      const newSubject: Subject = {
        id: newSubId,
        semesterId: selectedSemesterId,
        code: newSubjectCode.trim().toUpperCase(),
        name: newSubjectName.trim(),
        credits: Number(newSubjectCredits),
        hours: Number(newSubjectHours),
        description: `Advanced study paper specializing in ${newSubjectName.trim()}`,
        learningOutcomes: [`Master core frameworks of ${newSubjectName.trim()}`, `Implement field strategies under faculty supervision`],
        instructorId: finalInstructorId,
        assessmentMethod: 'Semester assignments + Practical execution'
      };

      SwanayaDatabase.set("subjects", [...allSubjects, newSubject]);
      targetSubjectId = newSubId;
    } else {
      // SELECT mode: Update existing subject to have this instructorId
      if (!targetSubjectId) {
        alert('Please select a valid subject paper.');
        return;
      }

      const updatedSubjects = allSubjects.map(sub => 
        sub.id === targetSubjectId ? { ...sub, instructorId: finalInstructorId } : sub
      );
      SwanayaDatabase.set("subjects", updatedSubjects);
    }

    // 3. Update Instructor's assignedSubjects array
    const currentAllInstructors = SwanayaDatabase.get<Instructor[]>("instructors");
    const updatedInstructors = currentAllInstructors.map(inst => {
      if (inst.id === finalInstructorId) {
        const assigned = inst.assignedSubjects || [];
        if (!assigned.includes(targetSubjectId)) {
          return { ...inst, assignedSubjects: [...assigned, targetSubjectId] };
        }
      }
      return inst;
    });
    SwanayaDatabase.set("instructors", updatedInstructors);
    setInstructors(updatedInstructors);

    // Refresh overall list of subjects
    setSubjects(SwanayaDatabase.get<Subject[]>("subjects"));

    // Log Activity Audit
    const instRecord = updatedInstructors.find(i => i.id === finalInstructorId);
    const subRecord = SwanayaDatabase.get<Subject[]>("subjects").find(s => s.id === targetSubjectId);
    SwanayaDatabase.log(
      currentUser.email, 
      currentUser.name, 
      "INSTRUCTOR_PAPER_ALLOCATE", 
      `Assigned Instructor ${instRecord?.name} to Subject: ${subRecord?.code} (${subRecord?.name})`
    );

    setSuccessMessage(`Successfully allocated ${instRecord?.name} to Subject Paper: ${subRecord?.code} (${subRecord?.name})!`);
    setAllocationSuccess(true);
    onRefreshAllData();

    // Reset inputs
    setNewSubjectCode('CPMM');
    setNewSubjectName('Content Production & Media Management');
    setNewInstructorName('Adithyan M');
    setNewInstructorEmail('adithyan@swanayamedia.com');

    setTimeout(() => {
      setAllocationSuccess(false);
    }, 5000);
  };

  const handleUnallocate = (subjectId: string, instructorId: string) => {
    const allSubjects = SwanayaDatabase.get<Subject[]>("subjects");
    const allInstructors = SwanayaDatabase.get<Instructor[]>("instructors");

    // Clear instructorId on Subject
    const updatedSubjects = allSubjects.map(sub => 
      sub.id === subjectId ? { ...sub, instructorId: '' } : sub
    );
    SwanayaDatabase.set("subjects", updatedSubjects);
    setSubjects(updatedSubjects);

    // Filter assigned list on Instructor
    const updatedInstructors = allInstructors.map(inst => {
      if (inst.id === instructorId) {
        return { 
          ...inst, 
          assignedSubjects: (inst.assignedSubjects || []).filter(sid => sid !== subjectId) 
        };
      }
      return inst;
    });
    SwanayaDatabase.set("instructors", updatedInstructors);
    setInstructors(updatedInstructors);

    SwanayaDatabase.log(currentUser.email, currentUser.name, "INSTRUCTOR_PAPER_DEALLOCATE", `Removed instructor assignment for Subject ID: ${subjectId}`);
    onRefreshAllData();
  };

  return (
    <div className="space-y-6">
      
      {/* Visual security guard indicator */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg shrink-0">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200 font-serif">Restricted Workspace: Allocation Manager</h3>
            <p className="text-[10px] text-slate-500">Authorized personnel only: <span className="font-semibold text-amber-500 uppercase">Only Admins and Counselors</span> hold allocation credentials.</p>
          </div>
        </div>
        <div className="hidden md:block text-right font-mono text-[9px] text-slate-600">
          <span>IP BOUND: SECURE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Interactive allocation deployer */}
        <div className="lg:col-span-5">
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-6 space-y-5">
            <div className="border-b border-slate-850 pb-3">
              <span className="text-[9px] font-mono font-bold text-amber-500 tracking-widest uppercase">FACULTY PLACEMENT FORM</span>
              <h3 className="text-sm font-serif font-bold text-white mt-1">Allocate Instructor & Paper</h3>
            </div>

            {allocationSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-xs font-semibold animate-pulse">
                {successMessage}
              </div>
            )}

            <form onSubmit={handleAllocate} className="space-y-5 text-xs">
              
              {/* STEP 1: CHOOSE TARGET COURSE & SEMESTER */}
              <div className="space-y-3 bg-slate-950 p-4 border border-slate-850 rounded">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">1. Curriculum Placement Target</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 uppercase font-bold">Target Course</label>
                    <select
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-slate-200"
                    >
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>{c.code} · {c.name.substring(0, 20)}...</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 uppercase font-bold">Semester Term</label>
                    <select
                      value={selectedSemesterId}
                      onChange={(e) => setSelectedSemesterId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-slate-200"
                    >
                      {semesters.filter(s => s.courseId === selectedCourseId).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* STEP 2: SELECT OR INPUT SUBJECT PAPER (E.G. CPMM) */}
              <div className="space-y-3 bg-slate-950 p-4 border border-slate-850 rounded">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">2. Subject / Paper Choice</p>
                  <div className="flex gap-2 text-[9px] font-mono bg-slate-900 border border-slate-800 p-0.5 rounded">
                    <button
                      type="button"
                      onClick={() => setPaperMode('SELECT')}
                      className={`px-2 py-0.5 rounded ${paperMode === 'SELECT' ? 'bg-amber-500 text-black font-bold':'text-slate-400'}`}
                    >
                      Select Exist
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaperMode('CREATE')}
                      className={`px-2 py-0.5 rounded ${paperMode === 'CREATE' ? 'bg-amber-500 text-black font-bold':'text-slate-400'}`}
                    >
                      Create Paper
                    </button>
                  </div>
                </div>

                {paperMode === 'SELECT' ? (
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 uppercase font-bold">Subject Paper</label>
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-slate-200"
                    >
                      {semesterSubjects.map(s => (
                        <option key={s.id} value={s.id}>{s.code} · {s.name}</option>
                      ))}
                      {semesterSubjects.length === 0 && (
                        <option value="">No papers exists for this term. Use Create Paper mode.</option>
                      )}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1 col-span-1">
                        <label className="text-[9px] text-slate-400 uppercase font-bold">Paper Code</label>
                        <input 
                          type="text" 
                          required
                          value={newSubjectCode}
                          onChange={(e) => setNewSubjectCode(e.target.value)}
                          placeholder="e.g. CPMM"
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono font-bold uppercase"
                        />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className="text-[9px] text-slate-400 uppercase font-bold">Subject Name</label>
                        <input 
                          type="text" 
                          required
                          value={newSubjectName}
                          onChange={(e) => setNewSubjectName(e.target.value)}
                          placeholder="e.g. Content Production"
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 uppercase font-bold">Credits</label>
                        <input 
                          type="number" 
                          required
                          value={newSubjectCredits}
                          onChange={(e) => setNewSubjectCredits(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 uppercase font-bold">Contact Hours</label>
                        <input 
                          type="number" 
                          required
                          value={newSubjectHours}
                          onChange={(e) => setNewSubjectHours(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 3: ASSIGN AN INSTRUCTOR OR REGISTER NEW (E.G. ADITHYAN M) */}
              <div className="space-y-3 bg-slate-950 p-4 border border-slate-850 rounded">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">3. Academic Instructor</p>
                  <div className="flex gap-2 text-[9px] font-mono bg-slate-900 border border-slate-800 p-0.5 rounded">
                    <button
                      type="button"
                      onClick={() => setInstructorMode('SELECT')}
                      className={`px-2 py-0.5 rounded ${instructorMode === 'SELECT' ? 'bg-amber-500 text-black font-bold':'text-slate-400'}`}
                    >
                      Assign Exist
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstructorMode('REGISTER')}
                      className={`px-2 py-0.5 rounded ${instructorMode === 'REGISTER' ? 'bg-amber-500 text-black font-bold':'text-slate-400'}`}
                    >
                      Register New
                    </button>
                  </div>
                </div>

                {instructorMode === 'SELECT' ? (
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 uppercase font-bold">Select Active Instructor</label>
                    <select
                      value={selectedInstructorId}
                      onChange={(e) => setSelectedInstructorId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-slate-200"
                    >
                      {instructors.map(i => (
                        <option key={i.id} value={i.id}>{i.name} ({i.specialization.substring(0, 20)}...)</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 uppercase font-bold">Faculty Full Name</label>
                      <input 
                        type="text" 
                        required
                        value={newInstName}
                        onChange={(e) => setNewInstructorName(e.target.value)}
                        placeholder="e.g. Adithyan M"
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 uppercase font-bold">Email Address</label>
                        <input 
                          type="email" 
                          required
                          value={newInstEmail}
                          onChange={(e) => setNewInstructorEmail(e.target.value)}
                          placeholder="adithyan@swanayamedia.com"
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 uppercase font-bold">Contact Number</label>
                        <input 
                          type="text" 
                          value={newInstPhone}
                          onChange={(e) => setNewInstructorPhone(e.target.value)}
                          placeholder="+91 94460 77889"
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 uppercase font-bold">Primary Specialization</label>
                      <input 
                        type="text" 
                        value={newInstSpec}
                        onChange={(e) => setNewInstructorSpec(e.target.value)}
                        placeholder="Content Strategy, Media Branding, etc."
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold uppercase tracking-wider rounded transition-all cursor-pointer shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Deploy Allocation Assignment
              </button>

            </form>
          </div>
        </div>

        {/* Right Column: Visual directory ledger */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg flex justify-between items-center">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Faculty Paper Assignments directory</h4>
            <span className="text-[10px] font-mono text-amber-500 font-bold bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
              ACTIVE FACULTY: {instructors.length}
            </span>
          </div>

          <div className="space-y-4">
            {instructors.map((inst) => {
              // Find subjects allocated to this instructor
              const instSubjects = subjects.filter(s => s.instructorId === inst.id);
              return (
                <div key={inst.id} className="bg-slate-900/40 border border-slate-800 rounded-lg p-5 space-y-4 shadow hover:border-slate-750 transition-all">
                  
                  {/* Instructor Bio Profile */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <img 
                        src={inst.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${inst.name}`} 
                        alt={inst.name} 
                        className="w-10 h-10 rounded-full bg-slate-950 border border-slate-850 shrink-0"
                      />
                      <div className="space-y-1">
                        <h4 className="text-sm font-serif font-bold text-slate-200">{inst.name}</h4>
                        <p className="text-[10px] font-mono text-amber-500 font-semibold">{inst.qualification}</p>
                        <p className="text-slate-400 text-xs leading-normal">{inst.specialization}</p>
                      </div>
                    </div>
                    
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase">
                      {inst.status}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-500 flex flex-wrap gap-4 border-t border-b border-slate-850 py-2.5 font-mono">
                    <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-amber-500" /> {inst.phone}</span>
                    <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-amber-500" /> {inst.email}</span>
                    <span className="flex items-center gap-1"><Award className="w-3.5 h-3.5 text-amber-500" /> {inst.experience}</span>
                  </div>

                  {/* Allocated Papers list */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Allocated Syllabus Papers ({instSubjects.length})</span>
                    
                    <div className="space-y-2">
                      {instSubjects.map((sub) => {
                        // Find respective course
                        const sem = semesters.find(s => s.id === sub.semesterId);
                        const course = courses.find(c => c.id === sem?.courseId);
                        return (
                          <div key={sub.id} className="bg-slate-950 p-3 rounded border border-slate-900 flex items-center justify-between gap-4 text-xs font-mono">
                            <div className="space-y-1 truncate mr-2">
                              <div className="flex items-center gap-2">
                                <span className="text-amber-500 font-bold bg-amber-500/5 border border-amber-500/20 px-1.5 py-0.2 rounded text-[10px]">
                                  {sub.code}
                                </span>
                                <span className="text-slate-200 font-semibold truncate">{sub.name}</span>
                              </div>
                              <p className="text-[9px] text-slate-500 truncate">Course Program: {course?.name} ({course?.code})</p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleUnallocate(sub.id, inst.id)}
                              className="p-1.5 bg-slate-900 border border-slate-850 hover:bg-rose-500/10 hover:border-rose-500/20 text-rose-400 rounded shrink-0 cursor-pointer transition-colors"
                              title="Unallocate Faculty Assignment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                      {instSubjects.length === 0 && (
                        <p className="text-xs text-slate-500 italic">No syllabus papers currently allocated to this instructor. Configure one above.</p>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
