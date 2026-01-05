import { AppState, Client, Project, Task, TeamMember } from '../types';

// REPLACE THIS WITH YOUR DEPLOYED GOOGLE APPS SCRIPT WEB APP URL
// Tambahkan ?redirect=true untuk menghindari CORS issues
const API_URL = 'https://script.google.com/macros/s/AKfycbwAf44RsPBkfCZSjz6HquD6KAb6SRm0eiQU3viDYgmCxz7O4UAyKdeUvp7Xwyu83nA59g/exec';

// Helper to make POST requests (GAS Web Apps require POST for simple CORS handling sometimes, or JSONP, but POST is cleaner for data actions)
const post = async (action: string, payload: any = {}) => {
    try {
        const response = await fetch(API_URL, {
            redirect: "follow",
            method: "POST",
            body: JSON.stringify({ action, payload }),
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log(data);
        return data;
    } catch (error) {
        console.error("API Error:", error);
        return null;
    }
};

export const api = {
    // Initial Load - This triggers the Auto-Setup in GAS if sheets don't exist
    fetchAllData: async (): Promise<Partial<AppState> | null> => {
        const res = await post('GET_ALL');
        if (res && res.status === 'success') {
            return {
                clients: res.data.clients || [],
                projects: res.data.projects || [],
                tasks: res.data.tasks || [],
                team: res.data.team || []
            };
        }
        return null;
    },

    createClient: (client: Client) => post('CREATE_CLIENT', client),
    updateClient: (client: Partial<Client> & { id: string }) => post('UPDATE_CLIENT', client),

    createProject: (project: Project) => post('CREATE_PROJECT', project),

    createTask: (task: Task) => post('CREATE_TASK', task),
    updateTask: (task: Partial<Task> & { id: string }) => post('UPDATE_TASK', task),
    batchCreateTasks: (tasks: Task[]) => post('BATCH_CREATE_TASKS', tasks),

    createTeamMember: (member: TeamMember) => post('CREATE_TEAM', member),
    updateTeamMember: (member: TeamMember) => post('UPDATE_TEAM', member),
    deleteTeamMember: (id: string) => post('DELETE_TEAM', { id }),
};