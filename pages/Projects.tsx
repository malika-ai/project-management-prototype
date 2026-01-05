import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { Plus, FolderOpen, Briefcase, Clock, CheckCircle2, User, ChevronRight, X, BarChart3, Layers, Calendar, Shield, Archive, ArchiveRestore } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTime } from '../utils/formatTime';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const Projects: React.FC = () => {
  const { projects, clients, tasks, team, addProject, updateProject, settings } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  
  // View State: 'active' or 'archived'
  const [showArchived, setShowArchived] = useState(false);

  // Helper to aggregate project data (Lightweight for list view)
  const getProjectStats = (projectId: string, clientId?: string) => {
      const client = clientId ? clients.find(c => c.id === clientId) : null;
      const projectTasks = tasks.filter(t => t.projectId === projectId);
      const totalTasks = projectTasks.length;
      const completedTasks = projectTasks.filter(t => t.isCompleted).length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const totalSeconds = projectTasks.reduce((acc, t) => acc + t.timeSpent, 0);
      const memberIds = Array.from(new Set(projectTasks.flatMap(t => t.assignees)));
      const members = team.filter(m => memberIds.includes(m.id));

      return {
          clientName: client?.name || 'Internal Team',
          businessName: client?.businessName || 'Internal Project',
          package: client?.package || 'Internal',
          isInternal: !clientId,
          progress,
          totalSeconds,
          members,
          taskCount: totalTasks,
          completedCount: completedTasks
      };
  };

  // Helper for Detailed Modal Data
  const projectDetails = useMemo(() => {
      if (!selectedProject) return null;
      
      const project = projects.find(p => p.id === selectedProject);
      if (!project) return null;

      const client = project.clientId ? clients.find(c => c.id === project.clientId) : null;
      const projectTasks = tasks.filter(t => t.projectId === project.id);
      
      // Calculate Stats
      const totalSeconds = projectTasks.reduce((acc, t) => acc + t.timeSpent, 0);
      const totalTasks = projectTasks.length;
      const completedTasks = projectTasks.filter(t => t.isCompleted).length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Time Distribution Data (Top 5 Tasks)
      const timeDistribution = projectTasks
        .filter(t => t.timeSpent > 0)
        .map(t => ({
            name: t.title,
            seconds: t.timeSpent,
            formatted: formatTime(t.timeSpent)
        }))
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, 5);

      // Involved Team Members with Contribution
      const involvedMembers = team.map(member => {
          const memberTasks = projectTasks.filter(t => t.assignees.includes(member.id));
          if (memberTasks.length === 0) return null;
          
          // Estimate contribution (simplified: global task time / number of assignees)
          const contribution = memberTasks.reduce((acc, t) => acc + (t.timeSpent / t.assignees.length), 0);
          
          return {
              ...member,
              contributionSeconds: contribution,
              taskCount: memberTasks.length
          };
      }).filter(Boolean) as (typeof team[0] & { contributionSeconds: number, taskCount: number })[];

      return {
          project,
          client,
          tasks: projectTasks,
          stats: { totalSeconds, totalTasks, completedTasks, progress },
          chartData: timeDistribution,
          team: involvedMembers.sort((a, b) => b.contributionSeconds - a.contributionSeconds)
      };
  }, [selectedProject, projects, clients, tasks, team]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addProject(newProject);
    setIsModalOpen(false);
    setNewProject({ name: '', description: '' });
  };

  const handleArchiveToggle = (e: React.MouseEvent, id: string, currentStatus: string) => {
      e.stopPropagation();
      const newStatus = currentStatus === 'Archived' ? 'Active' : 'Archived';
      const action = currentStatus === 'Archived' ? 'restore' : 'archive';
      
      if(window.confirm(`Are you sure you want to ${action} this project?`)) {
          updateProject({ id, status: newStatus as any });
      }
  }

  // Filter projects based on view state
  const displayedProjects = projects.filter(p => {
      if (showArchived) return p.status === 'Archived';
      return p.status !== 'Archived';
  });

  // Dynamic Spacing based on Compact View Setting
  const cardPadding = settings.compactView ? 'p-3' : 'p-6';
  const elementGap = settings.compactView ? 'gap-3' : 'gap-6';

  return (
    <div className={`space-y-6`}>
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Projects</h1>
           <p className="text-gray-500 dark:text-gray-400">Overview of client deliverables and progress.</p>
        </div>
        
        <div className="flex items-center gap-3">
             {/* View Toggle */}
            <div className="flex bg-gray-200/50 dark:bg-slate-800 p-1 rounded-xl">
               <button 
                onClick={() => setShowArchived(false)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${!showArchived ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
               >
                   <FolderOpen className="w-4 h-4" /> Active
               </button>
               <button 
                onClick={() => setShowArchived(true)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${showArchived ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
               >
                   <Archive className="w-4 h-4" /> Archived
               </button>
            </div>

            <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-gray-900 dark:bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-black dark:hover:bg-indigo-700 transition-all flex items-center shadow-lg"
            >
                <Plus className="w-5 h-5 mr-2" />
                New Internal Project
            </button>
        </div>
      </div>

      <div className={`flex flex-col ${settings.compactView ? 'gap-2' : 'gap-4'}`}>
          {displayedProjects.map(project => {
              const stats = getProjectStats(project.id, project.clientId);
              const isArchived = project.status === 'Archived';
              
              return (
                <GlassCard 
                    key={project.id} 
                    onClick={() => setSelectedProject(project.id)}
                    className="p-0 overflow-hidden flex flex-col md:flex-row hover:shadow-md transition-all group cursor-pointer relative" 
                    hoverEffect
                >
                    {/* Archive Button (Absolute positioned) */}
                    <div className="absolute top-2 right-2 md:top-auto md:bottom-2 md:right-2 z-10">
                        <button 
                            onClick={(e) => handleArchiveToggle(e, project.id, project.status)}
                            className={`p-2 rounded-full transition-colors ${isArchived 
                                ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                                : 'bg-gray-100 dark:bg-slate-700 text-gray-400 hover:bg-red-100 hover:text-red-500'}`}
                            title={isArchived ? "Restore Project" : "Archive Project"}
                        >
                            {isArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                        </button>
                    </div>

                    {/* Left Status Stripe */}
                    <div className={`w-full md:w-1.5 h-1 md:h-auto ${isArchived ? 'bg-gray-300 dark:bg-slate-600' : stats.isInternal ? 'bg-gray-400' : 'bg-indigo-500'}`}></div>
                    
                    <div className={`flex-1 ${cardPadding} flex flex-col md:flex-row items-start md:items-center ${elementGap} ${isArchived ? 'opacity-75 grayscale-[0.5]' : ''}`}>
                        
                        {/* Section 1: Main Info */}
                        <div className="flex-1 min-w-[200px]">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate" title={stats.businessName}>
                                    {stats.businessName}
                                </h3>
                                {stats.isInternal && (
                                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold uppercase rounded-md">Internal</span>
                                )}
                            </div>
                            
                            {/* Project Name / Description context */}
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-3 truncate">{project.name}</p>

                            <div className="flex flex-wrap gap-2">
                                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded-md border border-gray-100 dark:border-slate-700">
                                    <User className="w-3 h-3 mr-1.5" />
                                    {stats.clientName}
                                </div>
                                {!stats.isInternal && (
                                    <div className="flex items-center text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md border border-indigo-100 dark:border-indigo-800 font-medium">
                                        <Briefcase className="w-3 h-3 mr-1.5" />
                                        {stats.package}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 2: Team Members */}
                        <div className="flex flex-col gap-1 min-w-[120px]">
                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Involved Team</p>
                            <div className="flex -space-x-3 mt-1">
                                {stats.members.length > 0 ? (
                                    stats.members.slice(0, 5).map(m => (
                                        <div key={m.id} className="w-9 h-9 rounded-full border-2 border-white dark:border-slate-700 shadow-sm overflow-hidden" title={`${m.name} (${m.role})`}>
                                            <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                                        </div>
                                    ))
                                ) : (
                                    <span className="text-xs text-gray-400 italic py-2">No members assigned</span>
                                )}
                                {stats.members.length > 5 && (
                                    <div className="w-9 h-9 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                                        +{stats.members.length - 5}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 3: Progress & Hours */}
                        <div className="flex flex-col gap-3 min-w-[200px] w-full md:w-auto border-t md:border-t-0 md:border-l border-gray-100 dark:border-slate-700 pt-4 md:pt-0 md:pl-6">
                             
                             {/* Progress Bar */}
                             <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Progress</span>
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{stats.progress}%</span>
                                </div>
                                <div className="w-full h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-500 ${
                                        stats.progress === 100 ? 'bg-green-500' : 'bg-indigo-500'
                                    }`} style={{ width: `${stats.progress}%` }}></div>
                                </div>
                                <div className="text-[10px] text-gray-400 mt-1 text-right">
                                    {stats.completedCount} / {stats.taskCount} tasks done
                                </div>
                             </div>

                             {/* Total Hours */}
                             <div className="flex items-center justify-between md:justify-start gap-4">
                                <div className="flex items-center text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-gray-200/50 dark:border-slate-700">
                                    <Clock className="w-4 h-4 mr-2 text-indigo-500 dark:text-indigo-400" />
                                    <span className="font-mono font-bold text-sm">{formatTime(stats.totalSeconds)}</span>
                                </div>
                                <span className={`px-2.5 py-1 text-xs rounded-full font-bold uppercase ${
                                    project.status === 'Active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 
                                    project.status === 'Completed' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 
                                    project.status === 'Archived' ? 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400' :
                                    'bg-gray-100 text-gray-600'
                                }`}>
                                    {project.status}
                                </span>
                             </div>
                        </div>

                         {/* Arrow Action */}
                        <div className="hidden md:flex items-center justify-center pl-2 text-gray-300 dark:text-slate-600 group-hover:text-indigo-500 transition-colors">
                            <ChevronRight className="w-6 h-6" />
                        </div>
                    </div>
                </GlassCard>
              )
          })}
          
          {displayedProjects.length === 0 && (
              <div className="text-center py-20 text-gray-400 bg-white/30 dark:bg-slate-800/30 rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-700">
                  <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p>No {showArchived ? 'archived' : 'active'} projects found.</p>
              </div>
          )}
      </div>

       {/* Add Project Modal */}
       {createPortal(
        <AnimatePresence>
            {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md">
                <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md"
                >
                <div className="p-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Create Internal Project</h2>
                    <form onSubmit={handleAdd} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1">Project Name</label>
                            <input required type="text" className="w-full rounded-lg border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 p-2 text-gray-900 dark:text-white" 
                                value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1">Description</label>
                            <textarea className="w-full rounded-lg border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 p-2 h-24 text-gray-900 dark:text-white" 
                                value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} />
                        </div>
                        <div className="flex justify-end pt-2 space-x-2">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 dark:text-gray-400">Cancel</button>
                            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg">Create Project</button>
                        </div>
                    </form>
                </div>
                </motion.div>
            </div>
            )}
        </AnimatePresence>,
        document.body
       )}
    </div>
  );
};

export default Projects;