import React, { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';

interface GestureHandlerProps {
  setTreeForm: (isTree: boolean) => void;
  controlsRef: React.MutableRefObject<any>;
}

export const GestureHandler: React.FC<GestureHandlerProps> = ({ setTreeForm, controlsRef }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null);
  
  // Status & Telemetry
  const [status, setStatus] = useState<string>("Initializing AI...");
  const [rpm, setRpm] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(0); // 0% to 100%
  const [activation, setActivation] = useState<number>(0); // 0.0 to 1.0
  
  const [cameraActive, setCameraActive] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>("");

  const lastVideoTime = useRef(-1);
  const lastGestureTime = useRef(0);
  
  // Logic Refs
  const lastHandX = useRef<number | null>(null);
  const handVelocityRef = useRef(0);
  const cumulativeAzimuth = useRef(0);
  
  const targetPolar = useRef(Math.PI / 3);
  const targetDistance = useRef(20); 
  const inputMagnitudeRef = useRef(0); 
  
  // Track if we are currently "holding" the tree via gesture
  const isGestureActiveRef = useRef(false);

  // 1. Initialize MediaPipe
  useEffect(() => {
    let active = true;
    const loadModel = async () => {
      try {
        setStatus("Loading Vision Model...");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        if (!active) return;
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        if (active) {
            setLandmarker(handLandmarker);
            setStatus("Ready. Enable Camera.");
            startCamera();
        }
      } catch (e: any) {
        console.error("Model Error:", e);
        setStatus("AI Load Failed");
      }
    };
    loadModel();
    return () => { active = false; };
  }, []);

  // 2. Camera Logic
  const startCamera = async (specificDeviceId?: string) => {
    if (!videoRef.current) return;
    if (videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    const constraints: MediaStreamConstraints = { 
        video: { 
            width: 480, height: 360, // Request higher res for the larger view
            deviceId: specificDeviceId ? { exact: specificDeviceId } : undefined,
            facingMode: specificDeviceId ? undefined : 'user'
        } 
    };
    try {
        setStatus("Connecting Camera...");
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().then(() => {
                setCameraActive(true);
                setStatus("STANDBY");
                const track = stream.getVideoTracks()[0];
                if (track.getSettings().deviceId) setCurrentDeviceId(track.getSettings().deviceId || "");
                navigator.mediaDevices.enumerateDevices().then(devs => {
                    setDevices(devs.filter(d => d.kind === 'videoinput'));
                });
            }).catch(() => setStatus("Click Enable"));
        };
    } catch (e) {
        setStatus("Camera Denied");
    }
  };

  const handleSwitchCamera = () => {
      if (devices.length < 2) return;
      const idx = devices.findIndex(d => d.deviceId === currentDeviceId);
      startCamera(devices[(idx + 1) % devices.length].deviceId);
  };

  // Helper to release control back to physics
  const releaseControl = () => {
      if (isGestureActiveRef.current) {
          isGestureActiveRef.current = false;
          if (controlsRef.current) {
              controlsRef.current.autoRotate = true; 
          }
      }
      setStatus("IDLE");
      inputMagnitudeRef.current = 0;
      setActivation(0);
      lastHandX.current = null; // Reset velocity tracking
  };

  // 3. Main Loop
  useFrame((state, delta) => {
    if (!landmarker || !videoRef.current || !cameraActive) return;

    if (videoRef.current.readyState >= 2 && videoRef.current.currentTime !== lastVideoTime.current) {
      lastVideoTime.current = videoRef.current.currentTime;
      const now = performance.now();
      const result = landmarker.detectForVideo(videoRef.current, now);

      if (result.landmarks && result.landmarks.length > 0) {
        const hand2D = result.landmarks[0];
        const wrist2D = hand2D[0];
        const middleMCP2D = hand2D[9];
        
        // --- A. Gesture Scale (Zoom Control) ---
        const handSize2D = Math.sqrt(Math.pow(middleMCP2D.x - wrist2D.x, 2) + Math.pow(middleMCP2D.y - wrist2D.y, 2));
        
        const zoomInput = THREE.MathUtils.clamp((handSize2D - 0.05) / (0.20 - 0.05), 0, 1);
        const minDist = 12;
        const maxDist = 35;
        const desiredDistance = THREE.MathUtils.lerp(maxDist, minDist, zoomInput); 
        targetDistance.current = THREE.MathUtils.lerp(targetDistance.current, desiredDistance, 0.1);


        // --- B. Open/Close Trigger Logic (3D) ---
        let opennessRatio = 0;
        const tips = [4, 8, 12, 16, 20];
        
        if (result.worldLandmarks && result.worldLandmarks.length > 0) {
            const hand3D = result.worldLandmarks[0];
            const wrist3D = hand3D[0];
            const middleMCP3D = hand3D[9];
            const handScale3D = Math.sqrt(
                Math.pow(middleMCP3D.x - wrist3D.x, 2) + 
                Math.pow(middleMCP3D.y - wrist3D.y, 2) + 
                Math.pow(middleMCP3D.z - wrist3D.z, 2)
            );
            let totalTipDist3D = 0;
            tips.forEach(idx => {
                const tip = hand3D[idx];
                totalTipDist3D += Math.sqrt(
                    Math.pow(tip.x - wrist3D.x, 2) + 
                    Math.pow(tip.y - wrist3D.y, 2) + 
                    Math.pow(tip.z - wrist3D.z, 2)
                );
            });
            opennessRatio = totalTipDist3D / 5 / (handScale3D || 0.01);
        } else {
            let totalTipDist2D = 0;
            tips.forEach(idx => {
                const tip = hand2D[idx];
                totalTipDist2D += Math.sqrt(Math.pow(tip.x - wrist2D.x, 2) + Math.pow(tip.y - wrist2D.y, 2));
            });
            opennessRatio = totalTipDist2D / 5 / (handSize2D || 0.1);
        }

        const rawActivation = THREE.MathUtils.clamp((opennessRatio - 1.2) / (1.7 - 1.2), 0, 1);
        setActivation(rawActivation);


        // --- C. VELOCITY BASED ROTATION (The "Globe Spin") ---
        const handX = 1 - wrist2D.x; // Invert so Right is Right
        const handY = wrist2D.y;

        // 1. Calculate Hand Velocity
        if (lastHandX.current !== null) {
            const deltaX = handX - lastHandX.current;
            // Velocity = distance / time. 
            // We apply a multiplier for "Mechanical Advantage" (Gearing)
            // A multiplier of 15 means moving hand across screen in 1 sec rotates tree ~2.5 times
            const rawVelocity = (deltaX / delta) * 3.0; 
            
            // Smooth it out slightly to remove camera jitter
            handVelocityRef.current = THREE.MathUtils.lerp(handVelocityRef.current, rawVelocity, 0.4);
        }
        lastHandX.current = handX;

        // 2. Apply Velocity if Significant (Clutch)
        // If hand is moving fast enough, we engage the motor
        const velocityThreshold = 0.2; 
        
        if (Math.abs(handVelocityRef.current) > velocityThreshold) {
            isGestureActiveRef.current = true;
            setStatus(handVelocityRef.current > 0 ? ">>> SWIPING RIGHT" : "<<< SWIPING LEFT");
            inputMagnitudeRef.current = handVelocityRef.current; // For RPM display

            if (controlsRef.current) {
                const controls = controlsRef.current as OrbitControls;
                controls.autoRotate = false;
                
                // Directly apply velocity to rotation
                const angleChange = handVelocityRef.current * delta * 2.5; // Gain factor
                const currentAz = controls.getAzimuthalAngle();
                controls.setAzimuthalAngle(currentAz - angleChange);
                cumulativeAzimuth.current += angleChange;
            }
        } else {
             // Hand is visible but still. 
             // We release control to let momentum take over, OR we could "Hold" it.
             // "Globe spin" feel suggests releasing control allows momentum.
             if (isGestureActiveRef.current) {
                 releaseControl();
             } else {
                 setStatus("TRACKING - MOVE TO SPIN");
                 inputMagnitudeRef.current = 0;
             }
        }


        // --- D. Apply Height & Zoom Physics ---
        targetPolar.current = THREE.MathUtils.clamp(handY * Math.PI, 0.1, Math.PI / 2);
        
        if (controlsRef.current) {
            const controls = controlsRef.current as OrbitControls;
            
            // Height
            const currentPol = controls.getPolarAngle();
            controls.setPolarAngle(THREE.MathUtils.lerp(currentPol, targetPolar.current, 0.1));

            // Zoom
            const offset = new THREE.Vector3().copy(controls.object.position).sub(controls.target);
            const spherical = new THREE.Spherical().setFromVector3(offset);
            spherical.radius = THREE.MathUtils.lerp(spherical.radius, targetDistance.current, 0.05);
            spherical.radius = THREE.MathUtils.clamp(spherical.radius, minDist, maxDist);
            offset.setFromSpherical(spherical);
            controls.object.position.copy(controls.target).add(offset);
            controls.update(); 
            
            const pct = 1 - (spherical.radius - minDist) / (maxDist - minDist);
            setZoomLevel(pct * 100);
        }

        // --- E. Triggers ---
        const clockTime = state.clock.elapsedTime;
        if (clockTime - lastGestureTime.current > 0.5) {
            if (opennessRatio > 1.7) { 
                setTreeForm(false);
                setStatus("TRIGGER: EXPLODE");
                lastGestureTime.current = clockTime;
            } else if (opennessRatio < 1.3) {
                setTreeForm(true);
                setStatus("TRIGGER: ASSEMBLE");
                lastGestureTime.current = clockTime;
            }
        }
      } else {
          releaseControl();
      }
    }
    
    // Telemetry Update (Show Speed relative to typical swipe)
    const displayRPM = (Math.abs(inputMagnitudeRef.current) * 20); 
    setRpm(prev => THREE.MathUtils.lerp(prev, displayRPM, 0.1));
  });

  return (
    <Html fullscreen style={{ pointerEvents: 'none', zIndex: 100 }}>
        <div className="absolute bottom-8 left-8 pointer-events-auto flex flex-col gap-2">
            
            {/* --- FLIGHT DECK HUD (ENLARGED) --- */}
            {/* increased width from w-80 (20rem) to w-[400px] and adjusted height */}
            <div className="relative w-[400px] bg-black/80 border border-yellow-600/40 rounded-xl overflow-hidden backdrop-blur-md shadow-[0_0_30px_rgba(0,0,0,0.6)]">
                
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-yellow-900/20 border-b border-yellow-600/30">
                    <span className="text-xs text-yellow-500 font-bold tracking-widest">GESTURE COMMAND LINK</span>
                    <div className="flex gap-2">
                         <div className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`} />
                    </div>
                </div>

                <div className="flex h-56"> 
                    {/* Video Area - Larger */}
                    <div className="relative w-[280px] group border-r border-yellow-600/30 bg-black">
                        <video 
                            ref={videoRef} 
                            className="w-full h-full object-cover transform scale-x-[-1] opacity-70 mix-blend-screen"
                            playsInline 
                            muted 
                        />
                        
                        {/* Dynamic Grid Overlay */}
                        <div className="absolute inset-0 opacity-20 pointer-events-none">
                            <div className="w-full h-full grid grid-cols-4 grid-rows-4">
                                {[...Array(16)].map((_, i) => (
                                    <div key={i} className="border-[0.5px] border-yellow-400/30"></div>
                                ))}
                            </div>
                        </div>
                        
                        {/* ACTIVATION BAR OVERLAY */}
                        <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gray-800">
                             <div 
                                className={`h-full transition-all duration-100 ${activation > 0.9 ? 'bg-red-500 shadow-[0_0_15px_#ef4444]' : 'bg-yellow-500'}`}
                                style={{ width: `${activation * 100}%` }}
                             />
                        </div>
                        <div className="absolute bottom-2 left-2 text-[9px] font-bold text-yellow-500 tracking-wider bg-black/50 px-1 rounded">
                            GESTURE INTENSITY
                        </div>

                        {!cameraActive && (
                            <button 
                                onClick={() => startCamera()}
                                className="absolute inset-0 flex items-center justify-center bg-black/60 hover:bg-black/40 text-yellow-400 font-bold tracking-[0.2em] text-lg transition-all"
                            >
                                ACTIVATE CAMERA
                            </button>
                        )}
                        {cameraActive && devices.length > 1 && (
                            <button onClick={handleSwitchCamera} className="absolute top-2 right-2 p-2 text-yellow-500/50 hover:text-yellow-400 bg-black/20 rounded-full">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                            </button>
                        )}
                    </div>

                    {/* Vertical Gauges - Adjusted for height */}
                    <div className="flex-1 bg-black/40 flex flex-col justify-between p-3 gap-2">
                        {/* Zoom Gauge */}
                        <div className="h-full flex flex-col items-center justify-end relative w-full bg-yellow-900/10 rounded border border-yellow-600/20 overflow-hidden">
                            <div 
                                className="w-full bg-gradient-to-t from-yellow-600/60 to-yellow-400/20 transition-all duration-300 ease-out"
                                style={{ height: `${zoomLevel}%` }}
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-[9px] text-yellow-500 font-bold tracking-widest rot-90 transform -rotate-90 whitespace-nowrap">DISTANCE</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Telemetry Panel */}
                <div className="grid grid-cols-2 gap-px bg-yellow-600/30">
                    <div className="bg-black/90 p-3 flex flex-col justify-center items-center border-r border-yellow-900/50">
                        <span className="text-[9px] text-gray-500 uppercase tracking-widest">Swipe Speed</span>
                        <div className="text-xl font-mono font-bold text-yellow-400 tabular-nums leading-none mt-1">
                            {rpm.toFixed(0)} <span className="text-[9px] font-normal text-yellow-600">Vel</span>
                        </div>
                    </div>
                    <div className="bg-black/90 p-3 flex flex-col justify-center items-center">
                         <span className="text-[9px] text-gray-500 uppercase tracking-widest">Proximity</span>
                        <div className="text-xl font-mono font-bold text-emerald-400 tabular-nums leading-none mt-1">
                            {zoomLevel.toFixed(0)}<span className="text-[12px]">%</span>
                        </div>
                    </div>
                </div>

                {/* Status Bar */}
                <div className="px-4 py-2 bg-black/80 border-t border-yellow-600/30 flex justify-between items-center">
                    <span className="text-[10px] font-mono text-yellow-200/90 truncate max-w-[280px]">{status}</span>
                </div>
            </div>
        </div>
    </Html>
  );
};