import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEffect, useMemo, useState } from 'react';
import type { FixtureRow } from './FixtureLibraryTable';
import sidebar from '@/@data/sidebar';
import axios from 'axios';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (row: Omit<FixtureRow, 'id'>) => void;
}

const DEFAULT_FORM: Omit<FixtureRow, 'id'> = {
  type: '',
  modelName: '',
  sizeIn: 0,
  manufacturer: '',
  price: 0,
  lumens: 0,
  peakPowerW: 0,
  maxVoltageV: 0,
  maxCurrentA: 0,
  minPwm: 0,
  maxPwm: 0,
  dimmingMode: '',
  dimmingCurve: '',
  minCct: 0,
  midCct: 0,
  maxCct: 0,
  sidebarId: undefined,
  channelCount: 0,
  dimmingGamma: 0,
};

export default function AddFixtureDialog({ open, onOpenChange, onSubmit }: Props) {
  const [form, setForm] = useState<Omit<FixtureRow, 'id'>>(DEFAULT_FORM);
  const [manufacturers, setManufacturers] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingManufacturers, setIsLoadingManufacturers] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customManufacturer, setCustomManufacturer] = useState('');
  const [isAddingManufacturer, setIsAddingManufacturer] = useState(false);

  const lightingOptions = useMemo(() => {
    return (sidebar as Array<{ id: number; title: string; type?: string }>)
      .filter(s => s.type === 'lighting')
      .map(s => {
        if (s.title === 'Pendant') {
          const label = s.id === 8 ? 'Pendant (Circular)' : 'Pendant (Linear)';
          return { value: `${label}`, label, id: s.id };
        }
        return { value: `${s.title}`, label: s.title, id: s.id };
      });
  }, []);

  // Fetch manufacturers from API
  useEffect(() => {
    const fetchManufacturers = async () => {
      try {
        setIsLoadingManufacturers(true);
        const response = await axios.get('/api/manufacturers');
        setManufacturers(response.data);
      } catch (error) {
        console.error('Error fetching manufacturers:', error);
      } finally {
        setIsLoadingManufacturers(false);
      }
    };

    if (open) {
      fetchManufacturers();
    }
  }, [open]);

  useEffect(() => {
    if (open) setForm(DEFAULT_FORM);
  }, [open]);

  const set = <K extends keyof Omit<FixtureRow, 'id'>>(k: K, v: Omit<FixtureRow, 'id'>[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const handleManufacturerChange = (value: string) => {
    if (value === 'custom') {
      setShowCustomInput(true);
      set('manufacturer', '');
    } else {
      setShowCustomInput(false);
      set('manufacturer', value);
    }
  };

  const handleAddCustomManufacturer = async () => {
    if (!customManufacturer.trim()) return;

    try {
      setIsAddingManufacturer(true);
      const response = await axios.post('/api/manufacturers', {
        name: customManufacturer.trim(),
      });

      // Add the new manufacturer to the list
      setManufacturers(prev =>
        [...prev, response.data].sort((a, b) => a.name.localeCompare(b.name))
      );

      // Set it as the selected manufacturer
      set('manufacturer', response.data.name);

      // Reset custom input
      setCustomManufacturer('');
      setShowCustomInput(false);
    } catch (error) {
      console.error('Error adding manufacturer:', error);
      alert('Failed to add manufacturer. It may already exist.');
    } finally {
      setIsAddingManufacturer(false);
    }
  };

  const isValid = Boolean(
    (form.type ?? '').toString().trim() &&
      (form.modelName ?? '').toString().trim() &&
      (form.manufacturer ?? '').toString().trim()
  );

  useEffect(() => {
    if (form.type) {
      const matched = lightingOptions.find(opt => opt.value === form.type);
      if (matched) {
        const sidebarId = Number(
          matched.value === 'Pendant (Circular)'
            ? 8
            : matched.value === 'Pendant (Linear)'
              ? 9
              : lightingOptions.find(opt => opt.value === form.type)?.id
        );
        set('sidebarId', sidebarId);
      }
    }
  }, [form.type, lightingOptions]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add Fixture</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Fixture Type</Label>
            <Select value={form.type} onValueChange={v => set('type', v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {lightingOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Model Name</Label>
            <Input
              required
              value={form.modelName ?? ''}
              onChange={e => set('modelName', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Size (IN.)</Label>
            <Input
              value={form.sizeIn ?? ''}
              type="number"
              onChange={e => set('sizeIn', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Manufacturer</Label>
            <Select
              value={showCustomInput ? 'custom' : (form.manufacturer ?? '')}
              onValueChange={handleManufacturerChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={isLoadingManufacturers ? 'Loading...' : 'Select manufacturer'}
                />
              </SelectTrigger>
              <SelectContent>
                {manufacturers.map(manufacturer => (
                  <SelectItem key={manufacturer.id} value={manufacturer.name}>
                    {manufacturer.name}
                  </SelectItem>
                ))}
                <SelectItem value="custom">+ Add Custom Manufacturer</SelectItem>
              </SelectContent>
            </Select>
            {showCustomInput && (
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Enter manufacturer name"
                  value={customManufacturer}
                  onChange={e => setCustomManufacturer(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomManufacturer();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddCustomManufacturer}
                  disabled={!customManufacturer.trim() || isAddingManufacturer}
                >
                  {isAddingManufacturer ? 'Adding...' : 'Add'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowCustomInput(false);
                    setCustomManufacturer('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Channels</Label>
            <Select
              value={String(form.channelCount ?? 2)}
              onValueChange={v => set('channelCount', Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Price</Label>
            <Input
              value={form.price ?? ''}
              onChange={e => set('price', Number(e.target.value) || undefined)}
            />
          </div>
          <div className="space-y-2">
            <Label>Lumens</Label>
            <Input
              value={form.lumens ?? ''}
              onChange={e => set('lumens', Number(e.target.value) || undefined)}
            />
          </div>
          <div className="space-y-2">
            <Label>Peak Power (W)</Label>
            <Input
              value={form.peakPowerW ?? ''}
              onChange={e => set('peakPowerW', Number(e.target.value) || undefined)}
            />
          </div>
          <div className="space-y-2">
            <Label>Max Voltage (V)</Label>
            <Input
              value={form.maxVoltageV ?? ''}
              onChange={e => set('maxVoltageV', Number(e.target.value) || undefined)}
            />
          </div>
          <div className="space-y-2">
            <Label>Max Current (A)</Label>
            <Input
              value={form.maxCurrentA ?? ''}
              onChange={e => set('maxCurrentA', Number(e.target.value) || undefined)}
            />
          </div>
          <div className="space-y-2">
            <Label>Min PWM</Label>
            <Input
              value={form.minPwm ?? ''}
              onChange={e => set('minPwm', Number(e.target.value) || undefined)}
            />
          </div>
          <div className="space-y-2">
            <Label>Max PWM</Label>
            <Input
              value={form.maxPwm ?? ''}
              onChange={e => set('maxPwm', Number(e.target.value) || undefined)}
            />
          </div>
          <div className="space-y-2">
            <Label>Dimming Mode</Label>
            <Select value={form.dimmingMode ?? ''} onValueChange={v => set('dimmingMode', v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select dimming mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CC">CC</SelectItem>
                <SelectItem value="CV">CV</SelectItem>
                <SelectItem value="0-10V">0-10V</SelectItem>
                <SelectItem value="DALI DT6">DALI DT6</SelectItem>
                <SelectItem value="DALI DT8">DALI DT8</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* <div className="space-y-2">
            <Label>Dimming Curve</Label>
            <Select value={form.dimmingCurve ?? ''} onValueChange={v => set('dimmingCurve', v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select curve" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Linear">Linear</SelectItem>
                <SelectItem value="Log">Log</SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div> */}
          <div className="space-y-2">
            <Label>Dimming Gamma</Label>
            <Input
              value={form.dimmingGamma ?? ''}
              onChange={e => set('dimmingGamma', Number(e.target.value) || undefined)}
            />
          </div>
          <div className="space-y-2">
            <Label>Min CCT</Label>
            <Input
              value={form.minCct ?? ''}
              onChange={e => set('minCct', Number(e.target.value) || undefined)}
            />
          </div>
          <div className="space-y-2">
            <Label>Mid CCT</Label>
            <Input
              value={form.midCct ?? ''}
              onChange={e => set('midCct', Number(e.target.value) || undefined)}
            />
          </div>
          <div className="space-y-2">
            <Label>Max CCT</Label>
            <Input
              value={form.maxCct ?? ''}
              onChange={e => set('maxCct', Number(e.target.value) || undefined)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!isValid}
            onClick={() => {
              if (!isValid) return;
              onSubmit(form);
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
