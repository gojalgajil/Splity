'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
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
  billId?: string; // Add bill reference for grouping
}

interface ItemAssignment {
  itemId: string;
  personIds: string[];
  isShared: boolean;
}

function FinalizeSplitPageContent() {
  const router = useRouter();
  const [bills, setBills] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<ReceiptItem[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [assignments, setAssignments] = useState<ItemAssignment[]>([]);
  const [splitOption, setSplitOption] = useState<'equal' | 'custom'>('custom'); // Default to custom for multiple bills

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

  // Fetch bills and people on mount
  useEffect(() => {
    const fetchData = () => {
      try {
        const savedBills = localStorageBills.getBills();
        const savedPeople = localStoragePeople.getPeople();

        setBills(savedBills);
        setPeople(savedPeople.map((p: any) => ({ id: p.id, name: p.name, amount: p.amount ?? 0 })));

        // Collect all items from all bills
        let allBillItems: ReceiptItem[] = [];
        let itemIdCounter = 0;

        savedBills.forEach((bill, billIndex) => {
          if (bill.items) {
            bill.items.forEach((item: any) => {
              allBillItems.push({
                id: `item-${billIndex}-${itemIdCounter++}`,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                billId: bill.id
              });
            });
          }
        });

        setAllItems(allBillItems);

        // Initialize assignments for all items
        const initialAssignments: ItemAssignment[] = allBillItems.map((item) => ({
          itemId: item.id,
          personIds: [], // Start with no assignments - users must manually assign items
          isShared: false,
        }));
        setAssignments(initialAssignments);

        console.log('Loaded bills:', savedBills);
        console.log('Loaded people:', savedPeople);
        console.log('All items:', allBillItems);

      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    fetchData();
  }, []);

  // Calculate total from all bills
  const calculateTotal = () => {
    return bills.reduce((sum, bill) => sum + (bill.total || 0), 0);
  };

  const total = calculateTotal();

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
    if (splitOption === 'equal' && people.length > 0) {
      return total / people.length;
    }

    // Custom split logic across all bills
    let share = 0;

    // Calculate share of items across all bills
    assignments.forEach(assignment => {
      if (assignment.personIds.includes(personId)) {
        const item = allItems.find(i => i.id === assignment.itemId);
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

    // For now, distribute tax and service charge proportionally
    // This could be enhanced to assign tax per bill
    const totalItemsValue = allItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const assignedItemsTotal = assignments
      .filter(a => a.personIds.includes(personId))
      .reduce((sum, assignment) => {
        const item = allItems.find(i => i.id === assignment.itemId);
        if (item) {
          const itemTotal = item.price * item.quantity;
          return sum + (assignment.isShared ? itemTotal / assignment.personIds.length : itemTotal);
        }
        return sum;
      }, 0);

    // Add proportional share of all bills' tax and service charge
    if (totalItemsValue > 0) {
      bills.forEach(bill => {
        const billTax = bill.tax || 0;
        const billServiceCharge = bill.serviceCharge || 0;
        share += ((billTax + billServiceCharge) * assignedItemsTotal) / totalItemsValue;
      });
    }

    return share;
  };

  const handleFinalizeSplit = () => {
    try {
      // Calculate person shares for custom split
      const personShares: { [personId: string]: number } = {};

      people.forEach(person => {
        if (splitOption === 'custom') {
          personShares[person.id] = calculatePersonShare(person.id);
        } else {
          personShares[person.id] = total / people.length;
        }
      });

      console.log('Final personShares:', personShares);

      // Create a summary of all bills split
      const splitSummary = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        total,
        bills: bills.length,
        splitType: splitOption,
        people: people.map(person => ({
          id: person.id,
          name: person.name,
          amount: personShares[person.id],
          items: splitOption === 'custom'
            ? allItems
                .filter(item =>
                  assignments.some(
                    a => a.itemId === item.id && a.personIds.includes(person.id)
                  )
                )
                .map(item => ({
                  name: item.name,
                  price: item.price,
                  quantity: item.quantity,
                  fromBill: item.billId
                }))
            : []
        }))
      };

      // Save to localStorage
      const savedSplits = JSON.parse(localStorage.getItem('savedSplits') || '[]');
      savedSplits.push(splitSummary);
      localStorage.setItem('savedSplits', JSON.stringify(savedSplits));

      // Clear bills after successful split
      localStorageBills.clearBills();

      // Navigate to settlement page
      router.push('/settlement');

    } catch (error) {
      console.error('Error finalizing split:', error);
      alert('Failed to finalize split. Please try again.');
    }
  };

  if (people.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-muted-foreground mb-4">No people found</h2>
          <p className="text-muted-foreground mb-6">Please add people first before splitting bills.</p>
          <button
            onClick={() => router.push('/add-people')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Add People
          </button>
        </div>
      </div>
    );
  }

  if (bills.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-muted-foreground mb-4">No bills found</h2>
          <p className="text-muted-foreground mb-6">Please add bills first before splitting.</p>
          <button
            onClick={() => router.push('/add-bill')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Add Bills
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-card rounded-xl shadow-lg p-6 mb-8 border">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">Finalize Split</h1>

          {/* Bills Summary */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">Bills Overview</h2>
            <div className="space-y-3">
              {bills.map((bill, index) => {
                const billOwner = people.find(p => p.id === bill.personId);
                return (
                  <div key={bill.id || index} className="p-4 bg-muted rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">Bill {index + 1}</h3>
                        <p className="text-sm text-muted-foreground">
                          Owner: {billOwner?.name || bill.personName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Items: {bill.items?.length || 0} • Tax: Rp {(bill.tax || 0).toLocaleString('id-ID')} • Service: Rp {(bill.serviceCharge || 0).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">
                          Rp {(bill.total || 0).toLocaleString('id-ID')}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="p-4 bg-accent rounded-lg font-bold">
                <div className="flex justify-between">
                  <span>Total from all bills:</span>
                  <span className="text-xl text-primary">Rp {total.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* People Management */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-foreground">All People</h2>
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

          {/* Items Assignment */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">Assign Items to People</h2>
            <div className="space-y-4">
              {allItems.map((item) => {
                // Find bill info
                const billIndex = bills.findIndex(b => b.id === item.billId);
                const bill = bills[billIndex];
                const owner = people.find(p => p.id === bill?.personId);
                const billNumber = billIndex + 1;

                return (
                  <div key={item.id} className="border border-border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium">{item.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} × Rp {item.price.toLocaleString('id-ID')} = Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          From Bill {billNumber} • Owner: {owner?.name || bill?.personName}
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
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Split Summary</h2>
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
                <span>Rp {total.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3 mt-8">
            <button
              type="button"
              onClick={handleFinalizeSplit}
              className="w-full px-4 py-3 rounded-md font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Complete Split & View Settlement
            </button>

            <button
              type="button"
              onClick={() => router.push('/add-bill')}
              className="w-full px-4 py-3 border border-border rounded-md font-medium text-foreground hover:bg-accent transition-colors"
            >
              Add More Bills
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FinalizeSplitPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <FinalizeSplitPageContent />
    </Suspense>
  );
}
