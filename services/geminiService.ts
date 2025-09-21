import { GoogleGenAI } from "@google/genai";
import { VideoConfig } from '../types';

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

export const generateAndPollVideo = async (
  apiKey: string,
  prompt: string,
  imageFile: File | null,
  config: VideoConfig,
  numberOfVideos: number,
  onProgress: (message: string) => void
): Promise<string[]> => {
  if (!apiKey) {
    throw new Error("Google AI API Key is not set. Please enter it in the header.");
  }
  
  try {
    const ai = new GoogleGenAI({ apiKey });

    onProgress("Initializing Veo 3 model...");

    // Build request with proper structure
    const requestPayload: any = {
      model: config.model,
      prompt,
      config: {
        numberOfVideos: numberOfVideos,
        aspectRatio: config.aspectRatio,  // Pass aspect ratio correctly
      },
    };

    if (imageFile) {
      onProgress("Processing reference image...");
      const base64Image = await fileToBase64(imageFile);
      requestPayload.image = {
        imageBytes: base64Image,
        mimeType: imageFile.type,
      };
    }

    onProgress("Sending request to Google Veo 3 API...");
    
    let operation = await ai.models.generateVideos(requestPayload);
    
    // Poll for completion
    const progressMessages = [
      "Analyzing your prompt...",
      "Storyboarding the scenes...", 
      "Rendering frames with correct aspect ratio...",
      "Adding final touches...",
      "Almost there...",
    ];
    let messageIndex = 0;
    
    onProgress(progressMessages[messageIndex++]);

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
      
      if (messageIndex < progressMessages.length) {
         onProgress(progressMessages[messageIndex++]);
      }

      // Refresh operation status
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const generatedVideos = operation.response?.generatedVideos;
    if (!generatedVideos || generatedVideos.length === 0) {
      throw new Error("Video generation failed or returned no videos.");
    }
    
    onProgress(`Downloading ${generatedVideos.length} generated video(s)...`);

    const downloadPromises = generatedVideos.map(async (videoData: any) => {
      const downloadLink = videoData.video?.uri;
      if (!downloadLink) {
        console.warn("A generated video was missing a download link.");
        return null;
      }
      
      const response = await fetch(`${downloadLink}&key=${apiKey}`);
      if (!response.ok) {
        throw new Error(`Failed to download a video: ${response.statusText}`);
      }
      const videoBlob = await response.blob();
      return URL.createObjectURL(videoBlob);
    });

    const videoUrls = (await Promise.all(downloadPromises)).filter(url => url !== null) as string[];

    if (videoUrls.length === 0) {
      throw new Error("All video downloads failed.");
    }

    return videoUrls;
    
  } catch (error: any) {
    console.error('Video generation error:', error);
    throw new Error(error.message || 'Failed to generate video');
  }
};