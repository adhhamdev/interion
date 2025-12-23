import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Wand2, Download, Layout, Sliders, MessageSquare, Undo2,
  Armchair, Plus, Trash2, Sun, Moon, Mic, MicOff, Lightbulb, 
  Sparkles, Baby, ShieldCheck, SunMedium, Palette, Info, CheckCircle2,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Settings2,
  AlertCircle, X, CheckCircle, Sparkle, Film, Play, Video, Share2,
  Monitor, Smartphone, Wind, Gauge, Palette as PaletteIcon, RotateCcw
} from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Button } from './components/Button';
import { Input, TextArea } from './components/Input';
import { Select } from './components/Select';
import { generateDesignIteration, generateDesignVideo } from './services/geminiService';
import { 
  RoomType, DesignStyle, BudgetLevel, DesignState, DesignVersion, CustomItem, VideoState, VideoVersion
} from './types';

// --- Types ---
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

type Mode = 'landing' | 'design' | 'video';

// --- Utils ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function createBlob(data: Float32Array): any {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) int16[i] = data[i] * 32768;
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const VIBE_PRESETS = [
  { id: 'kid-friendly', label: 'Kid Friendly', icon: Baby, desc: 'Safe for children' },
  { id: 'pet-friendly', label: 'Pet Friendly', icon: ShieldCheck, desc: 'Durable for pets' },
  { id: 'natural-light', label: 'More Light', icon: SunMedium, desc: 'Brighter feel' },
  { id: 'social', label: 'Entertaining', icon: Sparkles, desc: 'Better for guests' },
];

const INITIAL_STATE: DesignState = {
  roomType: RoomType.LIVING_ROOM,
  style: DesignStyle.MODERN,
  mood: 'Cozy and inviting',
  budget: BudgetLevel.MID,
  instructions: '',
  lockedElements: '',
  customItems: [],
  selectedPresets: []
};

const INITIAL_VIDEO_STATE: VideoState = {
  resolution: '720p',
  aspectRatio: '16:9',
  style: 'Cinematic Architectural Showcase',
  motionIntensity: 5,
  prompt: 'A smooth cinematic tracking shot of the redesigned room, highlighting lighting and textures.'
};

type Tab = 'create' | 'insight' | 'add' | 'edit' | 'video-settings';
type Theme = 'dark' | 'light';

const Logo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <img src="logo.svg" alt="Interior AI Logo" className={className} />
);

const App: React.FC = () => {
  const [mode, setMode] = useState<Mode>('landing');
  const [versions, setVersions] = useState<DesignVersion[]>([]);
  const [videoVersions, setVideoVersions] = useState<VideoVersion[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [designState, setDesignState] = useState<DesignState>(INITIAL_STATE);
  const [videoState, setVideoState] = useState<VideoState>(INITIAL_VIDEO_STATE);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('create');
  const [theme, setTheme] = useState<Theme>('dark');
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [isListening, setIsListening] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveSessionPromiseRef = useRef<Promise<any> | null>(null);

  const currentVersion = versions.find(v => v.id === currentVersionId);
  const currentVideo = videoVersions.find(v => v.id === currentVideoId);
  const historyScrollRef = useRef<HTMLDivElement>(null);

  // --- Notification System ---
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // --- Reset Application ---
  const handleReset = () => {
    if (versions.length > 0 && !confirm("Are you sure you want to start a new project? All current design iterations will be lost.")) {
      return;
    }
    setVersions([]);
    setVideoVersions([]);
    setCurrentVersionId(null);
    setCurrentVideoId(null);
    setDesignState(INITIAL_STATE);
    setVideoState(INITIAL_VIDEO_STATE);
    setMode('landing');
    addToast("Started new project.", "info");
  };

  // --- API Key Selection for Veo ---
  const ensureApiKey = async () => {
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) {
      addToast("A paid project API key is required for video generation.", "info");
      await (window as any).aistudio.openSelectKey();
    }
  };

  // --- Version Handling ---
  const handleSelectVersion = (id: string) => {
    const v = versions.find(ver => ver.id === id);
    if (v) {
      setCurrentVersionId(id);
      setDesignState({ ...v.config });
      addToast(`Switched to version: ${v.promptUsed}`, "info");
    }
  };

  const handleDeleteVersion = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newVersions = versions.filter(v => v.id !== id);
    setVersions(newVersions);
    if (id === currentVersionId) {
      if (newVersions.length > 0) {
        const nextVersion = newVersions[newVersions.length - 1];
        setCurrentVersionId(nextVersion.id);
        setDesignState({ ...nextVersion.config });
      } else {
        setCurrentVersionId(null);
        setMode('landing');
      }
    }
    addToast("Design removed.", "info");
  };

  const handleDeleteVideo = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newVideos = videoVersions.filter(v => v.id !== id);
    setVideoVersions(newVideos);
    if (id === currentVideoId) {
      setCurrentVideoId(newVideos.length > 0 ? newVideos[newVideos.length - 1].id : null);
    }
    addToast("Video removed.", "info");
  };

  const handleEngineError = (err: any) => {
    console.error("Redesign Error:", err);
    if (err.message === "API_KEY_ERROR") {
      addToast("API Key issue. Please re-select your key.", "error");
      (window as any).aistudio.openSelectKey();
      return;
    }

    let userMessage = err.message || "Oops! We encountered a small hiccup.";
    if (err.message?.includes('429')) {
      userMessage = "The AI designer is taking a short breather. Please wait a few seconds.";
    } else if (err.message?.includes('Network') || !navigator.onLine) {
      userMessage = "Check your internet connection and try again.";
    }
    addToast(userMessage, 'error');
  };

  const startListening = async () => {
    try {
      if (!process.env.API_KEY) {
        addToast("Voice features are currently unavailable.", "error");
        return;
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      liveSessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          systemInstruction: 'Transcribe the users design or video requests clearly.'
        },
        callbacks: {
          onopen: () => {
            const source = audioContext.createMediaStreamSource(stream);
            const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              liveSessionPromiseRef.current?.then(s => s.sendRealtimeInput({ media: createBlob(inputData) }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContext.destination);
            setIsListening(true);
            addToast("Listening for instructions...", "success");
          },
          onmessage: async (m: LiveServerMessage) => {
            if (m.serverContent?.inputTranscription) {
              const t = m.serverContent.inputTranscription.text;
              if (t) {
                if (mode === 'video') {
                  setVideoState(prev => ({ ...prev, prompt: (prev.prompt + ' ' + t).trim() }));
                } else {
                  setDesignState(prev => ({ ...prev, instructions: (prev.instructions + ' ' + t).trim() }));
                }
              }
            }
          },
          onclose: () => stopListening()
        }
      });
    } catch (err) { stopListening(); addToast("Microphone access denied.", "error"); }
  };

  const stopListening = () => {
    setIsListening(false);
    audioContextRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    liveSessionPromiseRef.current?.then(s => s.close());
    liveSessionPromiseRef.current = null;
  };

  const handleToggleMic = () => isListening ? stopListening() : startListening();

  const togglePreset = (id: string) => {
    setDesignState(prev => ({
      ...prev,
      selectedPresets: prev.selectedPresets.includes(id)
        ? prev.selectedPresets.filter(p => p !== id)
        : [...prev.selectedPresets, id]
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { addToast("Photo must be smaller than 5MB.", "info"); return; }
      const reader = new FileReader();
      reader.onloadend = () => {
        const newVersion: DesignVersion = {
          id: crypto.randomUUID(),
          parentId: null,
          timestamp: Date.now(),
          imageUrl: reader.result as string,
          config: { ...INITIAL_STATE },
          promptUsed: "Original Photo"
        };
        setVersions([newVersion]);
        setCurrentVersionId(newVersion.id);
        setDesignState({ ...INITIAL_STATE });
        addToast("Room uploaded! Choose your path.", "success");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!currentVersion) return;
    setIsGenerating(true);
    try {
      const response = await generateDesignIteration(currentVersion.imageUrl, designState, currentVersion.id);
      const newVersion: DesignVersion = {
        id: crypto.randomUUID(),
        parentId: currentVersion.id,
        timestamp: Date.now(),
        imageUrl: response.imageUrl,
        config: { ...designState },
        promptUsed: designState.instructions || `Iteration ${versions.length + 1}`,
        vibeSummary: response.vibeSummary,
        reasoning: response.reasoning,
        suggestions: response.suggestions,
        sustainabilityScore: response.sustainabilityScore
      };
      setVersions(prev => [...prev, newVersion]);
      setCurrentVersionId(newVersion.id);
      setActiveTab('insight');
      setIsPanelExpanded(true);
      addToast("Design iteration complete!", "success");
    } catch (err: any) { handleEngineError(err); } finally { setIsGenerating(false); }
  };

  const handleGenerateVideo = async () => {
    if (!currentVersion) return;
    await ensureApiKey();
    setIsGenerating(true);
    try {
      const videoUrl = await generateDesignVideo(currentVersion.imageUrl, videoState);
      const newVideo: VideoVersion = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        videoUrl,
        thumbnailUrl: currentVersion.imageUrl,
        prompt: videoState.prompt,
        config: { ...videoState }
      };
      setVideoVersions(prev => [...prev, newVideo]);
      setCurrentVideoId(newVideo.id);
      addToast("Video showcase ready!", "success");
    } catch (err: any) { handleEngineError(err); } finally { setIsGenerating(false); }
  };

  const HistoryItem = ({ version, isSelected, onClick, onDelete, vertical }: any) => (
    <div className={`group relative flex-shrink-0 transition-all rounded-lg ${vertical ? 'w-full mb-3' : 'w-16 h-16'}`}>
      <button onClick={onClick} className={`w-full h-full aspect-video rounded-lg border overflow-hidden transition-all ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/30' : theme === 'dark' ? 'border-white/10 opacity-60 hover:opacity-100' : 'border-zinc-300 opacity-60 hover:opacity-100'}`}>
        <img src={version.imageUrl || version.thumbnailUrl} className="w-full h-full object-cover" alt="History" />
        <div className={`absolute inset-0 ${theme === 'dark' ? 'bg-black/20' : 'bg-white/10'} ${isSelected ? 'bg-transparent' : ''}`} />
      </button>
      <button onClick={(e) => onDelete(e, version.id)} className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"><Trash2 className="w-3 h-3" /></button>
    </div>
  );

  const TabButton = ({ id, icon: Icon, label }: { id: Tab, icon: any, label: string }) => (
    <button onClick={() => { setActiveTab(id); setIsPanelExpanded(true); }} className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all ${activeTab === id ? 'text-indigo-400' : theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-800'}`}>
      <div className={`p-1.5 rounded-full ${activeTab === id ? 'bg-indigo-500/10' : ''}`}><Icon className="w-5 h-5" /></div>
      <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
    </button>
  );

  return (
    <div className={`h-screen w-screen flex flex-col md:flex-row ${theme === 'dark' ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'} overflow-hidden transition-colors duration-300`}>
      
      {/* Toast System */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 w-[90%] max-w-sm pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-3 p-4 rounded-2xl shadow-2xl border pointer-events-auto animate-in slide-in-from-top-4 duration-300 ${toast.type === 'error' ? 'bg-red-500 text-white border-red-400' : toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-zinc-900 text-white border-zinc-700'}`}>
            {toast.type === 'error' ? <AlertCircle className="w-5 h-5 flex-none" /> : toast.type === 'success' ? <CheckCircle className="w-5 h-5 flex-none" /> : <Info className="w-5 h-5 flex-none" />}
            <span className="text-sm font-medium flex-1">{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="p-1 hover:bg-white/10 rounded-full"><X className="w-4 h-4" /></button>
          </div>
        ))}
      </div>

      {mode === 'landing' ? (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 relative">
          <div className="absolute top-6 right-6 flex gap-2">
            <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} className={`p-3 rounded-full border transition-all ${theme === 'dark' ? 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-white' : 'bg-white border-zinc-200 text-zinc-600 hover:text-black'}`}>
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
          <div className="max-w-xl w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="flex flex-col items-center gap-4">
              <Logo className="w-24 h-24 text-indigo-500" />
              <h1 className="text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white to-zinc-500">Interior AI</h1>
            </div>
            <p className={`${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-600'} text-lg`}>Transform spaces iteratively or generate cinematic showcases for commercial use.</p>
            
            {!currentVersion ? (
              <div className={`relative group cursor-pointer w-full aspect-video rounded-3xl border-2 border-dashed ${theme === 'dark' ? 'border-white/10 bg-zinc-900/30 hover:bg-zinc-900/50' : 'border-zinc-300 bg-white hover:bg-zinc-100'} flex flex-col items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-[0.98]`}>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 z-20 cursor-pointer" />
                <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center"><Upload className="text-indigo-500 w-8 h-8" /></div>
                <span className="text-lg font-bold">Drop room photo to begin</span>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-8 duration-700">
                  <button 
                    onClick={() => { setMode('design'); setActiveTab('create'); }}
                    className={`group p-8 rounded-3xl border transition-all hover:scale-105 ${theme === 'dark' ? 'bg-zinc-900 border-white/5 hover:bg-zinc-800' : 'bg-white border-zinc-200 hover:shadow-xl'}`}
                  >
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Layout className="text-indigo-500 w-8 h-8" /></div>
                    <h3 className="text-xl font-bold mb-2">Design Studio</h3>
                    <p className="text-sm text-zinc-500">Iteratively redesign furniture, textures, and layouts with AI.</p>
                  </button>
                  <button 
                    onClick={() => { setMode('video'); }}
                    className={`group p-8 rounded-3xl border transition-all hover:scale-105 ${theme === 'dark' ? 'bg-zinc-900 border-white/5 hover:bg-zinc-800' : 'bg-white border-zinc-200 hover:shadow-xl'}`}
                  >
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Film className="text-amber-500 w-8 h-8" /></div>
                    <h3 className="text-xl font-bold mb-2">Cinema Studio</h3>
                    <p className="text-sm text-zinc-500">Generate high-end cinematic walkthroughs for advertisers and promoters.</p>
                  </button>
                </div>
                <button onClick={handleReset} className={`flex items-center gap-2 mx-auto text-xs font-bold uppercase tracking-widest px-6 py-3 rounded-full transition-all ${theme === 'dark' ? 'text-zinc-500 hover:text-white bg-white/5' : 'text-zinc-500 hover:text-black bg-zinc-100'}`}><RotateCcw className="w-3 h-3" /> Change Photo / Start Over</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Canvas / Video Player Area */}
          <div className={`flex-1 relative flex flex-col min-h-0 ${theme === 'dark' ? 'bg-[#080808]' : 'bg-zinc-200'} transition-colors duration-300`}>
            <div className="absolute top-4 inset-x-0 z-20 flex items-center justify-between px-6 pointer-events-none">
              <div className="flex gap-2 pointer-events-auto items-center">
                <button onClick={() => setMode('landing')} className={`px-4 py-2 flex items-center gap-2 rounded-full backdrop-blur-md border shadow-sm transition-all ${theme === 'dark' ? 'bg-black/60 border-white/5 text-white' : 'bg-white/80 border-zinc-300 text-zinc-900'}`}><Logo className="w-5 h-5" /> Home</button>
                <button onClick={handleReset} className={`p-3 rounded-full backdrop-blur-md border shadow-sm transition-all ${theme === 'dark' ? 'bg-black/60 border-white/5 text-white' : 'bg-white/80 border-zinc-300 text-zinc-900'}`} title="New Project"><Plus className="w-4 h-4" /></button>
                <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} className={`p-3 rounded-full backdrop-blur-md border shadow-sm ${theme === 'dark' ? 'bg-black/60 border-white/5 text-white' : 'bg-white/80 border-zinc-300 text-zinc-900'}`}>{theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
              </div>
              <div className="flex gap-2 pointer-events-auto">
                {mode === 'video' && currentVideo && (
                  <Button variant="secondary" onClick={() => { const a = document.createElement('a'); a.href = currentVideo.videoUrl; a.download = 'showcase.mp4'; a.click(); }}><Download className="w-4 h-4 mr-2" /> Download MP4</Button>
                )}
                {mode === 'design' && currentVersion && (
                   <Button variant="secondary" onClick={() => { const l = document.createElement('a'); l.href = currentVersion.imageUrl; l.download='design.png'; l.click(); }}><Download className="w-4 h-4 mr-2" /> Save Image</Button>
                )}
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-4">
              {mode === 'design' ? (
                <img src={currentVersion?.imageUrl} className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl transition-all duration-500" alt="Design" />
              ) : (
                <div className="w-full h-full flex items-center justify-center relative">
                   {currentVideo ? (
                     <div className="relative group w-full max-w-4xl aspect-video rounded-3xl overflow-hidden shadow-2xl border border-white/5">
                       <video key={currentVideo.id} src={currentVideo.videoUrl} controls autoPlay loop className="w-full h-full object-cover" />
                       <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80"><Share2 className="w-4 h-4" /></button>
                       </div>
                     </div>
                   ) : (
                     <div className="text-center space-y-4">
                       <div className="w-24 h-24 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto"><Play className="text-amber-500 w-10 h-10" /></div>
                       <p className="text-zinc-500 font-medium">Configure your cinematic settings and generate a video.</p>
                     </div>
                   )}
                </div>
              )}
              {isGenerating && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center z-40">
                  <div className="relative w-32 h-32">
                    <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full" />
                    <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    {mode === 'video' ? <Film className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 text-amber-400 animate-pulse" /> : <Wand2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 text-indigo-400 animate-pulse" />}
                  </div>
                  <h3 className="mt-8 text-xl font-black uppercase tracking-widest text-white animate-pulse">{mode === 'video' ? 'Processing Cinema Walkthrough...' : 'Synthesizing Space...'}</h3>
                  <p className="mt-4 text-zinc-400 max-w-xs text-center text-sm">{mode === 'video' ? 'Polishing reflections, camera paths, and lighting. This may take a minute.' : 'Analyzing architectural geometry and applying design intent.'}</p>
                </div>
              )}
            </div>
          </div>

          {/* Controls Sidebar */}
          <div className={`flex-none z-30 flex flex-col border-t md:border-l ${theme === 'dark' ? 'bg-zinc-950 border-white/5' : 'bg-white border-zinc-200'} transition-all duration-500 ease-in-out shadow-xl ${isPanelExpanded ? 'h-[82vh] md:h-full md:w-[420px]' : 'h-[140px] md:h-full md:w-[80px]'}`}>
            <div className={`flex items-center justify-between p-4 md:p-6 border-b flex-none ${theme === 'dark' ? 'border-white/5' : 'border-zinc-200'} ${!isPanelExpanded && 'md:justify-center'}`}>
              <div className="flex items-center gap-3">
                <Logo className="w-6 h-6 text-indigo-500" />
                {isPanelExpanded && <h2 className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>{mode === 'video' ? 'Cinema Studio' : 'Design Studio'}</h2>}
              </div>
              <div className="flex items-center gap-2">
                {isPanelExpanded && <button onClick={handleToggleMic} className={`p-2.5 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : theme === 'dark' ? 'bg-white/5 text-zinc-500' : 'bg-zinc-100 text-zinc-400'}`}><Mic className="w-4 h-4" /></button>}
                <button onClick={() => setIsPanelExpanded(!isPanelExpanded)} className={`p-2.5 rounded-full transition-all ${theme === 'dark' ? 'hover:bg-white/10 text-zinc-500' : 'hover:bg-zinc-100 text-zinc-400'}`}>
                  <div className="md:hidden">{isPanelExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}</div>
                  <div className="hidden md:block">{isPanelExpanded ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}</div>
                </button>
              </div>
            </div>

            <div className={`flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 overscroll-contain pb-20 transition-opacity duration-300 ${!isPanelExpanded && 'opacity-0 pointer-events-none md:hidden'}`}>
              {mode === 'design' ? (
                <>
                  {activeTab === 'create' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                      <div className="space-y-1"><h3 className="text-xl font-black">Style & Look</h3></div>
                      <div className="grid grid-cols-2 gap-2">
                        {VIBE_PRESETS.map(p => (
                          <button key={p.id} onClick={() => togglePreset(p.id)} className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border transition-all ${designState.selectedPresets.includes(p.id) ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400' : theme === 'dark' ? 'bg-white/5 border-white/5 text-zinc-500' : 'bg-zinc-50 border-zinc-200 text-zinc-500'}`}>
                            <p.icon className="w-4 h-4" /><span className="text-[10px] font-black uppercase">{p.label}</span>
                          </button>
                        ))}
                      </div>
                      <Select label="Room Style" value={designState.style} onChange={e => setDesignState({...designState, style: e.target.value as DesignStyle})} options={Object.values(DesignStyle).map(v => ({ value: v, label: v }))} />
                      <Input label="Atmosphere" value={designState.mood} onChange={e => setDesignState({...designState, mood: e.target.value})} placeholder="e.g. Airy, cozy, elegant" />
                    </div>
                  )}

                  {activeTab === 'insight' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                      <div className={`p-4 rounded-2xl border space-y-2 ${theme === 'dark' ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-200'}`}>
                        <div className="flex items-center gap-2 text-indigo-500"><Lightbulb className="w-4 h-4" /><span className="text-[10px] font-black uppercase">Summary</span></div>
                        <p className={`text-sm font-medium leading-relaxed italic ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'}`}>"{currentVersion?.vibeSummary || "Redesign to see designer notes."}"</p>
                      </div>
                      <div className={`p-4 rounded-2xl border text-xs leading-relaxed font-medium ${theme === 'dark' ? 'bg-white/5 border-white/5 text-zinc-400' : 'bg-zinc-50 border-zinc-200 text-zinc-600'}`}>
                        {currentVersion?.reasoning || "Spatial analysis appears here."}
                      </div>
                    </div>
                  )}

                  {activeTab === 'add' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                      <div className={`relative aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 ${theme === 'dark' ? 'border-white/5 bg-white/5' : 'border-zinc-200 bg-zinc-50'}`}>
                        <Plus className="w-6 h-6 text-zinc-400" /><span className="text-xs font-bold uppercase text-zinc-400">Add Asset</span>
                        <input type="file" onChange={(e) => {
                          const f = e.target.files?.[0];
                          if(f){
                            const r = new FileReader(); r.onloadend = () => {
                              const ni: CustomItem = { id: crypto.randomUUID(), image: r.result as string, instruction: '' };
                              setDesignState(p => ({ ...p, customItems: [...p.customItems, ni] }));
                            }; r.readAsDataURL(f);
                          }
                        }} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </div>
                    </div>
                  )}

                  {activeTab === 'edit' && (
                    <div className="space-y-6">
                       <TextArea label="Specific Instructions" value={designState.instructions} onChange={e => setDesignState({...designState, instructions: e.target.value})} placeholder="e.g. 'Add a minimal desk under the window...'" className="h-48" />
                       {currentVersion?.suggestions && (
                         <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                           {currentVersion.suggestions.map((s, i) => (
                             <button key={i} onClick={() => setDesignState({...designState, instructions: s})} className="px-3 py-2 rounded-full border text-[10px] whitespace-nowrap bg-indigo-500/10 border-indigo-500/20 text-indigo-300">{s}</button>
                           ))}
                         </div>
                       )}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-8 animate-in slide-in-from-right-4">
                  <div className="space-y-1"><h3 className="text-xl font-black">Cinema Config</h3><p className="text-xs text-zinc-500">Expert cinematic settings for high-end promotion.</p></div>
                  
                  {/* Resolution & Aspect */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-zinc-500 flex items-center gap-1"><Monitor className="w-3 h-3" /> Resolution</label>
                       <div className="flex gap-1 p-1 rounded-xl bg-zinc-900 border border-white/5">
                          {['720p', '1080p'].map(res => (
                            <button key={res} onClick={() => setVideoState({...videoState, resolution: res as any})} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${videoState.resolution === res ? 'bg-amber-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}>{res}</button>
                          ))}
                       </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-zinc-500 flex items-center gap-1"><Smartphone className="w-3 h-3" /> Aspect</label>
                       <div className="flex gap-1 p-1 rounded-xl bg-zinc-900 border border-white/5">
                          {['16:9', '9:16'].map(asp => (
                            <button key={asp} onClick={() => setVideoState({...videoState, aspectRatio: asp as any})} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${videoState.aspectRatio === asp ? 'bg-amber-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}>{asp}</button>
                          ))}
                       </div>
                    </div>
                  </div>

                  {/* Motion Settings */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-500 flex items-center gap-1"><Gauge className="w-3 h-3" /> Motion Intensity ({videoState.motionIntensity}/10)</label>
                      <input type="range" min="1" max="10" value={videoState.motionIntensity} onChange={(e) => setVideoState({...videoState, motionIntensity: parseInt(e.target.value)})} className="w-full accent-amber-600 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer" />
                      <div className="flex justify-between text-[8px] font-bold text-zinc-600"><span>STATIONARY</span><span>DYNAMIC</span></div>
                    </div>

                    <Input label="Video Style" value={videoState.style} onChange={e => setVideoState({...videoState, style: e.target.value})} placeholder="e.g. Drone sweep, Slow pan, handheld" />
                  </div>

                  {/* Prompts/Script Area - Consolidated here */}
                  <div className="space-y-4 border-t border-white/5 pt-6">
                    <div className="space-y-1"><h4 className="text-[10px] font-black uppercase text-amber-500 tracking-widest">Cinema Script</h4><p className="text-[10px] text-zinc-500">Describe the camera path or promotional focus.</p></div>
                    <TextArea value={videoState.prompt} onChange={e => setVideoState({...videoState, prompt: e.target.value})} placeholder="Describe how the camera should move..." className="h-32" />
                  </div>
                  
                  <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-amber-500/5 border-amber-500/10' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-center gap-2 text-amber-500 mb-2"><Info className="w-4 h-4" /><span className="text-[10px] font-black uppercase">Expert Tip</span></div>
                    <p className="text-[11px] leading-relaxed text-zinc-400">9:16 is optimized for Reels & TikTok ads. Use 1080p for high-quality TV commercials.</p>
                  </div>
                </div>
              )}
              
              <div className="hidden md:block pt-4">
                {mode === 'design' ? (
                  <Button onClick={handleGenerate} isLoading={isGenerating} className="w-full h-14" icon={<Wand2 className="w-5 h-5" />}>UPDATE DESIGN</Button>
                ) : (
                  <Button onClick={handleGenerateVideo} isLoading={isGenerating} className="w-full h-14 bg-amber-600 hover:bg-amber-500 shadow-amber-900/20" icon={<Video className="w-5 h-5" />}>GENERATE VIDEO</Button>
                )}
              </div>
            </div>

            <div className={`flex flex-col border-t flex-none z-50 transition-colors duration-300 ${theme === 'dark' ? 'bg-zinc-950 border-white/5' : 'bg-zinc-50 border-zinc-200'}`}>
              <div className={`md:hidden p-4 border-b border-white/5 transition-all ${!isPanelExpanded && 'hidden'}`}>
                 <Button onClick={mode === 'design' ? handleGenerate : handleGenerateVideo} isLoading={isGenerating} className={`w-full h-12 ${mode === 'video' ? 'bg-amber-600' : ''}`}>{mode === 'video' ? 'GENERATE VIDEO' : 'UPDATE DESIGN'}</Button>
              </div>
              
              {/* Tabs only shown in design mode */}
              {mode === 'design' && (
                <div className={`flex border-b border-white/5 ${!isPanelExpanded && 'md:flex-col'}`}>
                  <TabButton id="create" icon={Layout} label={isPanelExpanded ? "Style" : ""} />
                  <TabButton id="insight" icon={Lightbulb} label={isPanelExpanded ? "Notes" : ""} />
                  <TabButton id="add" icon={Armchair} label={isPanelExpanded ? "Items" : ""} />
                  <TabButton id="edit" icon={MessageSquare} label={isPanelExpanded ? "Requests" : ""} />
                </div>
              )}

              <div className={`p-4 transition-all duration-300 ${theme === 'dark' ? 'bg-zinc-900' : 'bg-zinc-100'} ${!isPanelExpanded && 'md:hidden'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`}>{mode === 'video' ? 'Cinema History' : 'Design History'}</span>
                </div>
                <div className="md:hidden overflow-x-auto scrollbar-hide flex gap-3 pb-2 mt-2">
                  {mode === 'design' 
                    ? versions.map(v => <HistoryItem key={v.id} version={v} isSelected={v.id === currentVersionId} onClick={() => handleSelectVersion(v.id)} onDelete={handleDeleteVersion} />)
                    : videoVersions.map(v => <HistoryItem key={v.id} version={v} isSelected={v.id === currentVideoId} onClick={() => setCurrentVideoId(v.id)} onDelete={handleDeleteVideo} />)
                  }
                </div>
                <div className="hidden md:grid grid-cols-4 gap-2 max-h-32 overflow-y-auto custom-scrollbar mt-2">
                  {mode === 'design' 
                    ? versions.map(v => <HistoryItem key={v.id} version={v} isSelected={v.id === currentVersionId} onClick={() => handleSelectVersion(v.id)} onDelete={handleDeleteVersion} vertical />)
                    : videoVersions.map(v => <HistoryItem key={v.id} version={v} isSelected={v.id === currentVideoId} onClick={() => setCurrentVideoId(v.id)} onDelete={handleDeleteVideo} vertical />)
                  }
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;