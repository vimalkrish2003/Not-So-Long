import { useRef, useCallback } from 'react';

export const useMutex = () => {
  const locked = useRef(false);
  const queue = useRef([]);
  
  const acquire = useCallback((timeout = 5000) => {
    return new Promise((resolve, reject) => {
      if (!locked.current) {
        locked.current = true;
        resolve();
      } else {
        // Add timeout for deadlock prevention
        const timeoutId = setTimeout(() => {
          const index = queue.current.findIndex(q => q.reject === reject);
          if (index !== -1) {
            queue.current.splice(index, 1);
            reject(new Error('Mutex acquire timeout'));
          }
        }, timeout);

        queue.current.push({
          resolve: () => {
            clearTimeout(timeoutId);
            resolve();
          },
          reject,
          timeoutId
        });
      }
    });
  }, []);

  const release = useCallback(() => {
    const next = queue.current.shift();
    if (next) {
      clearTimeout(next.timeoutId);
      next.resolve();
    } else {
      locked.current = false;
    }
  }, []);

  return { acquire, release };
};