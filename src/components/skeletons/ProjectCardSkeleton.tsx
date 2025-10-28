import React from 'react';
import { Card } from '@/components/ui/Card';

// Skeleton component with shimmer effect
const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

const ProjectCardSkeleton = () => {
  return (
    <Card className="group relative overflow-hidden cursor-pointer">
      {/* Image Section */}
      <div className="px-[33px] pt-[24px] bg-gray-50">
        <div
          className="w-full bg-gray-200 rounded animate-pulse flex items-center justify-center"
          style={{ height: '250px' }}
        >
          {/* Image placeholder icon */}
          <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {/* Text Content */}
      <div className="px-6 space-y-1 py-6">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </Card>
  );
};

export default ProjectCardSkeleton;
