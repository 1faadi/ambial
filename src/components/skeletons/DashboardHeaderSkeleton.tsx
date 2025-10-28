// components/skeletons/DashboardHeaderSkeleton.tsx
import React from 'react';
import { SquarePen, ZoomIn, ZoomOut, Undo, Redo, Download, Save, Eye } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

const DashboardHeaderSkeleton = () => {
  return (
    <header className="mx-auto flex gap-1 xl:gap-2 justify-between shrink-0 px-4 py-2 h-[81px]">
      {/* Logo and Project Name Section */}
      <div className="bg-white border border-light-gray rounded-[8px] flex items-center gap-1 xl:gap-8 py-1 px-1 xl:px-3">
        <div className="relative h-[44px] w-[44px]">
          <Image src="/images/ambial_logo.png" alt="logo" priority fill />
        </div>
        <div className="flex items-center gap-[10px] px-[10px]">
          <Skeleton className="h-5 w-32 xl:w-48" />
          <Button variant="ghost" className="cursor-not-allowed" disabled>
            <SquarePen className="h-6 w-6 text-gray-400" />
          </Button>
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="px-1 xl:px-3 py-[11.5px] bg-white border border-light-gray rounded-[8px] flex gap-3 items-center">
        <Button variant="outline" className="cursor-not-allowed" disabled>
          <ZoomOut className="h-6 w-6 text-gray-400" />
        </Button>
        <Skeleton className="h-6 w-12 rounded-[30px]" />
        <Button variant="outline" className="cursor-not-allowed" disabled>
          <ZoomIn className="h-6 w-6 text-gray-400" />
        </Button>
      </div>

      {/* Undo/Redo Controls */}
      <div className="px-1 xl:px-3 py-[11.5px] bg-white border border-light-gray rounded-[8px] flex gap-[4px] xl:gap-[10px] items-center">
        <Button variant="outline" className="cursor-not-allowed" disabled>
          <Undo className="h-6 w-6 text-gray-400" />
        </Button>
        <Button variant="outline" className="cursor-not-allowed" disabled>
          <Redo className="h-6 w-6 text-gray-400" />
        </Button>
      </div>

      {/* Action Buttons */}
      <div className="px-2 xl:px-3 py-[11.5px] bg-white border border-light-gray rounded-[8px] flex gap-[6px] xl:gap-[10px] items-center">
        <Button
          className="bg-gray-200 hover:bg-gray-200 text-gray-400 font-medium cursor-not-allowed"
          disabled
        >
          <Eye />
        </Button>
        <Button variant="ghost" className="font-medium cursor-not-allowed text-gray-400" disabled>
          Discard
        </Button>
        <Button
          className="bg-gray-200 hover:bg-gray-200 text-gray-400 font-medium cursor-not-allowed"
          disabled
        >
          <Save /> Save
        </Button>
        <Button className="font-medium cursor-not-allowed text-gray-400" disabled>
          <Download /> Download
        </Button>
        <Skeleton className="h-8 w-8 rounded" />
      </div>
    </header>
  );
};

export default DashboardHeaderSkeleton;
