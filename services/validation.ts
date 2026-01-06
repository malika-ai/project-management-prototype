import { z } from 'zod';

// Client Schema
export const ClientSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  businessName: z.string().min(1, 'Business name is required').max(100),
  package: z.string().min(1, 'Package is required'),
  description: z.string().max(500, 'Description too long'),
  email: z.string().email('Invalid email format'),
  whatsapp: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid WhatsApp number'),
  businessField: z.string().min(1, 'Business field is required'),
  status: z.enum([
    'Onboarding',
    'Waiting for data',
    'Training #1',
    'Waiting for Feedback #1',
    'Training #2',
    'Waiting for Feedback #2',
    'Training #3',
    'Integration',
    'Active',
    'Drop'
  ]),
  joinedDate: z.string().datetime('Invalid date format'),
  totalTimeSpent: z.number().min(0, 'Time cannot be negative'),
  requirements: z.array(z.string()),
  addons: z.array(z.string())
});

// Task Schema
export const TaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, 'Title is required').max(200),
  projectId: z.string().min(1, 'Project ID is required'),
  division: z.enum(['Sales', 'Support', 'Trainer', 'IT', 'QC']),
  assignees: z.array(z.string()),
  isCompleted: z.boolean(),
  completedAt: z.string().datetime().optional(),
  timeSpent: z.number().min(0),
  activeUserIds: z.array(z.string()),
  timerSessions: z.record(z.string(), z.number()).optional(),
  deadline: z.string().datetime(),
  priority: z.enum(['Urgent', 'High', 'Regular', 'Low']),
  completionPercentage: z.number().min(0).max(100),
  lastProgressNote: z.string().optional(),
  subtasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    isCompleted: z.boolean(),
    completedAt: z.string().datetime().optional()
  })),
  createdAt: z.string().datetime()
});

// Team Member Schema
export const TeamMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['Manager', 'Leader', 'Sales', 'Support', 'Trainer', 'IT', 'Developer', 'QA']),
  avatar: z.string().url()
});

// Project Schema
export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  clientId: z.string().optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['Active', 'Completed', 'On Hold', 'Archived'])
});

// Export inferred types
export type ValidatedClient = z.infer<typeof ClientSchema>;
export type ValidatedTask = z.infer<typeof TaskSchema>;
export type ValidatedTeamMember = z.infer<typeof TeamMemberSchema>;
export type ValidatedProject = z.infer<typeof ProjectSchema>;

/**
 * Generic validation helper function
 */
export const validateData = <T>(
  schema: z.ZodSchema<T>, 
  data: unknown
): { 
  success: boolean; 
  data?: T; 
  errors?: z.ZodError['errors'] 
} => {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors };
    }
    throw error;
  }
};

/**
 * Safe parse helper that doesn't throw
 */
export const safeValidate = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } => {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return { success: false, error: errorMessage };
    }
    return { success: false, error: 'Unknown validation error' };
  }
};