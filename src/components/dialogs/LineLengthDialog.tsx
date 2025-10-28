'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { LineLengthDialogProps } from '@/types/interfaces';
import { Loader2 } from 'lucide-react';
import { useCanvas } from '@/context/canvasContext';

const LineLengthDialog: React.FC<LineLengthDialogProps> = ({
  open,
  lineLength,
  onSave,
  onCancel,
}) => {
  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');
  const [loading, setLoading] = useState(false);
  const { setShouldRecordHistory } = useCanvas();

  useEffect(() => {
    if (open) {
      setFeet('');
      setInches('');
      setLoading(false);
    }
  }, [open, lineLength]);

  const handleFeetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setFeet(value);
    }
  };

  const handleInchesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setInches(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  const handleSave = async () => {
    const f = parseFloat(feet || '0');
    const i = parseFloat(inches || '0');
    const lengthValue = f + (isNaN(i) ? 0 : i / 12);
    if (!isNaN(lengthValue) && lengthValue > 0) {
      setLoading(true);
      try {
        await onSave(lengthValue);
      } finally {
        setShouldRecordHistory(true);
        setLoading(false);
      }
    }
  };

  const handleCancel = () => {
    if (!loading) {
      onCancel();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={isOpen => {
        if (!isOpen && !loading) {
          handleCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Line Length</DialogTitle>
          <DialogDescription>Enter the reference length in feet and inches.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="calculatedLength" className="text-right">
              Calculated
            </Label>
            <div className="col-span-3 text-sm text-gray-600">{lineLength.toFixed(2)} pixels</div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right">Length</Label>
            <div className="col-span-3 grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="feet" className="text-xs text-gray-600">
                  Feet
                </Label>
                <Input
                  id="feet"
                  type="text"
                  placeholder="0"
                  value={feet}
                  onChange={handleFeetChange}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                  autoFocus
                  disabled={loading}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="inches" className="text-xs text-gray-600">
                  Inches
                </Label>
                <Input
                  id="inches"
                  type="text"
                  placeholder="0"
                  value={inches}
                  onChange={handleInchesChange}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LineLengthDialog;
