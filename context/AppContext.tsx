import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppState, Client, Project, Task, TeamMember, ClientStatus, Division, AppSettings, TaskPriority, Subtask } from '../types';
import { WORKFLOW_SEQUENCE } from '../constants';
import { api } from '../services/googleSheet';

interface AppContextType extends AppState {
  isLoading: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  addClient: (client: Omit<Client, 'id' | 'joinedDate' | 'totalTimeSpent' | 'requirements' | 'addons'>, requirements: string[], addons: string[]) => void;
  addProject: (project: Omit<Project, 'id' | 'status'>) => void;
  updateProject: (project: Partial<Project> & { id: string }) => void;
  addTask: (task: Omit<Task, 'id' | 'isCompleted' | 'timeSpent' | 'activeUserIds' | 'completionPercentage' | 'subtasks' | 'createdAt'>) => void;
  addTeamMember: (member: Omit<TeamMember, 'id' | 'avatar'>) => void;
  updateTeamMember: (member: TeamMember) => void;
  deleteTeamMember: (id: string) => void;
  updateClientStatus: (id: string, status: ClientStatus) => void;
  toggleTaskTimer: (taskId: string) => void;
  logTaskProgress: (taskId: string, note: string, percentage: number, newRequirements?: string[], newAddons?: string[]) => void;
  updateTaskPriority: (taskId: string, priority: TaskPriority) => void;
  updateTaskDeadline: (taskId: string, newDeadline: string) => void;
  assignTask: (taskId: string, memberId: string) => void;
  updateTaskAssignees: (taskId: string, memberIds: string[]) => void;
  completeTask: (taskId: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  getTaskTotalTime: (task: Task) => number; // New Helper
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0); // State to force re-render for timer UI updates
  
  // Initialize default workflow deadlines from constants
  const defaultWorkflowDeadlines = WORKFLOW_SEQUENCE.reduce((acc, stage) => ({
      ...acc,
      [stage.taskTitle]: stage.daysToComplete
  }), {} as Record<string, number>);

  const [state, setState] = useState<AppState>({
      currentUser: null,
      clients: [],
      projects: [],
      tasks: [],
      team: [],
      settings: {
          theme: 'light',
          compactView: false,
          sidebarCollapsed: false,
          workflowDeadlines: defaultWorkflowDeadlines
      }
  });

  // Global Tick for UI Timers (Runs every second)
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timerInterval);
  }, []);

  // Theme Side Effect
  useEffect(() => {
    if (state.settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.settings.theme]);

  // Load Data from Google Sheets on Mount
  useEffect(() => {
      const loadData = async () => {
          setIsLoading(true);
          try {
              const data = await api.fetchAllData();
              if (data) {
                  const sanitizedTeam = (data.team || []).map(m => ({
                      ...m,
                      password: m.password || '123456'
                  }));

                  // Merge Default Settings with DB Settings
                  const mergedSettings: AppSettings = {
                      theme: data.settings?.theme || state.settings.theme,
                      compactView: data.settings?.compactView ?? state.settings.compactView,
                      sidebarCollapsed: data.settings?.sidebarCollapsed ?? state.settings.sidebarCollapsed,
                      workflowDeadlines: {
                          ...defaultWorkflowDeadlines,
                          ...(data.settings?.workflowDeadlines || {})
                      }
                  };

                  setState(prev => ({
                      ...prev,
                      clients: data.clients || [],
                      projects: data.projects || [],
                      tasks: data.tasks || [],
                      team: sanitizedTeam,
                      settings: mergedSettings
                  }));
              }
          } catch (e) {
              console.error("Failed to load initial data", e);
          } finally {
              setIsLoading(false);
          }
      };
      loadData();
  }, []);

  // Background Polling
  useEffect(() => {
    const POLL_INTERVAL = 10000;
    const syncData = async () => {
        if (isLoading) return;
        try {
            const data = await api.fetchAllData();
            if (data) {
                 setState(prev => {
                     const serverSettings = data.settings;
                     let nextSettings = prev.settings;
                     
                     if (serverSettings) {
                        nextSettings = {
                             ...prev.settings,
                             workflowDeadlines: {
                                 ...prev.settings.workflowDeadlines,
                                 ...(serverSettings.workflowDeadlines || {})
                             }
                         };
                     }

                    // IMPROVED: Merge tasks intelligently to preserve active timer sessions
                    const mergedTasks = (data.tasks || prev.tasks).map(serverTask => {
                        const localTask = prev.tasks.find(t => t.id === serverTask.id);
                        
                        // If local task has active timer sessions, preserve them
                        if (localTask && localTask.activeUserIds && localTask.activeUserIds.length > 0) {
                            return {
                                ...serverTask,
                                // Preserve local active sessions
                                activeUserIds: localTask.activeUserIds,
                                timerSessions: localTask.timerSessions,
                                // Use server's committed timeSpent, but preserve active sessions
                                timeSpent: serverTask.timeSpent
                            };
                        }
                        
                        return serverTask;
                    });

                    return {
                        ...prev,
                        clients: data.clients || prev.clients,
                        projects: data.projects || prev.projects,
                        tasks: mergedTasks, 
                        team: (data.team || []).map(m => ({
                            ...m,
                            password: m.password || '123456'
                        })),
                        settings: nextSettings
                    };
                });
            }
        } catch (e) {
            console.error("Background sync failed", e);
        }
    };
    const intervalId = setInterval(syncData, POLL_INTERVAL);
    return () => clearInterval(intervalId);
  }, [isLoading]);

  const login = (email: string, password: string) => {
      const user = state.team.find(m => m.email.toLowerCase() === email.toLowerCase());
      if (user && user.password === password) {
          setState(prev => ({ ...prev, currentUser: user }));
          return true;
      }
      if (state.team.length === 0) {
          const demoUser: TeamMember = { 
            id: 'admin', 
            name: 'System Admin', 
            email: email, 
            password: password || 'admin123', 
            role: 'Manager', 
            avatar: 'https://ui-avatars.com/api/?name=System+Admin&background=4f46e5&color=fff' 
          };
          setState(prev => ({ ...prev, currentUser: demoUser, team: [demoUser] }));
          api.createTeamMember(demoUser); 
          return true;
      }
      return false;
  };

  const logout = () => {
      setState(prev => ({ ...prev, currentUser: null }));
  };

  // Helper to calculate LIVE time for a task (Committed + Active Session)
  const getTaskTotalTime = (task: Task) => {
    let activeSeconds = 0;
    if (task.timerSessions) {
        const now = Date.now();
        Object.values(task.timerSessions).forEach(startTime => {
            if (startTime) {
                activeSeconds += (now - startTime) / 1000;
            }
        });
    }
    return (task.timeSpent || 0) + activeSeconds;
  };

  // Priority Escalation Logic (Uses calculated time indirectly via polling check)
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => {
        let hasChanges = false;
        const now = new Date();
        const tasksToSync: Task[] = [];
        const settings = prev.settings;
        
        const newTasks = prev.tasks.map(task => {
          let updatedTask = { ...task };
          let priorityChanged = false;
          
          if (!task.isCompleted && task.createdAt) {
             const created = new Date(task.createdAt);
             if (!isNaN(created.getTime())) { 
                 const diffTime = Math.abs(now.getTime() - created.getTime());
                 const diffDays = diffTime / (1000 * 60 * 60 * 24);
                 
                 const maxDays = settings.workflowDeadlines?.[task.title] || 3;
                 
                 let currentPriorityVal = 0;
                 if (task.priority === 'Regular') currentPriorityVal = 1;
                 if (task.priority === 'High') currentPriorityVal = 2;
                 if (task.priority === 'Urgent') currentPriorityVal = 3;

                 let targetPriority: TaskPriority | null = null;
                 let targetPriorityVal = 0;

                 if (diffDays >= maxDays) {
                     targetPriority = 'Urgent';
                     targetPriorityVal = 3;
                 } else if (diffDays >= (maxDays * 0.7)) {
                     targetPriority = 'High';
                     targetPriorityVal = 2;
                 } else {
                     targetPriority = 'Regular';
                     targetPriorityVal = 1;
                 }

                 if (targetPriority && targetPriorityVal > currentPriorityVal) {
                     updatedTask.priority = targetPriority;
                     hasChanges = true;
                     priorityChanged = true;
                 }
             }
          }

          if (priorityChanged) {
              tasksToSync.push(updatedTask);
          }

          return updatedTask;
        });

        if (tasksToSync.length > 0) {
            tasksToSync.forEach(t => api.updateTask(t));
        }

        if (!hasChanges) return prev;

        // Note: We don't update client.totalTimeSpent here anymore because task.timeSpent 
        // is now committed time. We will update client total on poll or calculate it live.
        // For simplicity in this fix, we leave client aggregation as is, knowing it might lag slightly 
        // until a task timer is stopped (committed).
        
        return { ...prev, tasks: newTasks };
      });
    }, 5000); // Check every 5s is enough for priority
    return () => clearInterval(interval);
  }, []);

  const addClient = (clientData: any, requirements: string[], addons: string[]) => {
    const firstStage = WORKFLOW_SEQUENCE[0]; 
    const dynamicDays = state.settings.workflowDeadlines?.[firstStage.taskTitle] ?? firstStage.daysToComplete;

    const newClient: Client = {
      ...clientData,
      id: Math.random().toString(36).substr(2, 9),
      joinedDate: new Date().toISOString(),
      totalTimeSpent: 0,
      requirements,
      addons,
      status: firstStage.stage 
    };
    
    const defaultProject: Project = {
        id: Math.random().toString(36).substr(2, 9),
        name: `${newClient.businessName} Main Project`,
        clientId: newClient.id,
        status: 'Active'
    };

    const initialSubtasks: Subtask[] = firstStage.defaultSubtasks 
        ? firstStage.defaultSubtasks.map(title => ({
            id: Math.random().toString(36).substr(2, 9),
            title: title,
            isCompleted: false
        })) 
        : [];
    
    const firstTask: Task = {
        id: Math.random().toString(36).substr(2, 9),
        title: firstStage.taskTitle,
        projectId: defaultProject.id,
        division: firstStage.division,
        assignees: [],
        isCompleted: false,
        timeSpent: 0,
        activeUserIds: [],
        deadline: new Date(new Date().setDate(new Date().getDate() + dynamicDays)).toISOString(),
        priority: firstStage.priority,
        completionPercentage: 0,
        subtasks: initialSubtasks,
        createdAt: new Date().toISOString()
    };

    const addonTasks: Task[] = addons.map(addon => ({
        id: Math.random().toString(36).substr(2, 9),
        title: `Addon: ${addon}`,
        projectId: defaultProject.id,
        division: Division.IT, 
        assignees: [],
        isCompleted: false,
        timeSpent: 0,
        activeUserIds: [],
        deadline: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString(),
        priority: 'Regular',
        completionPercentage: 0,
        subtasks: [],
        createdAt: new Date().toISOString()
    }));

    setState(prev => ({ 
        ...prev, 
        clients: [...prev.clients, newClient],
        projects: [...prev.projects, defaultProject],
        tasks: [...prev.tasks, firstTask, ...addonTasks]
    }));

    api.createClient(newClient);
    api.createProject(defaultProject);
    api.batchCreateTasks([firstTask, ...addonTasks]);
  };

  const addProject = (projectData: any) => {
    const newProject: Project = {
      ...projectData,
      id: Math.random().toString(36).substr(2, 9),
      status: 'Active'
    };
    setState(prev => ({ ...prev, projects: [...prev.projects, newProject] }));
    api.createProject(newProject);
  };
  
  const updateProject = (projectUpdate: any) => {
      setState(prev => ({
          ...prev,
          projects: prev.projects.map(p => p.id === projectUpdate.id ? { ...p, ...projectUpdate } : p)
      }));
      api.updateProject(projectUpdate);
  }

  const addTask = (taskData: any) => {
    const newTask: Task = {
      ...taskData,
      id: Math.random().toString(36).substr(2, 9),
      isCompleted: false,
      timeSpent: 0,
      activeUserIds: [],
      completionPercentage: 0,
      subtasks: [],
      createdAt: new Date().toISOString()
    };
    setState(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }));
    api.createTask(newTask);
  };

  const addTeamMember = (memberData: any) => {
      const finalPassword = memberData.password && memberData.password.trim() !== '' 
        ? memberData.password 
        : '123456';

      const newMember: TeamMember = {
          ...memberData,
          password: finalPassword,
          id: Math.random().toString(36).substr(2, 9),
          avatar: `https://ui-avatars.com/api/?name=${memberData.name.replace(' ', '+')}&background=random&color=fff`
      };
      setState(prev => ({ ...prev, team: [...prev.team, newMember] }));
      api.createTeamMember(newMember);
  }

  const updateTeamMember = (member: TeamMember) => {
      setState(prev => ({
          ...prev,
          team: prev.team.map(m => m.id === member.id ? member : m)
      }));
      api.updateTeamMember(member);
  }

  const deleteTeamMember = (id: string) => {
      setState(prev => ({
          ...prev,
          team: prev.team.filter(m => String(m.id) !== String(id))
      }));
      api.deleteTeamMember(id);
  }

  const updateClientStatus = (id: string, status: ClientStatus) => {
    setState(prev => {
        const client = prev.clients.find(c => c.id === id);
        if (client) {
            const updated = { ...client, status };
            api.updateClient(updated); 
            return {
                ...prev,
                clients: prev.clients.map(c => c.id === id ? updated : c)
            };
        }
        return prev;
    });
  };

  const toggleTaskTimer = (taskId: string) => {
    setState(prev => {
        const currentUser = prev.currentUser;
        if (!currentUser) return prev;
        
        let task = prev.tasks.find(t => t.id === taskId);
        if(!task) return prev;

        const now = Date.now();
        const userId = currentUser.id;
        let updatedTask = { ...task };

        // Initialize sessions map if not exists
        if (!updatedTask.timerSessions) {
            updatedTask.timerSessions = {};
        }

        const isUserActive = updatedTask.activeUserIds.includes(userId);
        
        if (isUserActive) {
            // STOPPING TIMER
            // Calculate elapsed time accurately
            const startTime = updatedTask.timerSessions[userId];
            if (startTime) {
                const elapsedSeconds = (now - startTime) / 1000;
                updatedTask.timeSpent = (updatedTask.timeSpent || 0) + elapsedSeconds;
                
                // Cleanup session
                const newSessions = { ...updatedTask.timerSessions };
                delete newSessions[userId];
                updatedTask.timerSessions = newSessions;
            }

            // Remove user from active list
            updatedTask.activeUserIds = updatedTask.activeUserIds.filter(id => id !== userId);
            
            // Also update Client Total Time Spent (Aggregated)
            const project = prev.projects.find(p => p.id === task!.projectId);
            let updatedClients = prev.clients;
            if (project && project.clientId && startTime) {
                 const diff = (now - startTime) / 1000;
                 updatedClients = prev.clients.map(c => 
                     c.id === project.clientId ? { ...c, totalTimeSpent: c.totalTimeSpent + diff } : c
                 );
                 // We should ideally call api.updateClient here too, but for now we focus on task
            }

            api.updateTask(updatedTask);
            return {
                ...prev,
                tasks: prev.tasks.map(t => t.id === taskId ? updatedTask : t),
                clients: updatedClients
            };

        } else {
            // STARTING TIMER
            // Set Start Time
            updatedTask.timerSessions = {
                ...updatedTask.timerSessions,
                [userId]: now
            };
            // Add user to active list
            updatedTask.activeUserIds = [...updatedTask.activeUserIds, userId];

            api.updateTask(updatedTask);
            return {
                ...prev,
                tasks: prev.tasks.map(t => t.id === taskId ? updatedTask : t)
            };
        }
    });
  };

  const logTaskProgress = (taskId: string, note: string, percentage: number, newRequirements?: string[], newAddons?: string[]) => {
      setState(prev => {
          const taskBeforeUpdate = prev.tasks.find(t => t.id === taskId);
          if (!taskBeforeUpdate) return prev;

          // SOLID TIMER LOGIC: If I am logging, I imply stopping the timer if it's running for me
          const userId = prev.currentUser?.id;
          let calculatedTimeSpent = taskBeforeUpdate.timeSpent;
          let newTimerSessions = { ...taskBeforeUpdate.timerSessions };
          let newActiveUsers = taskBeforeUpdate.activeUserIds;
          
          let addedTime = 0;

          if (userId && taskBeforeUpdate.activeUserIds.includes(userId)) {
              const now = Date.now();
              const startTime = taskBeforeUpdate.timerSessions?.[userId];
              if (startTime) {
                  addedTime = (now - startTime) / 1000;
                  calculatedTimeSpent += addedTime;
                  delete newTimerSessions[userId];
              }
              newActiveUsers = newActiveUsers.filter(id => id !== userId);
          }

          const isNowCompleted = percentage === 100;
          
          const updatedTask = { 
              ...taskBeforeUpdate, 
              activeUserIds: newActiveUsers,
              timerSessions: newTimerSessions,
              timeSpent: calculatedTimeSpent,
              completionPercentage: percentage, 
              lastProgressNote: note,
              isCompleted: isNowCompleted ? true : taskBeforeUpdate.isCompleted,
              completedAt: isNowCompleted ? new Date().toISOString() : taskBeforeUpdate.completedAt
          };

          api.updateTask(updatedTask);
          
          // Update Client Total Time immediately
          let updatedClients = [...prev.clients];
          if (addedTime > 0) {
              const project = prev.projects.find(p => p.id === taskBeforeUpdate.projectId);
              if (project && project.clientId) {
                  updatedClients = updatedClients.map(c => 
                      c.id === project.clientId ? { ...c, totalTimeSpent: c.totalTimeSpent + addedTime } : c
                  );
                  const clientToUpdate = updatedClients.find(c => c.id === project.clientId);
                  if (clientToUpdate) api.updateClient(clientToUpdate);
              }
          }

          let newTasksToAdd: Task[] = [];

          if (!taskBeforeUpdate.isCompleted && isNowCompleted) {
              const currentStageIndex = WORKFLOW_SEQUENCE.findIndex(stage => stage.taskTitle === taskBeforeUpdate.title);
              
              if (currentStageIndex !== -1) {
                  const project = prev.projects.find(p => p.id === taskBeforeUpdate.projectId);
                  
                  if (project && project.clientId) {
                      const client = updatedClients.find(c => c.id === project.clientId); // use updatedClients
                      
                      if (client) {
                          let updatedClient = { ...client };
                          
                          if (newRequirements && newRequirements.length > 0) {
                              updatedClient.requirements = [...client.requirements, ...newRequirements];
                          }
                          if (newAddons && newAddons.length > 0) {
                              updatedClient.addons = [...client.addons, ...newAddons];
                              
                              const createdAddonTasks: Task[] = newAddons.map(addon => ({
                                  id: Math.random().toString(36).substr(2, 9),
                                  title: `Addon: ${addon}`,
                                  projectId: project.id,
                                  division: Division.IT, 
                                  assignees: [],
                                  isCompleted: false,
                                  timeSpent: 0,
                                  activeUserIds: [],
                                  deadline: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString(),
                                  priority: 'Regular',
                                  completionPercentage: 0,
                                  subtasks: [],
                                  createdAt: new Date().toISOString()
                              }));
                              newTasksToAdd = [...newTasksToAdd, ...createdAddonTasks];
                          }

                          if (currentStageIndex < WORKFLOW_SEQUENCE.length - 1) {
                              const nextStage = WORKFLOW_SEQUENCE[currentStageIndex + 1];
                              updatedClient.status = nextStage.stage;

                              let nextTaskSubtasks: Subtask[] = [];
                              
                              if (newRequirements) {
                                  nextTaskSubtasks = [...nextTaskSubtasks, ...newRequirements.map(req => ({
                                      id: Math.random().toString(36).substr(2, 9), title: req, isCompleted: false
                                  }))];
                              } 
                              if (nextStage.stage === ClientStatus.Training1 && client.requirements) {
                                   nextTaskSubtasks = [...nextTaskSubtasks, ...client.requirements.map(req => ({
                                      id: Math.random().toString(36).substr(2, 9), title: req, isCompleted: false
                                  }))];
                              }
                              if (nextStage.defaultSubtasks) {
                                  nextTaskSubtasks = [...nextTaskSubtasks, ...nextStage.defaultSubtasks.map(dt => ({
                                      id: Math.random().toString(36).substr(2, 9), title: dt, isCompleted: false
                                  }))];
                              }
                              
                              // Calculate dynamic deadline for next stage
                              const nextStageDays = prev.settings.workflowDeadlines?.[nextStage.taskTitle] ?? nextStage.daysToComplete;

                              const nextTask: Task = {
                                  id: Math.random().toString(36).substr(2, 9),
                                  title: nextStage.taskTitle,
                                  projectId: project.id,
                                  division: nextStage.division,
                                  assignees: taskBeforeUpdate.assignees,
                                  isCompleted: false,
                                  timeSpent: 0,
                                  activeUserIds: [],
                                  deadline: new Date(new Date().setDate(new Date().getDate() + nextStageDays)).toISOString(),
                                  priority: nextStage.priority,
                                  completionPercentage: 0,
                                  subtasks: nextTaskSubtasks,
                                  createdAt: new Date().toISOString()
                              };

                              newTasksToAdd.push(nextTask);
                          }
                          
                          if (client.status !== updatedClient.status || (newRequirements && newRequirements.length) || (newAddons && newAddons.length)) {
                               api.updateClient(updatedClient);
                               updatedClients = updatedClients.map(c => c.id === client.id ? updatedClient : c);
                          }
                      }
                  }
              }
          }

          const finalTasks = prev.tasks.map(t => t.id === taskId ? updatedTask : t).concat(newTasksToAdd);
          if (newTasksToAdd.length > 0) {
              api.batchCreateTasks(newTasksToAdd);
          }

          return {
              ...prev,
              tasks: finalTasks,
              clients: updatedClients
          };
      });
  };

  const updateTaskPriority = (taskId: string, priority: TaskPriority) => {
      setState(prev => {
          const task = prev.tasks.find(t => t.id === taskId);
          if (task) {
              const updated = { ...task, priority };
              api.updateTask(updated);
              return { ...prev, tasks: prev.tasks.map(t => t.id === taskId ? updated : t) };
          }
          return prev;
      });
  }

  const updateTaskDeadline = (taskId: string, newDeadline: string) => {
      setState(prev => {
          const task = prev.tasks.find(t => t.id === taskId);
          if (task) {
              const updated = { ...task, deadline: newDeadline };
              api.updateTask(updated);
              return { ...prev, tasks: prev.tasks.map(t => t.id === taskId ? updated : t) };
          }
          return prev;
      });
  }

  const updateTaskAssignees = (taskId: string, memberIds: string[]) => {
      setState(prev => {
          const task = prev.tasks.find(t => t.id === taskId);
          if (task) {
              const updated = { ...task, assignees: memberIds };
              api.updateTask(updated);
              return { ...prev, tasks: prev.tasks.map(t => t.id === taskId ? updated : t) };
          }
          return prev;
      });
  }
  
  const assignTask = (taskId: string, memberId: string) => {
      // Wrapper for updateTaskAssignees if single assignment needed
      const task = state.tasks.find(t => t.id === taskId);
      if(task) {
          const newAssignees = [...task.assignees, memberId];
          updateTaskAssignees(taskId, newAssignees);
      }
  }

  const completeTask = (taskId: string) => {
      logTaskProgress(taskId, 'Completed manually', 100);
  }

  const toggleSubtask = (taskId: string, subtaskId: string) => {
      setState(prev => {
          const task = prev.tasks.find(t => t.id === taskId);
          if (!task) return prev;

          const updatedSubtasks = task.subtasks.map(s => 
              s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted, completedAt: !s.isCompleted ? new Date().toISOString() : undefined } : s
          );
          
          // Recalculate percentage based on subtasks if exists
          const completedCount = updatedSubtasks.filter(s => s.isCompleted).length;
          const newPercentage = Math.round((completedCount / updatedSubtasks.length) * 100);

          const updatedTask = { 
              ...task, 
              subtasks: updatedSubtasks,
              completionPercentage: newPercentage
          };
          
          api.updateTask(updatedTask);
          
          return { ...prev, tasks: prev.tasks.map(t => t.id === taskId ? updatedTask : t) };
      });
  }

  const updateSettings = (settingsPart: Partial<AppSettings>) => {
      setState(prev => {
          const newSettings = { ...prev.settings, ...settingsPart };
          api.updateSettings(newSettings);
          return { ...prev, settings: newSettings };
      });
  }

  const value = {
    ...state,
    isLoading,
    login,
    logout,
    addClient,
    addProject,
    updateProject,
    addTask,
    addTeamMember,
    updateTeamMember,
    deleteTeamMember,
    updateClientStatus,
    toggleTaskTimer,
    logTaskProgress,
    updateTaskPriority,
    updateTaskDeadline,
    assignTask,
    updateTaskAssignees,
    completeTask,
    toggleSubtask,
    updateSettings,
    getTaskTotalTime
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};