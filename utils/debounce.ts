/**
 * Debouncing and Throttling Utilities
 * Helps optimize performance by limiting function calls
 */

/**
 * Debounce function - delays execution until after delay ms have passed since last call
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Debounce with immediate execution on first call
 */
export function debounceImmediate<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastCallTime = 0;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();

    // Execute immediately if enough time has passed
    if (now - lastCallTime > delay) {
      func.apply(this, args);
      lastCallTime = now;
    }

    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Set new timeout for subsequent calls
    timeoutId = setTimeout(() => {
      func.apply(this, args);
      lastCallTime = Date.now();
      timeoutId = null;
    }, delay);
  };
}

/**
 * Throttle function - ensures function is called at most once per specified period
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastResult: ReturnType<T>;

  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      lastResult = func.apply(this, args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }

    return lastResult;
  };
}

/**
 * Throttle with trailing call - ensures last call is always executed
 */
export function throttleTrailing<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    lastArgs = args;

    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
        
        // Execute with last arguments if they exist
        if (lastArgs !== null) {
          func.apply(this, lastArgs);
          lastArgs = null;
        }
      }, limit);
    }
  };
}

/**
 * Debounced promise - useful for API calls
 */
export function debouncePromise<T extends (...args: any[]) => Promise<any>>(
  func: T,
  delay: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let rejectPrevious: ((reason?: any) => void) | null = null;

  return function (this: any, ...args: Parameters<T>): Promise<ReturnType<T>> {
    // Cancel previous pending call
    if (rejectPrevious) {
      rejectPrevious(new Error('Debounced'));
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    return new Promise((resolve, reject) => {
      rejectPrevious = reject;

      timeoutId = setTimeout(async () => {
        try {
          const result = await func.apply(this, args);
          resolve(result);
          rejectPrevious = null;
        } catch (error) {
          reject(error);
          rejectPrevious = null;
        }
      }, delay);
    });
  };
}

/**
 * Rate limiter - limits number of calls within a time window
 */
export function rateLimit<T extends (...args: any[]) => any>(
  func: T,
  maxCalls: number,
  timeWindow: number
): (...args: Parameters<T>) => ReturnType<T> | null {
  const calls: number[] = [];

  return function (this: any, ...args: Parameters<T>): ReturnType<T> | null {
    const now = Date.now();

    // Remove calls outside the time window
    while (calls.length > 0 && calls[0] <= now - timeWindow) {
      calls.shift();
    }

    // Check if we can make another call
    if (calls.length < maxCalls) {
      calls.push(now);
      return func.apply(this, args);
    }

    console.warn(`Rate limit exceeded: ${maxCalls} calls per ${timeWindow}ms`);
    return null;
  };
}

/**
 * Batch calls - collect multiple calls and execute once
 */
export function batchCalls<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let batchArgs: Parameters<T>[] = [];
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    batchArgs.push(args);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      // Call function once with all batched arguments
      const allArgs = [...batchArgs];
      batchArgs = [];
      timeoutId = null;

      // Execute function for each batched call
      allArgs.forEach(argSet => {
        func.apply(this, argSet);
      });
    }, delay);
  };
}

/**
 * Memoize function results
 */
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  getKey?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return function (this: any, ...args: Parameters<T>): ReturnType<T> {
    const key = getKey ? getKey(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = func.apply(this, args);
    cache.set(key, result);
    return result;
  } as T;
}

/**
 * Memoize with expiration
 */
export function memoizeWithExpiry<T extends (...args: any[]) => any>(
  func: T,
  ttl: number,
  getKey?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, { value: ReturnType<T>; expiry: number }>();

  return function (this: any, ...args: Parameters<T>): ReturnType<T> {
    const key = getKey ? getKey(...args) : JSON.stringify(args);
    const now = Date.now();

    const cached = cache.get(key);
    if (cached && cached.expiry > now) {
      return cached.value;
    }

    const result = func.apply(this, args);
    cache.set(key, {
      value: result,
      expiry: now + ttl
    });

    return result;
  } as T;
}

/**
 * Example usage with React hooks
 */
import { useCallback, useRef, useEffect } from 'react';

export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  ) as T;
}

export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  limit: number
): T {
  const callbackRef = useRef(callback);
  const inThrottleRef = useRef(false);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    (...args: Parameters<T>) => {
      if (!inThrottleRef.current) {
        callbackRef.current(...args);
        inThrottleRef.current = true;

        setTimeout(() => {
          inThrottleRef.current = false;
        }, limit);
      }
    },
    [limit]
  ) as T;
}