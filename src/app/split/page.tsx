'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { localStoragePeople, localStorageBills } from '@/lib/localStorage';
import { Navbar } from '@/components/navbar';

interface Person {
  id: string;
  name: string;
  amount?: number;
}

interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface ItemAssignment {
  itemId: string;
  personIds: string[];
  isShared: boolean;
}

function SplitPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [assignments, setAssignments] = useState<ItemAssignment[]>([]);
  const [tax, setTax] = useState<number | null>(null);
  const [serviceCharge, setServiceCharge] = useState<number | null>(null);
  const [newPersonName, setNewPersonName] = useState('');
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editingPersonName, setEditingPersonName] = useState('');
  const [isAddingPerson, setIsAddingPerson] = useState(false);
  const [currentUser, setCurrentUser] = useState<{id: string, name: string} | null>(null);
  const [splitOption, setSplitOption] = useState<'equal' | 'custom' | null>(null);

  // Predefined colors for people
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-gray-500',
  ];

  // Fetch people from localStorage on mount
  useEffect(() => {
    let mounted = true;

    const fetchPeople = () => {
      try {
        const savedPeople = localStoragePeople.getPeople();
        if (savedPeople && mounted) {
          setPeople(savedPeople.map((p: any) => ({ id: p.id, name: p.name, amount: p.amount ?? 0 })));
        }
      } catch (err) {
        console.error('Unexpected error in fetchPeople:', err);
      }
    };

    fetchPeople();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // Get data from URL parameters
    const itemsParam = searchParams.get('items');
    const taxParam = searchParams.get('tax');
    const serviceChargeParam = searchParams.get('serviceCharge');
    const userId = searchParams.get('userId');
    const userName = searchParams.get('userName');
    const splitOptionParam = searchParams.get('splitOption');
    
    console.log('URL params:', {
      itemsParam,
      taxParam,
      serviceChargeParam,
      userId,
      userName,
      splitOptionParam
    });
    
    if (userId && userName) {
      setCurrentUser({ id: userId, name: decodeURIComponent(userName) });
    }
    
    if (splitOptionParam) {
      console.log('Setting split option to:', splitOptionParam);
      setSplitOption(splitOptionParam as 'equal' | 'custom');
    } else {
      console.log('No split option param found!');
    }
    
    if (itemsParam) {
      try {
        const parsedItems = JSON.parse(itemsParam);
        // Ensure each item has a unique ID
        const itemsWithIds = parsedItems.map((item: any, index: number) => ({
          ...item,
          id: item.id || `item-${Date.now()}-${index}`
        }));
        setItems(itemsWithIds);
        
        // Initialize assignments for each item
        const initialAssignments: ItemAssignment[] = itemsWithIds.map((item: any) => ({
          itemId: item.id,
          personIds: [],
          isShared: false,
        }));
        setAssignments(initialAssignments);
      } catch (error) {
        console.error('Error parsing items from URL:', error);
      }
    }
    
    if (taxParam) {
      setTax(taxParam === 'null' ? null : parseFloat(taxParam));
    }
    
    if (serviceChargeParam) {
      setServiceCharge(serviceChargeParam === 'null' ? null : parseFloat(serviceChargeParam));
    }
  }, [searchParams]);

  // Initialize assignments for custom split when people are loaded
  useEffect(() => {
    if (splitOption === 'custom' && items.length > 0 && people.length > 0 && assignments.length === 0) {
      const initialAssignments: ItemAssignment[] = items.map((item) => ({
        itemId: item.id,
        personIds: [], // Start with no assignments - users must manually assign items
        isShared: false,
      }));
      setAssignments(initialAssignments);
    }
  }, [splitOption, items, people, assignments.length]);

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal + (tax || 0) + (serviceCharge || 0);

  // Debug log untuk split option
  useEffect(() => {
    console.log('Split option:', splitOption);
    console.log('People length:', people.length);
    console.log('Total:', total);
    console.log('Items:', items);
  }, [splitOption, people.length, total, items]);

  const addPerson = () => {
    if (newPersonName.trim()) {
      try {
        // Only send name field
        const insertData = { 
          name: newPersonName.trim()
        };
        
        console.log('Adding person:', insertData);
        const updatedPeople = localStoragePeople.addPerson(newPersonName);
        console.log('Successfully added person, updated list:', updatedPeople);
        if (updatedPeople) {
          setPeople(updatedPeople);
          setNewPersonName('');
          setIsAddingPerson(false);
        }
      } catch (err) {
        console.error('Unexpected addPerson error:', err);
      }
    }
  };

  const deletePerson = (personId: string) => {
    try {
      const updatedPeople = localStoragePeople.deletePerson(personId);
      setPeople(updatedPeople);
      // Remove person from all assignments
      setAssignments(assignments.map(assignment => ({
        ...assignment,
        personIds: assignment.personIds.filter(id => id !== personId),
      })));
    } catch (err) {
      console.error('Unexpected deletePerson error:', err);
    }
  };

  const startEditPerson = (person: Person) => {
    setEditingPersonId(person.id);
    setEditingPersonName(person.name);
  };

  const saveEditPerson = async () => {
    if (editingPersonId && editingPersonName.trim()) {
      try {
        const updatedPeople = localStoragePeople.updatePerson(editingPersonId, { name: editingPersonName.trim() });
        setPeople(updatedPeople);
        setEditingPersonId(null);
        setEditingPersonName('');
      } catch (err) {
        console.error('Unexpected updatePerson error:', err);
      }
    }
  };

  const cancelEditPerson = () => {
    setEditingPersonId(null);
    setEditingPersonName('');
  };

  const toggleItemAssignment = (itemId: string, personId: string) => {
    setAssignments(assignments.map(assignment => {
      if (assignment.itemId === itemId) {
        const personIds = assignment.personIds.includes(personId)
          ? assignment.personIds.filter(id => id !== personId)
          : [...assignment.personIds, personId];
        
        return {
          ...assignment,
          personIds,
          isShared: personIds.length > 1,
        };
      }
      return assignment;
    }));
  };

  const calculatePersonShare = (personId: string): number => {
    console.log(`Calculating share for ${personId}, splitOption: ${splitOption}, people.length: ${people.length}`);
    
    // If split equally, divide total by number of people
    if (splitOption === 'equal' && people.length > 0) {
      const equalShare = total / people.length;
      console.log(`Equal split: total=${total}, people=${people.length}, share=${equalShare}`);
      return equalShare;
    }
    
    console.log('Using custom split logic');
    // Custom split logic
    let share = 0;
    
    // Calculate share of items
    assignments.forEach(assignment => {
      if (assignment.personIds.includes(personId)) {
        const item = items.find(i => i.id === assignment.itemId);
        if (item) {
          const itemTotal = item.price * item.quantity;
          if (assignment.isShared) {
            share += itemTotal / assignment.personIds.length;
          } else {
            share += itemTotal;
          }
        }
      }
    });
    
    // Calculate share of tax and service charge
    const assignedItemsTotal = assignments
      .filter(a => a.personIds.includes(personId))
      .reduce((sum, assignment) => {
        const item = items.find(i => i.id === assignment.itemId);
        if (item) {
          const itemTotal = item.price * item.quantity;
          return sum + (assignment.isShared ? itemTotal / assignment.personIds.length : itemTotal);
        }
        return sum;
      }, 0);
    
    if (subtotal > 0) {
      const taxShare = tax ? (tax * assignedItemsTotal) / subtotal : 0;
      const serviceShare = serviceCharge ? (serviceCharge * assignedItemsTotal) / subtotal : 0;
      share += taxShare + serviceShare;
    }
    
    console.log(`Custom share for ${personId}: ${share}`);
    return share;
  };

  const handleBack = () => {
    router.back();
  };

  const handleCompleteSplit = () => {
    console.log('handleCompleteSplit called');
    if (!currentUser) {
      console.error('No current user');
      return;
    }
    
    try {
      // Calculate person shares for custom split
      const personShares: { [personId: string]: number } = {};
      if (splitOption === 'custom') {
        console.log('Calculating person shares for custom split');
        people.forEach(person => {
          // For the current user (payer), only calculate share if they actually consumed items
          // In titipan case, the payer should have 0 share
          if (person.id === currentUser.id) {
            const consumedItems = items.filter(item => 
              assignments.some(a => a.itemId === item.id && a.personIds.includes(person.id))
            );
            
            if (consumedItems.length === 0) {
              // Pure titipan case - payer has 0 share
              personShares[person.id] = 0;
              console.log(`Setting 0 share for ${currentUser.name} - titipan case`);
              return;
            }
          }
          
          personShares[person.id] = calculatePersonShare(person.id);
          console.log(`Share for ${person.name}: ${personShares[person.id]}`);
        });
      }
      
      console.log('Final personShares:', personShares);
      
      // Create a summary of the split
      const splitSummary = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        total,
        tax: tax || 0,
        serviceCharge: serviceCharge || 0,
        splitType: splitOption || 'equal',
        people: people.map(person => ({
          id: person.id,
          name: person.name,
          amount: splitOption === 'custom' ? personShares[person.id] : total / people.length,
          items: splitOption === 'custom' 
            ? items
                .filter(item => 
                  assignments.some(
                    a => a.itemId === item.id && a.personIds.includes(person.id)
                  )
                )
                .map(item => ({
                  name: item.name,
                  price: item.price,
                  quantity: item.quantity
                }))
            : []
        })),
        createdBy: {
          id: currentUser.id,
          name: currentUser.name
        }
      };

      // Save to localStorage with custom split information
      const savedSplits = JSON.parse(localStorage.getItem('savedSplits') || '[]');
      savedSplits.push(splitSummary);
      localStorage.setItem('savedSplits', JSON.stringify(savedSplits));
      
      if (splitOption === 'custom') {
        console.log('Creating bills for custom split');
        
        // IMPORTANT: Remove any existing bills for the current user to prevent double counting
        const existingBills = localStorageBills.getBills();
        const currentUserBills = existingBills.filter(bill => bill.personId === currentUser.id);
        console.log('Existing bills for current user:', currentUserBills);
        
        // Remove existing bills for the current user
        currentUserBills.forEach(bill => {
          console.log('Removing existing bill:', bill.id);
          localStorageBills.deleteBill(bill.id);
        });
        
        // For custom split, create bills ONLY for people who have shares > 0
        // This prevents double counting the original payer's bill
        people.forEach(person => {
          const personShare = personShares[person.id];
          console.log(`Processing ${person.name}: share=${personShare}, personId=${person.id}, currentUser.id=${currentUser.id}`);
          
          if (personShare > 0) {
            const assignedItems = items.filter(item => 
              assignments.some(a => a.itemId === item.id && a.personIds.includes(person.id))
            );
            
            console.log(`Assigned items for ${person.name}:`, assignedItems);
            
            if (assignedItems.length > 0) {
              console.log(`Creating bill for ${person.name} with total ${personShare}`);
              const personBillData = {
                personId: person.id,
                personName: person.name,
                items: assignedItems.map(item => ({
                  name: item.name,
                  quantity: item.quantity,
                  price: item.price
                })),
                tax: tax ? (tax * assignedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)) / subtotal : 0,
                serviceCharge: serviceCharge ? (serviceCharge * assignedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)) / subtotal : 0,
                total: personShare,
                splitType: 'custom' as const,
                personShares: { [person.id]: personShare }
              };
              
              localStorageBills.addBill(personBillData);
            } else {
              console.log(`No assigned items for ${person.name}, skipping bill creation`);
            }
          } else {
            console.log(`Share is 0 for ${person.name}, skipping bill creation (titipan case)`);
          }
        });
      } else {
        // For equal split, create one bill for the current user
        const billData = {
          personId: currentUser.id,
          personName: currentUser.name,
          items: items.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
          })),
          tax: tax,
          serviceCharge: serviceCharge,
          total: total,
          splitType: (splitOption || 'equal') as 'equal' | 'custom',
          personShares: undefined
        };
        
        localStorageBills.addBill(billData);
      }
      
      // Navigate to settlement page
      console.log('Navigating to settlement page');
      router.push('/settlement');
      
    } catch (error) {
      console.error('Error saving split:', error);
      alert('Gagal menyimpan split. Silakan coba lagi.');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-card rounded-xl shadow-lg p-6 mb-8 border">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">Splity</h1>
          
          {/* People Management - Only for Custom Split */}
          {splitOption === 'custom' && (
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-foreground">People</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {people.map((person) => (
                  <div key={person.id} className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                    <div className={`w-3 h-3 rounded-full ${colors[people.findIndex(p => p.id === person.id) % colors.length]}`}></div>
                    <span className="font-medium text-sm truncate">{person.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Items Assignment - Only for Custom Split */}
          {splitOption === 'custom' && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4">Assign Items to People</h2>
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="border border-border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium">{item.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} × Rp {item.price.toLocaleString('id-ID')} = Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Assigned to:</p>
                      <div className="flex flex-wrap gap-2">
                        {people.map((person) => {
                          const assignment = assignments.find(a => a.itemId === item.id);
                          const isAssigned = assignment?.personIds.includes(person.id) || false;
                          const personColorIndex = people.findIndex(p => p.id === person.id) % colors.length;
                          return (
                            <button
                              key={`${item.id}-${person.id}`}
                              type="button"
                              onClick={() => toggleItemAssignment(item.id, person.id)}
                              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                isAssigned
                                  ? `${colors[personColorIndex]} text-primary-foreground`
                                  : 'bg-muted text-foreground hover:bg-accent'
                              }`}
                            >
                              {person.name}
                            </button>
                          );
                        })}
                      </div>
                      {assignments.find(a => a.itemId === item.id)?.personIds.length === 0 && (
                        <p className="text-sm text-muted-foreground italic">Not assigned to anyone</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Equal Split Info */}
          {splitOption === 'equal' && (
            <div className="mb-8 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <h2 className="text-lg font-semibold text-foreground mb-2">Equal Split</h2>
              <p className="text-foreground">
                Total bill (Rp {total.toLocaleString('id-ID')}) will be divided equally among {people.length} people.
                Each person pays: <strong>Rp {(total / people.length).toLocaleString('id-ID')}</strong>
              </p>
            </div>
          )}

          {/* Summary */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Summary</h2>
            <div className="space-y-3">
              {people.map((person) => {
                const share = calculatePersonShare(person.id);
                return (
                  <div key={person.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${colors[people.findIndex(p => p.id === person.id) % colors.length]}`}></div>
                      <span className="font-medium">{person.name}</span>
                    </div>
                    <span className="font-bold text-sm sm:text-base">Rp {share.toLocaleString('id-ID')}</span>
                  </div>
                );
              })}
              <div className="flex justify-between items-center p-3 bg-accent rounded-lg font-bold">
                <span>Total</span>
                <span>Rp {splitOption === 'custom' 
                  ? people.reduce((sum, person) => sum + calculatePersonShare(person.id), 0).toLocaleString('id-ID')
                  : total.toLocaleString('id-ID')
                }</span>
              </div>
            </div>
          </div>

          {/* Actions - Only for Custom Split */}
          {splitOption === 'custom' && (
            <div className="space-y-3 mt-8">
            <button
              type="button"
              onClick={() => {
                handleCompleteSplit();
                router.push('/settlement');
              }}
              className="w-full px-4 py-3 rounded-md font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Final Billing
            </button>
            
            <button
              type="button"
              onClick={() => {
                handleCompleteSplit();
                router.push('/select-user');
              }}
              className="w-full px-4 py-3 border border-border rounded-md font-medium text-foreground hover:bg-accent transition-colors"
            >
              Save Settlement & Add More Bills
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SplitPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <SplitPageContent />
    </Suspense>
  );
}
