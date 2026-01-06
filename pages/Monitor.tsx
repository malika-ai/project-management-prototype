import React from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { formatTime } from '../utils/formatTime';
import { Pause, Activity, Zap, Coffee } from 'lucide-react';
import { motion } from 'framer-motion';
import { TimerDisplay } from '../components/ui/TimerDisplay';

const MotionDiv = motion.div as any;

const Monitor: React.FC = () => {
  const { tasks, toggleTaskTimer, projects, clients, team, currentUser } = useApp();
  const activeTasks = tasks.filter(t => t.activeUserIds.length > 0);

  const getContextInfo = (projectId: string) => {
      const project = projects.find(p => p.id === projectId);
      const client = project?.clientId ? clients.find(c => c.id === project.clientId) : null;
      return { 
          projectName: project?.name || 'Unknown Project',
          clientName: client?.businessName || 'Internal'
      };
  };

  const getActiveMembers = (activeUserIds: string[]) => {
      return team.filter(m => activeUserIds.includes(m.id));
  }

  // Calculate Idle Members
  // Flatten all active User IDs from all active tasks
  const allActiveUserIds = activeTasks.flatMap(t => t.activeUserIds);
  const idleMembers = team.filter(m => !allActiveUserIds.includes(m.id));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center p-3 bg-red-50 rounded-full mb-4">
            <Activity className="w-8 h-8 text-red-500 animate-pulse" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Live Monitor</h1>
        <p className="text-gray-500">Real-time activity tracking.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Tasks Column */}
          <div className="lg:col-span-2 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <Zap className="w-5 h-5 mr-2 text-indigo-600" /> Active Sessions ({activeTasks.length})
              </h2>
              {activeTasks.length === 0 ? (
                  <div className="text-center py-20 opacity-50 border-2 border-dashed border-gray-200 rounded-2xl">
                      <p className="text-xl text-gray-400">No active timers running.</p>
                  </div>
              ) : (
                  activeTasks.map(task => {
                      const context = getContextInfo(task.projectId);
                      const activeMembers = getActiveMembers(task.activeUserIds);
                      const isMeActive = currentUser && task.activeUserIds.includes(currentUser.id);
                      
                      return (
                        <MotionDiv layout key={task.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                            <GlassCard className="p-6 border-l-4 border-l-red-500">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-start space-x-4">
                                        <div className="flex -space-x-3 pt-2">
                                            {activeMembers.map(m => (
                                                <div key={m.id} className="w-10 h-10 rounded-full overflow-hidden border-2 border-red-100 flex-shrink-0" title={m.name}>
                                                    <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                                                </div>
                                            ))}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-medium text-gray-800 leading-tight mt-1">{task.title}</h3>
                                            <p className="text-xs text-gray-400 mt-1">
                                                {activeMembers.map(m => m.name).join(', ')} working now.
                                            </p>
                                            <div className="flex flex-wrap gap-2 items-center text-xs text-gray-500 mt-2">
                                                <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{context.clientName}</span>
                                                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{context.projectName}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="text-right">
                                        <div className="text-3xl font-mono font-bold text-gray-800 tabular-nums">
                                            <TimerDisplay task={task} />
                                        </div>
                                        {isMeActive && (
                                            <button 
                                                onClick={() => toggleTaskTimer(task.id)}
                                                className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium flex items-center justify-end"
                                            >
                                                <Pause className="w-4 h-4 mr-1 fill-current" /> Stop My Timer
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </GlassCard>
                        </MotionDiv>
                      );
                  })
              )}
          </div>

          {/* Idle Members Column */}
          <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <Coffee className="w-5 h-5 mr-2 text-gray-400" /> Idle Members ({idleMembers.length})
              </h2>
              <div className="grid grid-cols-1 gap-3">
                  {idleMembers.map(member => (
                      <GlassCard key={member.id} className="p-3 flex items-center space-x-3 opacity-70 hover:opacity-100 transition-opacity">
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 filter grayscale">
                              <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                          </div>
                          <div>
                              <p className="text-sm font-bold text-gray-700">{member.name}</p>
                              <p className="text-xs text-gray-500">{member.role}</p>
                          </div>
                      </GlassCard>
                  ))}
                  {idleMembers.length === 0 && (
                      <p className="text-sm text-gray-400 italic">Everyone is busy working!</p>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};

export default Monitor;