import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { ArrowRight, PencilLine } from 'lucide-react';
import { ReferenceLineDialogProps } from '@/types/interfaces';

const ReferenceLineDialog: React.FC<ReferenceLineDialogProps> = ({
  isOpen,
  onClose,
  setShouldRecordHistory,
}) => {
  const handleContinue = () => {
    setShouldRecordHistory(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <div className="py-2 flex flex-col items-center gap-3">
          <PencilLine className="w-8 h-8" />
          <div className="flex flex-col items-center">
            <DialogTitle className="text-xl font-semibold">Draw Reference Line</DialogTitle>
            <p className="text-center text-muted-foreground text-sm leading-relaxed">
              Please draw a reference line on the canvas to continue with your design. This will
              help establish the baseline for your project.
            </p>
          </div>
          <div className="space-y-3">
            <Button onClick={handleContinue}>
              Continue
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReferenceLineDialog;
