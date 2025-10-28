import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { ProgressLossDialogProps } from '@/types/interfaces';

const ProgressLossDialog: React.FC<ProgressLossDialogProps> = ({ open, onCancel, onConfirm }) => {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Progress Confirmation</DialogTitle>
          <DialogDescription className="pt-4 text-base text-foreground">
            Are you sure you want to go back? Your progress will be lost.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-4">
          <Button className="cursor-pointer outline-0" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button className="cursor-pointer" onClick={onConfirm}>
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProgressLossDialog;
