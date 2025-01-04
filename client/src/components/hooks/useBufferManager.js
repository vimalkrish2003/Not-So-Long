import { useRef, useState, useCallback, useEffect } from "react";
import { useMutex } from "./useMutex";

const BUFFER_CONFIG = {
  INITIAL_STATE: {
    UNINITIALIZED: "UNINITIALIZED",
    INITIALIZED: "INITIALIZED",
    BUFFERING: "BUFFERING",
    READY: "READY",
    ERROR: "ERROR",
  },
  BUFFER_LEVELS: {
    LOW: 0.2, // 20% capacity triggers low buffer warning
    OPTIMAL: 0.6, // 60% capacity is target
    HIGH: 0.8, // 80% capacity triggers slowdown
  },
  SIZES: {
    ACTIVE_SIZE: 15 * 1024 * 1024, // 15MB active buffer (size of active buffer  )
    READY_SIZE: 10 * 1024 * 1024, // 10MB or more total size will trigger ready to playback
    STAGING_SIZE: 45 * 1024 * 1024, // 45MB staging buffer
    LOW_THRESHOLD: 45 * 1024 * 1024, // 45MB or less total size will trigger low Buffer warning
  },
};

export const useBufferManager = () => {
  const activeMutexA = useMutex();
  const activeMutexB = useMutex();
  const stagingMutex = useMutex();
  const sourceBufferRef = useRef(null);
  const optionsRef = useRef(null);
  const isPlayingRef = useRef(false);
  const maintenanceIntervalRef = useRef(null);

  //For testing
  const healthLogIntervalRef = useRef(null);
  const logHealth = useCallback(() => {
    const health = bufferHealth.current;
    console.log("=== Buffer Health ===");
    console.log("State:", health.state);
    console.log("Active A:", health.activeBufferA.size / 1024 / 1024, "MB");
    console.log("Active B:", health.activeBufferB.size / 1024 / 1024, "MB");
    console.log("Staging:", health.stagingBuffer.size / 1024 / 1024, "MB");
    console.log("Available:", health.AvailableSpace / 1024 / 1024, "MB");
    console.log("==================");
  }, []);

  // Enhanced buffer state with dual active buffers
  const bufferState = useRef({
    activeA: {
      chunks: [],
      metadata: { size: 0 },
      isActive: true, // Currently being consumed
    },
    activeB: {
      chunks: [],
      metadata: { size: 0 },
      isActive: false,
    },
    staging: {
      chunks: [],
      metadata: { size: 0 },
    },
    isSwapping: false,
  });

  // Enhanced health metrics
  const bufferHealth = useRef({
    state: BUFFER_CONFIG.INITIAL_STATE.UNINITIALIZED,
    activeBufferA: {
      size: 0,
      fullness: 0,
      isActive: true,
    },
    activeBufferB: {
      size: 0,
      fullness: 0,
      isActive: false,
    },
    stagingBuffer: {
      size: 0,
      fullness: 0,
    },
    AvailableSpace:
      BUFFER_CONFIG.SIZES.ACTIVE_SIZE + BUFFER_CONFIG.SIZES.STAGING_SIZE,
  });

  // Initialize function
  const initialize = useCallback((sourceBuffer, options = {}) => {
    sourceBufferRef.current = sourceBuffer;
    optionsRef.current = options;
    bufferHealth.current.state = BUFFER_CONFIG.INITIAL_STATE.INITIALIZED;

    // Start logging every 5 seconds
    healthLogIntervalRef.current = setInterval(logHealth, 5000);
  }, []);

  // Update buffer health metrics - No mutex needed
  const updateBufferHealth = useCallback(() => {
    const { activeA, activeB, staging } = bufferState.current;
    const currentActive = activeA.isActive ? activeA : activeB;
    const standbyBuffer = activeA.isActive ? activeB : activeA;
    const totalSize =
      activeA.metadata.size + activeB.metadata.size + staging.metadata.size;

    const newHealth = {
      state:
        currentActive.metadata.size >= BUFFER_CONFIG.SIZES.READY_SIZE
          ? BUFFER_CONFIG.INITIAL_STATE.READY
          : BUFFER_CONFIG.INITIAL_STATE.BUFFERING,
      activeBufferA: {
        size: activeA.metadata.size,
        fullness:
          (activeA.metadata.size / BUFFER_CONFIG.SIZES.ACTIVE_SIZE) * 100,
        isActive: activeA.isActive,
      },
      activeBufferB: {
        size: activeB.metadata.size,
        fullness:
          (activeB.metadata.size / BUFFER_CONFIG.SIZES.ACTIVE_SIZE) * 100,
        isActive: activeB.isActive,
      },
      stagingBuffer: {
        size: staging.metadata.size,
        fullness:
          (staging.metadata.size / BUFFER_CONFIG.SIZES.STAGING_SIZE) * 100,
      },
      AvailableSpace:
        BUFFER_CONFIG.SIZES.ACTIVE_SIZE -
        standbyBuffer.metadata.size +
        BUFFER_CONFIG.SIZES.STAGING_SIZE -
        staging.metadata.size,
    };

    // Check for state changes and trigger callbacks
    if (
      newHealth.state === BUFFER_CONFIG.INITIAL_STATE.READY &&
      bufferHealth.current.state !== BUFFER_CONFIG.INITIAL_STATE.READY
    ) {
      optionsRef.current?.onReadyForPlayback?.();
    }

    if (totalSize <= BUFFER_CONFIG.SIZES.LOW_THRESHOLD) {
      optionsRef.current?.onBufferLow?.({
        availableSpace: newHealth.AvailableSpace,
      });
    }

    bufferHealth.current = newHealth;
  }, []);

  // Get current active and standby buffers
  const getBuffers = useCallback(() => {
    const { activeA, activeB } = bufferState.current;
    return {
      current: activeA.isActive ? activeA : activeB,
      standby: activeA.isActive ? activeB : activeA,
      currentMutex: activeA.isActive ? activeMutexA : activeMutexB,
      standbyMutex: activeA.isActive ? activeMutexB : activeMutexA,
    };
  }, []);

  // Modified swap function to fill standby buffer
  const swapBuffers = useCallback(async () => {
    const { staging, isSwapping } = bufferState.current;
    const { standby, standbyMutex } = getBuffers();

    // Only check staging buffer availability
    if (isSwapping || staging.chunks.length === 0) {
      return;
    }

    await standbyMutex.acquire(1000);
    try {
      await stagingMutex.acquire(1000);
      try {
        bufferState.current.isSwapping = true;

        // Try to fill up to ACTIVE_SIZE
        const transferSize = Math.min(
          BUFFER_CONFIG.SIZES.ACTIVE_SIZE - standby.metadata.size,
          staging.metadata.size
        );

        if (transferSize <= 0) return;

        // Batch transfer chunks
        const chunksToTransfer = [];
        let transferredSize = 0;

        while (transferredSize < transferSize && staging.chunks.length > 0) {
          const chunk = staging.chunks.shift();
          chunksToTransfer.push(chunk);
          transferredSize += chunk.size;
        }

        standby.chunks.push(...chunksToTransfer);
        standby.metadata.size += transferredSize;
        staging.metadata.size -= transferredSize;
      } finally {
        stagingMutex.release();
      }
    } finally {
      bufferState.current.isSwapping = false;
      standbyMutex.release();
    }

    updateBufferHealth();
  }, [getBuffers, stagingMutex, updateBufferHealth]);

  // Switch active buffers
  const switchActiveBuffers = useCallback(async () => {
    const { activeA, activeB } = bufferState.current;

    // Switch active states
    activeA.isActive = !activeA.isActive;
    activeB.isActive = !activeB.isActive;

    // Get the newly inactive buffer (previously active)
    const previousActive = activeA.isActive ? activeB : activeA;

    // Immediately trigger refill of previous buffer
    if (previousActive.metadata.size < BUFFER_CONFIG.SIZES.ACTIVE_SIZE) {
      swapBuffers(); // Background buffer filling from staging buffer
    }

    updateBufferHealth();
  }, [updateBufferHealth, swapBuffers]);

  // Core buffer operations
  const operations = {
    addChunk: useCallback(
      async (chunk) => {
        const { activeA, activeB, staging } = bufferState.current;
        const { size, data } = chunk;

        // Get current active buffer
        const currentActive = activeA.isActive ? activeA : activeB;

        // Determine target buffer without mutex
        let targetBuffer;
        let targetMutex;

        if (currentActive.metadata.size < BUFFER_CONFIG.SIZES.READY_SIZE) {
          targetBuffer = currentActive;
          targetMutex = currentActive === activeA ? activeMutexA : activeMutexB;
        } else {
          const standbyBuffer = activeA.isActive ? activeB : activeA;
          if (standbyBuffer.metadata.size < BUFFER_CONFIG.SIZES.ACTIVE_SIZE) {
            targetBuffer = standbyBuffer;
            targetMutex =
              standbyBuffer === activeA ? activeMutexA : activeMutexB;
          } else {
            targetBuffer = staging;
            targetMutex = stagingMutex;
          }
        }

        const maxSize =
          targetBuffer === staging
            ? BUFFER_CONFIG.SIZES.STAGING_SIZE
            : BUFFER_CONFIG.SIZES.ACTIVE_SIZE;

        if (targetBuffer.metadata.size + size <= maxSize) {
          try {
            await targetMutex.acquire(1000);
            targetBuffer.chunks.push({ size, data });
            targetBuffer.metadata.size += size;
          } finally {
            targetMutex.release();
          }

          updateBufferHealth();
        }
      },
      [
        activeMutexA,
        activeMutexB,
        stagingMutex,
        updateBufferHealth,
        swapBuffers,
      ]
    ),

    removeChunk: useCallback(async () => {
      // Don't process chunks if not playing
      if (!isPlayingRef.current) {
        return;
      }
      // Check if sourceBuffer exists
      if (!sourceBufferRef.current) {
        console.warn("Buffer not initialized");
        return;
      }

      if (sourceBufferRef.current.updating) {
        return;
      }

      try {
        let { current, currentMutex } = getBuffers();
        await currentMutex.acquire(1000);

        try {
          // Check if current buffer is empty
          if (current.chunks.length === 0) {
            const { standby } = getBuffers();
            currentMutex.release();
            if (standby.metadata.size === 0) {
              return;
            }
            await switchActiveBuffers();
            ({ current, currentMutex } = getBuffers());
          }

          const chunk = current.chunks[0];
          if (!chunk) return;

          sourceBufferRef.current.appendBuffer(chunk.data);
          current.chunks.shift();
          current.metadata.size -= chunk.size;
        } finally {
          currentMutex.release();
        }

        updateBufferHealth();
      } catch (err) {
        console.error("Buffer operation failed:", err);
        throw new Error("Failed to process buffer chunk");
      }
    }, [getBuffers, switchActiveBuffers, updateBufferHealth]),
  };

  // Playback Control
  const controlPlayback = useCallback((shouldPlay) => {
    isPlayingRef.current = shouldPlay;

    // Clear existing interval if any
    if (maintenanceIntervalRef.current) {
      clearInterval(maintenanceIntervalRef.current);
      maintenanceIntervalRef.current = null;
    }

    // Start new interval if playing
    if (shouldPlay) {
      maintenanceIntervalRef.current = setInterval(() => {
        operations.removeChunk();
      }, 1000);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (maintenanceIntervalRef.current) {
        clearInterval(maintenanceIntervalRef.current);
      }
      if (healthLogIntervalRef.current) {
        clearInterval(healthLogIntervalRef.current);
      }
    };
  }, []);

  return {
    initialize,
    controlPlayback,
    get bufferHealth() {
      return bufferHealth.current;
    },
    operations: {
      addChunk: operations.addChunk,
      removeChunk: operations.removeChunk,
    },
  };
};

export default useBufferManager;
