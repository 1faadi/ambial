import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FabricObject } from 'fabric';
import { ComponentType } from '@/utils/enum';
import { LightingData } from '@/types/interfaces';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const assignCategory = (obj: FabricObject, category: ComponentType) => {
  obj.set('shapeCategory', category);
};

export function generateUUID() {
  return crypto.randomUUID();
}

export const getRelativeTime = (date: Date | string): string => {
  const now = new Date();
  const past = new Date(date);
  const diffInMs = now.getTime() - past.getTime();

  // Convert to different time units
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  const diffInWeeks = Math.floor(diffInDays / 7);
  const diffInMonths = Math.floor(diffInDays / 30);
  const diffInYears = Math.floor(diffInDays / 365);

  // Return appropriate format based on time difference
  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  } else if (diffInWeeks === 1) {
    return '1 week ago';
  } else if (diffInWeeks < 4) {
    return `${diffInWeeks} weeks ago`;
  } else if (diffInMonths === 1) {
    return '1 month ago';
  } else if (diffInMonths < 12) {
    return `${diffInMonths} months ago`;
  } else if (diffInYears === 1) {
    return '1 year ago';
  } else {
    return `${diffInYears} years ago`;
  }
};

export const extractJsonFromResponse = (response: string): LightingData[] | null => {
  const match = response.match(/```json\s*([\s\S]*?)\s*```/);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1]);
    } catch (err) {
      console.error('❌ JSON parsing error:', err);
    }
  }

  // Fallback: try parsing entire response if no ```json block
  try {
    return JSON.parse(response);
  } catch {
    console.warn('Could not extract valid JSON from GPT response.');
    return null;
  }
};
