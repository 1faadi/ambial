'use client';
import { useState, useRef, useEffect } from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Upload, FileJson, X, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/Separator';
import { Badge } from '@/components/ui/Badge';
import axiosInstance from '@/lib/axios';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';

interface Mix {
  id: number;
  layerCount: number;
}

interface MixLibraryData {
  mixLibraryVersion: string;
  units: string;
  indexRange: [number, number];
  layerSequence: {
    [key: string]: string;
  };
  mixes: Mix[];
}

export default function MixLibraryScreen() {
  const [mixData, setMixData] = useState<MixLibraryData | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch existing mix library on mount
  useEffect(() => {
    const fetchMixLibrary = async () => {
      try {
        setLoading(true);
        console.log('🔍 Fetching existing mix library...');
        const response = await axiosInstance.get('/api/mix-library');

        if (response.data.mixLibrary) {
          console.log('✅ Mix library loaded from database');
          setMixData(response.data.mixLibrary);
          setFileName(response.data.mixLibrary.fileName || 'Existing Mix Library');
        } else {
          console.log('ℹ️ No existing mix library found');
        }
      } catch (err) {
        console.error('❌ Error fetching mix library:', err);
        // Don't show error on initial load if there's no library
      } finally {
        setLoading(false);
      }
    };

    fetchMixLibrary();
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setError('Please upload a valid JSON file');
      return;
    }

    setFileName(file.name);
    setError('');

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const content = e.target?.result as string;
        console.log('📄 File content length:', content.length);
        console.log('📄 First 200 characters:', content.substring(0, 200));

        // Parse the full JSON first
        const fullJsonData = JSON.parse(content);
        console.log('✅ JSON parsed successfully');

        // Extract only the fields we need - create completely new objects
        const cleanMixes: Mix[] = [];

        if (fullJsonData.mixes && Array.isArray(fullJsonData.mixes)) {
          for (const sourceMix of fullJsonData.mixes) {
            // Create a brand new object with ONLY these two fields
            const cleanMix: Mix = {
              id: Number(sourceMix.id),
              layerCount: Number(sourceMix.layerCount),
            };
            cleanMixes.push(cleanMix);
          }
        }

        const extractedData: MixLibraryData = {
          mixLibraryVersion: String(fullJsonData.mixLibraryVersion || ''),
          units: String(fullJsonData.units || ''),
          indexRange: Array.isArray(fullJsonData.indexRange)
            ? [Number(fullJsonData.indexRange[0]), Number(fullJsonData.indexRange[1])]
            : [0, 0],
          layerSequence: { ...fullJsonData.layerSequence },
          mixes: cleanMixes,
        };

        console.log('📊 Extracted data:', JSON.stringify(extractedData, null, 2));

        // Validate the structure
        if (
          !extractedData.mixLibraryVersion ||
          !extractedData.mixes ||
          !Array.isArray(extractedData.mixes)
        ) {
          console.error('❌ Validation failed:', {
            hasVersion: !!extractedData.mixLibraryVersion,
            hasMixes: !!extractedData.mixes,
            isArray: Array.isArray(extractedData.mixes),
          });
          throw new Error('Invalid mix library format');
        }

        console.log('✅ Mix data parsed successfully');
        console.log('🔍 Number of mixes:', extractedData.mixes.length);
        console.log('🔍 First mix structure:', JSON.stringify(extractedData.mixes[0], null, 2));
        console.log('🔍 First mix keys:', Object.keys(extractedData.mixes[0]));

        // Save to database
        saveMixLibraryToDatabase(extractedData, file.name);
      } catch (err) {
        console.error('❌ Error parsing JSON:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to parse JSON file: ${errorMessage}`);
        setMixData(null);
        setLoading(false);
      }
    };

    reader.onerror = () => {
      console.error('❌ FileReader error');
      setError('Failed to read the file. Please try again.');
      setLoading(false);
    };

    reader.readAsText(file);
  };

  // Save mix library to database
  const saveMixLibraryToDatabase = async (data: MixLibraryData, uploadedFileName: string) => {
    try {
      setLoading(true);
      console.log('💾 Saving to database...');

      await axiosInstance.post('/api/mix-library', {
        fileName: uploadedFileName,
        mixLibraryVersion: data.mixLibraryVersion,
        units: data.units,
        indexRange: data.indexRange,
        layerSequence: data.layerSequence,
        mixes: data.mixes,
      });

      setMixData(data);
      setError('');
      console.log('✅ Mix library saved to database successfully');
    } catch (err) {
      console.error('❌ Error saving to database:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to save to database: ${errorMessage}`);
      setMixData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    try {
      setLoading(true);
      console.log('🗑️ Deleting mix library from database...');

      await axiosInstance.delete('/api/mix-library');

      setMixData(null);
      setFileName('');
      setError('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setShowDeleteDialog(false);
      console.log('✅ Mix library deleted successfully');
    } catch (err) {
      console.error('❌ Error deleting mix library:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to delete: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
  };

  return (
    <>
      <Header breadcrumbs={['Home', 'Mix Library']} />

      <div className="mx-[127px] my-10 space-y-6">
        <div className="py-2 space-y-[6px]">
          <h1 className="text-2xl font-semibold tracking-tight">Mix Library</h1>
          <p className="text-muted-foreground text-base">
            Upload and manage your lighting mix library configurations.
          </p>
        </div>

        {/* Upload Section */}
        {!mixData && !loading && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Upload Mix Library</h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                Upload a JSON file containing your mix library configuration
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <Button onClick={() => fileInputRef.current?.click()} disabled={loading}>
                <FileJson className="mr-2 h-4 w-4" />
                Select JSON File
              </Button>
              {error && (
                <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg max-w-md">
                  <p className="text-sm text-destructive font-medium">Error</p>
                  <p className="text-sm text-destructive/80 mt-1">{error}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Check the browser console for more details.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading && !mixData && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
              <h3 className="text-lg font-semibold mb-2">Loading...</h3>
              <p className="text-sm text-muted-foreground">
                {fileName ? 'Saving mix library to database...' : 'Loading mix library...'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Data Display Section */}
        {mixData && (
          <div className="space-y-6">
            {/* Header Info */}
            <Card className="px-3 py-7">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <FileJson className="h-5 w-5" />
                      {fileName}
                    </CardTitle>
                    <CardDescription>Mix Library v{mixData.mixLibraryVersion}</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleClearData}>
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Units</p>
                    <p className="text-base font-semibold mt-1">{mixData.units}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Index Range</p>
                    <p className="text-base font-semibold mt-1">
                      {mixData.indexRange[0]} - {mixData.indexRange[1]}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Mixes</p>
                    <p className="text-base font-semibold mt-1">{mixData.mixes.length}</p>
                  </div>
                </div>

                <Separator className="my-4" />

                <div>
                  <p className="text-sm font-medium mb-3">Layer Sequence</p>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(mixData.layerSequence).map(([layer, description]) => (
                      <div key={layer} className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {layer}
                        </Badge>
                        <span className="text-sm capitalize">{description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Mixes */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Mixes ({mixData.mixes.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mixData.mixes
                  .filter(mix => {
                    // Ensure mix only has id and layerCount
                    const keys = Object.keys(mix);
                    const isValid =
                      keys.length === 2 && keys.includes('id') && keys.includes('layerCount');
                    if (!isValid) {
                      console.warn('⚠️ Invalid mix detected:', mix, 'Keys:', keys);
                    }
                    return isValid;
                  })
                  .map(mix => {
                    // Ensure we're working with primitives only
                    const mixId = typeof mix.id === 'number' ? mix.id : Number(mix.id);
                    const layerCount =
                      typeof mix.layerCount === 'number' ? mix.layerCount : Number(mix.layerCount);

                    return (
                      <Card key={mixId} className="px-3 py-7">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Mix #{mixId}</CardTitle>
                            <Badge>{layerCount} Layers</Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Mix ID</span>
                              <span className="text-sm font-medium">{mixId}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Layer Count</span>
                              <span className="text-sm font-medium">{layerCount}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this mix library? This action cannot be undone and
              will permanently delete all associated mixes from the database.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
