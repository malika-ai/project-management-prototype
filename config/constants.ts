/**
 * Application-wide configuration constants
 * Centralized location for all magic numbers and configuration values
 */

export const CONFIG = {
  // Polling intervals (in milliseconds)
  POLLING: {
    DATA_SYNC_INTERVAL: 10_000,        // 10 seconds - background data sync
    PRIORITY_CHECK_INTERVAL: 5_000,    // 5 seconds - priority escalation check
  },
  
  // Timer configuration
  TIMER: {
    UPDATE_INTERVAL: 1_000,             // 1 second - timer UI update
    AUTO_SAVE_INTERVAL: 30_000,         // 30 seconds - auto-save active sessions
    BUFFER_CLEANUP_DELAY: 1_000,        // 1 second - processing flag cleanup buffer
  },
  
  // Dashboard display limits
  DASHBOARD: {
    TOP_CLIENTS_COUNT: 10,              // Show top 10 clients
    TOP_TASKS_COUNT: 5,                 // Show top 5 tasks
    MAX_TEAM_DISPLAY: 10,               // Max team members to display
    RECENT_ACTIVITY_LIMIT: 20,          // Recent activity items
  },
  
  // Cache configuration
  CACHE: {
    DURATION: 5 * 60 * 1000,            // 5 minutes cache validity
    KEY: 'malika-ai-cache',             // localStorage key
    VERSION: '1.0',                     // Cache version for invalidation
  },
  
  // Debouncing delays (in milliseconds)
  DEBOUNCE: {
    SEARCH: 300,                         // 300ms for search inputs
    INPUT: 500,                          // 500ms for text inputs
    API_CALL: 1_000,                     // 1 second for API calls
    RESIZE: 150,                         // 150ms for window resize
  },
  
  // Validation rules
  VALIDATION: {
    MIN_PASSWORD_LENGTH: 8,
    MAX_PASSWORD_LENGTH: 128,
    MAX_NAME_LENGTH: 100,
    MAX_DESCRIPTION_LENGTH: 500,
    MAX_TITLE_LENGTH: 200,
    MIN_PHONE_LENGTH: 10,
    MAX_PHONE_LENGTH: 15,
  },
  
  // API configuration
  API: {
    MAX_RETRIES: 3,                      // Max retry attempts for failed requests
    RETRY_DELAY: 1_000,                  // 1 second base retry delay
    REQUEST_TIMEOUT: 30_000,             // 30 seconds request timeout
    MAX_CONCURRENT_REQUESTS: 5,          // Max simultaneous requests
  },
  
  // Date formats
  DATE_FORMATS: {
    DISPLAY: 'MMM DD, YYYY',
    FULL: 'MMMM DD, YYYY HH:mm',
    TIME_ONLY: 'HH:mm:ss',
    ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  },
  
  // Priority escalation thresholds (percentage of deadline)
  PRIORITY: {
    URGENT_THRESHOLD: 1.0,              // 100% of deadline (past due)
    HIGH_THRESHOLD: 0.7,                // 70% of deadline
    REGULAR_THRESHOLD: 0.0,             // 0% of deadline
  },
  
  // UI configuration
  UI: {
    TOAST_DURATION: 3_000,               // 3 seconds toast notification
    MODAL_ANIMATION_DURATION: 200,       // 200ms modal animation
    LOADING_DELAY: 500,                  // 500ms before showing loader
    SKELETON_COUNT: 5,                   // Number of skeleton items
    MAX_AVATAR_SIZE: 1_000_000,          // 1MB max avatar size
  },
  
  // Pagination
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    MIN_PAGE_SIZE: 5,
  },
  
  // File upload
  FILE_UPLOAD: {
    MAX_SIZE: 10 * 1024 * 1024,         // 10MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    MAX_FILES: 5,
  },
  
  // Local storage keys
  STORAGE_KEYS: {
    CACHE: 'malika-ai-cache',
    THEME: 'malika-ai-theme',
    USER_PREFERENCES: 'malika-ai-preferences',
    SIDEBAR_STATE: 'malika-ai-sidebar',
  },
  
  // Workflow deadline defaults (in days)
  WORKFLOW_DEADLINES: {
    ONBOARDING: 3,
    WAITING_FOR_DATA: 2,
    TRAINING_1: 7,
    WAITING_FOR_FEEDBACK_1: 3,
    TRAINING_2: 7,
    WAITING_FOR_FEEDBACK_2: 3,
    TRAINING_3: 7,
    INTEGRATION: 5,
  },
  
  // Error messages
  ERROR_MESSAGES: {
    NETWORK_ERROR: 'Network error. Please check your connection.',
    SERVER_ERROR: 'Server error. Please try again later.',
    VALIDATION_ERROR: 'Please check your input and try again.',
    UNAUTHORIZED: 'You are not authorized to perform this action.',
    NOT_FOUND: 'The requested resource was not found.',
    GENERIC: 'An unexpected error occurred.',
  },
  
  // Success messages
  SUCCESS_MESSAGES: {
    CREATED: 'Successfully created!',
    UPDATED: 'Successfully updated!',
    DELETED: 'Successfully deleted!',
    SAVED: 'Changes saved!',
  },
} as const;

// Export type for type safety
export type AppConfig = typeof CONFIG;

// Helper function to get nested config values safely
export const getConfig = <T extends keyof typeof CONFIG>(
  category: T
): typeof CONFIG[T] => {
  return CONFIG[category];
};

// Helper to check if value exceeds threshold
export const exceedsThreshold = (
  value: number,
  threshold: keyof typeof CONFIG.PRIORITY
): boolean => {
  return value >= CONFIG.PRIORITY[threshold];
};

// Helper to format error message
export const getErrorMessage = (
  type: keyof typeof CONFIG.ERROR_MESSAGES,
  customMessage?: string
): string => {
  return customMessage || CONFIG.ERROR_MESSAGES[type];
};