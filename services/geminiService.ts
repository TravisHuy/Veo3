import { GoogleGenAI } from "@google/genai";
import { VideoConfig } from '../types';

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

// Queue management
interface QueueItem {
  id: string;
  execute: () => Promise<string[]>;
  onProgress: (message: string) => void;
  resolve: (value: string[]) => void;
  reject: (error: Error) => void;
}

class VideoGenerationQueue {
  private queue: QueueItem[] = [];
  private running: Set<string> = new Set();
  private maxConcurrent: number;

  constructor(maxConcurrent: number = 4) {
    this.maxConcurrent = maxConcurrent;
  }

  async add(
    apiKey: string,
    prompt: string,
    imageFile: File | null,
    config: VideoConfig,
    numberOfVideos: number,
    onProgress: (message: string) => void
  ): Promise<string[]> {
    const id = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const queueItem: QueueItem = {
        id,
        execute: () => this.executeGeneration(apiKey, prompt, imageFile, config, numberOfVideos, onProgress),
        onProgress,
        resolve,
        reject
      };

      this.queue.push(queueItem);
      onProgress(`🔄 Added to queue. Position: ${this.queue.length}. Running: ${this.running.size}/${this.maxConcurrent}`);
      
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.running.size >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.running.add(item.id);
    
    try {
      item.onProgress(`🚀 Starting generation... (${this.running.size}/${this.maxConcurrent} slots used)`);
      const result = await item.execute();
      item.resolve(result);
    } catch (error) {
      item.reject(error as Error);
    } finally {
      this.running.delete(item.id);
      // Process next item in queue with delay to avoid overwhelming the API
      setTimeout(() => this.processQueue(), 3000);
    }
  }

  private async executeGeneration(
    apiKey: string,
    prompt: string,
    imageFile: File | null,
    config: VideoConfig,
    numberOfVideos: number,
    onProgress: (message: string) => void
  ): Promise<string[]> {
    const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

    const retryWithBackoff = async <T>(
      fn: () => Promise<T>,
      maxRetries: number = 8,
      baseDelay: number = 5000
    ): Promise<T> => {
      let lastError: Error;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await fn();
        } catch (error: any) {
          lastError = error;
          
          // Don't retry on certain error codes
          if (error.status === 400 || error.status === 401 || error.status === 403) {
            throw error;
          }
          
          if (attempt === maxRetries) {
            throw error;
          }
          
          const delay = baseDelay * Math.pow(1.5, attempt);
          onProgress(`⏳ Service unavailable (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay/1000)}s...`);
          await sleep(delay);
        }
      }
      
      throw lastError!;
    };

    try {
      const ai = new GoogleGenAI({ apiKey });

      onProgress("🔧 Initializing Veo 3 model...");

      // Build request with proper structure
      const requestPayload: any = {
        model: config.model,
        prompt,
        config: {
          numberOfVideos: numberOfVideos,
          aspectRatio: config.aspectRatio,
        },
      };

      if (imageFile) {
        onProgress("🖼️ Processing reference image...");
        const base64Image = await fileToBase64(imageFile);
        requestPayload.image = {
          imageBytes: base64Image,
          mimeType: imageFile.type,
        };
      }

      onProgress("📡 Sending request to Google Veo 3 API...");
      
      // Use aggressive retry logic for the initial request
      let operation = await retryWithBackoff(async () => {
        return await ai.models.generateVideos(requestPayload);
      }, 8, 5000);
      
      // Poll for completion
      const progressMessages = [
        "🔍 Analyzing your prompt...",
        "🎬 Storyboarding the scenes...", 
        "🎨 Rendering frames with correct aspect ratio...",
        "✨ Adding final touches...",
        "🚀 Almost there...",
      ];
      let messageIndex = 0;
      
      onProgress(progressMessages[messageIndex++]);

      let pollAttempts = 0;
      const maxPollAttempts = 100; // Maximum 25 minutes of polling (100 * 15s)

      while (!operation.done && pollAttempts < maxPollAttempts) {
        await sleep(15000); // Poll every 15 seconds to reduce API load
        pollAttempts++;
        
        if (messageIndex < progressMessages.length) {
           onProgress(progressMessages[messageIndex++]);
        }

        try {
          // Refresh operation status with retry logic
          operation = await retryWithBackoff(async () => {
            return await ai.operations.getVideosOperation({ operation: operation });
          }, 5, 3000);
        } catch (error: any) {
          console.warn(`Polling attempt ${pollAttempts} failed:`, error.message);
          if (error.status === 503 || error.code === 503) {
            onProgress("⚠️ Service temporarily unavailable, retrying with backoff...");
            // Add exponential backoff for 503 errors during polling
            await sleep(Math.min(3000 * Math.pow(1.3, pollAttempts % 10), 30000));
          } else if (error.status !== 503 && error.code !== 503) {
            throw error;
          }
        }
      }

      if (pollAttempts >= maxPollAttempts) {
        throw new Error("⏰ Video generation timed out after 25 minutes. The service may be experiencing high load. Please try again later.");
      }

      const generatedVideos = operation.response?.generatedVideos;
      if (!generatedVideos || generatedVideos.length === 0) {
        throw new Error("❌ Video generation failed or returned no videos.");
      }
      
      onProgress(`📥 Downloading ${generatedVideos.length} generated video(s)...`);

      const downloadPromises = generatedVideos.map(async (videoData: any, index: number) => {
        const downloadLink = videoData.video?.uri;
        if (!downloadLink) {
          console.warn(`Video ${index + 1} was missing a download link.`);
          return null;
        }
        
        // Add retry logic for downloads too
        const response = await retryWithBackoff(async () => {
          const res = await fetch(`${downloadLink}&key=${apiKey}`);
          if (!res.ok) {
            throw new Error(`Failed to download video ${index + 1}: ${res.status} ${res.statusText}`);
          }
          return res;
        }, 5, 2000);

        const videoBlob = await response.blob();
        return URL.createObjectURL(videoBlob);
      });

      const videoUrls = (await Promise.all(downloadPromises)).filter(url => url !== null) as string[];

      if (videoUrls.length === 0) {
        throw new Error("❌ All video downloads failed. Please try again.");
      }

      onProgress(`✅ Video generation completed! Generated ${videoUrls.length} video(s).`);
      return videoUrls;
      
    } catch (error: any) {
      console.error('Video generation error:', error);
      
      // Provide more specific error messages with emojis for better UX
      if (error.status === 503 || error.code === 503) {
        throw new Error('🔄 Google Veo 3 service is currently unavailable. Your request is queued and will retry automatically with intelligent backoff.');
      } else if (error.status === 429) {
        throw new Error('⏳ Rate limit exceeded. Your request is queued and will retry automatically.');
      } else if (error.status === 401) {
        throw new Error('🔑 Invalid API key. Please check your Google AI API key.');
      } else if (error.status === 403) {
        throw new Error('🚫 Access denied. Please check if your API key has access to Veo 3.');
      } else if (error.message?.includes('timeout')) {
        throw new Error('⏰ Request timed out. The service may be experiencing high load.');
      }
      
      throw new Error(error.message || '❌ Failed to generate video');
    }
  }

  getQueueStatus(): { queueLength: number; runningCount: number; maxConcurrent: number } {
    return {
      queueLength: this.queue.length,
      runningCount: this.running.size,
      maxConcurrent: this.maxConcurrent
    };
  }
}

// Create global queue instance
const videoQueue = new VideoGenerationQueue(4); // Maximum 4 concurrent generations

export const generateAndPollVideo = async (
  apiKey: string,
  prompt: string,
  imageFile: File | null,
  config: VideoConfig,
  numberOfVideos: number,
  onProgress: (message: string) => void
): Promise<string[]> => {
  if (!apiKey) {
    throw new Error("🔑 Google AI API Key is not set. Please enter it in the header.");
  }
  
  return videoQueue.add(apiKey, prompt, imageFile, config, numberOfVideos, onProgress);
};

// Export queue status function for UI
export const getQueueStatus = () => videoQueue.getQueueStatus();