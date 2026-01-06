/**
 * Input Sanitization Utilities
 * Prevents XSS and injection attacks
 */

/**
 * Basic input sanitization without external dependencies
 */
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and > characters
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers like onclick=
};

/**
 * Email sanitization
 */
export const sanitizeEmail = (email: string): string => {
  if (typeof email !== 'string') return '';
  return email.toLowerCase().trim();
};

/**
 * Phone number sanitization
 * Keeps only digits and + sign
 */
export const sanitizePhone = (phone: string): string => {
  if (typeof phone !== 'string') return '';
  return phone.replace(/[^\d+]/g, '');
};

/**
 * URL sanitization
 * Only allows http and https protocols
 */
export const sanitizeUrl = (url: string): string => {
  if (typeof url !== 'string') return '';
  
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return url;
  } catch {
    return '';
  }
};

/**
 * Sanitize object with multiple fields
 */
export const sanitizeObject = <T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): T => {
  const sanitized = { ...obj };
  
  fields.forEach(field => {
    if (typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizeInput(sanitized[field] as string) as T[keyof T];
    }
  });
  
  return sanitized;
};

/**
 * Remove SQL injection patterns
 */
export const sanitizeSQLInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[';--]/g, '') // Remove SQL comment and statement terminators
    .replace(/(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/gi, ''); // Remove OR/AND 1=1 patterns
};

/**
 * Sanitize filename for safe file operations
 */
export const sanitizeFilename = (filename: string): string => {
  if (typeof filename !== 'string') return '';
  
  return filename
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace unsafe characters with underscore
    .replace(/\.+/g, '.') // Replace multiple dots with single dot
    .replace(/^\./, '') // Remove leading dot
    .substring(0, 255); // Limit length
};

/**
 * For rich text content with HTML (requires DOMPurify)
 * Note: Install with: npm install dompurify @types/dompurify
 */
import DOMPurify from 'dompurify';

export const sanitizeHtml = (html: string): string => {
  if (typeof html !== 'string') return '';
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOW_DATA_ATTR: false
  });
};

/**
 * Sanitize and validate ID
 */
export const sanitizeId = (id: string): string => {
  if (typeof id !== 'string') return '';
  
  return id
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .substring(0, 50);
};

/**
 * Create a safe form data sanitizer
 */
export const createFormSanitizer = <T extends Record<string, any>>(
  config: {
    stringFields?: (keyof T)[];
    emailFields?: (keyof T)[];
    phoneFields?: (keyof T)[];
    urlFields?: (keyof T)[];
    numberFields?: (keyof T)[];
  }
) => {
  return (formData: T): T => {
    const sanitized = { ...formData };
    
    // Sanitize string fields
    config.stringFields?.forEach(field => {
      if (typeof sanitized[field] === 'string') {
        sanitized[field] = sanitizeInput(sanitized[field] as string) as T[keyof T];
      }
    });
    
    // Sanitize email fields
    config.emailFields?.forEach(field => {
      if (typeof sanitized[field] === 'string') {
        sanitized[field] = sanitizeEmail(sanitized[field] as string) as T[keyof T];
      }
    });
    
    // Sanitize phone fields
    config.phoneFields?.forEach(field => {
      if (typeof sanitized[field] === 'string') {
        sanitized[field] = sanitizePhone(sanitized[field] as string) as T[keyof T];
      }
    });
    
    // Sanitize URL fields
    config.urlFields?.forEach(field => {
      if (typeof sanitized[field] === 'string') {
        sanitized[field] = sanitizeUrl(sanitized[field] as string) as T[keyof T];
      }
    });
    
    // Ensure number fields are numbers
    config.numberFields?.forEach(field => {
      const value = sanitized[field];
      if (typeof value === 'string') {
        const num = parseFloat(value);
        sanitized[field] = (isNaN(num) ? 0 : num) as T[keyof T];
      }
    });
    
    return sanitized;
  };
};

/**
 * Example usage of form sanitizer
 */
export const sanitizeClientFormData = createFormSanitizer<{
  name: string;
  businessName: string;
  email: string;
  whatsapp: string;
  description: string;
  businessField: string;
}>({
  stringFields: ['name', 'businessName', 'description', 'businessField'],
  emailFields: ['email'],
  phoneFields: ['whatsapp']
});

export const sanitizeTaskFormData = createFormSanitizer<{
  title: string;
  projectId: string;
  lastProgressNote?: string;
}>({
  stringFields: ['title', 'projectId', 'lastProgressNote']
});