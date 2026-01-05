import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { Division, Task, TaskPriority } from '../types';
import { Play, Pause, Plus, AlertCircle, Calendar, Tag, ChevronDown, Check, ListChecks, Trash2, X, Clock, Minimize2, CheckCircle, Layout, UserPlus, Users, User, ShieldAlert, ArrowRight, Save, Layers, ListPlus, History } from 'lucide-react';
import { formatTime } from '../utils/formatTime';
import { motion, AnimatePresence } from 'framer-motion';

const PRIORITY_COLUMNS: TaskPriority[] = ['Urgent', 'High', 'Regular', 'Low'];

const COLUMN_COLORS: Record<string, string> = {
    'Unassigned': 'bg-gray-100 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 dashed',
    'Urgent': 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/30',
    'High': 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-900/30',
    'Regular': 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/30',
    'Low': 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
};

// Tasks that trigger the next stage requirement input
const TRANSITION_TASKS = [
    "Onboarding Process",
    "Collect Feedback #1",
    "Collect Feedback #2"
];

const Tasks: React.FC = () => {
  const { tasks, projects, addTask, toggleTaskTimer, logTaskProgress, updateTaskPriority, updateTaskAssignees, updateTaskDeadline, clients, currentUser, team, toggleSubtask, settings } = useApp();
  
  // View State
  const [viewMode, setViewMode] = useState<'board' | 'completed'>('board');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isActiveSessionOpen, setIsActiveSessionOpen] = useState(false); // New Active Session Modal
  
  // Data States
  const [activeTaskLogId, setActiveTaskLogId] = useState<string | null>(null);
  const [logNote, setLogNote] = useState('');
  const [logPercent, setLogPercent] = useState(0);
  
  // Next Stage Inputs State
  const [nextStageRequirements, setNextStageRequirements] = useState<string[]>([]);
  const [tempNextReq, setTempNextReq] = useState('');
  const [nextStageAddons, setNextStageAddons] = useState<string[]>([]);
  const [tempNextAddon, setTempNextAddon] = useState('');

  // Assignee Temporary State (For Multi-Select before Done)
  const [tempAssignees, setTempAssignees] = useState<string[]>([]);

  // Derived state to ensure reactivity when subtasks change
  const activeTaskForLog = activeTaskLogId ? tasks.find(t => t.id === activeTaskLogId) : null;

  // Sync logPercent with active task percentage when opening log or toggling subtasks
  useEffect(() => {
      if (activeTaskForLog) {
          setLogPercent(activeTaskForLog.completionPercentage);
      }
  }, [activeTaskForLog?.completionPercentage]);

  const [newTaskColumn, setNewTaskColumn] = useState<TaskPriority>('Regular');
  const [showMyTasksOnly, setShowMyTasksOnly] = useState(false);
  const [taskForm, setTaskForm] = useState({ 
      title: '', 
      projectId: '', 
      division: Division.Sales,
      assignees: [] as string[],
      deadline: '',
      priority: 'Regular' as TaskPriority
  });

  const [editingPriorityId, setEditingPriorityId] = useState<string | null>(null);
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
  const [editingDeadlineId, setEditingDeadlineId] = useState<string | null>(null);

  // --- Role Based Logic ---
  const isManagement = ['Manager', 'Leader'].includes(currentUser?.role || '');
  const isSales = currentUser?.role === 'Sales';

  // 1. Sales cannot view Tasks
  if (isSales) {
      return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
              <ShieldAlert className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Restricted Access</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2">Sales team members do not manage operational tasks.</p>
          </div>
      );
  }

  // 2. Column Visibility: Only Manager/Leader see 'Unassigned'
  const visibleColumns = isManagement 
    ? ['Unassigned', ...PRIORITY_COLUMNS] 
    : PRIORITY_COLUMNS;

  // Authorization for assignment (Leader/Manager)
  const canAssign = isManagement;

  const getClientInfo = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return { name: "Unknown", status: "" };
    if (project.clientId) {
      const client = clients.find(c => c.id === project.clientId);
      return { 
          name: client ? client.businessName : project.name, 
          status: client ? client.status : '' 
      };
    }
    return { name: project.name, status: 'Internal' };
  };

  const getAssignees = (memberIds: string[]) => {
      return team.filter(t => memberIds.includes(t.id));
  }

  // --- Handlers ---

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    addTask({ ...taskForm, assignees: [], priority: newTaskColumn });
    setIsAddModalOpen(false);
    setTaskForm({ 
        title: '', 
        projectId: '', 
        division: Division.Sales, 
        assignees: [],
        deadline: '',
        priority: 'Regular'
    });
  };

  const openTaskModal = (col: string) => {
      // Default to Regular if clicking add on Unassigned, or use the col if it's a priority
      const priority = PRIORITY_COLUMNS.includes(col as TaskPriority) ? (col as TaskPriority) : 'Regular';
      setNewTaskColumn(priority);
      setTaskForm({
          ...taskForm, 
          priority: priority, 
          projectId: projects[0]?.id || '',
          assignees: currentUser ? [currentUser.id] : [],
          deadline: new Date().toISOString().split('T')[0]
      });
      setIsAddModalOpen(true);
  }

  const handleToggleTimer = (task: Task) => {
      const isMySessionActive = currentUser && task.activeUserIds.includes(currentUser.id);

      if (isMySessionActive) {
          // I am active -> Pause/Stop -> Proceed to Log
          proceedToLog(task);
      } else {
          // I am NOT active -> Start Timer
          toggleTaskTimer(task.id);
          setActiveTaskLogId(task.id);
          setIsActiveSessionOpen(true); // Open the "Active Session" checklist popup
      }
  }

  // Helper to transition from Active/Running -> Log Modal
  const proceedToLog = (task: Task) => {
      // 1. Stop Timer if running
      const isMySessionActive = currentUser && task.activeUserIds.includes(currentUser.id);
      if (isMySessionActive) toggleTaskTimer(task.id);
      
      // 2. Setup Log Modal Data
      setActiveTaskLogId(task.id);
      
      // Use current calculated percentage from task object (which is updated by toggleSubtask)
      setLogPercent(task.completionPercentage); 
      setLogNote(task.lastProgressNote || '');
      
      // 3. Reset extra inputs
      setNextStageRequirements([]);
      setNextStageAddons([]);
      setTempNextReq('');
      setTempNextAddon('');
      
      // 4. Switch Modals
      setIsActiveSessionOpen(false);
      setIsLogModalOpen(true);
  }

  const handleSaveLog = () => {
      if (activeTaskLogId) {
          logTaskProgress(activeTaskLogId, logNote, logPercent, nextStageRequirements, nextStageAddons);
          setIsLogModalOpen(false);
          setActiveTaskLogId(null);
          setLogNote('');
          setLogPercent(0);
          setNextStageRequirements([]);
          setNextStageAddons([]);
      }
  }

  // Helper for adding requirements to state
  const addNextRequirement = () => {
      if(tempNextReq.trim()) {
          setNextStageRequirements([...nextStageRequirements, tempNextReq.trim()]);
          setTempNextReq('');
      }
  }
  const removeNextRequirement = (idx: number) => {
      setNextStageRequirements(nextStageRequirements.filter((_, i) => i !== idx));
  }

  // Helper for adding addons to state
  const addNextAddon = () => {
      if(tempNextAddon.trim()) {
          setNextStageAddons([...nextStageAddons, tempNextAddon.trim()]);
          setTempNextAddon('');
      }
  }
  const removeNextAddon = (idx: number) => {
      setNextStageAddons(nextStageAddons.filter((_, i) => i !== idx));
  }

  // --- Assignee Management Helpers ---
  const handleOpenAssignDropdown = (taskId: string, currentAssignees: string[]) => {
      setEditingPriorityId(null); 
      // If clicking same task, toggle off. If new task, set ID and init temp state.
      if (assigningTaskId === taskId) {
          setAssigningTaskId(null);
      } else {
          setAssigningTaskId(taskId);
          setTempAssignees([...currentAssignees]); // Deep copy to prevent ref issues
      }
  }

  const toggleTempAssignee = (memberId: string) => {
      setTempAssignees(prev => 
          prev.includes(memberId) 
              ? prev.filter(id => id !== memberId) 
              : [...prev, memberId]
      );
  }

  const handleCommitAssignees = (taskId: string) => {
      updateTaskAssignees(taskId, tempAssignees);
      setAssigningTaskId(null);
  }

  // --- Filtering Logic ---
  // If NOT management: Force filter to my tasks.
  // If Management: Allow toggling between All and My Tasks.
  const effectiveShowMyTasks = !isManagement ? true : showMyTasksOnly;

  const filteredTasks = effectiveShowMyTasks 
    ? tasks.filter(t => t.assignees.includes(currentUser?.id || ''))
    : tasks;

  // Filter for board view (Not completed)
  const boardTasks = filteredTasks.filter(t => !t.isCompleted);
  // Filter for completed view
  const completedTasks = filteredTasks.filter(t => t.isCompleted);

  // Dynamic Spacing based on Compact View Setting
  const cardPadding = settings.compactView ? 'p-2' : 'p-4';
  const stackSpacing = settings.compactView ? 'space-y-2' : 'space-y-3';
  const fontSizeClass = settings.compactView ? 'text-xs' : 'text-sm';

  return (
    <div className="h-full flex flex-col">
       <div className="mb-6 flex justify-between items-end">
        <div className="flex flex-col gap-2">
           <div>
               <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Task Board</h1>
               <p className="text-gray-500 dark:text-gray-400">
                   {isManagement ? "Overview of all agency tasks." : "Your assigned operational tasks."}
               </p>
           </div>
           
           {/* View Toggle */}
           <div className="flex bg-gray-200/50 dark:bg-slate-800 p-1 rounded-xl w-fit mt-1">
               <button 
                onClick={() => setViewMode('board')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'board' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
               >
                   <Layout className="w-4 h-4" /> Active Board
               </button>
               <button 
                onClick={() => setViewMode('completed')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'completed' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
               >
                   <CheckCircle className="w-4 h-4" /> Completed
               </button>
           </div>
        </div>
        <div className="flex items-center gap-4">
            {/* Only Manager/Leader can toggle view to see everyone's tasks */}
            {isManagement && (
                <label className="flex items-center space-x-2 cursor-pointer bg-white/50 dark:bg-slate-800/50 px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700">
                    <input 
                        type="checkbox" 
                        checked={showMyTasksOnly} 
                        onChange={e => setShowMyTasksOnly(e.target.checked)} 
                        className="rounded text-indigo-600 focus:ring-indigo-500 bg-transparent"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">My Tasks Only</span>
                </label>
            )}
            <div className="text-sm text-gray-400 dark:text-gray-500 font-mono bg-gray-100 dark:bg-slate-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700">
                {tasks.reduce((acc, t) => acc + t.activeUserIds.length, 0)} Active Timer(s)
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        {viewMode === 'board' ? (
            // BOARD VIEW
            <div className="flex space-x-6 min-w-[1250px] h-full">
                {visibleColumns.map(column => {
                    const tasksInColumn = boardTasks.filter(t => {
                        if (column === 'Unassigned') return t.assignees.length === 0;
                        return t.priority === column && t.assignees.length > 0;
                    });

                    return (
                        <div key={column} className="flex-1 flex flex-col h-full min-w-[300px]">
                            <div className={`p-3 rounded-xl border mb-4 flex justify-between items-center ${COLUMN_COLORS[column]} ${column === 'Unassigned' ? 'border-dashed' : ''}`}>
                                <div className="flex items-center gap-2">
                                    {column === 'Urgent' && <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />}
                                    {column === 'Unassigned' && <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
                                    <span className={`font-semibold ${column === 'Unassigned' ? 'text-gray-500 dark:text-gray-400 italic' : 'text-gray-800 dark:text-gray-200'}`}>{column}</span>
                                </div>
                                <span className="bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded text-xs font-bold text-gray-600 dark:text-gray-300">
                                    {tasksInColumn.length}
                                </span>
                            </div>

                            <div className={`flex-1 overflow-y-auto pr-2 scrollbar-hide ${stackSpacing}`}>
                                {tasksInColumn.map(task => {
                                    const clientInfo = getClientInfo(task.projectId);
                                    const assignees = getAssignees(task.assignees);
                                    const completedSubtasks = task.subtasks.filter(s => s.isCompleted).length;
                                    const isMySessionActive = currentUser && task.activeUserIds.includes(currentUser.id);
                                    const isAnyoneActive = task.activeUserIds.length > 0;
                                    
                                    const isEditing = assigningTaskId === task.id || editingPriorityId === task.id;

                                    return (
                                        <GlassCard 
                                            key={task.id} 
                                            hoverEffect={!isEditing}
                                            className={`${cardPadding} group border-l-4 transition-all 
                                                ${isAnyoneActive ? 'border-l-green-500 bg-green-50/30 dark:bg-green-900/20' : 'border-l-transparent hover:border-l-indigo-500'}
                                                ${isEditing ? 'z-50 relative shadow-xl ring-2 ring-indigo-500/20' : 'z-0'}
                                            `}
                                        >
                                            {/* Header: Client & Status Tag */}
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                                        {clientInfo.name}
                                                    </span>
                                                    {clientInfo.status && (
                                                        <span className="text-[10px] bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-md border border-gray-200 dark:border-slate-600 w-fit">
                                                            {clientInfo.status}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="relative">
                                                    <button 
                                                        onClick={() => {
                                                            if (!isManagement) return; 
                                                            setAssigningTaskId(null); 
                                                            setEditingPriorityId(editingPriorityId === task.id ? null : task.id)
                                                        }}
                                                        disabled={!isManagement && false} 
                                                        className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded flex items-center gap-1 hover:bg-opacity-80 transition
                                                            ${task.priority === 'Urgent' ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' : 
                                                              task.priority === 'High' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400' : 
                                                              task.priority === 'Regular' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' :
                                                              'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}
                                                    >
                                                        {task.priority} {isManagement && <ChevronDown className="w-3 h-3" />}
                                                    </button>
                                                    
                                                    {/* Priority Dropdown */}
                                                    {editingPriorityId === task.id && isManagement && (
                                                        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 shadow-xl rounded-lg border border-gray-100 dark:border-slate-600 z-50 w-32 overflow-hidden">
                                                            {PRIORITY_COLUMNS.map(p => (
                                                                <button 
                                                                    key={p}
                                                                    onClick={() => {
                                                                        updateTaskPriority(task.id, p);
                                                                        setEditingPriorityId(null);
                                                                    }}
                                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200"
                                                                >
                                                                    {p}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <h4 className={`${fontSizeClass} font-medium text-gray-900 dark:text-gray-100 mb-2 leading-snug`}>{task.title}</h4>

                                            {/* Subtasks in Card - Disabled if not active */}
                                            {task.subtasks.length > 0 && (
                                                <div className={`mb-3 space-y-1 bg-gray-50/50 dark:bg-slate-900/30 p-2 rounded-lg border border-gray-100/50 dark:border-slate-700/50 ${!isMySessionActive ? 'opacity-70' : ''}`}>
                                                    {task.subtasks.map(sub => (
                                                        <label 
                                                            key={sub.id} 
                                                            className={`flex items-start space-x-2 p-0.5 rounded transition-colors ${isMySessionActive ? 'cursor-pointer hover:bg-white/50 dark:hover:bg-slate-700/50' : 'cursor-not-allowed'}`} 
                                                            onClick={(e) => !isMySessionActive && e.preventDefault()}
                                                        >
                                                            <input 
                                                                type="checkbox" 
                                                                checked={sub.isCompleted} 
                                                                onChange={() => toggleSubtask(task.id, sub.id)}
                                                                disabled={!isMySessionActive}
                                                                className={`w-3 h-3 mt-1 rounded text-indigo-600 focus:ring-0 border-gray-300 dark:border-slate-600 ${!isMySessionActive ? 'text-gray-400 bg-gray-100 dark:bg-slate-800' : ''}`}
                                                            />
                                                            <span className={`text-xs leading-tight ${sub.isCompleted ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-700 dark:text-gray-300'}`}>
                                                                {sub.title}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                            
                                            {/* Meta Data Row: Dates & Progress */}
                                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
                                                <div className="flex flex-col gap-0.5">
                                                    {editingDeadlineId === task.id ? (
                                                        <input 
                                                            type="date" 
                                                            className="text-[10px] p-0 border-0 bg-transparent text-gray-900 dark:text-white focus:ring-0 w-24"
                                                            defaultValue={task.deadline.split('T')[0]}
                                                            autoFocus
                                                            onBlur={(e) => {
                                                                updateTaskDeadline(task.id, e.target.value);
                                                                setEditingDeadlineId(null);
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    updateTaskDeadline(task.id, e.currentTarget.value);
                                                                    setEditingDeadlineId(null);
                                                                }
                                                                if (e.key === 'Escape') setEditingDeadlineId(null);
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    ) : (
                                                        <div 
                                                            className="flex items-center text-red-500/80 dark:text-red-400/80 font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 px-1 -ml-1 rounded transition-colors" 
                                                            title="Click to change deadline"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingDeadlineId(task.id);
                                                            }}
                                                        >
                                                            <Calendar className="w-3 h-3 mr-1" />
                                                            <span>{new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}</span>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center text-gray-400" title="Created Date">
                                                        <History className="w-3 h-3 mr-1" />
                                                        <span>{task.createdAt ? new Date(task.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric'}) : '-'}</span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end gap-1">
                                                    {task.subtasks.length > 0 && (
                                                        <div className="flex items-center bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full" title="Subtasks">
                                                            <ListChecks className="w-3 h-3 mr-1 text-gray-500 dark:text-gray-300" />
                                                            <span>{completedSubtasks}/{task.subtasks.length}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-12 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                            <div className="h-full bg-green-500" style={{ width: `${task.completionPercentage}%` }}></div>
                                                        </div>
                                                        <span className="text-[9px] font-mono">{task.completionPercentage}%</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100/50 dark:border-slate-700/50">
                                                {/* Assignees Section */}
                                                <div className="relative flex items-center">
                                                    <div className="flex -space-x-2">
                                                        {assignees.map(member => (
                                                            <img 
                                                                key={member.id} 
                                                                src={member.avatar} 
                                                                alt={member.name} 
                                                                className={`w-6 h-6 rounded-full border-2 border-white dark:border-slate-800 shadow-sm ${task.activeUserIds.includes(member.id) ? 'ring-2 ring-green-500' : ''}`} 
                                                                title={member.name}
                                                            />
                                                        ))}
                                                        {assignees.length === 0 && canAssign && (
                                                           <button 
                                                               onClick={() => handleOpenAssignDropdown(task.id, task.assignees)}
                                                               className="w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-900 hover:text-indigo-600 transition-colors border-2 border-white dark:border-slate-800"
                                                               title="Assign Member"
                                                           >
                                                               <UserPlus className="w-3 h-3" />
                                                           </button>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Assignee Selection Dropdown (Multi-Select with Done button) */}
                                                    {assigningTaskId === task.id && (
                                                        <div className="absolute left-0 top-full mt-2 bg-white dark:bg-slate-800 shadow-xl rounded-lg border border-gray-100 dark:border-slate-600 z-50 w-48 overflow-hidden">
                                                            <div className="p-2 border-b border-gray-100 dark:border-slate-700 text-[10px] text-gray-400 font-bold uppercase tracking-wider">Assign Members</div>
                                                            <div className="max-h-48 overflow-y-auto">
                                                                {team.map(member => {
                                                                    const isSelected = tempAssignees.includes(member.id);
                                                                    return (
                                                                        <button 
                                                                            key={member.id}
                                                                            onClick={() => toggleTempAssignee(member.id)}
                                                                            className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2 ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-200'}`}
                                                                        >
                                                                            <div className={`w-3 h-3 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-slate-500'}`}>
                                                                                {isSelected && <Check className="w-2 h-2 text-white" />}
                                                                            </div>
                                                                            <img src={member.avatar} className="w-5 h-5 rounded-full" />
                                                                            <div className="flex flex-col">
                                                                                <span>{member.name}</span>
                                                                                <span className="text-[9px] text-gray-400">{member.role}</span>
                                                                            </div>
                                                                        </button>
                                                                    )
                                                                })}
                                                            </div>
                                                            <button 
                                                                onClick={() => handleCommitAssignees(task.id)} 
                                                                className="w-full p-2 text-xs font-bold text-center text-white bg-indigo-600 hover:bg-indigo-700 border-t dark:border-slate-700"
                                                            >
                                                                Done
                                                            </button>
                                                        </div>
                                                    )}

                                                    <span className={`text-xs font-mono ml-3 ${isAnyoneActive ? 'text-green-600 dark:text-green-400 font-bold' : 'text-gray-400'}`}>
                                                        {formatTime(task.timeSpent)}
                                                    </span>
                                                </div>
                                                
                                                {/* Action Buttons */}
                                                <div className="flex items-center gap-2">
                                                    {assignees.length > 0 && canAssign && (
                                                         <div className="relative">
                                                            <button 
                                                                onClick={() => handleOpenAssignDropdown(task.id, task.assignees)}
                                                                className="p-1.5 rounded-full text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                                                                title="Manage Assignees"
                                                            >
                                                                <Users className="w-4 h-4" />
                                                            </button>
                                                         </div>
                                                    )}

                                                    <button 
                                                        onClick={() => handleToggleTimer(task)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center
                                                            ${isMySessionActive 
                                                                ? 'bg-red-100 text-red-600 shadow-inner dark:bg-red-900/50 dark:text-red-300' 
                                                                : isAnyoneActive 
                                                                    ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300' 
                                                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600'
                                                            }`}
                                                    >
                                                        {isMySessionActive 
                                                            ? <><Pause className="w-3 h-3 mr-1" /> Stop</> 
                                                            : isAnyoneActive
                                                                ? <><UserPlus className="w-3 h-3 mr-1" /> Join</>
                                                                : <><Play className="w-3 h-3 mr-1" /> Start</>
                                                        }
                                                    </button>
                                                </div>
                                            </div>
                                        </GlassCard>
                                    );
                                })}
                                {/* Add Task Button */}
                                {isManagement && (
                                    <button 
                                        onClick={() => openTaskModal(column)}
                                        className="w-full py-2 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl text-gray-400 dark:text-gray-500 hover:border-indigo-400 hover:text-indigo-500 transition-all text-sm font-medium flex items-center justify-center opacity-60 hover:opacity-100"
                                    >
                                        <Plus className="w-4 h-4 mr-2" /> Add Task
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        ) : (
            // COMPLETED TASKS VIEW (GRID)
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-1">
                 {completedTasks.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-gray-400">
                        <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="text-lg">No completed tasks found.</p>
                    </div>
                 ) : (
                    completedTasks.map(task => {
                        const clientInfo = getClientInfo(task.projectId);
                        const assignees = getAssignees(task.assignees);
                        
                        return (
                            <GlassCard key={task.id} className="p-4 opacity-80 hover:opacity-100 transition-opacity bg-gray-50/50 dark:bg-slate-800/50">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                            {clientInfo.name}
                                        </span>
                                    </div>
                                    <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-[10px] px-2 py-0.5 rounded font-bold uppercase flex items-center">
                                        <Check className="w-3 h-3 mr-1" /> Done
                                    </span>
                                </div>
                                
                                <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 leading-snug line-through decoration-gray-400">{task.title}</h4>
                                
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 bg-white/50 dark:bg-slate-900/50 p-2 rounded-lg border border-gray-100 dark:border-slate-700">
                                    {task.lastProgressNote ? (
                                        <p className="italic">"{task.lastProgressNote}"</p>
                                    ) : (
                                        <p className="italic text-gray-400">No final notes.</p>
                                    )}
                                </div>

                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200/50 dark:border-slate-700/50">
                                    <div className="flex items-center -space-x-2">
                                        {assignees.map(member => (
                                             <img key={member.id} src={member.avatar} alt="Assignee" className="w-6 h-6 rounded-full border border-white dark:border-slate-700 shadow-sm grayscale" />
                                        ))}
                                    </div>
                                    <div className="text-xs font-mono text-gray-500 dark:text-gray-400">
                                        {formatTime(task.timeSpent)}
                                    </div>
                                </div>
                            </GlassCard>
                        )
                    })
                 )}
            </div>
        )}
      </div>

       {/* Add Task Modal */}
       <AnimatePresence>
       {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 dark:bg-black/60 backdrop-blur-sm">
            <motion.div initial={{opacity: 0, scale: 0.9}} animate={{opacity: 1, scale: 1}} exit={{opacity: 0, scale: 0.9}} className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-white/50 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add Task to {newTaskColumn}</h2>
                    <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleAddTask} className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Task Title</label>
                        <input required type="text" className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" 
                            value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Project</label>
                        <select required className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                             value={taskForm.projectId} onChange={e => setTaskForm({...taskForm, projectId: e.target.value})}>
                            <option value="">Select Project</option>
                            {projects.filter(p => p.status === 'Active').map(p => {
                                const info = getClientInfo(p.id);
                                return <option key={p.id} value={p.id}>{info.name} - {p.name}</option>
                            })}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Deadline</label>
                        <input required type="date" className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" 
                            value={taskForm.deadline} onChange={e => setTaskForm({...taskForm, deadline: e.target.value})} />
                    </div>
                    <div className="flex justify-end space-x-2 pt-2">
                        <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md">Create Task</button>
                    </div>
                </form>
            </motion.div>
        </div>
       )}
       </AnimatePresence>

       {/* Active Session Checklist Modal */}
       <AnimatePresence>
        {isActiveSessionOpen && activeTaskForLog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 dark:bg-black/60 backdrop-blur-sm">
                <motion.div initial={{opacity: 0, y: 50}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: 50}} className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-indigo-100 dark:border-slate-700 relative overflow-hidden">
                    {/* Pulsing Background */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-gradient-x"></div>
                    
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold uppercase text-xs tracking-wider mb-1">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                </span>
                                Session Active
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{activeTaskForLog.title}</h2>
                        </div>
                        <button onClick={() => setIsActiveSessionOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" title="Minimize">
                            <Minimize2 className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="mb-8 flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900/50 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
                        <span className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold tracking-widest mb-1">Current Duration</span>
                        <div className="text-4xl font-mono font-bold text-gray-900 dark:text-white tabular-nums">
                            {formatTime(activeTaskForLog.timeSpent)}
                        </div>
                    </div>

                    {/* Active Checklist */}
                    {activeTaskForLog.subtasks.length > 0 && (
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                Subtasks
                            </label>
                            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-1 max-h-48 overflow-y-auto border border-gray-200 dark:border-slate-600">
                                {activeTaskForLog.subtasks.map(sub => (
                                    <div 
                                        key={sub.id} 
                                        className="flex items-center p-2 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-lg cursor-pointer transition-colors"
                                        onClick={() => toggleSubtask(activeTaskForLog.id, sub.id)}
                                    >
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 transition-colors ${
                                            sub.isCompleted 
                                            ? 'bg-green-500 border-green-500' 
                                            : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-500'
                                        }`}>
                                            {sub.isCompleted && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <span className={`text-sm ${sub.isCompleted ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-200'}`}>
                                            {sub.title}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button 
                        onClick={() => proceedToLog(activeTaskForLog)}
                        className="w-full bg-red-500 hover:bg-red-600 text-white p-3 rounded-xl font-bold shadow-lg shadow-red-200 dark:shadow-none transition-all flex items-center justify-center"
                    >
                        <Pause className="w-5 h-5 mr-2 fill-current" /> Stop & Log Progress
                    </button>
                </motion.div>
            </div>
        )}
       </AnimatePresence>

       {/* Log Progress Modal */}
       <AnimatePresence>
        {isLogModalOpen && activeTaskForLog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 dark:bg-black/60 backdrop-blur-sm">
                <motion.div initial={{opacity: 0, scale: 0.95}} animate={{opacity: 1, scale: 1}} exit={{opacity: 0, scale: 0.95}} className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-white/50 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Log Progress</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 truncate">{activeTaskForLog.title}</p>
                    
                    {/* Subtasks List in Log Modal (The Requested Feature) */}
                    {activeTaskForLog.subtasks.length > 0 && (
                        <div className="mb-5">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                Verify Checklist (Check before saving)
                            </label>
                            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-1 max-h-40 overflow-y-auto border border-gray-200 dark:border-slate-600">
                                {activeTaskForLog.subtasks.map(sub => (
                                    <div 
                                        key={sub.id} 
                                        className="flex items-center p-2 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-lg cursor-pointer transition-colors"
                                        onClick={() => toggleSubtask(activeTaskForLog.id, sub.id)}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center mr-3 transition-colors ${
                                            sub.isCompleted 
                                            ? 'bg-green-500 border-green-500' 
                                            : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-500'
                                        }`}>
                                            {sub.isCompleted && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <span className={`text-sm ${sub.isCompleted ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-200'}`}>
                                            {sub.title}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <label className="font-bold text-gray-700 dark:text-gray-300">Completion</label>
                                <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{logPercent}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="100" step="5" 
                                className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                value={logPercent} onChange={e => setLogPercent(parseInt(e.target.value))} 
                            />
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                                <span>Start</span>
                                <span>Halfway</span>
                                <span>Done</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Progress Note</label>
                            <textarea 
                                className="w-full p-3 border border-gray-200 dark:border-slate-600 rounded-xl bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none h-24"
                                placeholder="What did you work on? Any blockers?"
                                value={logNote} onChange={e => setLogNote(e.target.value)}
                            />
                        </div>

                        {/* Transition Logic: If completion is 100% and it's a specific task */}
                        {logPercent === 100 && TRANSITION_TASKS.some(t => activeTaskForLog.title.includes(t)) && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 animate-in fade-in slide-in-from-bottom-2">
                                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-4 flex items-center">
                                    <ArrowRight className="w-4 h-4 mr-1" /> Next Stage Preparation
                                </h3>
                                
                                {/* Section 1: REQUIREMENTS (Subtasks) - Show for Onboarding, Training, OR Feedback */}
                                {(activeTaskForLog.title.includes("Onboarding") || activeTaskForLog.title.includes("Training") || activeTaskForLog.title.includes("Feedback")) && (
                                    <div className="mb-4">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase flex items-center gap-1">
                                                <ListChecks className="w-3 h-3" /> Additional Requirements
                                            </label>
                                            <span className="text-[10px] text-blue-500 bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded font-medium border border-blue-200 dark:border-blue-800">
                                                Becomes Next Subtasks
                                            </span>
                                        </div>
                                        <div className="flex gap-2 mb-2">
                                            <input type="text" className="flex-1 text-sm p-2 rounded border border-blue-200 dark:border-blue-700 dark:bg-slate-800 dark:text-white" placeholder="New requirement..." 
                                                value={tempNextReq} onChange={e => setTempNextReq(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNextRequirement())} />
                                            <button type="button" onClick={addNextRequirement} className="bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-3 rounded text-xs font-bold">Add</button>
                                        </div>
                                        <div className="space-y-1">
                                            {nextStageRequirements.map((req, i) => (
                                                <div key={i} className="flex justify-between items-center bg-white dark:bg-slate-800 p-1.5 rounded text-xs text-blue-900 dark:text-blue-200 border border-blue-100 dark:border-blue-900">
                                                    <span>{req}</span>
                                                    <button type="button" onClick={() => removeNextRequirement(i)}><X className="w-3 h-3" /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Section 2: ADD-ONS (New Tasks) - Show for Onboarding or Feedback */}
                                {(activeTaskForLog.title.includes("Onboarding") || activeTaskForLog.title.includes("Feedback")) && (
                                    <div className="pt-3 border-t border-blue-200 dark:border-blue-800">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-xs font-bold text-purple-600 dark:text-purple-400 uppercase flex items-center gap-1">
                                                <ListPlus className="w-3 h-3" /> New Add-ons / Upsells
                                            </label>
                                             <span className="text-[10px] text-purple-500 bg-purple-100 dark:bg-purple-900/40 px-1.5 py-0.5 rounded font-medium border border-purple-200 dark:border-purple-800">
                                                Becomes New Tasks
                                            </span>
                                        </div>
                                        <div className="flex gap-2 mb-2">
                                            <input type="text" className="flex-1 text-sm p-2 rounded border border-purple-200 dark:border-purple-700 dark:bg-slate-800 dark:text-white focus:ring-purple-500 focus:border-purple-500" placeholder="Potential add-on..." 
                                                value={tempNextAddon} onChange={e => setTempNextAddon(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNextAddon())} />
                                            <button type="button" onClick={addNextAddon} className="bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 px-3 rounded text-xs font-bold">Add</button>
                                        </div>
                                        <div className="space-y-1">
                                            {nextStageAddons.map((addon, i) => (
                                                <div key={i} className="flex justify-between items-center bg-white dark:bg-slate-800 p-1.5 rounded text-xs text-purple-900 dark:text-purple-200 border border-purple-100 dark:border-purple-900">
                                                    <span>{addon}</span>
                                                    <button type="button" onClick={() => removeNextAddon(i)}><X className="w-3 h-3" /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end pt-4">
                            <button 
                                onClick={handleSaveLog}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex justify-center items-center"
                            >
                                <Save className="w-4 h-4 mr-2" /> Save Log & {logPercent === 100 ? 'Complete' : 'Close'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        )}
       </AnimatePresence>
    </div>
  );
};

export default Tasks;