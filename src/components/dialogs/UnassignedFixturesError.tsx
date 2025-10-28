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

interface UnassignedFixturesErrorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unassignedCount: number;
}

const UnassignedFixturesError: React.FC<UnassignedFixturesErrorProps> = ({
  open,
  onOpenChange,
  unassignedCount,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DialogTitle className="text-xl font-bold">
              Cannot Export: Unassigned Fixtures
            </DialogTitle>
          </div>
          <DialogDescription className="pt-4 text-base text-foreground">
            <div className="space-y-3">
              <p>
                <strong>Export blocked:</strong> There {unassignedCount === 1 ? 'is' : 'are'}{' '}
                <span className="font-semibold text-destructive">{unassignedCount}</span> fixture
                {unassignedCount === 1 ? '' : 's'} still in the{' '}
                <span className="font-semibold italic">Unassigned</span> layer.
              </p>
              <p className="text-sm">
                Before exporting, please assign all fixtures to their appropriate layer (by model
                type). Fixtures in the &quot;Unassigned&quot; layer indicate incomplete
                configuration.
              </p>
              <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                <strong>Action Required:</strong> Go to the Layers panel in the sidebar and move all
                fixtures from the &quot;Unassigned&quot; layer to the correct model-specific layer.
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

export default UnassignedFixturesError;
