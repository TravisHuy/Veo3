export type VeoModel = 
  | 'veo-2.0-generate-001'
  | 'veo-3.0-generate-001'
  | 'veo-3.0-fast-generate-001'
  | 'veo-3.0-generate-preview'
  | 'veo-3.0-fast-generate-preview';

export interface VideoConfig {
  aspectRatio: '16:9' | '9:16';
  enableSound: boolean;
  resolution: '720p' | '1080p';
  duration: 4 | 6 | 8;
  model: VeoModel;
}