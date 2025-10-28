import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { Download, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface ExportRow {
  id: string;
  room: string;
  zone: string;
  layer: string;
  type: string;
  name: string;
  qty: string;
  mfgPartNumber: string;
  description: string;
}

interface CSVPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ExportRow[];
  onDownload: () => void;
  projectName?: string;
}

type SortField = keyof ExportRow | null;
type SortDirection = 'asc' | 'desc' | null;

const CSVPreviewDialog: React.FC<CSVPreviewDialogProps> = ({
  open,
  onOpenChange,
  data,
  onDownload,
  projectName = 'project',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleDownload = () => {
    onDownload();
    onOpenChange(false);
  };

  const handleSort = (field: keyof ExportRow) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: keyof ExportRow) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-4 w-4 inline-block opacity-50" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="ml-1 h-4 w-4 inline-block" />;
    }
    return <ArrowDown className="ml-1 h-4 w-4 inline-block" />;
  };

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Filter by search term (search in room and name columns)
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      result = result.filter(
        row =>
          row.room.toLowerCase().includes(lowerSearchTerm) ||
          row.name.toLowerCase().includes(lowerSearchTerm)
      );
    }

    // Sort data
    if (sortField && sortDirection) {
      result.sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];

        // Handle numeric sorting (for qty and fields that might contain numbers)
        const aNum = parseFloat(aValue);
        const bNum = parseFloat(bValue);

        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }

        // Handle alphanumeric sorting (like "F1", "F2", "F10")
        const alphaNumCompare = (str1: string, str2: string) => {
          const regex = /(\d+)|(\D+)/g;
          const parts1 = str1.match(regex) || [];
          const parts2 = str2.match(regex) || [];

          for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const part1 = parts1[i] || '';
            const part2 = parts2[i] || '';

            const num1 = parseFloat(part1);
            const num2 = parseFloat(part2);

            if (!isNaN(num1) && !isNaN(num2)) {
              if (num1 !== num2) return num1 - num2;
            } else {
              const cmp = part1.localeCompare(part2);
              if (cmp !== 0) return cmp;
            }
          }
          return 0;
        };

        const comparison = alphaNumCompare(aValue, bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [data, searchTerm, sortField, sortDirection]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="xl:min-w-7xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>CSV Export Preview - {projectName}</DialogTitle>
          <DialogDescription>
            Preview of the data that will be exported to CSV. Total components: {data.length}
            {searchTerm && ` • Showing: ${filteredAndSortedData.length}`}
          </DialogDescription>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by room or light names..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('id')}>
                  ID {getSortIcon('id')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('room')}
                >
                  Room {getSortIcon('room')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('zone')}
                >
                  Zone {getSortIcon('zone')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('layer')}
                >
                  Layer {getSortIcon('layer')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('type')}
                >
                  Type {getSortIcon('type')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('name')}
                >
                  Name {getSortIcon('name')}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('qty')}>
                  QTY {getSortIcon('qty')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('mfgPartNumber')}
                >
                  MFG Part Number {getSortIcon('mfgPartNumber')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('description')}
                >
                  Description {getSortIcon('description')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    {searchTerm ? 'No results found' : 'No data to export'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{row.id}</TableCell>
                    <TableCell>{row.room}</TableCell>
                    <TableCell>{row.zone}</TableCell>
                    <TableCell>{row.layer}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.qty}</TableCell>
                    <TableCell>{row.mfgPartNumber}</TableCell>
                    <TableCell>{row.description}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleDownload} disabled={data.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CSVPreviewDialog;
