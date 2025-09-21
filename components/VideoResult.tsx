import React, { useRef, useState } from 'react';
import DownloadIcon from './icons/DownloadIcon';
import TrashIcon from './icons/TrashIcon';
import EyeIcon from './icons/EyeIcon';

interface VideoResultProps {
  videoUrl: string;
  aspectRatio?: '16:9' | '9:16';
  onDelete?: () => void;
}

const VideoResult: React.FC<VideoResultProps> = ({ videoUrl, aspectRatio = '16:9', onDelete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPiPSupported, setIsPiPSupported] = useState(
    document.pictureInPictureEnabled || false
  );

  // Open video in new page with clean layout (no badges)
  const handleViewInPage = () => {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Generated Video</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 20px;
              }
              .container {
                max-width: ${aspectRatio === '9:16' ? '450px' : '1200px'};
                width: 100%;
                background: rgba(30, 41, 59, 0.8);
                border-radius: 16px;
                padding: 24px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(16px);
                border: 1px solid rgba(148, 163, 184, 0.1);
              }
              video {
                width: 100%;
                height: auto;
                border-radius: 12px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                background: #000;
              }
              .header {
                text-align: center;
                margin-bottom: 24px;
              }
              .title {
                font-size: 1.5rem;
                font-weight: 700;
                background: linear-gradient(135deg, #10b981, #3b82f6);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
              }
              .controls {
                margin-top: 24px;
                display: flex;
                gap: 12px;
                justify-content: center;
                flex-wrap: wrap;
              }
              .btn {
                padding: 12px 24px;
                border: none;
                border-radius: 10px;
                cursor: pointer;
                font-weight: 600;
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                font-size: 0.875rem;
                min-width: 140px;
                justify-content: center;
              }
              .btn-download {
                background: linear-gradient(135deg, #059669, #047857);
                color: white;
                box-shadow: 0 4px 14px 0 rgba(5, 150, 105, 0.4);
              }
              .btn-download:hover {
                background: linear-gradient(135deg, #047857, #065f46);
                transform: translateY(-2px);
                box-shadow: 0 8px 25px 0 rgba(5, 150, 105, 0.6);
              }
              .btn-close {
                background: rgba(71, 85, 105, 0.8);
                color: #e2e8f0;
                border: 1px solid rgba(148, 163, 184, 0.3);
              }
              .btn-close:hover {
                background: rgba(51, 65, 85, 0.9);
                transform: translateY(-1px);
              }
              @media (max-width: 640px) {
                .container { padding: 16px; margin: 10px; }
                .controls { flex-direction: column; }
                .btn { min-width: auto; width: 100%; }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 class="title">Generated Video</h1>
              </div>
              <video id="mainVideo" controls autoplay loop preload="metadata">
                <source src="${videoUrl}" type="video/mp4">
                Your browser does not support the video tag.
              </video>
              <div class="controls">
                <a href="${videoUrl}" download="veo-video-${Date.now()}.mp4" class="btn btn-download">
                  📥 Download Video
                </a>
                <button onclick="window.close()" class="btn btn-close">
                  ✕ Close Window
                </button>
              </div>
            </div>
          </body>
        </html>
      `);
      newWindow.document.close();
    }
  };

  // Toggle Picture-in-Picture mode
  const handlePictureInPicture = async () => {
    if (!videoRef.current || !isPiPSupported) return;
    
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (error) {
      console.error('Error toggling Picture-in-Picture:', error);
    }
  };
  
  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700/50 overflow-hidden shadow-2xl relative group transition-all duration-300 hover:shadow-green-500/10 hover:border-green-500/30">
      {/* Action Buttons Overlay */}
      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20">
        {/* View in Page Button */}
        <button
          onClick={handleViewInPage}
          className="text-slate-300 hover:text-blue-400 bg-slate-800/90 hover:bg-blue-600/20 backdrop-blur-sm rounded-full p-2.5 transition-all duration-200 border border-slate-600 hover:border-blue-500 shadow-lg"
          aria-label="View in new page"
          title="Open in new page"
        >
          <EyeIcon className="w-4 h-4" />
        </button>
        
        {/* Picture-in-Picture Button */}
        {isPiPSupported && (
          <button
            onClick={handlePictureInPicture}
            className="text-slate-300 hover:text-purple-400 bg-slate-800/90 hover:bg-purple-600/20 backdrop-blur-sm rounded-full p-2.5 transition-all duration-200 border border-slate-600 hover:border-purple-500 shadow-lg"
            aria-label="Picture in Picture"
            title="Picture in Picture mode"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2M7 4h10M7 4l-2 14h12l-2-14M10 9v6M14 9v6" />
            </svg>
          </button>
        )}
        
        {/* Delete Button */}
        {onDelete && (
          <button
            onClick={onDelete}
            className="text-slate-300 hover:text-red-400 bg-slate-800/90 hover:bg-red-600/20 backdrop-blur-sm rounded-full p-2.5 transition-all duration-200 border border-slate-600 hover:border-red-500 shadow-lg"
            aria-label="Delete video"
            title="Delete video"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* Video Container - Responsive aspect ratio */}
      <div className={`${aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'} bg-black relative overflow-hidden`}>
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          className="w-full h-full object-cover"
          autoPlay
          loop
          muted
          preload="metadata"
          onLoadStart={() => {
            // Check PiP support when video loads
            if (videoRef.current) {
              setIsPiPSupported(document.pictureInPictureEnabled && 'requestPictureInPicture' in videoRef.current);
            }
          }}
        >
          Your browser does not support the video tag.
        </video>
      </div>
      
      {/* Enhanced Action Bar */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-t border-slate-700/50">
        <div className="flex gap-3">
          {/* Download Button - Primary */}
          <a
            href={videoUrl}
            download={`veo-video-${Date.now()}.mp4`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-green-500/25 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            <DownloadIcon className="w-4 h-4" />
            <span className="text-sm">Download</span>
          </a>
          
          {/* View in Page Button - Secondary */}
          <button
            onClick={handleViewInPage}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/25 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            <EyeIcon className="w-4 h-4" />
            <span className="text-sm">View</span>
          </button>

          {/* Picture-in-Picture Button */}
          {isPiPSupported && (
            <button
              onClick={handlePictureInPicture}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/25 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              title="Picture in Picture mode"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm hidden sm:inline">PiP</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoResult;