import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { motion } from 'framer-motion';
import { AiAnalysisDialogProps } from '@/types/interfaces';

const AIAnalysisDialog = ({ isOpen, onClose }: AiAnalysisDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex flex-col items-center">
        <DialogTitle>
          <div className="py-9 mt-7 flex flex-col gap-[15px]">
            <p className="text-base font-semibold">AI Analyzing</p>
            <motion.div
              className="relative h-[83px] w-[83px]"
              animate={{
                scale: [1, 1.1, 1],
                opacity: [1, 0.8, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <Image src="/images/ai-sparkle.png" alt="AI" fill priority />
            </motion.div>
            <p className="text-base text-[#717171AA]">Please wait ..</p>
          </div>
        </DialogTitle>
        <div className="mb-4">
          <Button className="h-10 w-[157px]" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AIAnalysisDialog;
