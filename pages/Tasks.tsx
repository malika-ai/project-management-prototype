import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { Division, Task, TaskPriority } from '../types';
import { Play, Pause, Plus, AlertCircle, Calendar, Tag, ChevronDown, Check, ListChecks, Trash2, X, Clock, Minimize2, CheckCircle, Layout, UserPlus, Users, User } from 'lucide-react';
import { formatTime } from '../utils/formatTime';
import { motion, AnimatePresence } from 'framer-motion';

const PRIORITY_COLUMNS: TaskPriority[] = ['Urgent', 'High', 'Regular', 'Low'];
const ALL_COLUMNS = ['Unassigned', ...PRIORITY_COLUMNS];

const COLUMN_COLORS: Record<string, string> = {
    'Unassigned': 'bg-gray-100 border-gray-200 dashed',
    'Urgent': 'bg-red-50 border-red-200',
    'High': 'bg-orange-50 border-orange-200',
    'Regular': 'bg-blue-50 border-blue-200',
    'Low': 'bg-slate-50 border-slate-200'
};

// Tasks that trigger the next stage requirement input
const TRANSITION_TASKS = [
    "Onboarding Process",
    "Collect Feedback #1",
    "Collect Feedback #2"
];

const Tasks: React.FC = () => {
  const { tasks, projects, addTask, toggleTaskTimer, logTaskProgress, updateTaskPriority, assignTask, clients, currentUser, team, toggleSubtask } = useApp();
  
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

  // Derived state to ensure reactivity when subtasks change
  const activeTaskForLog = activeTaskLogId ? tasks.find(t => t.id === activeTaskLogId) : null;

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

  // Authorization for assignment
  const canAssign = currentUser?.role === 'Manager' || currentUser?.role === 'Leader';

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

  const filteredTasks = showMyTasksOnly 
    ? tasks.filter(t => t.assignees.includes(currentUser?.id || ''))
    : tasks;

  // Filter for board view (Not completed)
  const boardTasks = filteredTasks.filter(t => !t.isCompleted);
  // Filter for completed view
  const completedTasks = filteredTasks.filter(t => t.isCompleted);

  return (
    <div className="h-full flex flex-col">
       <div className="mb-6 flex justify-between items-end">
        <div className="flex flex-col gap-2">
           <div>
               <h1 className="text-3xl font-bold text-gray-900">Task Board</h1>
               <p className="text-gray-500">Prioritize work by Urgency.</p>
           </div>
           
           {/* View Toggle */}
           <div className="flex bg-gray-200/50 p-1 rounded-xl w-fit mt-1">
               <button 
                onClick={() => setViewMode('board')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'board' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
               >
                   <Layout className="w-4 h-4" /> Active Board
               </button>
               <button 
                onClick={() => setViewMode('completed')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'completed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
               >
                   <CheckCircle className="w-4 h-4" /> Completed
               </button>
           </div>
        </div>
        <div className="flex items-center gap-4">
            <label className="flex items-center space-x-2 cursor-pointer bg-white/50 px-4 py-2 rounded-xl border border-gray-200">
                <input 
                    type="checkbox" 
                    checked={showMyTasksOnly} 
                    onChange={e => setShowMyTasksOnly(e.target.checked)} 
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">My Tasks Only</span>
            </label>
            <div className="text-sm text-gray-400 font-mono bg-gray-100 px-3 py-2 rounded-lg">
                {tasks.reduce((acc, t) => acc + t.activeUserIds.length, 0)} Active Timer(s)
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        {viewMode === 'board' ? (
            // BOARD VIEW
            <div className="flex space-x-6 min-w-[1250px] h-full">
                {ALL_COLUMNS.map(column => {
                    // Filter Logic:
                    // If 'Unassigned', show tasks with NO assignees array or empty.
                    // If 'Urgent' etc, show tasks WITH assignees AND matching priority.
                    const tasksInColumn = boardTasks.filter(t => {
                        if (column === 'Unassigned') return t.assignees.length === 0;
                        return t.assignees.length > 0 && t.priority === column;
                    });

                    return (
                        <div key={column} className="flex-1 flex flex-col h-full min-w-[300px]">
                            <div className={`p-3 rounded-xl border mb-4 flex justify-between items-center ${COLUMN_COLORS[column]} ${column === 'Unassigned' ? 'border-dashed' : ''}`}>
                                <div className="flex items-center gap-2">
                                    {column === 'Urgent' && <AlertCircle className="w-4 h-4 text-red-600" />}
                                    {column === 'Unassigned' && <Users className="w-4 h-4 text-gray-500" />}
                                    <span className={`font-semibold ${column === 'Unassigned' ? 'text-gray-500 italic' : 'text-gray-800'}`}>{column}</span>
                                </div>
                                <span className="bg-white/50 px-2 py-0.5 rounded text-xs font-bold text-gray-600">
                                    {tasksInColumn.length}
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                                {tasksInColumn.map(task => {
                                    const clientInfo = getClientInfo(task.projectId);
                                    const assignees = getAssignees(task.assignees);
                                    const completedSubtasks = task.subtasks.filter(s => s.isCompleted).length;
                                    const isMySessionActive = currentUser && task.activeUserIds.includes(currentUser.id);
                                    const isAnyoneActive = task.activeUserIds.length > 0;
                                    
                                    // NEW: Check if this specific card is being edited (Priority or Assignment dropdown open)
                                    const isEditing = assigningTaskId === task.id || editingPriorityId === task.id;

                                    return (
                                        <GlassCard 
                                            key={task.id} 
                                            // FIX: Add z-index: 50 when editing, and relative position. 
                                            // Disable hover effect when editing to prevent jitter.
                                            hoverEffect={!isEditing}
                                            className={`p-4 group border-l-4 transition-all 
                                                ${isAnyoneActive ? 'border-l-green-500 bg-green-50/30' : 'border-l-transparent hover:border-l-indigo-500'}
                                                ${isEditing ? 'z-50 relative shadow-xl ring-2 ring-indigo-500/20' : 'z-0'}
                                            `}
                                        >
                                            {/* Header: Client & Status Tag */}
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs font-bold text-indigo-600">
                                                        {clientInfo.name}
                                                    </span>
                                                    {clientInfo.status && (
                                                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md border border-gray-200 w-fit">
                                                            {clientInfo.status}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="relative">
                                                    <button 
                                                        onClick={() => {
                                                            setAssigningTaskId(null); // Close other dropdown
                                                            setEditingPriorityId(editingPriorityId === task.id ? null : task.id)
                                                        }}
                                                        className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded flex items-center gap-1 hover:bg-opacity-80 transition
                                                            ${task.priority === 'Urgent' ? 'bg-red-100 text-red-600' : 
                                                              task.priority === 'High' ? 'bg-orange-100 text-orange-600' : 
                                                              task.priority === 'Regular' ? 'bg-blue-100 text-blue-600' :
                                                              'bg-slate-100 text-slate-600'}`}
                                                    >
                                                        {task.priority} <ChevronDown className="w-3 h-3" />
                                                    </button>
                                                    
                                                    {/* Priority Dropdown */}
                                                    {editingPriorityId === task.id && (
                                                        <div className="absolute right-0 top-full mt-1 bg-white shadow-xl rounded-lg border border-gray-100 z-50 w-32 overflow-hidden">
                                                            {PRIORITY_COLUMNS.map(p => (
                                                                <button 
                                                                    key={p}
                                                                    onClick={() => {
                                                                        updateTaskPriority(task.id, p);
                                                                        setEditingPriorityId(null);
                                                                    }}
                                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700"
                                                                >
                                                                    {p}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <h4 className="text-sm font-medium text-gray-900 mb-2 leading-snug">{task.title}</h4>

                                            {/* Subtasks in Card - Disabled if not active */}
                                            {task.subtasks.length > 0 && (
                                                <div className={`mb-3 space-y-1 bg-gray-50/50 p-2 rounded-lg border border-gray-100/50 ${!isMySessionActive ? 'opacity-70' : ''}`}>
                                                    {task.subtasks.map(sub => (
                                                        <label 
                                                            key={sub.id} 
                                                            className={`flex items-start space-x-2 p-0.5 rounded transition-colors ${isMySessionActive ? 'cursor-pointer hover:bg-white/50' : 'cursor-not-allowed'}`} 
                                                            onClick={(e) => !isMySessionActive && e.preventDefault()}
                                                        >
                                                            <input 
                                                                type="checkbox" 
                                                                checked={sub.isCompleted} 
                                                                onChange={() => toggleSubtask(task.id, sub.id)}
                                                                disabled={!isMySessionActive}
                                                                className={`w-3 h-3 mt-1 rounded text-indigo-600 focus:ring-0 border-gray-300 ${!isMySessionActive ? 'text-gray-400 bg-gray-100' : ''}`}
                                                            />
                                                            <span className={`text-xs leading-tight ${sub.isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                                                {sub.title}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                            
                                            <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                                                <div className="flex items-center">
                                                    <Calendar className="w-3 h-3 mr-1" />
                                                    <span>{new Date(task.deadline).toLocaleDateString()}</span>
                                                </div>
                                                {task.subtasks.length > 0 && (
                                                    <div className="flex items-center bg-gray-100 px-2 py-0.5 rounded-full" title="Subtasks">
                                                        <ListChecks className="w-3 h-3 mr-1 text-gray-500" />
                                                        <span>{completedSubtasks}/{task.subtasks.length}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1">
                                                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-green-500" style={{ width: `${task.completionPercentage}%` }}></div>
                                                    </div>
                                                    <span className="text-[10px] font-mono">{task.completionPercentage}%</span>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100/50">
                                                {/* Assignees Section */}
                                                <div className="relative flex items-center">
                                                    <div className="flex -space-x-2">
                                                        {assignees.map(member => (
                                                            <img 
                                                                key={member.id} 
                                                                src={member.avatar} 
                                                                alt={member.name} 
                                                                className={`w-6 h-6 rounded-full border-2 border-white shadow-sm ${task.activeUserIds.includes(member.id) ? 'ring-2 ring-green-500' : ''}`} 
                                                                title={member.name}
                                                            />
                                                        ))}
                                                        {assignees.length === 0 && canAssign && (
                                                           <button 
                                                               onClick={() => {
                                                                   setEditingPriorityId(null); // Close other dropdown
                                                                   setAssigningTaskId(assigningTaskId === task.id ? null : task.id)
                                                               }}
                                                               className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-indigo-100 hover:text-indigo-600 transition-colors border-2 border-white"
                                                               title="Assign Member"
                                                           >
                                                               <UserPlus className="w-3 h-3" />
                                                           </button>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Assignee Selection Dropdown (Multi-Select) */}
                                                    {assigningTaskId === task.id && (
                                                        <div className="absolute left-0 top-full mt-2 bg-white shadow-xl rounded-lg border border-gray-100 z-50 w-48 overflow-hidden">
                                                            <div className="p-2 border-b border-gray-100 text-[10px] text-gray-400 font-bold uppercase tracking-wider">Assign Members</div>
                                                            <div className="max-h-48 overflow-y-auto">
                                                                {team.map(member => {
                                                                    const isAssigned = task.assignees.includes(member.id);
                                                                    return (
                                                                        <button 
                                                                            key={member.id}
                                                                            onClick={() => {
                                                                                assignTask(task.id, member.id);
                                                                                // Keep dropdown open for multi-select
                                                                            }}
                                                                            className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 ${isAssigned ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}`}
                                                                        >
                                                                            <div className={`w-3 h-3 rounded border flex items-center justify-center ${isAssigned ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                                                                {isAssigned && <Check className="w-2 h-2 text-white" />}
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
                                                            <button onClick={() => setAssigningTaskId(null)} className="w-full p-2 text-xs text-center text-gray-500 border-t hover:bg-gray-50">Done</button>
                                                        </div>
                                                    )}

                                                    <span className={`text-xs font-mono ml-3 ${isAnyoneActive ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
                                                        {formatTime(task.timeSpent)}
                                                    </span>
                                                </div>
                                                
                                                {/* Action Buttons */}
                                                <div className="flex items-center gap-2">
                                                    {/* Assign Button (Visible if assigned, for changing assignee) - Only for Leaders/Managers */}
                                                    {assignees.length > 0 && canAssign && (
                                                         <div className="relative">
                                                            <button 
                                                                onClick={() => {
                                                                    setEditingPriorityId(null); // Close other dropdown
                                                                    setAssigningTaskId(assigningTaskId === task.id ? null : task.id)
                                                                }}
                                                                className="p-1.5 rounded-full text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                                title="Manage Assignees"
                                                            >
                                                                <Users className="w-4 h-4" />
                                                            </button>
                                                            {/* Dropdown Reused Logic - rendered above based on state */}
                                                         </div>
                                                    )}

                                                    <button 
                                                        onClick={() => handleToggleTimer(task)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center
                                                            ${isMySessionActive 
                                                                ? 'bg-red-100 text-red-600 shadow-inner' 
                                                                : isAnyoneActive 
                                                                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                                                    : 'bg-gray-100 text-gray-600 hover:bg-indigo-600 hover:text-white'
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
                                <button 
                                    onClick={() => openTaskModal(column)}
                                    className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-all text-sm font-medium flex items-center justify-center opacity-60 hover:opacity-100"
                                >
                                    <Plus className="w-4 h-4 mr-2" /> Add Task
                                </button>
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
                            <GlassCard key={task.id} className="p-4 opacity-80 hover:opacity-100 transition-opacity bg-gray-50/50">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs font-bold text-gray-500">
                                            {clientInfo.name}
                                        </span>
                                    </div>
                                    <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase flex items-center">
                                        <Check className="w-3 h-3 mr-1" /> Done
                                    </span>
                                </div>
                                
                                <h4 className="text-sm font-medium text-gray-800 mb-2 leading-snug line-through decoration-gray-400">{task.title}</h4>
                                
                                <div className="text-xs text-gray-500 mb-3 bg-white/50 p-2 rounded-lg border border-gray-100">
                                    {task.lastProgressNote ? (
                                        <p className="italic">"{task.lastProgressNote}"</p>
                                    ) : (
                                        <p className="italic text-gray-400">No final notes.</p>
                                    )}
                                </div>

                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200/50">
                                    <div className="flex items-center -space-x-2">
                                        {assignees.map(member => (
                                             <img key={member.id} src={member.avatar} alt="Assignee" className="w-6 h-6 rounded-full border border-white shadow-sm grayscale" />
                                        ))}
                                    </div>
                                    <div className="text-xs font-mono text-gray-500">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div initial={{opacity: 0, scale: 0.9}} animate={{opacity: 1, scale: 1}} className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <h2 className="text-lg font-bold mb-4">Add Task to {newTaskColumn}</h2>
                <form onSubmit={handleAddTask} className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Project / Client</label>
                        <select required className="w-full p-2 border rounded-lg bg-gray-50 text-gray-900" 
                            value={taskForm.projectId} onChange={e => setTaskForm({...taskForm, projectId: e.target.value})}>
                            <option value="">Select Project</option>
                            {projects.map(p => {
                                const client = clients.find(c => c.id === p.clientId);
                                return <option key={p.id} value={p.id}>{client ? `${client.businessName} - ` : ''}{p.name}</option>
                            })}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Task Title</label>
                        <input required type="text" className="w-full p-2 border rounded-lg bg-gray-50 text-gray-900" 
                            value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Deadline</label>
                            <input required type="date" className="w-full p-2 border rounded-lg bg-gray-50 text-gray-900" 
                                value={taskForm.deadline} onChange={e => setTaskForm({...taskForm, deadline: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Division</label>
                            <select className="w-full p-2 border rounded-lg bg-gray-50 text-gray-900"
                                value={taskForm.division} onChange={e => setTaskForm({...taskForm, division: e.target.value as Division})}>
                                {Object.values(Division).map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    {/* Note: In add modal, we just allow assigning self or no one initially for simplicity, or we could add multi-select here too */}
                    <div className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded">
                        Note: You can assign multiple members after creating the task.
                    </div>

                    <div className="flex justify-end space-x-2 pt-2">
                        <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-gray-500">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Create</button>
                    </div>
                </form>
            </motion.div>
        </div>
       )}
       </AnimatePresence>

       {/* Active Session Modal (Shows Subtasks & Stop Button) */}
       <AnimatePresence>
        {isActiveSessionOpen && activeTaskForLog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
                <motion.div initial={{opacity: 0, y: 50}} animate={{opacity: 1, y: 0}} className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border-t-4 border-indigo-500">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="flex items-center space-x-2 mb-1">
                                <span className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                </span>
                                <span className="text-xs font-bold text-green-600 uppercase tracking-wider">Session Active</span>
                            </div>
                            <h2 className="text-lg font-bold text-gray-900">{activeTaskForLog.title}</h2>
                            <div className="flex items-center text-gray-500 text-sm mt-1">
                                <Clock className="w-4 h-4 mr-1" />
                                <span className="font-mono">{formatTime(activeTaskForLog.timeSpent)}</span>
                            </div>
                            <div className="mt-2 text-xs text-gray-400">
                                {activeTaskForLog.activeUserIds.length > 1 && (
                                    <span>{activeTaskForLog.activeUserIds.length} people tracking this task.</span>
                                )}
                            </div>
                        </div>
                        <button onClick={() => setIsActiveSessionOpen(false)} className="text-gray-400 hover:text-gray-600" title="Minimize (Keep Running)">
                            <Minimize2 className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 max-h-60 overflow-y-auto">
                            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                                <ListChecks className="w-4 h-4 mr-2" />
                                Session Checklist
                            </h3>
                            {activeTaskForLog.subtasks.length > 0 ? (
                                <div className="space-y-2">
                                    {activeTaskForLog.subtasks.map(subtask => (
                                        <label key={subtask.id} className="flex items-start space-x-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200">
                                            <input 
                                                type="checkbox" 
                                                checked={subtask.isCompleted} 
                                                onChange={() => toggleSubtask(activeTaskForLog.id, subtask.id)}
                                                className="w-5 h-5 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" 
                                            />
                                            <span className={`text-sm leading-tight ${subtask.isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                                {subtask.title}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 italic">No checklist items.</p>
                            )}
                        </div>

                        <button 
                            onClick={() => proceedToLog(activeTaskForLog)}
                            className="w-full py-4 bg-red-50 text-red-600 rounded-xl font-bold flex items-center justify-center hover:bg-red-100 transition-colors"
                        >
                            <Pause className="w-5 h-5 mr-2 fill-current" />
                            Stop Timer & Log Progress
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
       </AnimatePresence>

       {/* Log Progress Modal */}
       <AnimatePresence>
        {isLogModalOpen && activeTaskForLog && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
                <motion.div initial={{opacity: 0, scale: 0.95}} animate={{opacity: 1, scale: 1}} className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">Log Progress</h2>
                    <p className="text-sm text-gray-500 mb-4">{activeTaskForLog.title}</p>
                    
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between mb-1">
                                <label className="text-sm font-medium text-gray-700">Completion</label>
                                <span className="text-sm font-bold text-indigo-600">{logPercent}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                step="5"
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                value={logPercent} 
                                onChange={(e) => setLogPercent(parseInt(e.target.value))} 
                            />
                            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                <span>0%</span>
                                <span>50%</span>
                                <span>Done (100%)</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Progress Note</label>
                            <textarea 
                                className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900"
                                rows={3}
                                placeholder="What did you work on?"
                                value={logNote}
                                onChange={(e) => setLogNote(e.target.value)}
                            ></textarea>
                        </div>

                        {TRANSITION_TASKS.includes(activeTaskForLog.title) && (
                            <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 space-y-3">
                                <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center">
                                    <ListChecks className="w-3 h-3 mr-1" /> Next Stage Setup
                                </h4>
                                
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Add Requirements (Subtasks)</label>
                                    <div className="flex gap-1 mb-2">
                                        <input 
                                            type="text" 
                                            className="flex-1 p-2 text-xs border rounded-lg text-gray-900" 
                                            placeholder="New Requirement..."
                                            value={tempNextReq}
                                            onChange={e => setTempNextReq(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNextRequirement())}
                                        />
                                        <button onClick={addNextRequirement} className="bg-indigo-200 text-indigo-700 px-3 rounded-lg text-xs font-bold">+</button>
                                    </div>
                                    <div className="space-y-1">
                                        {nextStageRequirements.map((req, i) => (
                                            <div key={i} className="flex justify-between items-center text-xs bg-white p-1.5 rounded border border-indigo-100 text-indigo-600">
                                                <span>{req}</span>
                                                <button onClick={() => removeNextRequirement(i)}><X className="w-3 h-3 text-red-400" /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Add-ons (New Tasks)</label>
                                    <div className="flex gap-1 mb-2">
                                        <input 
                                            type="text" 
                                            className="flex-1 p-2 text-xs border rounded-lg text-gray-900" 
                                            placeholder="New Add-on..."
                                            value={tempNextAddon}
                                            onChange={e => setTempNextAddon(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNextAddon())}
                                        />
                                        <button onClick={addNextAddon} className="bg-purple-200 text-purple-700 px-3 rounded-lg text-xs font-bold">+</button>
                                    </div>
                                    <div className="space-y-1">
                                        {nextStageAddons.map((addon, i) => (
                                            <div key={i} className="flex justify-between items-center text-xs bg-white p-1.5 rounded border border-purple-100 text-purple-600">
                                                <span>{addon}</span>
                                                <button onClick={() => removeNextAddon(i)}><X className="w-3 h-3 text-red-400" /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setIsLogModalOpen(false)} className="flex-1 py-2.5 text-gray-500 font-medium text-sm hover:bg-gray-50 rounded-xl transition-colors">Cancel</button>
                            <button onClick={handleSaveLog} className="flex-1 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">Save Log</button>
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