import { useEffect, useRef, RefObject } from 'react';
import { Engine, Render, Runner, Composite } from 'matter-js'; // World removed as Composite.clear is used

/**
 * Custom hook to encapsulate Matter.js engine, renderer, and runner setup and control.
 * It handles initialization, starting/stopping based on an isRunning prop, and cleanup.
 */

interface UseMatterJSProps {
  /** Ref to the HTMLDivElement where the Matter.js canvas will be rendered. */
  sceneRef: RefObject<HTMLDivElement>;
  /** Optional width for the Matter.js canvas. Defaults to 800. */
  canvasWidth?: number;
  /** Optional height for the Matter.js canvas. Defaults to 600. */
  canvasHeight?: number;
  /** Boolean prop to control the running state of the Matter.js engine and renderer. Defaults to true. */
  isRunning?: boolean;
}

const useMatterJS = ({
  sceneRef,
  canvasWidth = 800,
  canvasHeight = 600,
  isRunning = true,
}: UseMatterJSProps) => {
  const engineRef = useRef<Engine | null>(null);
  const renderRef = useRef<Render | null>(null);
  const runnerRef = useRef<Runner | null>(null);

  useEffect(() => {
    if (!sceneRef.current) {
      console.warn("Scene ref is not available for Matter.js setup.");
      return;
    }

    // Create engine
    const engine = Engine.create();
    engineRef.current = engine;

    // Create renderer
    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: canvasWidth,
        height: canvasHeight,
        wireframes: false, // Default to false, can be overridden by options
        background: 'transparent', // Default background
      },
    });
    renderRef.current = render;

    // Create runner
    const runner = Runner.create();
    runnerRef.current = runner;

    // Initial setup of Matter.js engine, renderer, and runner.
    // This effect runs once on mount and cleans up on unmount.
    // The actual starting/stopping of Render and Runner is handled by the effect below,
    // but we create and prepare them here. If isRunning is true initially, they are started.
    if (isRunning) {
      Render.run(render); // Start rendering
      Runner.run(runner, engine); // Start the engine simulation loop
      console.log("Matter.js engine, renderer, and runner created and started (initial).");
    } else {
      console.log("Matter.js engine, renderer, and runner created but NOT started (initial isRunning is false).");
    }

    return () => {
      // This cleanup function runs when the component using the hook unmounts.
      console.log("Unmounting useMatterJS: Full cleanup of Matter.js engine, renderer, and runner.");
      if (renderRef.current) {
        Render.stop(renderRef.current);
        if (renderRef.current.canvas) {
          renderRef.current.canvas.remove(); // Important to remove the canvas element
        }
        renderRef.current = null;
      }
      if (runnerRef.current) {
        Runner.stop(runnerRef.current);
        runnerRef.current = null;
      }
      if (engineRef.current) {
        Composite.clear(engineRef.current.world, false, true); // Clear all composites, bodies, constraints from the world
        Engine.clear(engineRef.current); // Fully clear the engine
        engineRef.current = null;
      }
      console.log("Matter.js full cleanup complete.");
    };
  }, [sceneRef, canvasWidth, canvasHeight, isRunning]); // Added isRunning to handle initial start correctly within this effect.

  // Effect to dynamically start/stop the engine and renderer based on the isRunning prop.
  useEffect(() => {
    // Skip if this is the initial run and the main setup effect already handled it.
    // This check ensures this effect primarily handles changes to isRunning *after* initial setup.
    // However, the main setup effect now also considers initial isRunning, making this more about subsequent changes.
    // For simplicity and robustness, let this effect also try to set the state.
    // If Render.run or Runner.run are called multiple times, they generally handle it gracefully.

    const engine = engineRef.current;
    const render = renderRef.current;
    const runnerInstance = runnerRef.current; // Renamed to avoid conflict with 'Runner' module
    const renderInstance = renderRef.current; // Renamed to avoid conflict with 'Render' module

    if (engine && renderInstance && runnerInstance) {
      if (isRunning) {
        // Check if already running to avoid redundant console logs, though Matter.js handles multiple runs.
        // This is more for cleaner logging than strict necessity.
        if (!renderInstance.options.enabled || (runnerInstance && !runnerInstance.enabled)) {
            console.log("useMatterJS: Starting/Resuming Render and Runner due to isRunning change.");
        }
        Render.run(renderInstance);
        Runner.run(runnerInstance, engine);
      } else {
        // Similar check for stopping
        if (renderInstance.options.enabled || (runnerInstance && runnerInstance.enabled)) {
            console.log("useMatterJS: Stopping Render and Runner due to isRunning change.");
        }
        Render.stop(renderInstance);
        Runner.stop(runnerInstance);
      }
    }
    // This effect specifically handles dynamic start/stop.
    // Full cleanup of engine/render/runner instances is managed by the main setup useEffect on unmount.
  }, [isRunning]); // This effect reacts only to changes in the isRunning prop.

  // Expose the engineRef so the consuming component can interact with the Matter.js world (e.g., add bodies).
  return { engineRef };
};

export default useMatterJS;
