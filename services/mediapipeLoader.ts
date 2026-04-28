/**
 * Singleton MediaPipe preloader.
 * Loads WASM + HandLandmarker model once during splash screen.
 * CameraView reuses the cached instance — no lag on mode switch.
 */
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

let cachedLandmarker: HandLandmarker | null = null;
let loadPromise: Promise<HandLandmarker | null> | null = null;

export async function preloadMediaPipe(): Promise<HandLandmarker | null> {
  if (cachedLandmarker) return cachedLandmarker;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks("/mediapipe");

      const tryCreate = async (delegate: 'GPU' | 'CPU') => {
        return await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/mediapipe/hand_landmarker.task",
            delegate
          },
          runningMode: "VIDEO",
          numHands: 1
        });
      };

      try {
        const hasWebGPU = !!(navigator as any).gpu;
        cachedLandmarker = await tryCreate(hasWebGPU ? 'GPU' : 'CPU');
      } catch {
        try {
          cachedLandmarker = await tryCreate('CPU');
        } catch (e) {
          console.error('MediaPipe preload failed:', e);
          return null;
        }
      }

      console.log('✅ MediaPipe preloaded');
      return cachedLandmarker;
    } catch (e) {
      console.error('MediaPipe preload error:', e);
      return null;
    }
  })();

  return loadPromise;
}

export function getCachedLandmarker(): HandLandmarker | null {
  return cachedLandmarker;
}
