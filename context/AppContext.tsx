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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper for dates
const futureDate = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  
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
                  // Sanitize Team Data (Ensure password field exists for legacy data)
                  const sanitizedTeam = (data.team || []).map(m => ({
                      ...m,
                      password: m.password || '123456' // Default if missing from DB
                  }));

                  setState(prev => ({
                      ...prev,
                      clients: data.clients || [],
                      projects: data.projects || [],
                      tasks: data.tasks || [],
                      team: sanitizedTeam
                  }));
              } else {
                  console.log("No data fetched or API error. Starting empty.");
              }
          } catch (e) {
              console.error("Failed to load initial data", e);
          } finally {
              setIsLoading(false);
          }
      };
      loadData();
  }, []);

  // Background Polling for Real-time Sync (Every 10 seconds)
  useEffect(() => {
    const POLL_INTERVAL = 10000; // 10 seconds

    const syncData = async () => {
        // Skip if we are still loading initial data
        if (isLoading) return;

        try {
            // Fetch silently (don't set isLoading)
            const data = await api.fetchAllData();
            if (data) {
                 setState(prev => {
                    return {
                        ...prev,
                        clients: data.clients || prev.clients,
                        projects: data.projects || prev.projects,
                        tasks: data.tasks || prev.tasks, 
                        team: (data.team || []).map(m => ({
                            ...m,
                            password: m.password || '123456'
                        }))
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

  // Timer Interval & Priority Escalation
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => {
        let hasChanges = false;
        const now = new Date();
        const tasksToSync: Task[] = []; // Store tasks that need API updates
        const settings = prev.settings;
        
        const newTasks = prev.tasks.map(task => {
          let updatedTask = { ...task };
          let priorityChanged = false;
          
          // 1. Update Time Spent (Local Only)
          if (task.activeUserIds.length > 0) {
            updatedTask.timeSpent = task.timeSpent + task.activeUserIds.length;
            hasChanges = true;
          }

          // 2. Automatic Priority Escalation Rule (Dynamic based on Settings)
          if (!task.isCompleted && task.createdAt) {
             const created = new Date(task.createdAt);
             
             if (!isNaN(created.getTime())) { 
                 const diffTime = Math.abs(now.getTime() - created.getTime());
                 const diffDays = diffTime / (1000 * 60 * 60 * 24);
                 
                 // Get configured duration for this specific task title, default to 3 days if not found
                 const maxDays = settings.workflowDeadlines?.[task.title] || 3;
                 
                 let currentPriorityVal = 0;
                 if (task.priority === 'Regular') currentPriorityVal = 1;
                 if (task.priority === 'High') currentPriorityVal = 2;
                 if (task.priority === 'Urgent') currentPriorityVal = 3;

                 let targetPriority: TaskPriority | null = null;
                 let targetPriorityVal = 0;

                 // Logic: 
                 // If passed 100% of allowed time -> Urgent
                 // If passed 70% of allowed time -> High
                 // Else -> Regular (Default)

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

                 // Only update if priority *increases* (Escalation only)
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

        const newClients = prev.clients.map(client => {
           const clientProjects = prev.projects.filter(p => p.clientId === client.id).map(p => p.id);
           const activeTaskInClient = newTasks.find(t => t.activeUserIds.length > 0 && clientProjects.includes(t.projectId));
           
           if (activeTaskInClient) {
             return { ...client, totalTimeSpent: client.totalTimeSpent + activeTaskInClient.activeUserIds.length };
           }
           return client;
        });

        return { ...prev, tasks: newTasks, clients: newClients };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const addClient = (clientData: Omit<Client, 'id' | 'joinedDate' | 'totalTimeSpent' | 'requirements' | 'addons'>, requirements: string[], addons: string[]) => {
    const firstStage = WORKFLOW_SEQUENCE[0]; 
    // Use dynamic duration from settings if available, else fallback to constant
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

  const addProject = (projectData: Omit<Project, 'id' | 'status'>) => {
    const newProject: Project = {
      ...projectData,
      id: Math.random().toString(36).substr(2, 9),
      status: 'Active'
    };
    setState(prev => ({ ...prev, projects: [...prev.projects, newProject] }));
    api.createProject(newProject);
  };
  
  const updateProject = (projectUpdate: Partial<Project> & { id: string }) => {
      setState(prev => ({
          ...prev,
          projects: prev.projects.map(p => p.id === projectUpdate.id ? { ...p, ...projectUpdate } : p)
      }));
      api.updateProject(projectUpdate);
  }

  const addTask = (taskData: Omit<Task, 'id' | 'isCompleted' | 'timeSpent' | 'activeUserIds' | 'completionPercentage' | 'subtasks' | 'createdAt'>) => {
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

  const addTeamMember = (memberData: Omit<TeamMember, 'id' | 'avatar'>) => {
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
        
        let updatedTask = prev.tasks.find(t => t.id === taskId);
        if(!updatedTask) return prev;

        const isActive = updatedTask.activeUserIds.includes(currentUser.id);
        let newActiveUsers = [...updatedTask.activeUserIds];
        
        if (isActive) {
            newActiveUsers = newActiveUsers.filter(id => id !== currentUser.id);
        } else {
            newActiveUsers.push(currentUser.id);
        }
        
        updatedTask = { ...updatedTask, activeUserIds: newActiveUsers };
        
        api.updateTask(updatedTask);

        return {
            ...prev,
            tasks: prev.tasks.map(t => {
                if (t.id === taskId) return updatedTask!;
                if (t.activeUserIds.includes(currentUser.id)) {
                     const otherTask = { ...t, activeUserIds: t.activeUserIds.filter(id => id !== currentUser.id) };
                     api.updateTask(otherTask); 
                     return otherTask;
                }
                return t;
            })
        };
    });
  };

  const logTaskProgress = (taskId: string, note: string, percentage: number, newRequirements?: string[], newAddons?: string[]) => {
      setState(prev => {
          const isNowCompleted = percentage === 100;
          const taskBeforeUpdate = prev.tasks.find(t => t.id === taskId);
          
          if (!taskBeforeUpdate) return prev;

          const newActiveUsers = taskBeforeUpdate.activeUserIds.filter(id => id !== prev.currentUser?.id);
          const updatedTask = { 
              ...taskBeforeUpdate, 
              activeUserIds: newActiveUsers,
              completionPercentage: percentage, 
              lastProgressNote: note,
              isCompleted: isNowCompleted ? true : taskBeforeUpdate.isCompleted,
              completedAt: isNowCompleted ? new Date().toISOString() : taskBeforeUpdate.completedAt
          };

          api.updateTask(updatedTask);

          let newTasksToAdd: Task[] = [];
          let updatedClients = [...prev.clients];

          if (!taskBeforeUpdate.isCompleted && isNowCompleted) {
              const currentStageIndex = WORKFLOW_SEQUENCE.findIndex(stage => stage.taskTitle === taskBeforeUpdate.title);
              
              if (currentStageIndex !== -1) {
                  const project = prev.projects.find(p => p.id === taskBeforeUpdate.projectId);
                  
                  if (project && project.clientId) {
                      const client = prev.clients.find(c => c.id === project.clientId);
                      
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
                          } else {
                              updatedClient.status = ClientStatus.Active;
                          }

                          updatedClients = updatedClients.map(c => c.id === client.id ? updatedClient : c);
                          api.updateClient(updatedClient);
                      }
                  }
              }
          }

          if (newTasksToAdd.length > 0) {
              api.batchCreateTasks(newTasksToAdd);
          }

          const updatedTasks = prev.tasks.map(t => t.id === taskId ? updatedTask : t);

          return {
              ...prev,
              tasks: [...updatedTasks, ...newTasksToAdd],
              clients: updatedClients
          };
      });
  }

  const toggleSubtask = (taskId: string, subtaskId: string) => {
      setState(prev => {
        const task = prev.tasks.find(t => t.id === taskId);
        if (!task) return prev;

        const updatedSubtasks = task.subtasks.map(s => s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted, completedAt: !s.isCompleted ? new Date().toISOString() : undefined } : s);
        
        const totalSubtasks = updatedSubtasks.length;
        const completedSubtasks = updatedSubtasks.filter(s => s.isCompleted).length;
        const newPercentage = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : task.completionPercentage;
        
        const updatedTask = {
            ...task,
            subtasks: updatedSubtasks,
            completionPercentage: newPercentage,
        };

        api.updateTask(updatedTask); 

        return {
            ...prev,
            tasks: prev.tasks.map(t => t.id === taskId ? updatedTask : t)
        };
      });
  }

  const updateTaskPriority = (taskId: string, priority: TaskPriority) => {
      setState(prev => {
          const task = prev.tasks.find(t => t.id === taskId);
          if (task) {
              const updated = { ...task, priority };
              api.updateTask(updated);
              return {
                 ...prev,
                 tasks: prev.tasks.map(t => t.id === taskId ? updated : t)
              };
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
              return {
                 ...prev,
                 tasks: prev.tasks.map(t => t.id === taskId ? updated : t)
              };
          }
          return prev;
      });
  }

  const assignTask = (taskId: string, memberId: string) => {
    setState(prev => {
        const task = prev.tasks.find(t => t.id === taskId);
        if(!task) return prev;
        
        const currentAssignees = task.assignees || [];
        let newAssignees;
        
        if (currentAssignees.includes(memberId)) {
            newAssignees = currentAssignees.filter(id => id !== memberId);
        } else {
            newAssignees = [...currentAssignees, memberId];
        }

        const updated = { ...task, assignees: newAssignees };
        api.updateTask(updated);

        return {
            ...prev,
            tasks: prev.tasks.map(t => t.id === taskId ? updated : t)
        };
    });
  }
  
  const updateTaskAssignees = (taskId: string, memberIds: string[]) => {
      setState(prev => {
          const task = prev.tasks.find(t => t.id === taskId);
          if (!task) return prev;
          
          const updated = { ...task, assignees: memberIds };
          api.updateTask(updated);
          
          return {
              ...prev,
              tasks: prev.tasks.map(t => t.id === taskId ? updated : t)
          };
      });
  }

  const completeTask = (taskId: string) => {
      logTaskProgress(taskId, "Quick Completed", 100);
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
      setState(prev => ({ ...prev, settings: { ...prev.settings, ...newSettings }}));
  };

  return (
    <AppContext.Provider value={{
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
      updateSettings
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};