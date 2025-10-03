import React, { useState, useEffect, useRef } from 'react';
import { VideoConfig, VeoModel } from './types';
import { generateAndPollVideo } from './services/geminiService';
import Header from './components/Header';
import Loader from './components/Loader';
import VideoResult from './components/VideoResult';
import UploadIcon from './components/icons/UploadIcon';
import EyeIcon from './components/icons/EyeIcon';
import EyeOffIcon from './components/icons/EyeOffIcon';
import TrashIcon from './components/icons/TrashIcon';

interface GenerationJob {
  id: number;
  status: 'loading' | 'success' | 'error';
  url?: string;
  message: string;
}

const VEO_MODELS: VeoModel[] = [
  'veo-3.0-generate-preview',
  'veo-3.0-fast-generate-preview',
  'veo-3.0-generate-001',
  'veo-3.0-fast-generate-001',
  'veo-2.0-generate-001',
];

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [prompt, setPrompt] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [config, setConfig] = useState<VideoConfig>({
    aspectRatio: '16:9',
    enableSound: true,
    resolution: '1080p',
    duration: 8,
    model: 'veo-3.0-generate-preview',
  });
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [syncNotification, setSyncNotification] = useState<string | null>(null);
  const nextJobId = useRef(0);

  // Load saved data from localStorage on component mount
  useEffect(() => {
    try {
      // Load API key
      const savedKey = localStorage.getItem('gemini-api-key');
      if (savedKey && savedKey.trim()) {
        setApiKey(savedKey.trim());
      }

      // Load last used config
      const savedConfig = localStorage.getItem('gemini-video-config');
      if (savedConfig) {
        try {
          const parsedConfig = JSON.parse(savedConfig);
          setConfig(prev => ({ ...prev, ...parsedConfig }));
        } catch (error) {
          console.error('Error parsing saved config:', error);
        }
      }
    } catch (error) {
      console.error('Error loading saved data from localStorage:', error);
    }
  }, []);

  // Listen for localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'gemini-api-key') {
        if (e.newValue && e.newValue.trim()) {
          setApiKey(e.newValue.trim());
          setSyncNotification('API Key synced from another tab');
        } else {
          setApiKey('');
          setSyncNotification('API Key cleared from another tab');
        }
      } else if (e.key === 'gemini-video-config') {
        if (e.newValue) {
          try {
            const parsedConfig = JSON.parse(e.newValue);
            setConfig(prev => ({ ...prev, ...parsedConfig }));
            setSyncNotification('Settings synced from another tab');
          } catch (error) {
            console.error('Error parsing config from other tab:', error);
          }
        }
      }
    };

    // Add event listener for storage changes
    window.addEventListener('storage', handleStorageChange);

    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Auto hide sync notification after 3 seconds
  useEffect(() => {
    if (syncNotification) {
      const timer = setTimeout(() => {
        setSyncNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [syncNotification]);
  
  // Save API key to localStorage whenever it changes
  const handleApiKeyChange = (key: string) => {
    const trimmedKey = key.trim();
    setApiKey(key); // Keep original input for user experience
    
    try {
      if (trimmedKey) {
        localStorage.setItem('gemini-api-key', trimmedKey);
      } else {
        localStorage.removeItem('gemini-api-key');
      }
    } catch (error) {
      console.error('Error saving API key to localStorage:', error);
    }
  };

  // Clear API key function for logout/reset functionality
  const clearApiKey = () => {
    setApiKey('');
    try {
      localStorage.removeItem('gemini-api-key');
    } catch (error) {
      console.error('Error clearing API key from localStorage:', error);
    }
  };

  // Save prompt to localStorage (không đồng bộ giữa các tab)
  const savePrompt = (newPrompt: string) => {
    setPrompt(newPrompt);
    // Không lưu vào localStorage để mỗi tab có prompt riêng
  };

  // Save config to localStorage
  const saveConfig = <K extends keyof VideoConfig>(key: K, value: VideoConfig[K]) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    try {
      localStorage.setItem('gemini-video-config', JSON.stringify(newConfig));
    } catch (error) {
      console.error('Error saving config to localStorage:', error);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
    const fileInput = document.getElementById('image-upload') as HTMLInputElement;
    if(fileInput) fileInput.value = "";
  };

  const handleGenerate = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your Google AI API Key.');
      return;
    }
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }
    setError(null);
    
    const jobId = nextJobId.current++;
    const currentPrompt = prompt;
    const currentImageFile = imageFile;
    const currentConfig = config;

    setJobs(prev => [...prev, { id: jobId, status: 'loading', message: 'Preparing request...' }]);

    const updateJobProgress = (message: string) => {
        setJobs(prevJobs => prevJobs.map(job => 
            job.id === jobId ? { ...job, message } : job
        ));
    };

    try {
      const videoUrls = await generateAndPollVideo(apiKey, currentPrompt, currentImageFile, currentConfig, 1, updateJobProgress);
      setJobs(prevJobs => prevJobs.map(job => 
          job.id === jobId ? { ...job, status: 'success', url: videoUrls[0], message: 'Completed' } : job
      ));
    } catch (err: any) {
      // If the job was cancelled, it might not exist anymore. Only update if it does.
      setJobs(prevJobs => prevJobs.map(job => 
        job.id === jobId ? { ...job, status: 'error', message: err.message || 'An unknown error occurred.' } : job
      ));
    }
  };

  const handleDeleteJob = (jobId: number) => {
    setJobs(prev => prev.filter(job => job.id !== jobId));
  };


  const handleConfigChange = <K extends keyof VideoConfig>(key: K, value: VideoConfig[K]) => {
    saveConfig(key, value);
  };

  const isGenerating = jobs.some(j => j.status === 'loading');

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <Header />
      
      {/* Sync Notification */}
      {syncNotification && (
        <div className="bg-blue-600/20 border border-blue-500/30 text-blue-300 px-4 py-2 text-sm text-center animate-pulse">
          <span className="inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncNotification}
          </span>
        </div>
      )}

      <main className="flex-grow container mx-auto p-4 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
          {/* Controls Panel */}
          <div className="bg-slate-800 p-6 rounded-lg shadow-lg flex flex-col gap-6 h-full">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="api-key" className="block text-sm font-medium text-slate-300">
                  1. Enter Your Google AI API Key
                </label>
                {apiKey && (
                  <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-full border border-green-400/20">
                    ✓ Saved
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  id="api-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="Enter your Google AI API Key"
                  className="w-full bg-slate-900 border border-slate-600 rounded-md py-2 pl-3 pr-20 text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                  aria-label="Google AI API Key"
                />
                <div className="absolute inset-y-0 right-0 flex items-center">
                  {apiKey && (
                    <button
                      type="button"
                      onClick={clearApiKey}
                      className="px-2 text-slate-400 hover:text-red-400 transition-colors"
                      aria-label="Clear API Key"
                      title="Clear saved API key"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="px-3 text-slate-400 hover:text-slate-200"
                    aria-label={showApiKey ? 'Hide API Key' : 'Show API Key'}
                  >
                    {showApiKey ? (
                      <EyeOffIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
              {apiKey && (
                <p className="text-xs text-slate-400 mt-1">
                  API Key saved locally. It will persist when you open new tabs.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-slate-300 mb-2">
                2. Enter Your Prompt
              </label>
              <textarea
                id="prompt"
                rows={5}
                className="w-full bg-slate-900 border border-slate-600 rounded-md p-3 text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                placeholder="A cinematic shot of a raccoon coding on a laptop in a futuristic city, rain pouring down."
                value={prompt}
                onChange={(e) => savePrompt(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                3. Add Reference Image (Optional)
              </label>
              <div 
                className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-600 border-dashed rounded-md hover:border-green-500 transition-colors cursor-pointer bg-slate-900/50 hover:bg-slate-900/70"
                onClick={() => document.getElementById('image-upload')?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add('border-green-500', 'bg-green-500/10');
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-green-500', 'bg-green-500/10');
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-green-500', 'bg-green-500/10');
                  const files = e.dataTransfer.files;
                  if (files.length > 0) {
                    const file = files[0];
                    if (file.type.startsWith('image/')) {
                      if (imagePreview) {
                        URL.revokeObjectURL(imagePreview);
                      }
                      setImageFile(file);
                      setImagePreview(URL.createObjectURL(file));
                    }
                  }
                }}
              >
                <div className="space-y-1 text-center w-full">
                  {imagePreview ? (
                     <div className="relative group w-48 mx-auto">
                        <img src={imagePreview} alt="Preview" className="mx-auto h-32 w-auto rounded-md" />
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             removeImage();
                           }} 
                           className="absolute top-0 right-0 m-1 bg-red-600 hover:bg-red-700 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-all duration-200"
                         >
                           ×
                         </button>
                     </div>
                  ) : (
                    <>
                      <UploadIcon className="mx-auto h-12 w-12 text-slate-500" />
                      <div className="text-lg font-medium text-slate-300">
                        Click to upload or drag and drop
                      </div>
                      <p className="text-sm text-slate-400">PNG, JPG, GIF up to 10MB</p>
                    </>
                  )}
                  <input 
                    id="image-upload" 
                    name="image-upload" 
                    type="file" 
                    className="sr-only" 
                    onChange={handleImageChange} 
                    accept="image/*" 
                  />
                </div>
              </div>
            </div>
            
            <div className="mt-4">
              {error && (
                <div className="text-center text-red-400 bg-red-900/50 p-3 rounded-md mb-4">
                  <p>{error}</p>
                </div>
              )}
              <button
                onClick={handleGenerate}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 focus:ring-offset-slate-900 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? 'Generate Another...' : 'Generate Video'}
              </button>
            </div>

            <div className="mt-auto">
              <h3 className="text-sm font-medium text-slate-300 mb-2">4. Configure Options</h3>
              <div className="space-y-4">
                {/* Aspect Ratio */}
                <div>
                    <label className="text-xs font-medium text-slate-400">Aspect Ratio</label>
                    <div className="flex gap-2 mt-1">
                        {(['16:9', '9:16'] as const).map(ratio => (
                            <button key={ratio} onClick={() => handleConfigChange('aspectRatio', ratio)} className={`px-4 py-2 text-sm rounded-md transition ${config.aspectRatio === ratio ? 'bg-green-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>{ratio}</button>
                        ))}
                    </div>
                </div>
                {/* Resolution */}
                 <div>
                    <label className="text-xs font-medium text-slate-400">Resolution</label>
                    <div className="flex gap-2 mt-1">
                        {(['720p', '1080p'] as const).map(res => (
                            <button key={res} onClick={() => handleConfigChange('resolution', res)} className={`px-4 py-2 text-sm rounded-md transition ${config.resolution === res ? 'bg-green-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>{res}</button>
                        ))}
                    </div>
                </div>
                {/* VEO Model */}
                <div>
                  <label htmlFor="veo-model" className="text-xs font-medium text-slate-400">VEO Model</label>
                  <select
                    id="veo-model"
                    value={config.model}
                    onChange={(e) => handleConfigChange('model', e.target.value as VeoModel)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-600 bg-slate-700 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md text-white transition"
                  >
                    {VEO_MODELS.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
                 {/* Enable Sound */}
                 <div>
                    <label className="text-xs font-medium text-slate-400">Sound</label>
                    <div className="mt-1">
                        <label htmlFor="sound-toggle" className="flex items-center cursor-pointer">
                            <div className="relative">
                                <input type="checkbox" id="sound-toggle" className="sr-only" checked={config.enableSound} onChange={(e) => handleConfigChange('enableSound', e.target.checked)} />
                                <div className={`block w-14 h-8 rounded-full transition ${config.enableSound ? 'bg-green-600' : 'bg-slate-700'}`}></div>
                                <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${config.enableSound ? 'translate-x-6' : ''}`}></div>
                            </div>
                            <div className="ml-3 text-slate-200 text-sm">{config.enableSound ? 'Enabled' : 'Disabled'}</div>
                        </label>
                    </div>
                </div>
              </div>
            </div>

          </div>

          {/* Result Panel */}
          <div className="bg-slate-800 p-6 rounded-lg shadow-lg">
             {jobs.length > 0 ? (
                <div className="w-full h-full overflow-y-auto">
                    {/* Simple 2-Column Grid Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {jobs.map((job) => (
                           <div key={job.id} className="w-full">
                             {job.status === 'loading' && (
                                <div className={`bg-slate-900/50 rounded-lg overflow-hidden flex items-center justify-center p-4 relative border border-slate-700 ${
                                  config.aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'
                                }`}>
                                  <Loader message={job.message} />
                                  <button
                                    onClick={() => handleDeleteJob(job.id)}
                                    className="absolute top-3 right-3 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-red-600/70 rounded-full p-1.5 transition-colors z-10"
                                    aria-label="Cancel generation"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                </div>
                             )}
                             {job.status === 'success' && job.url && (
                               <VideoResult 
                                 videoUrl={job.url}
                                 aspectRatio={config.aspectRatio}
                                 onDelete={() => handleDeleteJob(job.id)} 
                               />
                             )}
                             {job.status === 'error' && (
                               <div className={`bg-slate-900/50 rounded-lg border border-red-500/30 p-6 relative ${
                                 config.aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'
                               } flex items-center justify-center`}>
                                 <button
                                   onClick={() => handleDeleteJob(job.id)}
                                   className="absolute top-3 right-3 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-red-600/70 rounded-full p-1.5 transition-colors z-10"
                                   aria-label="Delete failed generation"
                                 >
                                   <TrashIcon className="w-4 h-4" />
                                 </button>
                                 <div className="text-center text-red-400">
                                   <p className="font-bold text-lg">Generation Failed</p>
                                   <p className="text-sm mt-2 text-red-300 max-w-xs">{job.message}</p>
                                 </div>
                               </div>
                             )}
                           </div>
                        ))}
                    </div>
                </div>
             ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center text-slate-500">
                      <p className="text-lg font-medium">Your generated videos will appear here.</p>
                      <p className="text-sm mt-2">Fill out the form and click "Generate Video" to start.</p>
                  </div>
                </div>
             )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;