'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { localStoragePeople } from '@/lib/localStorage';
import { toPng } from 'html-to-image';
import { localStorageBills } from '@/lib/localStorage';
import { calculateSettlement, formatCurrency } from '@/lib/settlement';
import { ThemeToggle } from '@/components/theme-toggle';
import { Navbar } from '@/components/navbar';
import { StatusBadge } from '@/components/status-badge';
import { showNotification, showConfirmDialog } from '@/lib/notifications';

interface Person {
  id: string;
  name: string;
  amount: number;
}

function SettlementPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [people, setPeople] = useState<Person[]>([]);
  const [settlement, setSettlement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [directSettlement, setDirectSettlement] = useState<any>(null);

  const [directBill, setDirectBill] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState<Record<string, 'paid' | 'unpaid'>>({});
  const [showShareImage, setShowShareImage] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification('Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy text: ', err);
      showNotification('Failed to copy to clipboard');
    }
  };

  const handleSharePaymentImage = async (from: string, to: string, amount: number) => {
    if (isGeneratingImage) return;

    setIsGeneratingImage(true);

    try {
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'fixed';
      tempDiv.style.top = '0';
      tempDiv.style.left = '0';
      tempDiv.style.width = '300px';
      tempDiv.style.padding = '24px';
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.color = 'black';
      tempDiv.style.zIndex = '9999';
      tempDiv.style.visibility = 'hidden';
      tempDiv.style.boxSizing = 'border-box';
      tempDiv.style.borderRadius = '12px';
      tempDiv.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
      tempDiv.style.fontFamily = 'Arial, sans-serif';

      const text = `${from} → ${to}\n${formatCurrency(amount)}`;

      tempDiv.innerHTML = `
  <div style="text-align: center; padding: 16px;">
    <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px; white-space: pre-line;">
      ${text.replace(/\n/g, '<br>')}
    </div>
    <div style="
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      color: #9ca3af;
      font-size: 8px;
      text-align: center;
    ">
      <div>Generated on ${new Date().toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}</div>
      <div style="margin-top: 4px">Splity App</div>
    </div>
  </div>
`;

      document.body.appendChild(tempDiv);

      try {
        tempDiv.style.visibility = 'visible';
        await new Promise(resolve => setTimeout(resolve, 100));

        const dataUrl = await toPng(tempDiv, {
          backgroundColor: '#ffffff',
          quality: 1,
          cacheBust: true,
          pixelRatio: 2
        });

        if (navigator.share) {
          try {
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], 'payment.png', { type: 'image/png' });

            await navigator.share({
              files: [file],
              title: 'Payment Details',
              text: `Payment from ${from} to ${to}`,
            });
            return;
          } catch (shareError) {
            console.log('Native sharing failed, falling back to download', shareError);
          }
        }

        const link = document.createElement('a');
        link.download = `payment-${from}-to-${to}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

      } catch (error) {
        console.error('Error generating image:', error);
        alert('Failed to generate image. Please try again.');
      } finally {
        if (document.body.contains(tempDiv)) {
          document.body.removeChild(tempDiv);
        }
      }
    } catch (error) {
      console.error('Error in share as image:', error);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  useEffect(() => {
    const loadData = () => {
      try {
        // Clean up invalid bills first
        const allBills = localStorageBills.getBills();
        const invalidBills = allBills.filter(bill =>
          !bill.items ||
          !Array.isArray(bill.items) ||
          bill.items.length === 0
        );

        if (invalidBills.length > 0) {
          console.log('Found invalid bills, cleaning up:', invalidBills);
          invalidBills.forEach(bill => {
            localStorageBills.deleteBill(bill.id);
          });
        }

        // Check if this is a direct settlement from URL parameters
        const itemsParam = searchParams.get('items');
        const taxParam = searchParams.get('tax');
        const serviceChargeParam = searchParams.get('serviceCharge');
        const userId = searchParams.get('userId');
        const userName = searchParams.get('userName');
        const splitOptionParam = searchParams.get('splitOption');
        const billUniqueIdParam = searchParams.get('billUniqueId');

        if (itemsParam && userId && userName) {
          // Direct settlement from upload/edit/split
          console.log('Processing direct settlement from URL params');

          // Clear old savedSplits to start fresh settlement session
          localStorage.setItem('savedSplits', '[]');
          console.log('DEBUG - Cleared savedSplits for fresh settlement session');

          try {
            const items = JSON.parse(itemsParam);
            const tax = taxParam === 'null' ? null : (taxParam ? parseFloat(taxParam) : null);
            const serviceCharge = serviceChargeParam === 'null' ? null : (serviceChargeParam ? parseFloat(serviceChargeParam) : null);

            // Get all people from localStorage
            const savedPeople = localStoragePeople.getPeople();
            if (savedPeople.length === 0) {
              router.push('/');
              return;
            }

            setPeople(savedPeople);

            // Create a temporary bill structure for display with edit/delete
            const currentUser = savedPeople.find(p => p.id === userId);
            if (currentUser) {
              const tempBill = {
                id: 'temp-bill-' + Date.now(),
                personId: userId,
                personName: userName,
                items: items.map((item: any) => ({
                  id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
                  name: item.name,
                  quantity: item.quantity || 1,
                  price: item.price
                })),
                tax: tax,
                serviceCharge: serviceCharge,
                total: items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) + (tax || 0) + (serviceCharge || 0),
                createdAt: new Date().toISOString(),
                isTemporary: true
              };

              setDirectBill(tempBill);

              // Add to localStorage for settlement calculation (without id and createdAt as they're generated automatically)
              const billForStorage = {
                personId: userId,
                personName: userName,
                items: items.map((item: any) => ({
                  id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
                  name: item.name,
                  quantity: item.quantity || 1,
                  price: item.price
                })),
                tax: tax,
                serviceCharge: serviceCharge,
                total: items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) + (tax || 0) + (serviceCharge || 0)
              };
              localStorageBills.addBill(billForStorage);

              // Calculate settlement
              const settlementData = calculateSettlement(savedPeople);
              setSettlement(settlementData);
            }
          } catch (error) {
            console.error('Error processing direct settlement:', error);
          }
        } else if (searchParams.get('finalizeMode') === 'true') {
          // Process all accumulated bills for final settlement
          console.log('Processing finalize mode - all accumulated bills');

          // DO NOT clear savedSplits - it contains the custom split data from finalize-split page!
          // Just proceed with the existing data
          console.log('DEBUG - Keeping existing savedSplits for final settlement');

          try {
            // Get all people from localStorage
            const savedPeople = localStoragePeople.getPeople();
            if (savedPeople.length === 0) {
              router.push('/');
              return;
            }

            setPeople(savedPeople);

            // Calculate settlement for ALL accumulated bills
            const settlementData = calculateSettlement(savedPeople);
            setSettlement(settlementData);

            console.log('DEBUG - Final settlement calculated for all bills');
          } catch (error) {
            console.error('Error processing final settlement:', error);
          }
        } else if (splitOptionParam === 'equal' && billUniqueIdParam) {
          // Handle equal split navigation directly to settlement
          console.log('Processing equal split settlement from URL params');

          // Clear old savedSplits to start fresh settlement session
          localStorage.setItem('savedSplits', '[]');
          console.log('DEBUG - Cleared savedSplits for fresh equal settlement session');

          try {
            // Get all people from localStorage
            const savedPeople = localStoragePeople.getPeople();
            if (savedPeople.length === 0) {
              router.push('/');
              return;
            }

            setPeople(savedPeople);

            // For equal split, we don't have bill data from URL, but we can get from localStorage bills
            // Find the bill with the matching billUniqueId
            const allBills = localStorageBills.getBills();
            const matchingBill = allBills.find((bill: any) => bill.id === billUniqueIdParam);

            if (matchingBill) {
              console.log('DEBUG - Found matching bill for equal settlement:', matchingBill);

              const billTotalAmount = matchingBill.total;

              // Create equal split summary for savedSplits
              const billEqualSplitSummary = {
                id: Date.now().toString(),
                date: new Date().toISOString(),
                total: billTotalAmount,
                tax: matchingBill.tax || 0,
                serviceCharge: matchingBill.serviceCharge || 0,
                splitType: 'equal',
                billUniqueId: billUniqueIdParam,
                people: savedPeople.map((person: any) => ({
                  id: person.id,
                  name: person.name,
                  amount: billTotalAmount / savedPeople.length,
                  items: [] // Equal split - no specific item assignments
                })),
                createdBy: {
                  id: matchingBill.personId,
                  name: matchingBill.personName
                }
              };

              const billSavedSplits = JSON.parse(localStorage.getItem('savedSplits') || '[]');
              // CHECK: Don't add duplicate equal split entries
              const billExistingEqualBill = billSavedSplits.find((split: any) =>
                split.splitType === 'equal' && split.billUniqueId === billUniqueIdParam
              );
              if (!billExistingEqualBill) {
                billSavedSplits.push(billEqualSplitSummary);
                localStorage.setItem('savedSplits', JSON.stringify(billSavedSplits));
                console.log('DEBUG - Saved equal split summary');
              } else {
                console.log('DEBUG - Equal split summary already exists, skipping save');
              }

              // Calculate settlement
              const currentSettlementData = calculateSettlement(savedPeople);
              setSettlement(currentSettlementData);

          } else {
            console.error('Bill not found for billUniqueId:', billUniqueIdParam);

            // DEBUG: List all bills to find the mismatch
            console.log('DEBUG - All bills in localStorage:');
            allBills.forEach((bill: any) => {
              console.log('  - Bill ID:', bill.id, 'Person:', bill.personName);
            });

            console.log('DEBUG - Searched billUniqueId:', billUniqueIdParam);

            // Try fuzzy matching as fallback
            let foundFallback = false;
            for (const bill of allBills) {
              // Check if bill ID contains parts of searched ID
              const billParts = bill.id.split('-');
              const searchParts = billUniqueIdParam.split('-');

              const hasMatchingPersonId = billParts.some((part: string) =>
                searchParts.some((searchPart: string) => searchPart.includes(part) || part.includes(searchPart))
              );

              if (hasMatchingPersonId && !foundFallback) {
                console.log('DEBUG - Found fuzzy match, using bill:', bill.id);

                const fallbackTotal = bill.total;

                // Create equal split summary for savedSplits
                const fallbackEqualSplitSummary = {
                  id: Date.now().toString(),
                  date: new Date().toISOString(),
                  total: fallbackTotal,
                  tax: bill.tax || 0,
                  serviceCharge: bill.serviceCharge || 0,
                  splitType: 'equal',
                  billUniqueId: bill.id, // Use found bill ID
                  people: savedPeople.map((person: any) => ({
                    id: person.id,
                    name: person.name,
                    amount: fallbackTotal / savedPeople.length,
                    items: [] // Equal split - no specific item assignments
                  })),
                  createdBy: {
                    id: bill.personId,
                    name: bill.personName
                  }
                };

                const fallbackSavedSplits = JSON.parse(localStorage.getItem('savedSplits') || '[]');
                // CHECK: Don't add duplicate equal split entries
                const fallbackExistingEqualBill = fallbackSavedSplits.find((split: any) =>
                  split.splitType === 'equal' && split.billUniqueId === bill.id
                );
                if (!fallbackExistingEqualBill) {
                  fallbackSavedSplits.push(fallbackEqualSplitSummary);
                  localStorage.setItem('savedSplits', JSON.stringify(fallbackSavedSplits));
                  console.log('DEBUG - Saved fallback equal split summary');

                  // Calculate settlement with fallback bill
                  const fallbackSettlementData = calculateSettlement(savedPeople);
                  setSettlement(fallbackSettlementData);
                  foundFallback = true; // Set flag and exit loop
                  break;
                }
              }
            }

            // If no fallback found, show error message
            if (!foundFallback) {
              alert(`Bill not found for: ${billUniqueIdParam}\n\nThis might be due to a timing issue. Please try clicking "Equal Split" again.`);
            }
          }
          } catch (error) {
            console.error('Error processing equal split settlement:', error);
          }
        } else {
          // Regular settlement from localStorage
          const savedPeople = localStoragePeople.getPeople();
          if (savedPeople.length === 0) {
            router.push('/');
            return;
          }

        setPeople(savedPeople);
        // Clear savedSplits if there are no bills to prevent showing stale data
        if (allBills.length === 0) {
          console.log('DEBUG - Clearing savedSplits since no bills exist');
          localStorage.setItem('savedSplits', '[]');
        }
        const settlementData = calculateSettlement(savedPeople);
        setSettlement(settlementData);
        }
      } catch (error) {
        console.error('Error loading settlement data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    // Initialize payment status from localStorage if available
    const savedStatus = localStorage.getItem('paymentStatus');
    if (savedStatus) {
      try {
        const parsed = JSON.parse(savedStatus) as Record<string, 'paid' | 'unpaid'>;
        setPaymentStatus(parsed);
      } catch (e) {
        console.error('Error parsing payment status:', e);
      }
    }
  }, [searchParams]);

  const togglePaymentStatus = (from: string, to: string) => {
    const key = `${from}_${to}`;
    const newStatus = {
      ...paymentStatus,
      [key]: paymentStatus[key] === 'paid' ? 'unpaid' : 'paid'
    } as Record<string, 'paid' | 'unpaid'>;
    setPaymentStatus(newStatus);
    // Save to localStorage
    localStorage.setItem('paymentStatus', JSON.stringify(newStatus));
  };

  const handleClearAllBills = async () => {
    const confirmed = await showConfirmDialog('Are you sure you want to clear all bills? This will keep your people list but remove all bill data.');
    if (confirmed) {
      // Clear all bills
      localStorageBills.clearBills();
      // Clear savedSplits data too (FIX: prevents stale consumption data from showing)
      localStorage.setItem('savedSplits', '[]');
      // Clear payment status
      localStorage.removeItem('paymentStatus');
      // Show success notification
      showNotification('All bills cleared successfully!');
      // Keep people data and navigate to home
      router.push('/');
    }
  };

  const handleAddMoreBills = () => {
    router.push('/add-bill');
  };

  const deleteBill = async (billId: string) => {
    const confirmed = await showConfirmDialog('Are you sure you want to delete this bill?');
    if (confirmed) {
      localStorageBills.deleteBill(billId);

      // If this was a direct bill, clear it and redirect
      if (directBill && directBill.id === billId) {
        setDirectBill(null);
        router.push('/');
        return;
      }

      // Reload settlement data
      const savedPeople = localStoragePeople.getPeople();
      setPeople(savedPeople);
      const settlementData = calculateSettlement(savedPeople);
      setSettlement(settlementData);

      showNotification('Bill deleted successfully!');
    }
  };

  const editBill = (bill: any) => {
    // Check if bill has items, if not, return early
    if (!bill.items || !Array.isArray(bill.items) || bill.items.length === 0) {
      console.error('Bill has no items:', bill);
      alert('This bill cannot be edited because it has no items. You may need to delete it and create a new one.');
      return;
    }

    // Navigate to edit page with bill data
    const params = new URLSearchParams();
    params.set('items', JSON.stringify(bill.items.map((item: any) => ({
      ...item,
      id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9)
    }))));
    params.set('tax', bill.tax?.toString() || 'null');
    params.set('serviceCharge', bill.serviceCharge?.toString() || 'null');
    params.set('billId', bill.id);

    // Include custom split data if present
    if (bill.splitType === 'custom' && bill.personShares) {
      params.set('splitType', 'custom');
      params.set('personShares', JSON.stringify(bill.personShares));
    }

    router.push(`/edit?${params.toString()}`);
  };

  const getShareText = () => {
    if (!settlement) return '';

    let text = `Total Bill\n`;
    text += `${formatCurrency(settlement.totalExpenses)}\n`;
    text += `Split between ${people.length} people\n`;

    if (settlement.settlements.length > 0) {
      text += 'Payment Actions:\n\n';
      settlement.settlements.forEach((s: any) => {
        text += `${s.from}→${s.to}\n`;
        text += `${formatCurrency(s.amount)}\n\n`;
      });
    }

    return text;
  };

  const handleShare = async () => {
    const shareText = getShareText();
    if (!shareText) return;

    // Try copy to clipboard first on all devices
    try {
      await navigator.clipboard.writeText(shareText);
      showNotification('Settlement details copied to clipboard!');
      return;
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      showNotification('Failed to copy to clipboard');
    }

    // Fallback: try Web Share API
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Bill Settlement',
          text: shareText,
          url: ''
        });
        return;
      } catch (err) {
        console.log('Web Share API error:', err);
      }
    }

    // Final fallback: Open mailto
    const subject = 'Bill Settlement Details';
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareText)}`);
  };

  const handleShareAsImage = async () => {
    if (isGeneratingImage || !settlement) return;

    setIsGeneratingImage(true);
    setShowShareImage(true);

    // Small delay to ensure the image is rendered before capture
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      if (!imageRef.current) throw new Error('Image element not found');

      const dataUrl = await toPng(imageRef.current, {
        backgroundColor: '#ffffff',
        quality: 1,
        cacheBust: true,
      });

      // Create download link
      const link = document.createElement('a');
      link.download = `bill-settlement-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;

      // Try to share on mobile first
      if (navigator.share) {
        try {
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          const file = new File([blob], 'bill-settlement.png', { type: 'image/png' });

          await navigator.share({
            files: [file],
            title: 'Bill Settlement',
            text: 'Check out this bill settlement',
          });
          return;
        } catch (shareError) {
          console.log('Native sharing failed, falling back to download', shareError);
        }
      }

      // Fallback to download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error('Error generating image:', error);
      alert('Failed to generate image. Please try again.');
    } finally {
      setIsGeneratingImage(false);
      setShowShareImage(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!settlement) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No settlement data available</p>
          <button
            onClick={() => router.push('/add-bill')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Start Adding Bills
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-card rounded-xl shadow-lg p-6 mb-8 border">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-3xl font-bold text-foreground">Bill Settlement</h1>
            <div className="flex space-x-2">
              <button
                onClick={handleShare}
                className="p-2 rounded-full hover:bg-accent/50 transition-colors"
                title="Copy to clipboard"
                aria-label="Copy settlement details to clipboard"
                disabled={isGeneratingImage}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy-icon lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2 ry" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
              <button
                onClick={handleShareAsImage}
                className="p-2 rounded-full hover:bg-accent/50 transition-colors"
                title="Share as Image"
                aria-label="Share settlement as image"
                disabled={isGeneratingImage}
              >
                {isGeneratingImage ? (
                  <div className="w-6 h-6 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link-icon lucide-external-link"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                )}
              </button>
            </div>
          </div>
          <p className="text-muted-foreground mb-6">
            Here's who needs to pay whom:
          </p>

          {/* Quick Summary */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 border border-primary/20">
              <div className="text-center mb-6">
                <h2 className="text-lg font-semibold text-foreground mb-2">Total Bill</h2>
                <div className="text-3xl font-bold text-primary">
                  {formatCurrency(settlement.totalExpenses)}
                </div>
                <p className="text-muted-foreground mt-1">
                  Split between {people.length} people
                </p>
              </div>

              {/* Payment Actions */}
              {settlement.settlements.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground text-center mb-3">Payment Actions:</h3>
                  {settlement.settlements.map((settlement: any, index: number) => (
                    <div key={index} className="p-4 bg-background rounded-lg border border-border hover:bg-accent/10 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => togglePaymentStatus(settlement.from, settlement.to)}
                            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-accent/20 transition-colors"
                            aria-label={`Mark payment from ${settlement.from} to ${settlement.to} as ${paymentStatus[`${settlement.from}_${settlement.to}`] === 'paid' ? 'unpaid' : 'paid'}`}
                          >
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              paymentStatus[`${settlement.from}_${settlement.to}`] === 'paid'
                                ? 'bg-green-500 border-green-500'
                                : 'border-muted-foreground/50'}`}
                            >
                              {paymentStatus[`${settlement.from}_${settlement.to}`] === 'paid' && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-foreground truncate">{settlement.from}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className="font-medium text-foreground truncate">{settlement.to}</span>
                            </div>
                            <div className="mt-1">
                              <StatusBadge
                                status={paymentStatus[`${settlement.from}_${settlement.to}`] || 'unpaid'}
                                className="text-xs"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end">
                          <span className="font-bold text-foreground text-sm sm:text-lg ml-11 sm:ml-0">
                            {formatCurrency(settlement.amount)}
                          </span>
                          <div className="flex space-x-2 ml-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(`${settlement.from} → ${settlement.to}\n${formatCurrency(settlement.amount)}`);
                              }}
                              className="p-1 rounded-full hover:bg-accent/30 transition-colors"
                              title="Copy payment details"
                              aria-label="Copy payment details"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSharePaymentImage(settlement.from, settlement.to, settlement.amount);
                              }}
                              className="p-1 rounded-full hover:bg-accent/30 transition-colors"
                              title="Share as image"
                              aria-label="Share payment as image"
                              disabled={isGeneratingImage}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                                <path d="M15 3h6v6"/>
                                <path d="M10 14 21 3"/>
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-lg font-medium text-foreground mb-2">
                    Split: {formatCurrency(settlement.perPersonShare)} per person
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Toggle Details Button */}
          <div className="text-center mb-6">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-6 py-2 bg-muted hover:bg-accent rounded-lg transition-colors font-medium text-foreground"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>

          {/* Detailed Breakdown - Only show when expanded */}
          {showDetails && (
            <div className="space-y-8 border-t pt-8">
              {/* People List */}
              {/* <div>
                <h2 className="text-xl font-semibold text-foreground mb-4">Participants:</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {people.map((person) => (
                    <div key={person.id} className="border border-border rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                          <span className="text-muted-foreground font-medium">
                            {person.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">{person.name}</h3>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div> */}

              {/* Direct Bill (if any) */}
              {directBill && (
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-4">Current Bill</h2>
                  <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-primary font-medium text-sm">
                          {directBill.personName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{directBill.personName}</span>
                        <p className="text-xs text-muted-foreground">
                          {new Date(directBill.createdAt).toLocaleDateString('id-ID')} • {directBill.items.length} items
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <p className="font-semibold text-foreground">{formatCurrency(directBill.total)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Consumption Summary per Person */}
              <div>
                {(() => {
                  console.log('DEBUG - Starting consumption summary, personExpenses length:', settlement.personExpenses.length);
                  console.log('DEBUG - Settlement object:', settlement);
                  return null;
                })()}
                <h2 className="text-xl font-semibold text-foreground mb-4">Individual Consumption Summary</h2>
                <p className="text-muted-foreground mb-4">Shows what each person consumed</p>

                <div className="space-y-4">
                  {(() => {
                    // Read savedSplits data directly
                    const savedSplits = JSON.parse(localStorage.getItem('savedSplits') || '[]');

                    return settlement.personExpenses.map((expense: any) => {
                      // Get person's consumption from split data directly - NO BILL-BY-BILL ITERATION
                      let personItems: string[] = [];
                      let totalEqualSharing = 0;
                      let hasCustomItems = false;

                      // Find ALL splits where this person participated
                      const personSplits = savedSplits.filter((split: any) => {
                        // Match by person's participation in split
                        const personInSplit = split.people?.some((p: any) => p.id === expense.person.id);
                        const creatorMatch = split.createdBy?.id === expense.person.id;

                        return personInSplit || creatorMatch;
                      });

                      // Calculate total custom costs from split data
                      let totalCustomCosts = 0;

                      console.log('DEBUG - Processing personSplits for', expense.person.name, '- splits:', personSplits.length);
                      console.log('DEBUG - expense.person.id to find:', expense.person.id);

                      // Aggregate from ALL splits for this person
                      personSplits.forEach((split: any) => {
                        console.log('DEBUG - Split.people IDs:', split.people?.map((p: any) => p.id));
                        console.log('DEBUG - Split type:', split.splitType);

                        const personInSplit = split.people?.find((p: any) => {
                          console.log('DEBUG - Comparing p.id:', p.id, 'with expense.person.id:', expense.person.id);
                          return p.id === expense.person.id;
                        });

                        console.log('DEBUG - personInSplit found:', !!personInSplit);

                        if (personInSplit) {

                          if (split.splitType === 'custom') {
                            // Custom split: get specific items this person was assigned
                            if (personInSplit.items && personInSplit.items.length > 0) {
                              hasCustomItems = true;

                              // First, create a map of item counts (how many people have each item)
                              const itemCounts: {[key: string]: number} = {};

                              // Iterate through all people in the split to count item usage
                              split.people.forEach((p: any) => {
                                if (p.items && p.items.length > 0) {
                                  p.items.forEach((item: any) => {
                                    const key = `${item.name}_${item.price}`;
                                    if (!itemCounts[key]) {
                                      itemCounts[key] = 0;
                                    }
                                    itemCounts[key]++;
                                  });
                                }
                              });

                        personInSplit.items.forEach((item: any) => {
                          console.log('DEBUG - Processing item:', item);
                          const key = `${item.name}_${item.price}`;
                          const count = itemCounts[key] || 1;
                          const splitPrice = item.price / count;

                          const itemDesc = `${item.name} ${formatCurrency(splitPrice)}`;
                          console.log('DEBUG - Generated itemDesc:', itemDesc);
                          console.log('DEBUG - personItems before check:', personItems);

                          if (!personItems.includes(itemDesc)) {
                            personItems.push(itemDesc);
                            console.log('DEBUG - Added custom item to personItems:', itemDesc);
                            console.log('DEBUG - personItems after add:', personItems);
                            // Track the amount for this item
                            totalCustomCosts += splitPrice;
                            console.log('DEBUG - totalCustomCosts updated to:', totalCustomCosts);
                          } else {
                            console.log('DEBUG - Item already in personItems, skipped:', itemDesc);
                          }
                        });
                            } else {
                              // Custom split but no item assignments - count as equal sharing
                              totalEqualSharing += personInSplit.amount;
                              console.log('DEBUG - Custom split but no items, added to equal sharing:', personInSplit.amount);
                            }
                          } else {
                            // Equal split: all persons share equally
                            totalEqualSharing += personInSplit.amount;
                            console.log('DEBUG - Equal split added:', personInSplit.amount);
                          }
                        } else {
                          console.log('DEBUG - Person not found in split data');
                        }
                      });

                      // DEBUG: Full calculation breakdown - FINAL FIX HERE
                      console.log('=== DEBUG SHARING CALCULATION FOR', expense.person.name, '===');
                      console.log('expense.consumption:', expense.consumption);
                      console.log('totalCustomCosts:', totalCustomCosts);

                      console.log('savedSplits length from outer scope:', savedSplits.length);

                      const customBillTotal = savedSplits
                        .filter((split: any) => split.splitType === 'custom')
                        .reduce((sum: number, split: any) => sum + (split.total || 0), 0);
                      console.log('customBillTotal from savedSplits:', customBillTotal);

                      const totalEqualExpenses = settlement.totalExpenses - customBillTotal;
                      console.log('settlement.totalExpenses:', settlement.totalExpenses);
                      console.log('totalEqualExpenses:', totalEqualExpenses);

                      const equalSharingPerPerson = totalEqualExpenses / people.length;
                      console.log('people.length:', people.length);
                      console.log('equalSharingPerPerson:', equalSharingPerPerson);

                      const condition = totalCustomCosts < expense.consumption;
                      console.log('condition (totalCustomCosts < expense.consumption):', condition);
                      console.log('final totalEqualSharing:', condition ? equalSharingPerPerson : 0);

                      // FIXED: Calculate equal sharing directly from settlement data
                      // Total equal sharing = (total expenses - custom bill amount) / people count
                      totalEqualSharing = condition ? equalSharingPerPerson : 0;

                      console.log('DEBUG - Final consumption for', expense.person.name, ':');
                      console.log('  - Custom items:', personItems);
                      console.log('  - Equal sharing:', totalEqualSharing);
                      console.log('  - Has custom items:', hasCustomItems);

                      // Format the consumption description
                      let consumptionDescription: string;

                      if (personItems.length > 0) {
                        // Has specific items - show item consumption
                        consumptionDescription = `paid for ${personItems.join(', ')}`;
                        // If also has equal sharing, append it
                        if (totalEqualSharing > 0) {
                          consumptionDescription += `, sharing ${formatCurrency(totalEqualSharing)}`;
                        }
                      } else if (totalEqualSharing > 0) {
                        // No specific items - show equal sharing
                        consumptionDescription = `sharing ${formatCurrency(totalEqualSharing)}`;
                      } else if (expense.consumption > 0) {
                        // No custom items but has consumption = equal sharing
                        consumptionDescription = `sharing ${formatCurrency(expense.consumption)}`;
                      } else {
                        consumptionDescription = 'consumed nothing';
                      }

                      console.log('DEBUG - Final consumption description:', consumptionDescription);

                      return (
                        <div key={expense.person.id} className="p-4 bg-muted/50 rounded-lg">
                          <div className="text-sm text-muted-foreground">
                            <span className="font-semibold text-foreground">{expense.person.name}</span>: {consumptionDescription}
                          </div>
                        </div>
                      );
                    });
                  })()}
                  {/* <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg mt-4">
                    <span className="font-semibold text-foreground">Total =</span>
                    <span className="font-bold text-lg text-primary">
                      {formatCurrency(settlement.totalExpenses)}
                    </span>
                  </div> */}
                </div>
              </div>

              {/* Per Person Share
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  2. Split per Person
                </h2>
                <div className="p-4 bg-primary/10 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary mb-2">
                      {formatCurrency(settlement.totalExpenses)} ÷ {people.length}
                    </div>
                    <div className="text-xl font-bold text-primary">
                      = {formatCurrency(settlement.perPersonShare)} / person
                    </div>
                  </div>
                </div>
              </div> */}

              {/* Individual Balances - Commented out by user request */}

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-4">
                Payment Settlement
                </h2>
                <p className="text-muted-foreground mb-4">Initial Payments:</p>
                <div className="space-y-3">
                  {Object.entries(settlement.summary).map(([name, data]: [string, any]) => (
                    <div key={name} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0 p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                          <span className="text-muted-foreground font-medium text-sm">
                            {name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-foreground">{name}:</span>
                      </div>
                      <div className="text-sm sm:text-base text-right">
                        <span className="font-medium">{formatCurrency(data.paid)}</span>
                        {data.netBalance < 0 && (
                          <span className="text-destructive ml-2">
                            → underpaid {formatCurrency(Math.abs(data.netBalance))}
                          </span>
                        )}
                        {data.netBalance > 0 && (
                          <span className="text-green-600 ml-2">
                            → overpaid {formatCurrency(data.netBalance)}
                          </span>
                        )}
                        {data.netBalance === 0 && (
                          <span className="text-green-600 ml-2">
                            → all settled
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4 mt-8">
            <button
              onClick={handleAddMoreBills}
              className="w-full sm:w-auto px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Add More Bills
            </button>
            <button
              onClick={handleClearAllBills}
              className="w-full sm:w-auto px-6 py-3 border border-border rounded-lg text-foreground hover:bg-accent transition-colors"
            >
              Clear All & Start Over
            </button>
          </div>
        </div>
      </div>

      {/* Hidden element for image generation */}
      <div style={{ position: 'fixed', left: '-9999px', visibility: showShareImage ? 'visible' : 'hidden' }}>
        <div
          ref={imageRef}
          style={{
            width: '400px',
            padding: '32px',
            backgroundColor: 'white',
            color: 'black',
            fontFamily: 'Arial, sans-serif',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '12px', color: '#1f2937' }}>Total Bill</h1>
            <p style={{ fontSize: '32px', color: '#2563eb', fontWeight: 'bold', marginBottom: '8px' }}>
              {formatCurrency(settlement?.totalExpenses || 0)}
            </p>
            <p style={{ color: '#4b5563', fontSize: '14px' }}>Split between {people.length} people</p>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              marginBottom: '16px',
              color: '#1f2937',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '8px'
            }}>
              Payment Actions
            </h2>

            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {settlement?.settlements.map((s: any, index: number) => (
                <div key={index} style={{ 
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: index % 2 === 0 ? '#f9fafb' : 'white',
                  borderRadius: '8px'
                }}>
                  <p style={{ 
                    fontSize: '16px', 
                    marginBottom: '4px',
                    fontWeight: '500',
                    color: '#1f2937'
                  }}>
                    {s.from} → {s.to}
                  </p>
                  <p style={{ 
                    color: '#059669', 
                    fontWeight: '600',
                    fontSize: '16px'
                  }}>
                    {formatCurrency(s.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ 
            marginTop: '24px', 
            paddingTop: '16px', 
            borderTop: '1px solid #e5e7eb', 
            color: '#9ca3af', 
            fontSize: '12px', 
            textAlign: 'center' 
          }}>
            <div>Generated on {new Date().toLocaleDateString('id-ID', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</div>
            <div style={{ marginTop: '4px' }}>Splity App</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettlementPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SettlementPageContent />
    </Suspense>
  );
}
