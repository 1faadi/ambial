import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { AlertTriangle } from 'lucide-react';

interface DriverConstraintWarningProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driversCount: number;
  maxDriversPerEngine: number;
  dimmingEngineCount: number;
}

const DriverConstraintWarning: React.FC<DriverConstraintWarningProps> = ({
  open,
  onOpenChange,
  driversCount,
  maxDriversPerEngine,
  dimmingEngineCount,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DialogTitle className="text-xl font-bold">
              Dimming Engine Constraint Exceeded
            </DialogTitle>
          </div>
          <DialogDescription className="pt-4 text-base text-foreground">
            <div className="space-y-3">
              <p>
                <strong>Cannot export:</strong> You have allocated{' '}
                <span className="font-semibold text-destructive">{driversCount}</span> drivers, but
                your {dimmingEngineCount} dimming engine{dimmingEngineCount > 1 ? 's' : ''} can only
                support{' '}
                <span className="font-semibold">{maxDriversPerEngine * dimmingEngineCount}</span>{' '}
                drivers maximum ({maxDriversPerEngine} per engine).
              </p>
              <p className="text-sm">
                <strong>Constraint Details:</strong>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                  <li>Maximum drivers per dimming engine: {maxDriversPerEngine}</li>
                  <li>
                    Total capacity with {dimmingEngineCount} engine
                    {dimmingEngineCount > 1 ? 's' : ''}: {maxDriversPerEngine * dimmingEngineCount}{' '}
                    drivers
                  </li>
                  <li>Drivers per driver: 6 slots (max 96W)</li>
                  <li>Current dimming engines: {dimmingEngineCount}</li>
                </ul>
              </p>
              <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                <strong>Action Required:</strong> Add additional dimming engine
                {dimmingEngineCount > 0 ? 's' : ''} to the canvas to accommodate the{' '}
                {driversCount - maxDriversPerEngine * dimmingEngineCount} extra driver
                {driversCount - maxDriversPerEngine * dimmingEngineCount > 1 ? 's' : ''}. This will
                allow the system to distribute the load across more engines.
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-4">
          <Button
            className="cursor-pointer outline-0"
            variant="default"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DriverConstraintWarning;
