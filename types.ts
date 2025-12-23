
export enum RoomType {
  LIVING_ROOM = 'Living Room',
  BEDROOM = 'Bedroom',
  KITCHEN = 'Kitchen',
  BATHROOM = 'Bathroom',
  OFFICE = 'Home Office',
  DINING = 'Dining Room',
  HALLWAY = 'Hallway',
  COMMERCIAL = 'Commercial Space'
}

export enum DesignStyle {
  MODERN = 'Modern',
  MINIMALIST = 'Minimalist',
  INDUSTRIAL = 'Industrial',
  SCANDINAVIAN = 'Scandinavian',
  MID_CENTURY = 'Mid-Century Modern',
  CLASSIC = 'Classic / Traditional',
  BOHEMIAN = 'Bohemian',
  LUXURY = 'Luxury / Glam'
}

export enum BudgetLevel {
  LOW = 'Budget / DIY',
  MID = 'Mid-Range / Standard',
  HIGH = 'High-End / Luxury'
}

export interface CustomItem {
  id: string;
  image: string; // Base64
  instruction: string;
}

export interface DesignState {
  roomType: RoomType;
  style: DesignStyle;
  mood: string;
  budget: BudgetLevel;
  instructions: string;
  lockedElements: string;
  customItems: CustomItem[];
  inspirationImage?: string; // For Cross-Modal Aesthetic Transfer
  selectedPresets: string[]; // Quick-Action Chips
}

export interface DesignVersion {
  id: string;
  parentId: string | null;
  timestamp: number;
  imageUrl: string; // Base64 data URI
  config: DesignState;
  promptUsed: string;
  vibeSummary?: string;
  reasoning?: string;
  suggestions?: string[];
  sustainabilityScore?: number;
}

export interface GenerationResponse {
  imageUrl: string;
  vibeSummary: string;
  reasoning: string;
  suggestions: string[];
  sustainabilityScore: number;
}

export interface VideoVersion {
  id: string;
  timestamp: number;
  videoUrl: string;
  thumbnailUrl: string;
  prompt: string;
  config: VideoState;
}

export interface VideoState {
  resolution: '720p' | '1080p';
  aspectRatio: '16:9' | '9:16';
  style: string;
  motionIntensity: number;
  prompt: string;
}
