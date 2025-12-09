'use client';

import { useState, useCallback, useRef, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { localStorageBills, localStoragePeople, Bill } from '@/lib/localStorage';
import { Navbar } from '@/components/navbar';

function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function AddBillPageContent() {
  const [image, setImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();
  const [extractedTax, setExtractedTax] = useState<number | null>(null);
  const [extractedServiceCharge, setExtractedServiceCharge] = useState<number | null>(null);
  const [splitOption, setSplitOption] = useState<'equal' | 'custom'>('equal'); // Default to equal since custom handled in finalize-split
  const [inputMode, setInputMode] = useState<'upload' | 'manual'>('upload');
  const [manualItems, setManualItems] = useState<Array<{name: string, price: number, quantity: number}>>([
    { name: '', price: 0, quantity: 1 }
  ]);
  const [manualTax, setManualTax] = useState<string>('');
  const [manualServiceCharge, setManualServiceCharge] = useState<string>('');
  const [people, setPeople] = useState<Array<{id: string, name: string}>>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>('');
  const [canProceed, setCanProceed] = useState(false);
  const [billId, setBillId] = useState<string>('');
  const [ownerError, setOwnerError] = useState(false);
  const ownerSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load people from localStorage
    const savedPeople = localStoragePeople.getPeople();
    setPeople(savedPeople);

    // Check if there are no people, redirect back
    if (savedPeople.length === 0) {
      router.push('/add-people');
    }
    // NOTE: selectedOwner starts empty - user must select
  }, [router]);

  // Update canProceed when owner is selected
  useEffect(() => {
    setCanProceed(selectedOwner !== '');
    if (selectedOwner !== '') {
      setOwnerError(false);
    }
  }, [selectedOwner]);

  // Function to validate owner selection and scroll to owner section
  const validateOwnerAndScroll = () => {
    if (selectedOwner === '') {
      setOwnerError(true);
      ownerSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      return false;
    }
    return true;
  };

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }, [isDragging]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadClick = (e: React.MouseEvent) => {
    if (!validateOwnerAndScroll()) {
      e.preventDefault(); // Prevent file dialog from opening when validation fails
      // Error message already shown by validateOwnerAndScroll
      return;
    }
    // If validation passes, the file input onChange will handle the file
  };

  const handleContinue = () => {
    // Calculate total bill amount
    const items = inputMode === 'manual' ? manualItems.filter(item => item.name && item.price > 0) : extractedItems;
    const itemsTotal = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    const taxAmount = inputMode === 'manual' ? (parseFloat(manualTax) || 0) : (extractedTax || 0);
    const serviceChargeAmount = inputMode === 'manual' ? (parseFloat(manualServiceCharge) || 0) : (extractedServiceCharge || 0);
    const totalBillAmount = itemsTotal + taxAmount + serviceChargeAmount;

    // Find selected owner person
    const ownerPerson = people.find(p => p.id === selectedOwner);

    if (!ownerPerson) return null;

    // Save bill to localStorage with unique ID
    const billId = `${ownerPerson.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // Store billId for URL params
    setBillId(billId);
    const bill = {
      id: billId,
      personId: ownerPerson.id,
      personName: ownerPerson.name,
      items: items.map(item => ({
        name: item.name,
        quantity: item.quantity || 1,
        price: item.price
      })),
      tax: taxAmount,
      serviceCharge: serviceChargeAmount,
      total: totalBillAmount,
      splitType: splitOption as 'equal' | 'custom',
      createdAt: new Date().toISOString()
    };

    localStorageBills.addBill(bill);

    // Reset form fields after saving
    setImage(null);
    setExtractedItems([]);
    setExtractedTax(null);
    setExtractedServiceCharge(null);
    setManualItems([{ name: '', price: 0, quantity: 1 }]);
    setManualTax('');
    setManualServiceCharge('');

    // Return bill data AND billId for navigation (don't navigate here)
    return { items, taxAmount, serviceChargeAmount, ownerPerson, billId };
  };

  const addManualItem = () => {
    setManualItems([...manualItems, { name: '', price: 0, quantity: 1 }]);
  };

  const removeManualItem = (index: number) => {
    const newItems = manualItems.filter((_, i) => i !== index);
    setManualItems(newItems.length > 0 ? newItems : [{ name: '', price: 0, quantity: 1 }]);
  };

  const updateManualItem = (index: number, field: 'name' | 'price' | 'quantity', value: string | number) => {
    const newItems = [...manualItems];
    if (field === 'price' || field === 'quantity') {
      newItems[index][field] = typeof value === 'string' ? parseFloat(value) || 0 : value;
    } else {
      newItems[index][field] = value as string;
    }
    setManualItems(newItems);
  };

  const handleManualContinue = () => {
    const validItems = manualItems.filter(item => item.name && item.price > 0);
    if (validItems.length === 0) {
      setError('Please add at least one valid item');
      return;
    }
    setExtractedItems(validItems);
    setExtractedTax(parseFloat(manualTax) || null);
    setExtractedServiceCharge(parseFloat(manualServiceCharge) || null);
    setError('');
  };

  const updateExtractedItem = (index: number, field: 'name' | 'price' | 'quantity' | 'total', value: string | number) => {
    const itemKey = `${index}-${field}`;
    const stringValue = typeof value === 'string' ? value : value.toString();

    // Update input values to maintain focus
    setInputValues(prev => ({ ...prev, [itemKey]: stringValue }));

    const newItems = [...extractedItems];
    if (field === 'price' || field === 'quantity') {
      newItems[index][field] = typeof value === 'string' ? parseFloat(value) || 0 : value;
    } else if (field === 'total') {
      // Update price based on total and quantity
      const totalValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
      const quantity = newItems[index].quantity || 1;
      newItems[index].price = Math.round(totalValue / quantity);
    } else {
      newItems[index][field] = value as string;
    }
    setExtractedItems(newItems);
  };

  const handleInputChange = (index: number, field: 'name' | 'price' | 'quantity' | 'total', value: string) => {
    const itemKey = `${index}-${field}`;
    setInputValues(prev => ({ ...prev, [itemKey]: value }));

    // Update immediately on blur for all fields to avoid input issues
  };

  const handleInputBlur = (index: number, field: 'name' | 'price' | 'quantity' | 'total') => {
    const itemKey = `${index}-${field}`;
    const value = inputValues[itemKey];

    if (value !== undefined) {
      if (field === 'name') {
        updateExtractedItem(index, field, value);
      } else if (field === 'price' || field === 'quantity' || field === 'total') {
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue >= 0) {
          updateExtractedItem(index, field, numValue);
        }
      }
    }
  };

  const deleteExtractedItem = (index: number) => {
    const newItems = extractedItems.filter((_, i) => i !== index);
    setExtractedItems(newItems);
  };

  const updateGrandTotal = (newTotal: number) => {
    if (newTotal <= 0) return;

    // Distribute the difference proportionally
    const itemsTotal = extractedItems.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    const newItems = extractedItems.map(item => {
      const currentTotal = item.price * (item.quantity || 1);
      const proportion = currentTotal / itemsTotal;
      const newPrice = (newTotal * proportion) / (item.quantity || 1);

      return {
        ...item,
        price: Math.round(newPrice) // Round to nearest whole number
      };
    });

    setExtractedItems(newItems);
  };

  const [extractedItems, setExtractedItems] = useState<Array<{name: string, price: number, quantity?: number}>>([]);
  const [inputValues, setInputValues] = useState<{[key: string]: string}>({});
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const processReceipt = async () => {
    if (!image) {
      setStatus('No image to process');
      return;
    }

    setIsProcessing(true);
    setStatus('Processing receipt with AI...');
    setError('');

    try {
      console.log('Sending receipt for processing...');
      const response = await fetch('/api/process-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageData: image }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });

        const errorMessage = errorData?.message ||
                           errorData?.error ||
                           `Failed to process receipt (${response.status})`;
        throw new Error(errorMessage);
      }

      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('Invalid response format from server');
      }

      console.log('Received items:', data.items);

      // Transform the items to match our expected format
      const formattedItems = data.items.map((item: any) => ({
        name: String(item.name || '').trim(),
        price: Math.max(0, Number(item.price) || 0),
        quantity: Math.max(1, Number(item.quantity) || 1),
      })).filter((item: any) => item.name && item.price > 0);

      if (formattedItems.length === 0) {
        throw new Error('No valid items found in the receipt');
      }

      if (formattedItems.length > 0) {
        setExtractedItems(formattedItems);
        // Extract tax and service charge from the response
        setExtractedTax(data.tax || null);
        setExtractedServiceCharge(data.serviceCharge || null);
        setStatus(`Found ${formattedItems.length} items`);
        setError('');
      } else {
        throw new Error('No valid items found in the receipt');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process receipt';
      console.error('Error processing receipt:', {
        message: errorMessage,
        error: error instanceof Error ? error : undefined,
        stack: error instanceof Error ? error.stack : undefined
      });
      setError(errorMessage);
      setStatus('Error processing receipt');
      setExtractedItems([]); // Clear any previously extracted items
      setExtractedTax(null);
      setExtractedServiceCharge(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Owner Selection Header */}
        <div ref={ownerSectionRef} className="bg-card rounded-xl shadow-lg p-4 mb-6 border">
          <h2 className="text-lg font-semibold text-foreground mb-3">Uploading bill as:</h2>
          <select
            value={selectedOwner}
            onChange={(e) => setSelectedOwner(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:border-ring"
          >
            <option value="" disabled>Select person</option>
            {people.map(person => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          {ownerError && (
            <p className="text-sm text-destructive mt-1">Please select a bill owner first</p>
          )}
        </div>

        <div className="bg-card rounded-xl shadow-lg p-6 mb-8 border">
          <h1 className="text-2xl font-bold text-foreground mb-6">Add Receipt</h1>

          {/* Mode Selection */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setInputMode('upload')}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                inputMode === 'upload'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              📷 Upload Image
            </button>
            <button
              onClick={() => {
                if (validateOwnerAndScroll()) {
                  setInputMode('manual');
                }
              }}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                inputMode === 'manual'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              ✏️ Manual Input
            </button>
          </div>

          {inputMode === 'upload' ? (
            <>
              {!image ? (
                <div
                  className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                    isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="space-y-4">
                    <svg
                      className="mx-auto h-12 w-12 text-muted-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className="text-lg text-foreground">
                      {isDragging ? 'Drop your receipt here' : 'Drag and drop your receipt here'}
                    </p>
                    <p className="text-sm text-muted-foreground">or</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <label className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 cursor-pointer transition-colors text-center" onClick={handleUploadClick}>
                        📷 Take Photo
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          capture="environment"
                          onChange={handleFileInput}
                        />
                      </label>
                      <label className="px-4 py-2 bg-muted text-muted-foreground hover:bg-accent cursor-pointer transition-colors rounded-md text-center" onClick={handleUploadClick}>
                        📸 Select from Gallery
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleFileInput}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Supported formats: JPG, PNG (max 10MB)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="border border-border rounded-lg overflow-hidden">
                    <img
                      src={image}
                      alt="Uploaded receipt"
                      className="w-full h-auto max-h-96 object-contain"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      type="button"
                      onClick={() => setImage(null)}
                      className="px-4 py-2 border border-border rounded-md text-foreground hover:bg-accent transition-colors flex-1"
                    >
                      Retake
                    </button>
                    <div className="w-full space-y-4">
                      <button
                        type="button"
                        onClick={processReceipt}
                        disabled={isProcessing}
                        className={`w-full px-4 py-2 rounded-md text-primary-foreground ${
                          isProcessing
                            ? 'bg-primary/50 cursor-not-allowed'
                            : 'bg-primary hover:bg-primary/90'
                        }`}
                      >
                        {isProcessing ? 'Processing...' : 'Extract Items'}
                      </button>

                      {isProcessing && (
                        <div className="w-full bg-muted rounded-full h-2.5">
                          <div
                            className="bg-primary h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}

                      {status && (
                        <div className={`mt-4 p-4 rounded-md ${error ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                          {error || status}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Manual Input Form */
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium text-foreground">Add Items</h3>

                {manualItems.map((item, index) => (
                  <div key={index} className="bg-muted/50 p-3 rounded-lg">
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <input
                        type="text"
                        placeholder="Item name"
                        value={item.name}
                        onChange={(e) => updateManualItem(index, 'name', e.target.value)}
                        className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground"
                      />
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="Price"
                          value={item.price || ''}
                          onChange={(e) => {
                            // Only allow numbers and decimal point
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            updateManualItem(index, 'price', value);
                          }}
                          className="w-20 sm:w-24 px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity || ''}
                          onChange={(e) => updateManualItem(index, 'quantity', e.target.value)}
                          className="w-14 sm:w-16 px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground"
                        />
                        {manualItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeManualItem(index)}
                            className="p-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addManualItem}
                  className="px-4 py-2 border border-border rounded-md text-foreground hover:bg-accent transition-colors"
                >
                  + Add Item
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Tax (optional)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={manualTax}
                    onChange={(e) => setManualTax(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Service Charge (optional)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={manualServiceCharge}
                    onChange={(e) => setManualServiceCharge(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleManualContinue}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Continue to Next Step
              </button>

              {error && (
                <div className="p-4 rounded-md bg-destructive/10 text-destructive">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Items Display - After Processing */}
          {extractedItems.length > 0 && (
            <div className="mt-6 border-t pt-6">
              <h3 className="font-medium mb-2 text-foreground">
                Items:
              </h3>
              <div className="relative">
                <div className="max-h-64 overflow-y-auto mb-4">
                <table className="min-w-full divide-y divide-border md:table">
                  <thead className="hidden md:table-header-group">
                    <tr>
                      <th className="px-2 py-1 text-left text-xs font-medium text-muted-foreground uppercase">Item</th>
                      <th className="px-2 py-1 text-right text-xs font-medium text-muted-foreground uppercase">Qty</th>
                      <th className="px-2 py-1 text-right text-xs font-medium text-muted-foreground uppercase">Price</th>
                      <th className="px-2 py-1 text-right text-xs font-medium text-muted-foreground uppercase">Total</th>
                      <th className="px-2 py-1 text-center text-xs font-medium text-muted-foreground uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {extractedItems.map((item, index) => (
                      <tr key={`item-${index}`} className="block md:table-row border-b md:border-b-0">
                        <td className="block md:table-cell px-2 py-2 md:py-1 text-sm">
                          <div className="flex justify-between items-center md:block">
                            <span className="md:hidden text-muted-foreground">Item:</span>
                            <input
                              type="text"
                              value={inputValues[`${index}-name`] || item.name}
                              onChange={(e) => handleInputChange(index, 'name', e.target.value)}
                              onBlur={() => handleInputBlur(index, 'name')}
                              className="w-full border-b border-input focus:outline-none focus:border-ring bg-background text-sm"
                            />
                          </div>
                        </td>
                        <td className="block md:table-cell px-2 py-2 md:py-1 text-sm">
                          <div className="flex justify-between items-center md:block md:text-right">
                            <span className="md:hidden text-muted-foreground">Qty:</span>
                            <input
                              type="number"
                              min="1"
                              value={inputValues[`${index}-quantity`] || (item.quantity || 1).toString()}
                              onChange={(e) => handleInputChange(index, 'quantity', e.target.value)}
                              onBlur={() => handleInputBlur(index, 'quantity')}
                              className="w-16 md:text-right border-b border-input focus:outline-none focus:border-ring bg-background text-sm"
                            />
                          </div>
                        </td>
                        <td className="block md:table-cell px-2 py-2 md:py-1 text-sm">
                          <div className="flex justify-between items-center md:block md:text-right">
                            <span className="md:hidden text-muted-foreground">Price:</span>
                            <div className="flex items-center justify-end">
                              <span className="text-muted-foreground mr-1 text-xs">Rp</span>
                              <input
                                type="text"
                                inputMode="text"
                                value={inputValues[`${index}-price`] || item.price.toString()}
                                onInput={(e: React.FormEvent<HTMLInputElement>) => {
                                  // Only allow numbers and decimal point
                                  const value = e.currentTarget.value.replace(/[^0-9.]/g, '');
                                  handleInputChange(index, 'price', value);
                                }}
                                onBlur={() => handleInputBlur(index, 'price')}
                                className="w-20 text-right border-b border-input focus:outline-none focus:border-ring bg-background text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>
                          </div>
                        </td>
                        <td className="block md:table-cell px-2 py-2 md:py-1 text-sm">
                          <div className="flex justify-between items-center md:block md:text-right">
                            <span className="md:hidden text-muted-foreground">Total:</span>
                            <div className="flex items-center justify-end">
                              <span className="text-muted-foreground mr-1 text-xs">Rp</span>
                              <input
                                type="text"
                                inputMode="text"
                                value={inputValues[`${index}-total`] ?? (Number.isFinite(item.price) && Number.isFinite(item.quantity) ? (item.price * (item.quantity || 1)).toString() : '')}
                                onInput={(e: React.FormEvent<HTMLInputElement>) => {
                                  // Only allow numbers and decimal point
                                  const value = e.currentTarget.value.replace(/[^0-9.]/g, '');
                                  handleInputChange(index, 'total', value);
                                }}
                                onBlur={() => handleInputBlur(index, 'total')}
                                className="w-20 text-right font-medium border-b border-input focus:outline-none focus:border-ring bg-background text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>
                          </div>
                        </td>
                        <td className="block md:table-cell px-2 py-2 md:py-1 text-sm">
                          <div className="flex justify-between items-center md:block md:text-center">
                            <span className="md:hidden text-muted-foreground">Actions:</span>
                            <button
                              onClick={() => deleteExtractedItem(index)}
                              className="text-destructive hover:text-destructive/90 text-xs"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Scroll Indicator Icon */}
              {extractedItems.length > 5 && (
                <div className="absolute right-2 top-2 w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center animate-pulse">
                  <svg className="w-4 h-4 text-primary animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              )}
            </div>

            {/* Add Item Button */}
            <div className="flex justify-end mb-4">
                <button
                  onClick={() => {
                    const newItem = {
                      name: '',
                      price: 0,
                      quantity: 1
                    };
                    setExtractedItems([...extractedItems, newItem]);
                  }}
                  className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  + Add Item
                </button>
              </div>

              {/* Total Summary */}
              <div className="border-t pt-4 mb-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground text-sm">Rp</span>
                      <input
                        type="text"
                        inputMode="text"
                        value={extractedItems.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0).toString()}
                        onInput={(e: React.FormEvent<HTMLInputElement>) => {
                          const newSubtotal = parseFloat(e.currentTarget.value) || 0;
                          updateGrandTotal(newSubtotal);
                        }}
                        className="w-32 text-right font-medium border-b border-input focus:outline-none focus:border-ring bg-background [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Tax:</span>
                    <span className="font-medium">{formatIDR(extractedTax || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Service Charge:</span>
                    <span className="font-medium">{formatIDR(extractedServiceCharge || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="font-semibold text-foreground">Total:</span>
                    <span className="font-bold text-primary text-lg">
                      {formatIDR(
                        extractedItems.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0) +
                        (extractedTax || 0) +
                        (extractedServiceCharge || 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Split Options */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 text-foreground">How would you like to split this bill?</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div
                  onClick={() => setSplitOption('equal')}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    splitOption === 'equal'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-foreground">Split Equally</h5>
                      <p className="text-sm text-muted-foreground">Divide the total equally among all people</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 ${
                      splitOption === 'equal' ? 'border-primary bg-primary' : 'border-border'
                    }`}>
                      {splitOption === 'equal' && (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-primary-foreground rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => {
                    setSplitOption('custom');
                    if (extractedItems.length > 0) {
                      console.log('DEBUG - Custom split clicked, calling handleContinue with splitOption:', splitOption);
                      const billData = handleContinue();
                      console.log('DEBUG - handleContinue returned billData:', billData);
                      if (billData) {
                        const params = new URLSearchParams({
                          items: JSON.stringify(billData.items),
                          tax: billData.taxAmount.toString(),
                          serviceCharge: billData.serviceChargeAmount.toString(),
                          userId: selectedOwner,
                          userName: billData.ownerPerson.name,
                          splitOption: 'custom',
                          billUniqueId: billData.billId // Use returned billId directly
                        });
                        console.log('DEBUG - Navigating to split page with params');
                        router.push(`/split?${params.toString()}`);
                      }
                    }
                  }}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    splitOption === 'custom'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-foreground">Custom Split</h5>
                      <p className="text-sm text-muted-foreground">Assign specific items to specific people</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 ${
                      splitOption === 'custom' ? 'border-primary bg-primary' : 'border-border'
                    }`}>
                      {splitOption === 'custom' && (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-primary-foreground rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-col space-y-3 sm:space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    if (splitOption) {
                      handleContinue();
                      // Navigate to add more bills
                      router.push('/add-bill');
                    }
                  }}
                  disabled={!splitOption}
                  className="w-full px-4 py-3 sm:order-1 border border-border rounded-md font-medium text-foreground hover:bg-accent transition-colors"
                >
                  Save Bill & Add More Bills
                </button>

                <button
                  type="button"
                  onClick={() => {
                    // Force equal split option
                    setSplitOption('equal');
                    const billData = handleContinue();
                    if (billData) {
                      // For final bill, process ALL accumulated bills (don't specify billUniqueId)
                      const params = new URLSearchParams({
                        finalizeMode: 'true'  // Indicator to process all accumulated bills
                      });
                      router.push(`/settlement?${params.toString()}`);
                    }
                  }}
                  disabled={extractedItems.length === 0}
                  className={`w-full px-4 py-3 sm:order-2 rounded-md font-medium transition-colors ${
                    extractedItems.length > 0
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-muted cursor-not-allowed text-muted-foreground'
                  }`}
                >
                  Final Bill
                </button>
              </div>
            </div>
          </div>
        )}

        </div>

        <div className="bg-card rounded-xl shadow-lg p-6 border">
          <h2 className="text-xl font-semibold text-foreground mb-4">Tips for best results:</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-start">
              <svg className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Ensure good lighting when taking photos</span>
            </li>
            <li className="flex items-start">
              <svg className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Lay the receipt flat and avoid folds or wrinkles</span>
            </li>
            <li className="flex items-start">
              <svg className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Position the receipt within the frame</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function AddBillPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <AddBillPageContent />
    </Suspense>
  );
}
