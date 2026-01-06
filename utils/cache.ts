import { CONFIG } from '../config/constants';
import { Client, Project, Task, TeamMember, AppSettings } from '../types';

/**
 * LocalStorage Cache Manager
 * Provides caching layer for application data
 */

interface CacheData {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  team: TeamMember[];
  settings?: AppSettings;
}

interface CacheEntry {
  data: CacheData;
  timestamp: number;
  version: string;
}

class LocalCache {
  private cacheKey: string;
  private version: string;
  private duration: number;

  constructor() {
    this.cacheKey = CONFIG.STORAGE_KEYS.CACHE;
    this.version = CONFIG.CACHE.VERSION;
    this.duration = CONFIG.CACHE.DURATION;
  }

  /**
   * Check if localStorage is available
   */
  private isAvailable(): boolean {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Save data to cache
   */
  save(data: CacheData): boolean {
    if (!this.isAvailable()) {
      console.warn('LocalStorage is not available');
      return false;
    }

    try {
      const cacheEntry: CacheEntry = {
        data,
        timestamp: Date.now(),
        version: this.version
      };

      localStorage.setItem(this.cacheKey, JSON.stringify(cacheEntry));
      console.log('[Cache] Data saved successfully');
      return true;
    } catch (error) {
      console.error('[Cache] Failed to save:', error);
      // Clear cache if quota exceeded
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.clear();
      }
      return false;
    }
  }

  /**
   * Load data from cache
   */
  load(): CacheData | null {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const cached = localStorage.getItem(this.cacheKey);
      
      if (!cached) {
        console.log('[Cache] No cached data found');
        return null;
      }

      const cacheEntry: CacheEntry = JSON.parse(cached);

      // Check version compatibility
      if (cacheEntry.version !== this.version) {
        console.log('[Cache] Version mismatch, clearing cache');
        this.clear();
        return null;
      }

      // Check if cache is expired
      const age = Date.now() - cacheEntry.timestamp;
      if (age > this.duration) {
        console.log('[Cache] Cache expired, clearing');
        this.clear();
        return null;
      }

      console.log('[Cache] Loaded data from cache (age: ' + Math.round(age / 1000) + 's)');
      return cacheEntry.data;
    } catch (error) {
      console.error('[Cache] Failed to load:', error);
      this.clear();
      return null;
    }
  }

  /**
   * Check if cache is valid
   */
  isValid(): boolean {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (!cached) return false;

      const cacheEntry: CacheEntry = JSON.parse(cached);
      
      // Check version
      if (cacheEntry.version !== this.version) return false;

      // Check expiration
      const age = Date.now() - cacheEntry.timestamp;
      return age <= this.duration;
    } catch {
      return false;
    }
  }

  /**
   * Clear cache
   */
  clear(): void {
    if (!this.isAvailable()) return;

    try {
      localStorage.removeItem(this.cacheKey);
      console.log('[Cache] Cache cleared');
    } catch (error) {
      console.error('[Cache] Failed to clear:', error);
    }
  }

  /**
   * Get cache age in milliseconds
   */
  getAge(): number | null {
    if (!this.isAvailable()) return null;

    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (!cached) return null;

      const cacheEntry: CacheEntry = JSON.parse(cached);
      return Date.now() - cacheEntry.timestamp;
    } catch {
      return null;
    }
  }

  /**
   * Get cache size in bytes
   */
  getSize(): number {
    if (!this.isAvailable()) return 0;

    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (!cached) return 0;
      
      return new Blob([cached]).size;
    } catch {
      return 0;
    }
  }

  /**
   * Partially update cache
   */
  update(partial: Partial<CacheData>): boolean {
    const current = this.load();
    if (!current) return false;

    return this.save({
      ...current,
      ...partial
    });
  }
}

// Export singleton instance
export const localCache = new LocalCache();

/**
 * User preferences cache
 */
export const userPreferences = {
  save: (preferences: Record<string, any>): void => {
    try {
      localStorage.setItem(
        CONFIG.STORAGE_KEYS.USER_PREFERENCES,
        JSON.stringify(preferences)
      );
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  },

  load: (): Record<string, any> | null => {
    try {
      const prefs = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_PREFERENCES);
      return prefs ? JSON.parse(prefs) : null;
    } catch {
      return null;
    }
  },

  clear: (): void => {
    try {
      localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_PREFERENCES);
    } catch (error) {
      console.error('Failed to clear preferences:', error);
    }
  }
};

/**
 * Theme persistence
 */
export const themeStorage = {
  save: (theme: 'light' | 'dark'): void => {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, theme);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  },

  load: (): 'light' | 'dark' | null => {
    try {
      const theme = localStorage.getItem(CONFIG.STORAGE_KEYS.THEME);
      return theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : null;
    } catch {
      return null;
    }
  }
};

/**
 * Sidebar state persistence
 */
export const sidebarStorage = {
  save: (isCollapsed: boolean): void => {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.SIDEBAR_STATE, String(isCollapsed));
    } catch (error) {
      console.error('Failed to save sidebar state:', error);
    }
  },

  load: (): boolean | null => {
    try {
      const state = localStorage.getItem(CONFIG.STORAGE_KEYS.SIDEBAR_STATE);
      return state === 'true';
    } catch {
      return null;
    }
  }
};