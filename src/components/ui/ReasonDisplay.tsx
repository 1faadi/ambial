import React from 'react';
import { X, Lightbulb } from 'lucide-react';
import { Button } from './Button';

interface ReasonDisplayProps {
  isVisible: boolean;
  reason: string;
  shapeName: string;
  onClose: () => void;
}

const ReasonDisplay: React.FC<ReasonDisplayProps> = ({ isVisible, reason, shapeName, onClose }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-md mx-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900 truncate">{shapeName}</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-6 w-6 p-0 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{reason}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReasonDisplay;
