import React, { useEffect, useRef, useState } from 'react';
import { HandLandmarker, DrawingUtils, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { FEATURE_DIM, SEQUENCE_LENGTH } from '../constants';
import { getCachedLandmarker, preloadMediaPipe } from '../services/mediapipeLoader';

type CameraViewProps = {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  // Parent provides a mutable ref to receive per-frame feature arrays
  sequenceBufferRef: React.MutableRefObject<number[][]>;
};

const CameraView: React.FC<CameraViewProps> = ({ videoRef, canvasRef, sequenceBufferRef }) => {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      if (!window.isSecureContext && !window.location.hostname.startsWith('localhost')) {
        setLoading(false);
        setErrorMessage('Insecure context: camera access requires HTTPS or localhost. Use ngrok/localtunnel or open on localhost.');
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setLoading(false);
        setErrorMessage('Browser API not supported: getUserMedia is unavailable in this environment. Open in a modern browser (Chrome/Edge/Firefox) or use HTTPS.');
        return;
      }

      try {
        // Use preloaded instance if available, otherwise load now
        let landmarker = getCachedLandmarker();
        if (!landmarker) {
          landmarker = await preloadMediaPipe();
        }

        if (!landmarker) {
          setLoading(false);
          setErrorMessage('Failed to initialize MediaPipe. Try a different browser or device.');
          return;
        }

        if (!isMounted) return;
        handLandmarkerRef.current = landmarker;
        setLoading(false);
        startCamera();
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
        if (isMounted) {
          setLoading(false);
          setErrorMessage("Failed to load AI Model or required Web APIs are missing. Try a supported browser.");
        }
      }
    };

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
            videoRef.current?.play().catch(e => console.error("Play error:", e));
            predictWebcam();
          };
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setErrorMessage("Camera access denied or failed. Please check permissions.");
      }
    };

    const makeFixed = (arr: number[]) => {
      if (!arr) return new Array(FEATURE_DIM).fill(0);
      const a = arr.slice(0);
      if (a.length === FEATURE_DIM) return a;
      if (a.length > FEATURE_DIM) return a.slice(0, FEATURE_DIM);
      return a.concat(new Array(FEATURE_DIM - a.length).fill(0));
    };

    const processLandmarks = (result: HandLandmarkerResult) => {
      if (result.landmarks && result.landmarks.length > 0) {
        const hand = result.landmarks[0];
        // Push raw landmark coords — backend handles model-specific preprocessing
        const flattened: number[] = [];
        for (const lm of hand) {
          flattened.push(lm.x, lm.y, lm.z);
        }
        sequenceBufferRef.current.push(makeFixed(flattened));
      } else {
        sequenceBufferRef.current.push(new Array(FEATURE_DIM).fill(0));
      }

      if (sequenceBufferRef.current.length > SEQUENCE_LENGTH) sequenceBufferRef.current.shift();
    };

    const predictWebcam = () => {
      if (!videoRef.current || !canvasRef.current || !handLandmarkerRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      let startTimeMs = performance.now();

      try {
        const results = handLandmarkerRef.current.detectForVideo(video, startTimeMs);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.landmarks) {
          const drawingUtils = new DrawingUtils(ctx);
          for (const landmarks of results.landmarks) {
            drawingUtils.drawConnectors(landmarks, (HandLandmarker as any).HAND_CONNECTIONS, {
              color: '#8B5CF6', lineWidth: 3
            });
            drawingUtils.drawLandmarks(landmarks, { color: '#FFFFFF', radius: 4, lineWidth: 2 });
          }

          processLandmarks(results);
        }
      } catch (e) {
        console.error(e);
      }

      animationFrameId.current = requestAnimationFrame(predictWebcam);
    };

    initialize();

    return () => {
      isMounted = false;
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
      }
      // Don't close the shared landmarker — it's reused across modes
      handLandmarkerRef.current = null;
    };
  }, [canvasRef, sequenceBufferRef, videoRef]);

  return (
    <div className="relative w-full bg-black overflow-hidden" style={{ aspectRatio: '4/3' }}>
      {errorMessage ? (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-gray-900 p-6 text-center">
          <div>
            <div className="text-red-500 text-4xl mb-4">📷</div>
            <p className="text-red-400 font-semibold">{errorMessage}</p>
            <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-gray-700 rounded-lg text-sm hover:bg-gray-600 transition">Retry</button>
          </div>
        </div>
      ) : loading && (
        <div className="absolute inset-0 flex items-center justify-center z-30">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-mono text-accent animate-pulse">LOADING AI MODELS...</p>
          </div>
        </div>
      )}

      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none" />
    </div>
  );
};

export default CameraView;
