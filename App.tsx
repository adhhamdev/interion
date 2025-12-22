import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Wand2, 
  Download, 
  Layout, 
  Sliders, 
  MessageSquare,
  ChevronLeft,
  Undo2,
  Image as ImageIcon,
  Armchair,
  Plus,
  Trash2,
  X
} from 'lucide-react';
import { Button } from './components/Button';
import { Input, TextArea } from './components/Input';
import { Select } from './components/Select';
import { generateDesignIteration } from './services/geminiService';
import { 
  RoomType, 
  DesignStyle, 
  BudgetLevel, 
  DesignState, 
  DesignVersion,
  CustomItem
} from './types';

// --- Constants & Types ---
const INITIAL_STATE: DesignState = {
  roomType: RoomType.LIVING_ROOM,
  style: DesignStyle.MODERN,
  mood: 'Cozy and inviting',
  budget: BudgetLevel.MID,
  instructions: '',
  lockedElements: '',
  customItems: []
};

type Tab = 'create' | 'refine' | 'add' | 'edit';

// --- App Component ---
const App: React.FC = () => {
  // State
  const [versions, setVersions] = useState<DesignVersion[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [designState, setDesignState] = useState<DesignState>(INITIAL_STATE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('create');
  
  // Computed
  const currentVersion = versions.find(v => v.id === currentVersionId);
  const historyScrollRef = useRef<HTMLDivElement>(null);

  // --- Handlers ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const newVersion: DesignVersion = {
          id: crypto.randomUUID(),
          parentId: null,
          timestamp: Date.now(),
          imageUrl: base64,
          config: INITIAL_STATE,
          promptUsed: "Initial Upload"
        };
        setVersions([newVersion]);
        setCurrentVersionId(newVersion.id);
        setDesignState(INITIAL_STATE);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCustomItemUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const newItem: CustomItem = {
          id: crypto.randomUUID(),
          image: base64,
          instruction: ''
        };
        setDesignState(prev => ({
          ...prev,
          customItems: [...prev.customItems, newItem]
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeCustomItem = (id: string) => {
    setDesignState(prev => ({
      ...prev,
      customItems: prev.customItems.filter(item => item.id !== id)
    }));
  };

  const updateCustomItemInstruction = (id: string, text: string) => {
    setDesignState(prev => ({
      ...prev,
      customItems: prev.customItems.map(item => 
        item.id === id ? { ...item, instruction: text } : item
      )
    }));
  };

  const handleGenerate = async () => {
    if (!currentVersion) return;
    
    setIsGenerating(true);
    setError(null);

    try {
      // 1. Generate
      const newImageUrl = await generateDesignIteration(
        currentVersion.imageUrl,
        designState,
        currentVersion.id
      );

      // 2. Versioning
      const newVersion: DesignVersion = {
        id: crypto.randomUUID(),
        parentId: currentVersion.id,
        timestamp: Date.now(),
        imageUrl: newImageUrl,
        config: { ...designState },
        promptUsed: designState.instructions || `Apply ${designState.style} style`
      };

      setVersions(prev => [...prev, newVersion]);
      setCurrentVersionId(newVersion.id);
      
      // Auto-scroll history
      setTimeout(() => {
        if (historyScrollRef.current) {
          historyScrollRef.current.scrollTo({ left: historyScrollRef.current.scrollWidth, behavior: 'smooth' });
        }
      }, 100);

    } catch (err: any) {
      setError(err.message || "Failed to generate design.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (currentVersion) {
      const link = document.createElement('a');
      link.href = currentVersion.imageUrl;
      link.download = `interior-design-${currentVersion.id.slice(0, 8)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSelectVersion = (id: string) => {
    setCurrentVersionId(id);
    const selected = versions.find(v => v.id === id);
    if (selected) {
      setDesignState(selected.config);
    }
  };

  const handleUndo = () => {
    const currentIndex = versions.findIndex(v => v.id === currentVersionId);
    if (currentIndex > 0) {
      handleSelectVersion(versions[currentIndex - 1].id);
    }
  };

  // --- Sub-Components ---

  const HistoryItem = ({ version, index, isSelected, onClick, vertical }: any) => (
    <button 
      onClick={onClick}
      className={`
        relative group flex-shrink-0 transition-all overflow-hidden rounded-lg border
        ${isSelected 
          ? 'border-indigo-500 ring-2 ring-indigo-500/30 ring-offset-1 ring-offset-zinc-950' 
          : 'border-white/10 opacity-60 hover:opacity-100 hover:border-white/30'}
        ${vertical ? 'w-full aspect-video mb-3' : 'w-16 h-16'}
      `}
    >
      <img src={version.imageUrl} className="w-full h-full object-cover" alt={`V${index}`} />
      <div className={`absolute inset-0 bg-black/20 ${isSelected ? 'bg-transparent' : ''}`} />
    </button>
  );

  const TabButton = ({ id, icon: Icon, label }: { id: Tab, icon: any, label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`
        flex-1 flex flex-col items-center justify-center py-3 gap-1.5 transition-all
        ${activeTab === id ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'}
      `}
    >
      <div className={`p-1 rounded-full ${activeTab === id ? 'bg-indigo-500/10' : ''}`}>
        <Icon className={`w-5 h-5 ${activeTab === id ? 'stroke-[2.5px]' : 'stroke-2'}`} />
      </div>
      <span className="text-[10px] font-semibold tracking-wide uppercase">{label}</span>
    </button>
  );

  // --- Start Screen ---
  if (versions.length === 0) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Ambient Glow */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-900/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-900/20 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-md w-full text-center space-y-12 relative z-10 animate-in fade-in zoom-in duration-700">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-500 tracking-tight">
              Interior AI
            </h1>
            <p className="text-zinc-400 text-lg font-light">
              Reimagine your space with professional AI design.
            </p>
          </div>
          
          <div className="relative group cursor-pointer w-full aspect-[4/3] rounded-3xl border border-white/10 bg-zinc-900/50 hover:bg-zinc-900 transition-all duration-300 flex flex-col items-center justify-center gap-6 shadow-2xl shadow-black">
             <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileUpload} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />
            <div className="w-20 h-20 rounded-full bg-indigo-600/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Upload className="w-8 h-8 text-indigo-400" />
            </div>
            <div className="space-y-1">
              <span className="block text-sm font-medium text-white">Tap to upload photo</span>
              <span className="block text-xs text-zinc-500">JPG or PNG</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Main Editor UI ---
  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-black text-zinc-100 font-sans overflow-hidden selection:bg-indigo-500/30">
      
      {/* 1. Canvas Area (Responsive) */}
      <div className="flex-1 relative flex flex-col min-h-0 bg-[#09090b]">
        
        {/* Top Header Overlay */}
        <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/90 to-transparent z-20 flex items-center justify-between px-4 md:px-6 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3">
             <div className="md:hidden">
               <span className="text-xs font-bold tracking-widest text-zinc-500">V{versions.findIndex(v => v.id === currentVersionId)}</span>
             </div>
             <button onClick={handleUndo} className="hidden md:flex p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors" title="Undo">
                <Undo2 className="w-5 h-5" />
             </button>
          </div>
          
          <div className="pointer-events-auto">
            <Button variant="secondary" onClick={handleDownload} className="shadow-xl">
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Export</span>
              <span className="sm:hidden">Save</span>
            </Button>
          </div>
        </div>

        {/* Image Canvas */}
        <div className="flex-1 p-4 md:p-8 flex items-center justify-center relative overflow-hidden">
          {currentVersion && (
            <div className="relative w-full h-full flex items-center justify-center transition-all duration-500 ease-out group">
              <img 
                src={currentVersion.imageUrl} 
                alt="Design" 
                className="w-full h-full object-contain rounded-lg shadow-2xl shadow-black drop-shadow-2xl"
              />
              
              {isGenerating && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-30 animate-in fade-in duration-300">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                    <Wand2 className="w-6 h-6 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  <p className="mt-6 text-sm font-medium text-zinc-300 tracking-wide">Designing...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Controls & Tools Area */}
      {/* max-h-[50vh] ensures bottom sheet doesn't cover more than half screen on mobile */}
      <div className="flex-none z-30 flex flex-col bg-zinc-950 border-t border-white/5 md:border-t-0 md:border-l md:w-[420px] shadow-2xl md:h-full max-h-[50vh] md:max-h-none">
        
        {/* DESKTOP: Sidebar Header */}
        <div className="hidden md:flex items-center justify-between p-6 border-b border-white/5 flex-none">
           <h2 className="text-sm font-bold tracking-widest text-zinc-400 uppercase">Design Studio</h2>
           <span className="text-xs text-zinc-600 font-mono">AI-POWERED</span>
        </div>

        {/* SHARED: Controls Scroll Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar md:bg-zinc-950/50">
          <div className="p-6 space-y-8 md:pb-6">
            
            {activeTab === 'create' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 fade-in">
                <div className="space-y-1">
                  <h3 className="text-lg font-medium text-white">Base Concept</h3>
                  <p className="text-xs text-zinc-500">Define the core identity of the room.</p>
                </div>
                <Select 
                  label="Room Type"
                  value={designState.roomType} 
                  onChange={e => setDesignState({...designState, roomType: e.target.value as RoomType})}
                  options={Object.values(RoomType).map(v => ({ value: v, label: v }))} 
                />
                <Select 
                  label="Style"
                  value={designState.style} 
                  onChange={e => setDesignState({...designState, style: e.target.value as DesignStyle})}
                  options={Object.values(DesignStyle).map(v => ({ value: v, label: v }))} 
                />
                <Input 
                  label="Mood"
                  value={designState.mood}
                  onChange={e => setDesignState({...designState, mood: e.target.value})}
                  placeholder="e.g. Warm, Minimalist, Airy"
                />
              </div>
            )}

            {activeTab === 'refine' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 fade-in">
                 <div className="space-y-1">
                  <h3 className="text-lg font-medium text-white">Constraints</h3>
                  <p className="text-xs text-zinc-500">Refine budget and structure.</p>
                </div>
                <Select 
                  label="Budget"
                  value={designState.budget} 
                  onChange={e => setDesignState({...designState, budget: e.target.value as BudgetLevel})}
                  options={Object.values(BudgetLevel).map(v => ({ value: v, label: v }))} 
                />
                <Input 
                  label="Locked Elements"
                  value={designState.lockedElements}
                  onChange={e => setDesignState({...designState, lockedElements: e.target.value})}
                  placeholder="e.g. Sofa, Flooring"
                />
              </div>
            )}

             {activeTab === 'add' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 fade-in">
                <div className="space-y-1">
                  <h3 className="text-lg font-medium text-white">Add Items</h3>
                  <p className="text-xs text-zinc-500">Upload furniture or decor to add to the scene.</p>
                </div>
                
                {/* Upload Button */}
                <div className="relative group">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleCustomItemUpload} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="border border-dashed border-zinc-700 bg-zinc-900/50 rounded-xl p-6 flex flex-col items-center justify-center gap-2 group-hover:bg-zinc-900 group-hover:border-indigo-500/50 transition-all">
                    <Plus className="w-6 h-6 text-indigo-400" />
                    <span className="text-sm font-medium text-zinc-300">Upload New Item</span>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-4">
                  {designState.customItems.map((item, idx) => (
                    <div key={item.id} className="bg-zinc-900 border border-white/5 rounded-xl p-3 flex gap-4 relative group">
                      {/* Thumbnail */}
                      <div className="w-20 h-20 rounded-lg bg-zinc-950 flex-shrink-0 overflow-hidden border border-white/10">
                        <img src={item.image} alt="Asset" className="w-full h-full object-cover" />
                      </div>
                      
                      {/* Inputs */}
                      <div className="flex-1 flex flex-col gap-2">
                         <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase">Item #{idx + 1}</span>
                            <button 
                              onClick={() => removeCustomItem(item.id)}
                              className="text-zinc-500 hover:text-red-400 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                         </div>
                         <textarea
                          value={item.instruction}
                          onChange={(e) => updateCustomItemInstruction(item.id, e.target.value)}
                          placeholder="Where should this go? How big?"
                          className="w-full bg-zinc-950 border border-white/5 rounded-lg p-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none h-14"
                         />
                      </div>
                    </div>
                  ))}
                  {designState.customItems.length === 0 && (
                    <div className="text-center py-4 text-xs text-zinc-600 italic">
                      No custom items added yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'edit' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 fade-in">
                <div className="space-y-1">
                  <h3 className="text-lg font-medium text-white">Instructions</h3>
                  <p className="text-xs text-zinc-500">Guide the AI with specific details.</p>
                </div>
                <TextArea 
                  label="Prompt"
                  value={designState.instructions}
                  onChange={e => setDesignState({...designState, instructions: e.target.value})}
                  placeholder="Describe exactly what you want to change..."
                  className="h-40 text-base"
                />
              </div>
            )}
            
            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* MOBILE: Layout Stack */}
        <div className="md:hidden bg-zinc-950/90 backdrop-blur-xl border-t border-white/5 pb-safe flex-none">
          
          {/* 1. Generate Action (In Flow) */}
          <div className="px-4 py-3 border-b border-white/5">
             <Button 
                onClick={handleGenerate} 
                isLoading={isGenerating} 
                className="w-full shadow-lg shadow-indigo-900/30 h-10 text-sm"
                icon={<Wand2 className="w-4 h-4" />}
              >
                {isGenerating ? 'Designing...' : 'Generate Iteration'}
              </Button>
          </div>

          {/* 2. History Strip */}
          <div className="pt-2 pb-2 pl-4 border-b border-white/5 overflow-x-auto scrollbar-hide flex gap-3 min-h-[72px] items-center" ref={historyScrollRef}>
            {versions.map((v, i) => (
              <HistoryItem 
                key={v.id} 
                version={v} 
                index={i} 
                isSelected={v.id === currentVersionId}
                onClick={() => handleSelectVersion(v.id)} 
              />
            ))}
          </div>

          {/* 3. Bottom Tab Bar */}
          <div className="flex items-center justify-around px-2">
            <TabButton id="create" icon={Layout} label="Create" />
            <TabButton id="refine" icon={Sliders} label="Refine" />
            <TabButton id="add" icon={Armchair} label="Add" />
            <TabButton id="edit" icon={MessageSquare} label="Edit" />
          </div>
        </div>

        {/* DESKTOP: Footer Layout */}
        <div className="hidden md:flex flex-col bg-zinc-900 border-t border-white/5 flex-none">
           {/* Generate Button Area */}
           <div className="p-6">
              <Button 
                onClick={handleGenerate} 
                isLoading={isGenerating} 
                className="w-full h-14 text-base shadow-xl shadow-indigo-900/20 hover:shadow-indigo-900/30 transform hover:-translate-y-0.5 transition-all"
                icon={<Wand2 className="w-5 h-5" />}
              >
                {isGenerating ? 'Generating Design...' : 'Generate New Version'}
              </Button>
           </div>
           
           {/* Desktop Tabs */}
           <div className="flex border-t border-white/5">
              <TabButton id="create" icon={Layout} label="Create" />
              <TabButton id="refine" icon={Sliders} label="Refine" />
              <TabButton id="add" icon={Armchair} label="Add" />
              <TabButton id="edit" icon={MessageSquare} label="Edit" />
           </div>

           {/* Desktop History */}
           <div className="p-4 bg-black border-t border-white/5">
              <div className="flex items-center justify-between mb-3 px-1">
                 <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">History</span>
              </div>
              <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                {versions.map((v, i) => (
                  <HistoryItem 
                    key={v.id} 
                    version={v} 
                    index={i} 
                    isSelected={v.id === currentVersionId}
                    onClick={() => handleSelectVersion(v.id)} 
                    vertical
                  />
                ))}
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default App;