import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { UserPlus, Mail, Shield, CalendarDays, Clock, CheckSquare, FileText, X, AlertTriangle, CheckCircle, List, Briefcase, Lock, Eye, EyeOff, Check, RotateCcw, Trash2, Circle } from 'lucide-react';
import { ROLES } from '../constants';
import { Role, TeamMember, Task } from '../types';
import { formatTime } from '../utils/formatTime';
import { motion, AnimatePresence } from 'framer-motion';

const Team: React.FC = () => {
  const { team, addTeamMember, updateTeamMember, deleteTeamMember, currentUser, tasks, projects, clients } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', email: '', password: '', role: 'Sales' as Role });
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7days' | '30days'>('all');
  
  // Visibility Toggle for Passwords
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Reset Password State
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState('');

  // Report Modal State
  const [reportingMember, setReportingMember] = useState<TeamMember | null>(null);
  const [reportTab, setReportTab] = useState<'completed' | 'overdue' | 'pending'>('completed');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addTeamMember(newMember);
    setShowForm(false);
    setNewMember({ name: '', email: '', password: '', role: 'Sales' });
  };

  const togglePassword = (id: string) => {
      setVisiblePasswords(prev => ({
          ...prev,
          [id]: !prev[id]
      }));
  }

  const startResetPassword = (memberId: string) => {
      setResettingId(memberId);
      setTempPassword('');
  }

  const cancelReset = () => {
      setResettingId(null);
      setTempPassword('');
  }

  const saveNewPassword = (member: TeamMember) => {
      if(tempPassword.trim()) {
          updateTeamMember({ ...member, password: tempPassword });
          setResettingId(null);
          setTempPassword('');
      }
  }

  // Updated Handle Delete with stopPropagation
  const handleDelete = (e: React.MouseEvent, id: string, name: string) => {
      e.preventDefault();
      e.stopPropagation(); // Prevents clicking the parent Card
      
      if (window.confirm(`Are you sure you want to delete ${name}?\n\nThis will remove them from the team list permanently.`)) {
          deleteTeamMember(id);
      }
  }
  
  // Helper for Card Stats (Simple version)
  const getMemberSimpleStats = (memberId: string) => {
      const memberTasks = tasks.filter(t => t.assignees.includes(memberId));
      const totalSeconds = memberTasks.reduce((acc, t) => acc + t.timeSpent, 0);
      const completedCount = memberTasks.filter(t => t.isCompleted).length;

      return {
          hours: formatTime(totalSeconds),
          tasks: completedCount
      };
  }

  // Detailed Report Calculation
  const reportStats = useMemo(() => {
      if (!reportingMember) return null;

      const memberId = reportingMember.id;
      const memberTasks = tasks.filter(t => t.assignees.includes(memberId));

      const projectIds = Array.from(new Set(memberTasks.map(t => t.projectId)));
      const clientIds = new Set<string>();
      projectIds.forEach(pid => {
          const project = projects.find(p => p.id === pid);
          if (project && project.clientId) {
              clientIds.add(project.clientId);
          }
      });
      const assignedClientsCount = clientIds.size;
      const totalSeconds = memberTasks.reduce((acc, t) => acc + t.timeSpent, 0);
      const completedTasks = memberTasks.filter(t => t.isCompleted);
      const incompleteTasks = memberTasks.filter(t => !t.isCompleted);
      
      let totalSubtasks = 0;
      let completedSubtasks = 0;
      memberTasks.forEach(t => {
          totalSubtasks += t.subtasks.length;
          completedSubtasks += t.subtasks.filter(s => s.isCompleted).length;
      });

      const now = new Date();
      const overdueTasks = incompleteTasks.filter(t => new Date(t.deadline) < now);
      const pendingTasks = incompleteTasks.filter(t => new Date(t.deadline) >= now);

      return {
          totalTasks: memberTasks.length,
          assignedClientsCount,
          totalSeconds,
          completedTasks,
          completedTasksCount: completedTasks.length,
          totalSubtasks,
          completedSubtasks,
          overdueTasks,
          overdueCount: overdueTasks.length,
          pendingTasks,
          pendingCount: pendingTasks.length
      };
  }, [reportingMember, tasks, projects]);

  const getClientName = (projectId: string) => {
      const project = projects.find(p => p.id === projectId);
      if(!project) return 'Unknown Project';
      if(project.clientId) {
          const client = clients.find(c => c.id === project.clientId);
          return client ? client.businessName : project.name;
      }
      return project.name;
  }

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <div>
           <h1 className="text-3xl font-bold text-gray-900">Team Members</h1>
           <p className="text-gray-500">Manage your internal agency staff.</p>
        </div>
        <div className="flex items-center gap-4">
             <div className="flex items-center space-x-2 bg-white rounded-xl p-1 border border-gray-200 shadow-sm">
                <CalendarDays className="w-4 h-4 text-gray-400 ml-2" />
                <select 
                    className="bg-transparent border-none text-sm font-medium text-gray-900 focus:ring-0 cursor-pointer py-2 pr-8 pl-2"
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value as any)}
                >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="30days">Last 30 Days</option>
                </select>
            </div>
            <button 
              onClick={() => setShowForm(!showForm)}
              className="bg-gray-900 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-black transition-all flex items-center"
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Add Member
            </button>
        </div>
      </div>

      {showForm && (
          <GlassCard className="p-6 max-w-4xl mx-auto mb-8 animate-in fade-in slide-in-from-top-4">
              <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                  <div className="col-span-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Name</label>
                      <input required type="text" className="w-full mt-1 p-2 bg-white/50 border rounded-lg text-gray-900" value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} />
                  </div>
                  <div className="col-span-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Email</label>
                      <input required type="email" className="w-full mt-1 p-2 bg-white/50 border rounded-lg text-gray-900" value={newMember.email} onChange={e => setNewMember({...newMember, email: e.target.value})} />
                  </div>
                  <div className="col-span-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Password</label>
                      <input type="text" placeholder="Default: 123456" className="w-full mt-1 p-2 bg-white/50 border rounded-lg text-gray-900 placeholder-gray-400" value={newMember.password} onChange={e => setNewMember({...newMember, password: e.target.value})} />
                  </div>
                  <div className="col-span-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Role</label>
                      <select className="w-full mt-1 p-2 bg-white/50 border rounded-lg text-gray-900" value={newMember.role} onChange={e => setNewMember({...newMember, role: e.target.value as Role})}>
                          {ROLES.map(role => (
                              <option key={role} value={role}>{role}</option>
                          ))}
                      </select>
                  </div>
                  <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg h-[42px] col-span-1">Add to Team</button>
              </form>
          </GlassCard>
      )}

      <div className="flex flex-col space-y-4">
        {team.map(member => {
            const stats = getMemberSimpleStats(member.id);
            const isVisible = visiblePasswords[member.id];
            const isResetting = resettingId === member.id;
            const isCurrentUser = currentUser?.id === member.id;
            
            return (
              <GlassCard key={member.id} className="p-4 flex items-center justify-between" hoverEffect>
                 <div className="flex items-center space-x-6">
                     <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md">
                         <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                     </div>
                     <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            {member.name}
                            {isCurrentUser && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold uppercase">You</span>}
                        </h3>
                        <div className="flex flex-col gap-1 mb-2">
                            <div className="flex items-center text-gray-500 text-sm">
                                <Mail className="w-3 h-3 mr-2" /> {member.email}
                            </div>
                            
                            {isResetting ? (
                                <div className="flex items-center gap-2 mt-1">
                                    <input 
                                        type="text" 
                                        placeholder="New Password" 
                                        className="text-xs border border-indigo-200 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 w-32"
                                        value={tempPassword}
                                        onChange={e => setTempPassword(e.target.value)}
                                        autoFocus
                                        onClick={e => e.stopPropagation()}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.stopPropagation();
                                                saveNewPassword(member);
                                            }
                                        }}
                                    />
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); saveNewPassword(member); }}
                                        className="bg-green-100 hover:bg-green-200 text-green-700 p-1 rounded transition-colors"
                                        title="Save (Enter)"
                                    >
                                        <Check className="w-3 h-3" />
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); cancelReset(); }}
                                        className="bg-red-100 hover:bg-red-200 text-red-700 p-1 rounded transition-colors"
                                        title="Cancel"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center text-gray-400 text-xs">
                                    <Lock className="w-3 h-3 mr-2" /> 
                                    <span className="font-mono bg-gray-100 px-1 rounded mr-2">
                                        {isVisible ? member.password : '••••••••'}
                                    </span>
                                    <div className="flex items-center border-l border-gray-200 pl-2 ml-1 gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); togglePassword(member.id); }} className="hover:text-indigo-600 transition-colors" title={isVisible ? "Hide" : "Show"}>
                                            {isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); startResetPassword(member.id); }} className="hover:text-orange-600 transition-colors" title="Reset Password">
                                            <RotateCcw className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium text-xs border border-indigo-100 inline-flex items-center">
                            <Shield className="w-3 h-3 mr-1" />
                            {member.role}
                        </span>
                     </div>
                 </div>
                 
                 <div className="flex items-center space-x-8 mr-4">
                     <div className="text-center hidden md:block">
                         <div className="flex items-center justify-center text-gray-400 text-xs uppercase font-bold mb-1">
                             <Clock className="w-3 h-3 mr-1" /> Involved Hours
                         </div>
                         <div className="text-xl font-mono font-bold text-gray-800">{stats.hours}</div>
                     </div>
                     <div className="text-center hidden md:block">
                         <div className="flex items-center justify-center text-gray-400 text-xs uppercase font-bold mb-1">
                             <CheckSquare className="w-3 h-3 mr-1" /> Tasks Done
                         </div>
                         <div className="text-xl font-mono font-bold text-gray-800">{stats.tasks}</div>
                     </div>
                     
                     <div className="flex flex-col gap-2">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setReportingMember(member); }}
                            className="flex flex-col items-center justify-center bg-gray-900 hover:bg-black text-white p-3 rounded-xl transition-colors shadow-lg w-16"
                            title="View Productivity Report"
                        >
                            <FileText className="w-5 h-5 mb-1" />
                            <span className="text-[10px] font-bold uppercase tracking-wide">Report</span>
                        </button>
                        
                        {/* Delete Button (Hidden for Current User) */}
                        {!isCurrentUser && (
                            <button 
                                onClick={(e) => handleDelete(e, member.id, member.name)}
                                className="flex flex-col items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-600 p-2 rounded-xl transition-colors border border-red-100 cursor-pointer z-10"
                                title="Delete Member"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                     </div>
                 </div>
              </GlassCard>
            );
        })}
      </div>

      {/* Productivity Report Modal */}
      <AnimatePresence>
        {reportingMember && reportStats && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div className="flex items-center space-x-4">
                            <img src={reportingMember.avatar} alt={reportingMember.name} className="w-12 h-12 rounded-full border-2 border-white shadow-sm" />
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Productivity Report</h2>
                                <p className="text-sm text-gray-500">{reportingMember.name} • {reportingMember.role}</p>
                            </div>
                        </div>
                        <button onClick={() => setReportingMember(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                            <X className="w-6 h-6 text-gray-500" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {/* Summary Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            {/* Assigned Clients */}
                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Assigned Clients</span>
                                    <Briefcase className="w-5 h-5 text-blue-500" />
                                </div>
                                <div className="text-2xl font-bold text-blue-900">{reportStats.assignedClientsCount}</div>
                                <div className="text-xs text-blue-600 mt-1">Active Projects Involvement</div>
                            </div>

                             {/* Total Time */}
                             <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Total Time</span>
                                    <Clock className="w-5 h-5 text-indigo-500" />
                                </div>
                                <div className="text-2xl font-mono font-bold text-indigo-900">{formatTime(reportStats.totalSeconds)}</div>
                                <div className="text-xs text-indigo-600 mt-1">Recorded hours</div>
                            </div>

                             {/* Task Completion */}
                             <div className="p-4 bg-green-50 border border-green-100 rounded-2xl">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-green-500 uppercase tracking-wider">Completed</span>
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                </div>
                                <div className="text-2xl font-bold text-green-900">{reportStats.completedTasksCount} <span className="text-sm text-green-600 font-normal">Tasks</span></div>
                                <div className="text-xs text-green-600 mt-1">{reportStats.completedSubtasks} / {reportStats.totalSubtasks} Subtasks done</div>
                            </div>

                             {/* Overdue */}
                             <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Overdue</span>
                                    <AlertTriangle className="w-5 h-5 text-red-500" />
                                </div>
                                <div className="text-2xl font-bold text-red-900">{reportStats.overdueCount}</div>
                                <div className="text-xs text-red-600 mt-1">Tasks past deadline</div>
                            </div>
                        </div>

                        {/* Detailed Lists */}
                        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                            {/* Tabs */}
                            <div className="flex border-b border-gray-100">
                                <button 
                                    onClick={() => setReportTab('completed')}
                                    className={`flex-1 py-3 text-sm font-bold transition-colors ${reportTab === 'completed' ? 'bg-white text-green-600 border-b-2 border-green-500' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                >
                                    Completed ({reportStats.completedTasksCount})
                                </button>
                                <button 
                                    onClick={() => setReportTab('overdue')}
                                    className={`flex-1 py-3 text-sm font-bold transition-colors ${reportTab === 'overdue' ? 'bg-white text-red-600 border-b-2 border-red-500' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                >
                                    Overdue ({reportStats.overdueCount})
                                </button>
                                <button 
                                    onClick={() => setReportTab('pending')}
                                    className={`flex-1 py-3 text-sm font-bold transition-colors ${reportTab === 'pending' ? 'bg-white text-indigo-600 border-b-2 border-indigo-500' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                >
                                    Pending ({reportStats.pendingCount})
                                </button>
                            </div>

                            {/* List Content */}
                            <div className="max-h-[300px] overflow-y-auto">
                                {reportTab === 'completed' && (
                                    <TaskList tasks={reportStats.completedTasks} type="completed" getClientName={getClientName} />
                                )}
                                {reportTab === 'overdue' && (
                                    <TaskList tasks={reportStats.overdueTasks} type="overdue" getClientName={getClientName} />
                                )}
                                {reportTab === 'pending' && (
                                    <TaskList tasks={reportStats.pendingTasks} type="pending" getClientName={getClientName} />
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Subcomponent for List rendering to keep code clean
const TaskList: React.FC<{ tasks: Task[], type: 'completed' | 'overdue' | 'pending', getClientName: (id: string) => string }> = ({ tasks, type, getClientName }) => {
    if (tasks.length === 0) {
        return <div className="p-8 text-center text-gray-400 italic text-sm">No tasks found in this category.</div>
    }

    return (
        <div className="divide-y divide-gray-50">
            {tasks.map(task => {
                const completedSub = task.subtasks.filter(s => s.isCompleted).length;
                return (
                    <div key={task.id} className="p-4 hover:bg-gray-50 transition-colors flex flex-col group">
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{getClientName(task.projectId)}</span>
                                    {type === 'overdue' && (
                                        <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">
                                            Due {new Date(task.deadline).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                                <h4 className={`text-sm font-medium text-gray-900 ${type === 'completed' ? 'line-through decoration-gray-300' : ''}`}>
                                    {task.title}
                                </h4>
                            </div>
                            <div className="text-right ml-4">
                                <div className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    {formatTime(task.timeSpent)}
                                </div>
                            </div>
                        </div>
                        
                        {/* Subtasks Detail List */}
                        {task.subtasks.length > 0 && (
                             <div className="mt-2 pl-4 border-l-2 border-gray-100 space-y-1">
                                {task.subtasks.map(sub => (
                                    <div key={sub.id} className="flex items-center text-xs text-gray-500">
                                        {sub.isCompleted ? (
                                            <CheckCircle className="w-3 h-3 text-green-500 mr-2 flex-shrink-0" />
                                        ) : (
                                            <Circle className="w-3 h-3 text-gray-300 mr-2 flex-shrink-0" />
                                        )}
                                        <span className={sub.isCompleted ? "line-through opacity-70" : ""}>
                                            {sub.title}
                                        </span>
                                    </div>
                                ))}
                             </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default Team;