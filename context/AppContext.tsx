import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
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
  getTaskTotalTime: (task: Task) => number;
  isTaskProcessing: (taskId: string) => boolean; // NEW: Check if task is being processed
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper to ensure task arrays are initialized correctly
const sanitizeTask = (task: any): Task => {
    if (!task) return {} as Task;
    
    // Ensure Priority is valid
    const validPriorities = ['Urgent', 'High', 'Regular', 'Low'];
    const priority = validPriorities.includes(task.priority) ? task.priority : 'Regular';
    
    // Ensure deadline is a valid ISO string
    let deadline = task.deadline;
    if (typeof deadline !== 'string' || !deadline) {
         // Default to today or keep existing if it's strictly not null/undefined but wrong type (though we handled typeof check)
         deadline = new Date().toISOString();
    }

    return {
        ...task,
        priority: priority,
        deadline: deadline,
        subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
        activeUserIds: Array.isArray(task.activeUserIds) ? task.activeUserIds : [],
        assignees: Array.isArray(task.assignees) ? task.assignees : [],
        timerSessions: task.timerSessions || {},
        timeSpent: Number(task.timeSpent) || 0,
        completionPercentage: Number(task.completionPercentage) || 0
    };
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);
  
  // NEW: Track ongoing operations to prevent race conditions
  const processingTasks = useRef<Set<string>>(new Set());
  const pendingApiCalls = useRef<Map<string, Promise<any>>>(new Map());
  
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

                  const safeTasks = (data.tasks || []).map(sanitizeTask);

                  setState(prev => ({
                      ...prev,
                      clients: data.clients || [],
                      projects: data.projects || [],
                      tasks: safeTasks,
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

  // IMPROVED: Background Polling with smarter merge logic
  useEffect(() => {
    const POLL_INTERVAL = 10000;
    const syncData = async () => {
        if (isLoading) return;
        
        // Don't sync if there are pending operations
        if (processingTasks.current.size > 0) {
            console.log('Skipping sync - operations in progress');
            return;
        }
        
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

                    // IMPROVED: Smarter task merge
                    const serverTasksSanitized = (data.tasks || []).map(sanitizeTask);
                    
                    const mergedTasks = (serverTasksSanitized.length > 0 ? serverTasksSanitized : prev.tasks).map(serverTask => {
                        const localTask = prev.tasks.find(t => t.id === serverTask.id);
                        
                        // If task is being processed locally, keep local version entirely
                        if (localTask && processingTasks.current.has(localTask.id)) {
                            return localTask;
                        }
                        
                        // If local task has active timer sessions, preserve them
                        if (localTask && localTask.activeUserIds && localTask.activeUserIds.length > 0) {
                            return {
                                ...serverTask,
                                // Preserve local active sessions
                                activeUserIds: localTask.activeUserIds,
                                timerSessions: localTask.timerSessions,
                                // Use server's committed timeSpent
                                timeSpent: serverTask.timeSpent
                            };
                        }
                        
                        return serverTask;
                    });
                    
                    // Add any new tasks from server that don't exist locally
                    const localTaskIds = new Set(prev.tasks.map(t => t.id));
                    const newServerTasks = serverTasksSanitized.filter(t => !localTaskIds.has(t.id));

                    return {
                        ...prev,
                        clients: data.clients || prev.clients,
                        projects: data.projects || prev.projects,
                        tasks: [...mergedTasks, ...newServerTasks],
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

  const addClient = (
      clientData: Omit<Client, 'id' | 'joinedDate' | 'totalTimeSpent' | 'requirements' | 'addons'>, 
      requirements: string[] = [], 
      addons: string[] = []
  ) => {
    const newClient: Client = {
        ...clientData,
        id: Math.random().toString(36).substr(2, 9),
        joinedDate: new Date().toISOString(),
        totalTimeSpent: 0,
        requirements: requirements,
        addons: addons
    };

    setState(prev => ({ ...prev, clients: [...prev.clients, newClient] }));

    const newProject: Project = {
        id: Math.random().toString(36).substr(2, 9),
        name: `${clientData.businessName} Project`,
        clientId: newClient.id,
        status: 'Active'
    };

    setState(prev => ({ ...prev, projects: [...prev.projects, newProject] }));

    const firstStage = WORKFLOW_SEQUENCE[0];
    const stageDays = state.settings.workflowDeadlines?.[firstStage.taskTitle] ?? firstStage.daysToComplete;
    const firstTask: Task = {
        id: Math.random().toString(36).substr(2, 9),
        title: firstStage.taskTitle,
        projectId: newProject.id,
        division: firstStage.division,
        assignees: [],
        isCompleted: false,
        timeSpent: 0,
        activeUserIds: [],
        deadline: new Date(new Date().setDate(new Date().getDate() + stageDays)).toISOString(),
        priority: firstStage.priority,
        completionPercentage: 0,
        subtasks: (firstStage.defaultSubtasks || []).map(st => ({
            id: Math.random().toString(36).substr(2, 9),
            title: st,
            isCompleted: false
        })),
        createdAt: new Date().toISOString()
    };

    setState(prev => ({ ...prev, tasks: [...prev.tasks, firstTask] }));

    api.createClient(newClient);
    api.createProject(newProject);
    api.createTask(firstTask);
  };

  const addProject = (projectData: Omit<Project, 'id' | 'status'>) => {
    const newProject: Project = {
        ...projectData,
        id: Math.random().toString(36).substr(2, 9),
        status: 'Active'
    };
    setState(prev => ({ ...prev, projects: [...prev.projects, newProject] }));
    api.createProject(newProject);
  }

  const updateProject = (project: Partial<Project> & { id: string }) => {
    setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === project.id ? { ...p, ...project } : p)
    }));
    const fullProject = state.projects.find(p => p.id === project.id);
    if (fullProject) {
        api.updateProject({ ...fullProject, ...project });
    }
  }

  const addTask = (
    taskData: Omit<Task, 'id' | 'isCompleted' | 'timeSpent' | 'activeUserIds' | 'completionPercentage' | 'subtasks' | 'createdAt'>
  ) => {
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
      const finalPassword = memberData.password || '123456';
      
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

  // FIXED: Improved toggleTaskTimer with proper race condition handling
  const toggleTaskTimer = (taskId: string) => {
    // Check if task is already being processed
    if (processingTasks.current.has(taskId)) {
        console.log('Task timer toggle already in progress, ignoring duplicate call');
        return;
    }

    // Mark task as processing
    processingTasks.current.add(taskId);

    setState(prev => {
        const currentUser = prev.currentUser;
        if (!currentUser) {
            processingTasks.current.delete(taskId);
            return prev;
        }
        
        let task = prev.tasks.find(t => t.id === taskId);
        if(!task) {
            processingTasks.current.delete(taskId);
            return prev;
        }

        const now = Date.now();
        const userId = currentUser.id;
        let updatedTask = { ...sanitizeTask(task) }; // Ensure task is sanitized before op

        // Initialize sessions map if not exists
        if (!updatedTask.timerSessions) {
            updatedTask.timerSessions = {};
        }

        const isUserActive = updatedTask.activeUserIds.includes(userId);
        
        if (isUserActive) {
            // STOPPING TIMER
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
            
            // Update Client Total Time Spent
            const project = prev.projects.find(p => p.id === task!.projectId);
            let updatedClients = prev.clients;
            if (project && project.clientId && startTime) {
                 const diff = (now - startTime) / 1000;
                 updatedClients = prev.clients.map(c => 
                     c.id === project.clientId ? { ...c, totalTimeSpent: c.totalTimeSpent + diff } : c
                 );
            }

            // Make API call and cleanup processing flag when done
            api.updateTask(updatedTask).finally(() => {
                processingTasks.current.delete(taskId);
            });

            return {
                ...prev,
                tasks: prev.tasks.map(t => t.id === taskId ? updatedTask : t),
                clients: updatedClients
            };

        } else {
            // STARTING TIMER
            updatedTask.timerSessions = {
                ...updatedTask.timerSessions,
                [userId]: now
            };
            updatedTask.activeUserIds = [...updatedTask.activeUserIds, userId];

            // Make API call and cleanup processing flag when done
            api.updateTask(updatedTask).finally(() => {
                processingTasks.current.delete(taskId);
            });

            return {
                ...prev,
                tasks: prev.tasks.map(t => t.id === taskId ? updatedTask : t)
            };
        }
    });
  };

  // FIXED: Improved logTaskProgress with transaction tracking
  const logTaskProgress = (taskId: string, note: string, percentage: number, newRequirements?: string[], newAddons?: string[]) => {
      // Check if task is already being processed
      if (processingTasks.current.has(taskId)) {
          console.log('Task log already in progress, ignoring duplicate call');
          return;
      }

      // Mark task as processing
      processingTasks.current.add(taskId);

      setState(prev => {
          const rawTask = prev.tasks.find(t => t.id === taskId);
          if (!rawTask) {
              processingTasks.current.delete(taskId);
              return prev;
          }
          
          const taskBeforeUpdate = sanitizeTask(rawTask);

          // Stop timer if running for current user
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

          api.updateTask(updatedTask).finally(() => {
              // Only remove from processing after API call completes
              // This prevents double task creation during the API call
              setTimeout(() => {
                  processingTasks.current.delete(taskId);
              }, 1000); // Add 1 second buffer
          });
          
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

          // FIXED: Only create next steps if this task is actually completed now
          if (isNowCompleted) {
              // Logic for Next Stage Creation
              // This logic should run whether requirements are passed or not to ensure flow continues.
              
              // Find what the NEXT stage is based on current task
              const currentStageIdx = WORKFLOW_SEQUENCE.findIndex(w => w.taskTitle === updatedTask.title);
              
              if (currentStageIdx !== -1 && currentStageIdx < WORKFLOW_SEQUENCE.length - 1) {
                  const nextStage = WORKFLOW_SEQUENCE[currentStageIdx + 1];
                  
                  // Check if next task already exists (prevent dupes)
                  const existingNextTask = prev.tasks.find(t => 
                      t.projectId === updatedTask.projectId && 
                      t.title === nextStage.taskTitle
                  );

                  if (existingNextTask) {
                      // Update existing task with new subtasks ONLY if newRequirements are present
                      if (newRequirements && newRequirements.length > 0) {
                          const updatedNextTask = {
                              ...existingNextTask,
                              subtasks: [
                                  ...existingNextTask.subtasks,
                                  ...newRequirements.map(req => ({
                                      id: Math.random().toString(36).substr(2, 9),
                                      title: req,
                                      isCompleted: false
                                  }))
                              ]
                          };
                          api.updateTask(updatedNextTask);
                          // We rely on background sync to reflect this update in UI or we could map it below
                      }
                  } else {
                      // Create next task if it doesn't exist (Auto-Advance Workflow)
                      // Use new requirements if provided, OR fallback to defaults from config, OR empty
                      let nextSubtasks = [];
                      if (newRequirements && newRequirements.length > 0) {
                          nextSubtasks = newRequirements.map(req => ({
                              id: Math.random().toString(36).substr(2, 9),
                              title: req,
                              isCompleted: false
                          }));
                      } else if (nextStage.defaultSubtasks && nextStage.defaultSubtasks.length > 0) {
                          nextSubtasks = nextStage.defaultSubtasks.map(st => ({
                              id: Math.random().toString(36).substr(2, 9),
                              title: st,
                              isCompleted: false
                          }));
                      }

                      const nextTask: Task = {
                          id: Math.random().toString(36).substr(2, 9),
                          title: nextStage.taskTitle,
                          projectId: updatedTask.projectId,
                          division: nextStage.division,
                          assignees: [], // Initially unassigned
                          isCompleted: false,
                          timeSpent: 0,
                          activeUserIds: [],
                          deadline: new Date(new Date().setDate(new Date().getDate() + nextStage.daysToComplete)).toISOString(),
                          priority: nextStage.priority,
                          completionPercentage: 0,
                          subtasks: nextSubtasks,
                          createdAt: new Date().toISOString()
                      };
                      newTasksToAdd.push(nextTask);
                      api.createTask(nextTask);

                      // Update Client Status to Next Stage
                      const project = prev.projects.find(p => p.id === updatedTask.projectId);
                      if (project && project.clientId) {
                          updateClientStatus(project.clientId, nextStage.stage);
                      }
                  }
              }

              // Create Add-on Tasks
              if (newAddons && newAddons.length > 0) {
                   newAddons.forEach(addonTitle => {
                       const addonTask: Task = {
                           id: Math.random().toString(36).substr(2, 9),
                           title: `Add-on: ${addonTitle}`,
                           projectId: updatedTask.projectId,
                           division: Division.IT, // Default to IT/Dev for addons usually
                           assignees: [],
                           isCompleted: false,
                           timeSpent: 0,
                           activeUserIds: [],
                           deadline: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString(),
                           priority: 'High',
                           completionPercentage: 0,
                           subtasks: [],
                           createdAt: new Date().toISOString()
                       };
                       newTasksToAdd.push(addonTask);
                       api.createTask(addonTask);
                   });
              }
          }

          // Return Final State
          return {
              ...prev,
              tasks: [
                  ...prev.tasks.map(t => {
                      if (t.id === taskId) return updatedTask;
                      // If we updated a next task via subtasks above (logic simplification: we just refetch or rely on sync for strict correctness, 
                      // but for UI responsiveness we should update if we found it. 
                      // Ideally we'd map it here, but for now relying on background sync for the 'update existing' case is safer than complex reduce
                      // simpler: The newTasksToAdd handles the new ones.
                      return t;
                  }),
                  ...newTasksToAdd
              ],
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
              const updated = { ...task, deadline: new Date(newDeadline).toISOString() };
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
          if (task) {
              const newAssignees = task.assignees.includes(memberId) ? task.assignees : [...task.assignees, memberId];
              const updated = { ...task, assignees: newAssignees };
              api.updateTask(updated);
              return {
                  ...prev,
                  tasks: prev.tasks.map(t => t.id === taskId ? updated : t)
              };
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
              return {
                  ...prev,
                  tasks: prev.tasks.map(t => t.id === taskId ? updated : t)
              };
          }
          return prev;
      });
  }

  const completeTask = (taskId: string) => {
      logTaskProgress(taskId, 'Marked as complete', 100);
  }

  const toggleSubtask = (taskId: string, subtaskId: string) => {
      setState(prev => {
          const task = prev.tasks.find(t => t.id === taskId);
          if (task) {
              const updatedSubtasks = task.subtasks.map(s => 
                  s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s
              );
              
              // Auto-calc percentage
              const total = updatedSubtasks.length;
              const completed = updatedSubtasks.filter(s => s.isCompleted).length;
              const newPercentage = total > 0 ? Math.round((completed / total) * 100) : task.completionPercentage;

              const updated = { 
                  ...task, 
                  subtasks: updatedSubtasks,
                  completionPercentage: newPercentage,
                  isCompleted: newPercentage === 100 // Auto-complete if all subtasks done? Maybe optional.
              };
              
              api.updateTask(updated);
              return {
                  ...prev,
                  tasks: prev.tasks.map(t => t.id === taskId ? updated : t)
              };
          }
          return prev;
      });
  }

  const updateSettings = (newSettings: Partial<AppSettings>) => {
      setState(prev => {
          const updated = { ...prev.settings, ...newSettings };
          api.updateSettings(updated);
          return { ...prev, settings: updated };
      });
  }

  const getTaskTotalTime = (task: Task) => {
     // This is a helper for UI that might need live calculation (handled in TimerDisplay mostly)
     return task.timeSpent; 
  }

  const isTaskProcessing = (taskId: string) => {
      return processingTasks.current.has(taskId);
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
    getTaskTotalTime,
    isTaskProcessing
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};