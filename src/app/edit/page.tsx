'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { localStorageBills } from '@/lib/localStorage';
import { Navbar } from '@/components/navbar';

interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}



function EditPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [tax, setTax] = useState<number | null>(null);
  const [serviceCharge, setServiceCharge] = useState<number | null>(null);
  const [splitOption, setSplitOption] = useState<'equal' | 'custom' | null>(null);
  const [billCount, setBillCount] = useState(0);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  
  // Local input states for tax and service charge only
  const [taxInput, setTaxInput] = useState<string>('');
  const [serviceChargeInput, setServiceChargeInput] = useState<string>('');
  
  useEffect(() => {
    // Get data from URL parameters
    const itemsParam = searchParams.get('items');
    const taxParam = searchParams.get('tax');
    const serviceChargeParam = searchParams.get('serviceCharge');
    const splitOptionParam = searchParams.get('splitOption');
    const billId = searchParams.get('billId');
    const userId = searchParams.get('userId');
    
    console.log('Edit page URL params:', {
      itemsParam,
      taxParam,
      serviceChargeParam,
      splitOptionParam,
      billId
    });
    
    if (itemsParam) {
      try {
        const parsedItems = JSON.parse(itemsParam);
        setItems(parsedItems);
      } catch (error) {
        console.error('Error parsing items from URL:', error);
      }
    }
    
    if (taxParam) {
      const taxValue = taxParam === 'null' ? null : parseFloat(taxParam);
      setTax(taxValue);
      setTaxInput(taxValue?.toString() || '');
    }
    
    if (serviceChargeParam) {
      const parsedServiceCharge = serviceChargeParam === 'null' ? null : parseFloat(serviceChargeParam);
      setServiceCharge(parsedServiceCharge);
      setServiceChargeInput(parsedServiceCharge?.toString() || '');
    }
    
    if (splitOptionParam) {
      console.log('Edit page setting split option to:', splitOptionParam);
      setSplitOption(splitOptionParam as 'equal' | 'custom');
    } else {
      console.log('No split option param found! Defaulting to equal');
      setSplitOption('equal');
    }
    
    // Store billId for updating existing bill
    if (billId) {
      setEditingBillId(billId);
    }
    
    // Count existing bills for this user
    if (userId) {
      const existingBills = localStorageBills.getBillsByPerson(userId);
      setBillCount(existingBills.length);
    }
  }, [searchParams]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState<Omit<ReceiptItem, 'id'>>({ 
    name: '', 
    price: 0, 
    quantity: 1 
  });

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal + (tax || 0) + (serviceCharge || 0);

  const handleUpdateItem = (id: string, field: keyof ReceiptItem | 'total', value: string | number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        let updatedItem = { ...item };
        
        // If updating total, calculate new price
        if (field === 'total') {
          const newPrice = Number(value) / (item.quantity || 1);
          updatedItem = { ...updatedItem, price: newPrice };
        }
        // If updating quantity, keep the same total but adjust price
        else if (field === 'quantity') {
          const newQuantity = Number(value) || 1;
          const newPrice = (item.price * item.quantity) / newQuantity;
          updatedItem = { ...updatedItem, quantity: newQuantity, price: newPrice };
        }
        // For price updates, ensure it's a number
        else if (field === 'price') {
          updatedItem = { ...updatedItem, price: Number(value) || 0 };
        }
        // For other fields, update normally
        else {
          updatedItem = { ...updatedItem, [field]: value };
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  const handleDeleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleAddItem = () => {
    if (!newItem.name || newItem.price <= 0) return;
    
    const newItemWithId = {
      ...newItem,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    };
    
    setItems([
      ...items,
      newItemWithId,
    ]);
    
    setNewItem({ name: '', price: 0, quantity: 1 });
    setIsAddingItem(false);
  };

  // Sync tax and service charge inputs
  useEffect(() => {
    setTaxInput(tax?.toString() || '');
  }, [tax]);

  useEffect(() => {
    setServiceChargeInput(serviceCharge?.toString() || '');
  }, [serviceCharge]);

  const handleNext = () => {
    // Save current state and navigate based on split option
    const params = new URLSearchParams();
    params.set('items', JSON.stringify(items));
    params.set('tax', tax?.toString() || 'null');
    params.set('serviceCharge', serviceCharge?.toString() || 'null');
    
    // Add billId if it exists
    if (editingBillId) {
      params.set('billId', editingBillId);
    }
    
    // Add user info to params
    const userId = searchParams.get('userId');
    const userName = searchParams.get('userName');
    if (userId) params.set('userId', userId);
    if (userName) params.set('userName', userName);
    
    // For custom split, go to split page. For equal split, go directly to settlement.
    if (splitOption === 'custom') {
      router.push(`/split?${params.toString()}`);
    } else {
      router.push(`/settlement?${params.toString()}`);
    }
  };

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveBill = () => {
    setIsSaving(true);
    const userId = searchParams.get('userId');
    const userName = searchParams.get('userName');
    
    if (userId && userName) {
      const billData = {
        personId: userId,
        personName: decodeURIComponent(userName),
        items: items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        tax: tax,
        serviceCharge: serviceCharge,
        total: total,
        updatedAt: new Date().toISOString()
      };
      
      let currentBillId = editingBillId;
      
      if (currentBillId) {
        // For existing bill, we need to delete and re-add since there's no direct update method
        const allBills = localStorageBills.getBills();
        const updatedBills = allBills.filter(bill => bill.id !== currentBillId);
        localStorageBills.saveBills([...updatedBills, { ...billData, id: currentBillId, createdAt: new Date().toISOString() }]);
      } else {
        // Add new bill
        const newBill = { ...billData, id: Date.now().toString(), createdAt: new Date().toISOString() };
        const allBills = localStorageBills.getBills();
        localStorageBills.saveBills([...allBills, newBill]);
        currentBillId = newBill.id;
        setEditingBillId(currentBillId);
      }
      
      // Update URL to include the billId if it's a new bill
      if (!editingBillId && currentBillId) {
        const params = new URLSearchParams(searchParams.toString());
        params.set('billId', currentBillId);
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      }
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
    
    setIsSaving(false);
  };

  const handleAddAnotherBill = () => {
    // Save current bill to localStorage before going back to upload
    const userId = searchParams.get('userId');
    const userName = searchParams.get('userName');
    
    if (userId && userName) {
      // Save current bill to localStorage
      const bill = {
        personId: userId,
        personName: decodeURIComponent(userName),
        items: items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        tax: tax,
        serviceCharge: serviceCharge,
        total: total
      };
      
      localStorageBills.addBill(bill);
      setBillCount(billCount + 1); // Update counter
    }
    
    // Go back to upload page with same user info
    const params = new URLSearchParams();
    if (userId) params.set('userId', userId);
    if (userName) params.set('userName', userName);
    
    router.push(`/upload?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-card rounded-xl shadow-lg p-6 mb-8 border">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-foreground">Review Items</h1>
          {billCount > 0 && (
            <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
              {billCount} bill{billCount > 1 ? 's' : ''} added
            </div>
          )}
        </div>
        
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold text-foreground">Receipt Items</h2>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleSaveBill}
                disabled={isSaving}
                className={`text-sm px-3 py-1 rounded-md ${isSaving ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
              >
                {isSaving ? 'Saving...' : 'Save Bill'}
              </button>
              {saveSuccess && (
                <span className="text-sm text-green-600">Saved!</span>
              )}
              <button
                type="button"
                onClick={() => setIsAddingItem(true)}
                className="text-sm text-primary hover:text-primary/80"
              >
                + Add Item
              </button>
            </div>
          </div>
          
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-1/2">
                    Item
                  </th>
                  <th scope="col" className="px-2 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-1/6">
                    Qty
                  </th>
                  <th scope="col" className="px-2 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-1/6">
                    Price
                  </th>
                  <th scope="col" className="px-2 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-1/6">
                    Total
                  </th>
                  <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {[
                  ...items.map((item, index) => ({
                    ...item,
                    type: 'item',
                    key: `item-${item.id || index}`,
                    element: (
                      <tr key={`item-${item.id || index}`} className="hover:bg-accent">
                        <td className="px-2 py-4 whitespace-nowrap">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                            className="border-b border-input focus:outline-none focus:border-ring w-full bg-background"
                          />
                        </td>
                        <td className="px-2 py-4 whitespace-nowrap text-right">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={item.quantity.toString()}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (value === '') return;
                                const newQuantity = parseInt(value) || 1;
                                if (newQuantity > 0) {
                                  handleUpdateItem(item.id, 'quantity', newQuantity);
                                }
                              }}
                            className="w-16 text-right border-b border-input focus:outline-none focus:border-ring bg-background"
                          />
                        </td>
                        <td className="px-2 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end">
                            <span className="text-muted-foreground mr-1">Rp</span>
                            <input
                              type="text"
                              inputMode="text"
                              value={item.price.toString()}
                              onInput={(e) => {
                                const value = e.currentTarget.value;
                                if (value === '') {
                                  handleUpdateItem(item.id, 'price', 0);
                                  return;
                                }
                                const numValue = parseFloat(value);
                                if (!isNaN(numValue) && numValue >= 0) {
                                  handleUpdateItem(item.id, 'price', numValue);
                                }
                              }}
                              className="w-24 text-right border-b border-input focus:outline-none focus:border-ring bg-background [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </td>
                        <td className="px-2 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end">
                            <span className="text-muted-foreground mr-1">Rp</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={(item.price * item.quantity).toString()}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '') {
                                  handleUpdateItem(item.id, 'total', 0);
                                  return;
                                }
                                const total = parseFloat(value);
                                if (!isNaN(total) && total >= 0) {
                                  handleUpdateItem(item.id, 'total', total);
                                }
                              }}
                              className="w-24 text-right border-b border-input focus:outline-none focus:border-ring bg-background [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </td>
                        <td className="px-2 py-4 whitespace-nowrap text-center w-24">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="px-2 py-1 text-sm bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-md transition-colors whitespace-nowrap"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })),
                  ...(isAddingItem ? [{
                    type: 'add',
                    key: 'add-new-item-row-unique',
                    element: (
                      <tr key="add-new-item-row-unique" className="bg-primary/5">
                        <td className="px-2 py-4 whitespace-nowrap">
                          <input
                            type="text"
                            placeholder="Item name"
                            value={newItem.name}
                            onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                            className="border-b border-input focus:outline-none focus:border-ring w-full bg-transparent"
                            autoFocus
                          />
                        </td>
                        <td className="px-2 py-4 whitespace-nowrap text-right">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={newItem.quantity.toString()}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (value === '') return;
                                const newQuantity = parseInt(value) || 1;
                                if (newQuantity > 0) {
                                  setNewItem({...newItem, quantity: newQuantity});
                                }
                              }}
                            className="w-16 text-right border-b border-input focus:outline-none focus:border-ring bg-transparent"
                          />
                        </td>
                        <td className="px-2 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end">
                            <span className="text-muted-foreground mr-1">Rp</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0"
                              value={newItem.price || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '') {
                                  setNewItem({...newItem, price: 0});
                                  return;
                                }
                                const numValue = parseFloat(value);
                                if (!isNaN(numValue) && numValue >= 0) {
                                  setNewItem({...newItem, price: numValue});
                                }
                              }}
                              className="w-24 text-right border-b border-input focus:outline-none focus:border-ring bg-transparent"
                            />
                          </div>
                        </td>
                        <td className="px-2 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end">
                            <span className="text-muted-foreground mr-1">Rp</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={newItem.price * newItem.quantity === 0 ? '' : (newItem.price * newItem.quantity).toString()}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '') {
                                  setNewItem({...newItem, price: 0});
                                  return;
                                }
                                const total = parseFloat(value);
                                if (!isNaN(total) && total >= 0) {
                                  const price = total / (newItem.quantity || 1);
                                  setNewItem({...newItem, price});
                                }
                              }}
                              className="w-24 text-right border-b border-input focus:outline-none focus:border-ring bg-transparent"
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <button
                            type="button"
                            onClick={() => setIsAddingItem(false)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleAddItem}
                            className="text-primary hover:text-primary/90 font-medium"
                          >
                            Add
                          </button>
                        </td>
                      </tr>
                    )
                  }] : [])
                ].map(item => item.element)}
              </tbody>
              <tfoot className="bg-muted">
                <tr>
                  <td colSpan={2} className="px-6 py-3 text-right text-sm font-medium text-muted-foreground">
                    Subtotal:
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-medium text-foreground">
                    Rp {new Intl.NumberFormat('id-ID').format(subtotal)}
                  </td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={2} className="px-6 py-1 text-right text-sm font-medium text-muted-foreground">
                    <div className="flex items-center justify-end">
                      <span>Tax:</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Auto-detected"
                        value={taxInput}
                        onChange={(e) => setTaxInput(e.target.value)}
                        onBlur={() => {
                          const value = taxInput;
                          if (value === '') {
                            setTax(null);
                          } else {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue) && numValue >= 0) {
                              setTax(numValue);
                            }
                          }
                        }}
                        className="ml-2 w-24 text-right border-b border-input focus:outline-none focus:border-ring bg-background"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-1 text-right text-sm font-medium text-foreground">
                    Rp {new Intl.NumberFormat('id-ID').format(tax || 0)}
                  </td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={2} className="px-6 py-1 text-right text-sm font-medium text-muted-foreground">
                    <div className="flex items-center justify-end">
                      <span>Service Charge:</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Auto-detected"
                        value={serviceChargeInput}
                        onChange={(e) => setServiceChargeInput(e.target.value)}
                        onBlur={() => {
                          const value = serviceChargeInput;
                          if (value === '') {
                            setServiceCharge(null);
                          } else {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue) && numValue >= 0) {
                              setServiceCharge(numValue);
                            }
                          }
                        }}
                        className="ml-2 w-24 text-right border-b border-input focus:outline-none focus:border-ring bg-background"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-1 text-right text-sm font-medium text-foreground">
                    Rp {new Intl.NumberFormat('id-ID').format(serviceCharge || 0)}
                  </td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={2} className="px-6 py-3 text-right text-lg font-bold text-foreground border-t-2 border-border">
                    Total:
                  </td>
                  <td className="px-6 py-3 text-right text-lg font-bold text-foreground border-t-2 border-border">
                    Rp {new Intl.NumberFormat('id-ID').format(total)}
                  </td>
                  <td className="border-t-2 border-border"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams();
              const userId = searchParams.get('userId');
              const userName = searchParams.get('userName');
              
              if (userId) params.set('userId', userId);
              if (userName) params.set('userName', userName);
              if (editingBillId) params.set('billId', editingBillId);
              
              router.push(`/upload?${params.toString()}`);
            }}
            className="px-4 py-2 border border-border rounded-md text-foreground hover:bg-accent"
          >
            Back
          </button>
          
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={handleAddAnotherBill}
              className="px-4 py-2 border border-primary rounded-md text-primary hover:bg-primary/10"
            >
              + Add Another Bill
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              {splitOption === 'custom' ? 'Assign Items' : 'View Bill Settlement'}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

export default function EditPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <EditPageContent />
    </Suspense>
  );
}
