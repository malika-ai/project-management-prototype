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
  addTask: (task: Omit<Task, 'id' | 'isCompleted' | 'timeSpent' | 'activeUserIds' | 'completionPercentage' | 'subtasks' | 'createdAt'>) => void;
  addTeamMember: (member: Omit<TeamMember, 'id' | 'avatar'>) => void;
  updateTeamMember: (member: TeamMember) => void;
  deleteTeamMember: (id: string) => void;
  updateClientStatus: (id: string, status: ClientStatus) => void;
  toggleTaskTimer: (taskId: string) => void;
  logTaskProgress: (taskId: string, note: string, percentage: number, newRequirements?: string[], newAddons?: string[]) => void;
  updateTaskPriority: (taskId: string, priority: TaskPriority) => void;
  assignTask: (taskId: string, memberId: string) => void;
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
  const [state, setState] = useState<AppState>({
      currentUser: null,
      clients: [],
      projects: [],
      tasks: [],
      team: [],
      settings: {
          theme: 'light',
          compactView: false,
          sidebarCollapsed: false
      }
  });

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

  const login = (email: string, password: string) => {
      const user = state.team.find(m => m.email.toLowerCase() === email.toLowerCase());
      
      // Check if user exists and password matches
      if (user && user.password === password) {
          setState(prev => ({ ...prev, currentUser: user }));
          return true;
      }
      
      // First Time Login (Initialization): If Team is empty, create Admin
      // This sends the credentials 'admin@malika.ai' / 'admin123' to the spreadsheet
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
          api.createTeamMember(demoUser); // Writes to Google Sheet
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
        
        const newTasks = prev.tasks.map(task => {
          let updatedTask = { ...task };
          
          // 1. Time Tracking Logic
          if (task.activeUserIds.length > 0) {
            // Increment by the number of active users (Man-seconds)
            updatedTask.timeSpent = task.timeSpent + task.activeUserIds.length;
            hasChanges = true;
          }

          // 2. Priority Escalation Logic (Auto-Update based on Age)
          if (!task.isCompleted) {
             const created = new Date(task.createdAt);
             const diffTime = Math.abs(now.getTime() - created.getTime());
             const diffDays = diffTime / (1000 * 60 * 60 * 24);
             
             let currentPriorityVal = 0;
             if (task.priority === 'Regular') currentPriorityVal = 1;
             if (task.priority === 'High') currentPriorityVal = 2;
             if (task.priority === 'Urgent') currentPriorityVal = 3;

             let targetPriority: TaskPriority | null = null;
             let targetPriorityVal = 0;

             if (diffDays > 3) {
                 targetPriority = 'Urgent';
                 targetPriorityVal = 3;
             } else if (diffDays > 2) {
                 targetPriority = 'High';
                 targetPriorityVal = 2;
             } else if (diffDays > 1) {
                 targetPriority = 'Regular';
                 targetPriorityVal = 1;
             }

             // Only update if target priority is strictly higher than current
             if (targetPriority && targetPriorityVal > currentPriorityVal) {
                 updatedTask.priority = targetPriority;
                 hasChanges = true;
             }
          }

          return updatedTask;
        });

        if (!hasChanges) return prev;

        // Update Client Total Time based on active tasks
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
    // 1. Determine first stage from WORKFLOW_SEQUENCE
    const firstStage = WORKFLOW_SEQUENCE[0]; 

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

    // Generate Default Subtasks
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
        deadline: new Date(new Date().setDate(new Date().getDate() + firstStage.daysToComplete)).toISOString(),
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

    // Optimistic Update
    setState(prev => ({ 
        ...prev, 
        clients: [...prev.clients, newClient],
        projects: [...prev.projects, defaultProject],
        tasks: [...prev.tasks, firstTask, ...addonTasks]
    }));

    // API Calls
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
      // Logic for default password
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
      // Optimistic delete: filter out member whose ID matches (as string to be safe)
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
            api.updateClient(updated); // Background sync
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
        
        // Sync active status (Optional, good for Live Monitor)
        api.updateTask(updatedTask);

        return {
            ...prev,
            tasks: prev.tasks.map(t => {
                if (t.id === taskId) return updatedTask!;
                if (t.activeUserIds.includes(currentUser.id)) {
                    // Enforce one task at a time for user
                     const otherTask = { ...t, activeUserIds: t.activeUserIds.filter(id => id !== currentUser.id) };
                     api.updateTask(otherTask); // Sync stop of other task
                     return otherTask;
                }
                return t;
            })
        };
    });
  };

  const logTaskProgress = (taskId: string, note: string, percentage: number, newRequirements?: string[], newAddons?: string[]) => {
      // Logic is complex, we calculate new state then send API updates for changed entities
      setState(prev => {
          const isNowCompleted = percentage === 100;
          const taskBeforeUpdate = prev.tasks.find(t => t.id === taskId);
          
          if (!taskBeforeUpdate) return prev;

          // 1. Update the current task
          const newActiveUsers = taskBeforeUpdate.activeUserIds.filter(id => id !== prev.currentUser?.id);
          const updatedTask = { 
              ...taskBeforeUpdate, 
              activeUserIds: newActiveUsers,
              completionPercentage: percentage, 
              lastProgressNote: note,
              isCompleted: isNowCompleted ? true : taskBeforeUpdate.isCompleted 
          };

          api.updateTask(updatedTask);

          let newTasksToAdd: Task[] = [];
          let updatedClients = [...prev.clients];

          // 2. Check Workflow Automation
          if (!taskBeforeUpdate.isCompleted && isNowCompleted) {
              const currentStageIndex = WORKFLOW_SEQUENCE.findIndex(stage => stage.taskTitle === taskBeforeUpdate.title);
              
              if (currentStageIndex !== -1) {
                  const project = prev.projects.find(p => p.id === taskBeforeUpdate.projectId);
                  
                  if (project && project.clientId) {
                      const client = prev.clients.find(c => c.id === project.clientId);
                      
                      if (client) {
                          // A. Update Client
                          let updatedClient = { ...client };
                          
                          if (newRequirements && newRequirements.length > 0) {
                              updatedClient.requirements = [...client.requirements, ...newRequirements];
                          }
                          if (newAddons && newAddons.length > 0) {
                              updatedClient.addons = [...client.addons, ...newAddons];
                              
                              // Create Tasks for Addons
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

                          // B. Process Next Workflow Stage
                          if (currentStageIndex < WORKFLOW_SEQUENCE.length - 1) {
                              const nextStage = WORKFLOW_SEQUENCE[currentStageIndex + 1];
                              updatedClient.status = nextStage.stage;

                              // Create Next Task
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

                              const nextTask: Task = {
                                  id: Math.random().toString(36).substr(2, 9),
                                  title: nextStage.taskTitle,
                                  projectId: project.id,
                                  division: nextStage.division,
                                  assignees: [],
                                  isCompleted: false,
                                  timeSpent: 0,
                                  activeUserIds: [],
                                  deadline: new Date(new Date().setDate(new Date().getDate() + nextStage.daysToComplete)).toISOString(),
                                  priority: nextStage.priority,
                                  completionPercentage: 0,
                                  subtasks: nextTaskSubtasks,
                                  createdAt: new Date().toISOString()
                              };

                              newTasksToAdd.push(nextTask);
                          } else {
                              updatedClient.status = ClientStatus.Active;
                          }

                          // Update Client in list and API
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

        const updatedSubtasks = task.subtasks.map(s => s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s);
        
        const totalSubtasks = updatedSubtasks.length;
        const completedSubtasks = updatedSubtasks.filter(s => s.isCompleted).length;
        const newPercentage = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : task.completionPercentage;
        
        const updatedTask = {
            ...task,
            subtasks: updatedSubtasks,
            completionPercentage: newPercentage,
        };

        api.updateTask(updatedTask); // Sync subtask change

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
      addTask,
      addTeamMember,
      updateTeamMember,
      deleteTeamMember,
      updateClientStatus,
      toggleTaskTimer,
      logTaskProgress,
      updateTaskPriority,
      assignTask,
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