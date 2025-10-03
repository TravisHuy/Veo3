import React, { useState, useEffect } from 'react';
import { getQueueStatus } from '../services/geminiService';

const QueueStatus: React.FC = () => {
  const [status, setStatus] = useState({ queueLength: 0, runningCount: 0, maxConcurrent: 4 });

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(getQueueStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (status.queueLength === 0 && status.runningCount === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            <span className="text-sm font-semibold text-gray-700">Video Generation Queue</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-1">
            <span className="text-gray-600">🚀 Running:</span>
            <span className="font-bold text-green-600">
              {status.runningCount}/{status.maxConcurrent}
            </span>
          </div>
          
          <div className="flex items-center space-x-1">
            <span className="text-gray-600">⏳ Waiting:</span>
            <span className="font-bold text-blue-600">{status.queueLength}</span>
          </div>
          
          {status.queueLength > 0 && (
            <div className="flex items-center space-x-1">
              <span className="text-gray-600">📅 Est. wait:</span>
              <span className="font-bold text-orange-600">
                ~{Math.ceil((status.queueLength * 3) / status.maxConcurrent)}min
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Progress bar for active slots */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Processing Slots</span>
          <span>{status.runningCount} of {status.maxConcurrent} active</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ 
              width: `${(status.runningCount / status.maxConcurrent) * 100}%` 
            }}
          ></div>
        </div>
      </div>
      
      {/* Queue visualization */}
      {status.queueLength > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Queue Status</span>
            <span>{status.queueLength} requests waiting</span>
          </div>
          <div className="flex space-x-1">
            {Array.from({ length: Math.min(status.queueLength, 10) }).map((_, i) => (
              <div 
                key={i} 
                className="h-2 bg-blue-300 rounded-sm flex-1 animate-pulse"
                style={{ animationDelay: `${i * 0.1}s` }}
              ></div>
            ))}
            {status.queueLength > 10 && (
              <span className="text-xs text-gray-500 ml-2">+{status.queueLength - 10} more</span>
            )}
          </div>
        </div>
      )}
      
      <div className="mt-2 text-xs text-gray-500">
        <span className="inline-flex items-center">
          <span className="w-2 h-2 bg-green-400 rounded-full mr-1"></span>
          Queue system prevents 503 errors by limiting concurrent requests
        </span>
      </div>
    </div>
  );
};

export default QueueStatus;