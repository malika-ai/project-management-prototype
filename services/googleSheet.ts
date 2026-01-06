import { AppState, Client, Project, Task, TeamMember, AppSettings } from '../types';

// REPLACE THIS WITH YOUR DEPLOYED GOOGLE APPS SCRIPT WEB APP URL
const API_URL = 'https://script.google.com/macros/s/AKfycbwAf44RsPBkfCZSjz6HquD6KAb6SRm0eiQU3viDYgmCxz7O4UAyKdeUvp7Xwyu83nA59g/exec';

// Configuration
const CONFIG = {
    MAX_RETRIES: 5, // Increased retries for stability
    RETRY_DELAY: 2000, // Increased base delay
    REQUEST_TIMEOUT: 60000, // Increased timeout to 60s
};

// Request cache to prevent duplicate requests
const requestCache = new Map<string, Promise<any>>();
const pendingRequests = new Map<string, number>();

/**
 * Create a cache key for request deduplication
 */
const getCacheKey = (action: string, payload: any): string => {
    return `${action}:${JSON.stringify(payload)}`;
};

/**
 * Delay helper for retry logic
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch with timeout
 */
const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
};

/**
 * Enhanced POST with retry logic and error handling
 */
const post = async (action: string, payload: any = {}, options: { skipCache?: boolean } = {}): Promise<any> => {
    const cacheKey = getCacheKey(action, payload);
    
    // Check for duplicate requests (unless explicitly skipped)
    if (!options.skipCache && requestCache.has(cacheKey)) {
        console.log(`[API] Using cached request for ${action}`);
        return requestCache.get(cacheKey);
    }
    
    // Check for too many pending requests of the same type
    const pendingCount = pendingRequests.get(action) || 0;
    if (pendingCount > 5) {
        console.warn(`[API] Too many pending ${action} requests (${pendingCount}), throttling...`);
        await delay(CONFIG.RETRY_DELAY);
    }
    
    // Track pending request
    pendingRequests.set(action, pendingCount + 1);
    
    const makeRequest = async (retryCount = 0): Promise<any> => {
        try {
            console.log(`[API] ${action} (attempt ${retryCount + 1}/${CONFIG.MAX_RETRIES + 1})`);
            
            // NOTE: Using text/plain to avoid CORS preflight (OPTIONS) request which GAS doesn't handle.
            // Google Apps Script can still parse the JSON body correctly.
            const response = await fetchWithTimeout(
                API_URL,
                {
                    method: 'POST',
                    mode: 'cors',
                    cache: 'no-cache',
                    credentials: 'omit', // Crucial for GAS Web Apps to avoid auth conflicts
                    redirect: 'follow',
                    referrerPolicy: 'no-referrer',
                    headers: {
                        'Content-Type': 'text/plain', 
                    },
                    body: JSON.stringify({ action, payload }),
                },
                CONFIG.REQUEST_TIMEOUT
            );
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.status === 'error') {
                throw new Error(data.message || 'Server returned error status');
            }
            
            console.log(`[API] ✅ ${action} success`);
            return data;
            
        } catch (error: any) {
            console.error(`[API] ❌ ${action} failed:`, error.message);
            
            // Retry logic
            if (retryCount < CONFIG.MAX_RETRIES) {
                const isRetryable = 
                    error.name === 'AbortError' || // Timeout
                    error.message.includes('NetworkError') ||
                    error.message.includes('Failed to fetch') ||
                    error.message.includes('Server is busy') || 
                    error.message.includes('server error') || // Broad check for "We're sorry, a server error occurred"
                    error.message.includes('Exception') || // Catch generic GAS Exceptions
                    error.message.includes('Service invoked too many times') || // Common GAS error
                    error.message.includes('Exceeded maximum execution time') || // Common GAS error
                    (error.message.includes('HTTP') && error.message.includes('5')); // 5xx errors
                
                if (isRetryable) {
                    const backoffDelay = CONFIG.RETRY_DELAY * Math.pow(2, retryCount);
                    console.log(`[API] Retrying ${action} in ${backoffDelay}ms...`);
                    await delay(backoffDelay);
                    return makeRequest(retryCount + 1);
                }
            }
            
            // If all retries failed or error is not retryable
            console.error(`[API] 💀 ${action} failed after ${retryCount + 1} attempts`);
            
            // Return null instead of throwing to prevent app crashes
            return null;
        } finally {
            // Cleanup pending request count
            const current = pendingRequests.get(action) || 1;
            pendingRequests.set(action, Math.max(0, current - 1));
        }
    };
    
    // Create the request promise
    const requestPromise = makeRequest();
    
    // Cache the request (unless skipped)
    if (!options.skipCache) {
        requestCache.set(cacheKey, requestPromise);
        
        // Clear cache after request completes (with small delay)
        requestPromise.finally(() => {
            setTimeout(() => {
                requestCache.delete(cacheKey);
            }, 1000); // Keep cache for 1 second after completion
        });
    }
    
    return requestPromise;
};

/**
 * Enhanced API with better error handling and retry logic
 */
export const api = {
    /**
     * Initial Load - This triggers the Auto-Setup in GAS if sheets don't exist
     * This is called on app startup and during background polling
     */
    fetchAllData: async (): Promise<Partial<AppState> | null> => {
        try {
            const res = await post('GET_ALL', {}, { skipCache: true }); // Always skip cache for data fetching
            
            if (res && res.status === 'success') {
                return {
                    clients: res.data.clients || [],
                    projects: res.data.projects || [],
                    tasks: res.data.tasks || [],
                    team: res.data.team || [],
                    settings: res.data.settings || undefined
                };
            }
            
            return null;
        } catch (error) {
            console.error('[API] fetchAllData failed:', error);
            return null;
        }
    },

    /**
     * Create a new client
     */
    createClient: async (client: Client): Promise<any> => {
        return post('CREATE_CLIENT', client);
    },
    
    /**
     * Update an existing client
     */
    updateClient: async (client: Partial<Client> & { id: string }): Promise<any> => {
        return post('UPDATE_CLIENT', client);
    },
    
    /**
     * Create a new project
     */
    createProject: async (project: Project): Promise<any> => {
        return post('CREATE_PROJECT', project);
    },
    
    /**
     * Update an existing project
     */
    updateProject: async (project: Partial<Project> & { id: string }): Promise<any> => {
        return post('UPDATE_PROJECT', project);
    },
    
    /**
     * Create a new task
     */
    createTask: async (task: Task): Promise<any> => {
        return post('CREATE_TASK', task);
    },
    
    /**
     * Update an existing task
     * IMPORTANT: This is the critical function for timer operations
     */
    updateTask: async (task: Partial<Task> & { id: string }): Promise<any> => {
        return post('UPDATE_TASK', task);
    },
    
    /**
     * Create multiple tasks at once (batch operation)
     */
    batchCreateTasks: async (tasks: Task[]): Promise<any> => {
        return post('BATCH_CREATE_TASKS', tasks);
    },

    /**
     * Create a new team member
     */
    createTeamMember: async (member: TeamMember): Promise<any> => {
        return post('CREATE_TEAM', member);
    },
    
    /**
     * Update an existing team member
     */
    updateTeamMember: async (member: TeamMember): Promise<any> => {
        return post('UPDATE_TEAM', member);
    },
    
    /**
     * Delete a team member
     */
    deleteTeamMember: async (id: string): Promise<any> => {
        return post('DELETE_TEAM', { id });
    },

    /**
     * Update application settings
     */
    updateSettings: async (settings: AppSettings): Promise<any> => {
        return post('UPDATE_SETTINGS', settings);
    },
    
    /**
     * Clear request cache (useful for debugging)
     */
    clearCache: (): void => {
        requestCache.clear();
        console.log('[API] Request cache cleared');
    },
    
    /**
     * Get pending request counts (useful for debugging)
     */
    getPendingCounts: (): Map<string, number> => {
        return new Map(pendingRequests);
    }
};

// Expose for debugging in development
if (process.env.NODE_ENV === 'development') {
    (window as any).__apiDebug = {
        requestCache,
        pendingRequests,
        clearCache: api.clearCache,
        getPendingCounts: api.getPendingCounts
    };
}