import React, { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './components/Scene';

interface OverlayProps {
  isTreeForm: boolean;
  onToggleForm: () => void;
}

const Overlay: React.FC<OverlayProps> = ({ isTreeForm, onToggleForm }) => (
  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 z-10">
    <div className="text-center md:text-left pointer-events-none">
      <h1 className="text-4xl md:text-6xl font-serif text-yellow-500 font-bold tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" style={{ fontFamily: '"Cinzel", serif' }}>
        GRAND LUXURY
      </h1>
      <h2 className="text-xl md:text-3xl font-serif text-emerald-400 italic mt-2 tracking-wide" style={{ fontFamily: '"Playfair Display", serif' }}>
        Interactive Collection
      </h2>
    </div>

    {/* Center Interaction Button - Moved to Bottom Right to clear view */}
    <div className="absolute bottom-8 right-8 pointer-events-auto flex flex-col gap-4 items-end">
        <div className="bg-black/60 backdrop-blur-md p-4 border border-yellow-600/50 rounded-lg max-w-xs text-right mb-2">
            <p className="text-yellow-200 font-serif text-sm tracking-wider">
              GESTURE CONTROLS
            </p>
            <p className="text-emerald-500 text-xs mt-1 uppercase tracking-widest leading-relaxed">
              SWIPE HAND to Spin<br/>
              MOVE CLOSER to Zoom<br/>
              OPEN PALM to Explode
            </p>
        </div>

        <button 
          onClick={onToggleForm}
          className="group relative px-10 py-4 bg-black/80 backdrop-blur-md border border-yellow-500 text-yellow-400 font-serif tracking-[0.25em] text-lg rounded-sm transition-all hover:bg-yellow-500 hover:text-black hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,215,0,0.2)]"
        >
          <span className="relative z-10 font-bold">
            {isTreeForm ? "EXPLODE VIEW" : "ASSEMBLE"}
          </span>
          <div className="absolute inset-0 bg-yellow-500/20 scale-x-0 group-hover:scale-x-100 transition-transform origin-right duration-500 ease-out" />
        </button>
    </div>
  </div>
);

const Loading = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
    <div className="text-yellow-500 font-serif text-xl animate-pulse tracking-widest">
      ASSEMBLING LUXURY...
    </div>
  </div>
);

const App = () => {
  const [isTreeForm, setIsTreeForm] = useState(true);

  return (
    <div className="w-full h-full bg-black relative">
      <Overlay isTreeForm={isTreeForm} onToggleForm={() => setIsTreeForm(!isTreeForm)} />
      
      <Canvas 
        shadows 
        dpr={[1, 2]} 
        gl={{ 
          antialias: false,
          stencil: false,
          depth: true,
          powerPreference: "high-performance"
        }}
      >
        <Suspense fallback={null}>
          <Scene isTreeForm={isTreeForm} setTreeForm={setIsTreeForm} />
        </Suspense>
      </Canvas>
      
      <Suspense fallback={<Loading />}>
         {/* Hidden loader to trigger Suspense boundary */}
      </Suspense>
    </div>
  );
};

export default App;