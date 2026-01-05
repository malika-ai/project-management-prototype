import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { Calendar, CheckCircle2, Clock, Briefcase, Filter, ArrowRight, User } from 'lucide-react';
import { formatTime } from '../utils/formatTime';
import { Task, Subtask } from '../types';

const Activity: React.FC = () => {
  const { tasks, projects, clients, team } = useApp();
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7days' | '30days'>('7days');

  // Helpers for Date Grouping
  const isToday = (date: Date) => {
      const today = new Date();
      return date.getDate() === today.getDate() &&
             date.getMonth() === today.getMonth() &&
             date.getFullYear() === today.getFullYear();
  }

  const isYesterday = (date: Date) => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return date.getDate() === yesterday.getDate() &&
             date.getMonth() === yesterday.getMonth() &&
             date.getFullYear() === yesterday.getFullYear();
  }

  const isThisWeek = (date: Date) => {
      const now = new Date();
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())); // Start of week (Sunday)
      startOfWeek.setHours(0, 0, 0, 0);
      return date >= startOfWeek;
  }
  
  const isLastWeek = (date: Date) => {
      const now = new Date();
      const startOfThisWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      startOfThisWeek.setHours(0, 0, 0, 0);
      
      const startOfLastWeek = new Date(startOfThisWeek);
      startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
      
      const endOfLastWeek = new Date(startOfThisWeek);
      
      return date >= startOfLastWeek && date < endOfLastWeek;
  }

  const getTaskDate = (task: Task) => {
      // Prioritize completedAt, fallback to createdAt for ordering if completion date missing but marked complete
      return task.completedAt ? new Date(task.completedAt) : new Date(task.createdAt);
  }

  // Derived Data
  const groupedActivity = useMemo(() => {
    // 1. Filter tasks that are completed OR have completed subtasks
    const activeTasks = tasks.filter(t => t.isCompleted || t.subtasks.some(s => s.isCompleted));
    
    // 2. Filter by Date Range (Global Filter)
    const filtered = activeTasks.filter(t => {
        if (dateRange === 'all') return true;
        const date = getTaskDate(t);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (dateRange === 'today') return isToday(date);
        if (dateRange === '7days') return diffDays <= 7;
        if (dateRange === '30days') return diffDays <= 30;
        return true;
    });

    // 3. Group by Time Period
    const groups: Record<string, Task[]> = {
        'Today': [],
        'Yesterday': [],
        'This Week': [],
        'Last Week': [],
        'Older': []
    };

    filtered.forEach(task => {
        const date = getTaskDate(task);
        if (isToday(date)) groups['Today'].push(task);
        else if (isYesterday(date)) groups['Yesterday'].push(task);
        else if (isThisWeek(date)) groups['This Week'].push(task);
        else if (isLastWeek(date)) groups['Last Week'].push(task);
        else groups['Older'].push(task);
    });

    // Sort within groups (Newest first)
    Object.keys(groups).forEach(key => {
        groups[key].sort((a, b) => getTaskDate(b).getTime() - getTaskDate(a).getTime());
    });

    return groups;
  }, [tasks, dateRange]);

  const getClientInfo = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return { name: "Unknown", clientName: "Internal" };
    if (project.clientId) {
      const client = clients.find(c => c.id === project.clientId);
      return { 
          name: project.name,
          clientName: client ? client.businessName : "Internal" 
      };
    }
    return { name: project.name, clientName: 'Internal' };
  };

  const getAssignees = (ids: string[]) => {
      return team.filter(m => ids.includes(m.id));
  }

  // Groups to render in order
  const groupOrder = ['Today', 'Yesterday', 'This Week', 'Last Week', 'Older'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Activity Log</h1>
           <p className="text-gray-500 dark:text-gray-400">Track finished tasks and daily progress.</p>
        </div>
        <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 rounded-xl p-1 border border-gray-200 dark:border-slate-700 shadow-sm">
            <Filter className="w-4 h-4 text-gray-400 ml-2" />
            <select 
                className="bg-transparent border-none text-sm font-medium text-gray-900 dark:text-white focus:ring-0 cursor-pointer py-2 pr-8 pl-2"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
            >
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="all">All Time</option>
            </select>
        </div>
      </div>

      <div className="space-y-8">
          {groupOrder.map(groupName => {
              const groupTasks = groupedActivity[groupName];
              if (groupTasks.length === 0) return null;

              return (
                  <div key={groupName} className="relative">
                       {/* Timeline Line */}
                      <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-gray-200 dark:bg-slate-800"></div>

                      <div className="flex items-center mb-4 relative z-10">
                          <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm border
                             ${groupName === 'Today' ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-800' : 
                               groupName === 'Yesterday' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800' :
                               'bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-gray-400 dark:border-slate-700'
                             }`}>
                              {groupName}
                          </div>
                      </div>

                      <div className="space-y-4 ml-8">
                          {groupTasks.map(task => {
                              const info = getClientInfo(task.projectId);
                              const assignees = getAssignees(task.assignees);
                              const completedSubtasks = task.subtasks.filter(s => s.isCompleted);
                              
                              return (
                                  <GlassCard key={task.id} className="p-4 relative hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors">
                                      {/* Connector Dot */}
                                      <div className="absolute -left-[25px] top-6 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 bg-indigo-500 shadow-sm"></div>

                                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 gap-2">
                                          <div className="flex items-center gap-2">
                                               <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 dark:bg-slate-900 px-2 py-0.5 rounded border border-gray-100 dark:border-slate-700">
                                                   {info.clientName}
                                               </span>
                                               <div className="h-1 w-1 rounded-full bg-gray-300 dark:bg-slate-600"></div>
                                               <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]" title={info.name}>
                                                   {info.name}
                                               </span>
                                          </div>
                                          
                                          <div className="flex items-center text-xs text-gray-400 dark:text-gray-500 gap-3">
                                               {task.completedAt && (
                                                   <span className="flex items-center" title="Completion Time">
                                                       <Clock className="w-3 h-3 mr-1" />
                                                       {new Date(task.completedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                   </span>
                                               )}
                                          </div>
                                      </div>

                                      <div className="flex items-start justify-between">
                                          <div>
                                              <h3 className={`text-base font-bold text-gray-900 dark:text-white flex items-center ${task.isCompleted ? 'line-through decoration-gray-300 dark:decoration-slate-600 text-gray-500 dark:text-gray-400' : ''}`}>
                                                  {task.isCompleted && <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />}
                                                  {task.title}
                                              </h3>
                                              
                                              {/* Subtasks Display */}
                                              {completedSubtasks.length > 0 && (
                                                  <div className="mt-3 space-y-1 bg-gray-50 dark:bg-slate-900/50 p-2 rounded-lg border border-gray-100 dark:border-slate-700/50">
                                                      {completedSubtasks.map(sub => (
                                                          <div key={sub.id} className="flex items-center text-xs text-gray-600 dark:text-gray-300">
                                                              <div className="w-4 h-4 flex items-center justify-center mr-2">
                                                                  <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                                                              </div>
                                                              <span className="line-through decoration-gray-300 dark:decoration-slate-600 opacity-80">{sub.title}</span>
                                                              {sub.completedAt && (
                                                                  <span className="ml-auto text-[10px] text-gray-400">
                                                                      {new Date(sub.completedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                                  </span>
                                                              )}
                                                          </div>
                                                      ))}
                                                  </div>
                                              )}
                                          </div>

                                          <div className="flex flex-col items-end pl-4">
                                               {/* Explicitly showing Name & Avatar for Clarity */}
                                               <div className="flex flex-col items-end gap-1 mb-2">
                                                   {assignees.length > 0 ? assignees.map(m => (
                                                       <div key={m.id} className="flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 px-2 py-1 rounded-full border border-gray-100 dark:border-slate-700">
                                                           <img src={m.avatar} className="w-5 h-5 rounded-full" />
                                                           <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{m.name}</span>
                                                       </div>
                                                   )) : (
                                                       <div className="flex items-center gap-2 text-gray-400">
                                                           <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                                                               <User className="w-3 h-3" />
                                                           </div>
                                                           <span className="text-xs">Unassigned</span>
                                                       </div>
                                                   )}
                                               </div>

                                               <span className="text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded">
                                                   {formatTime(task.timeSpent)}
                                               </span>
                                          </div>
                                      </div>
                                  </GlassCard>
                              );
                          })}
                      </div>
                  </div>
              );
          })}
          
          {Object.values(groupedActivity).every((g: any) => g.length === 0) && (
              <div className="text-center py-20 opacity-50">
                  <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-slate-700" />
                  <p className="text-gray-500 dark:text-gray-400">No activity found for this period.</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default Activity;