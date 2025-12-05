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
      const notification = document.createElement('div');
      notification.textContent = 'Copied to clipboard!';
      notification.style.position = 'fixed';
      notification.style.bottom = '20px';
      notification.style.left = '50%';
      notification.style.transform = 'translateX(-50%)';
      notification.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      notification.style.color = 'white';
      notification.style.padding = '8px 16px';
      notification.style.borderRadius = '4px';
      notification.style.zIndex = '1000';
      document.body.appendChild(notification);
      setTimeout(() => document.body.removeChild(notification), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
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
        
        if (itemsParam && userId && userName) {
          // Direct settlement from upload/edit/split
          console.log('Processing direct settlement from URL params');
          
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
        } else {
          // Regular settlement from localStorage
          const savedPeople = localStoragePeople.getPeople();
          if (savedPeople.length === 0) {
            router.push('/');
            return;
          }
          
          setPeople(savedPeople);
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

  const handleClearAllBills = () => {
    if (confirm('Are you sure you want to clear all bills? This will keep your people list but remove all bill data.')) {
      // Clear all bills
      localStorageBills.clearBills();
      // Clear payment status
      localStorage.removeItem('paymentStatus');
      // Keep people data and reload the page
      router.push('/select-user');
    }
  };

  const handleAddMoreBills = () => {
    router.push('/select-user');
  };

  const deleteBill = (billId: string) => {
    if (confirm('Are you sure you want to delete this bill?')) {
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
      alert('Settlement details copied to clipboard!');
      return;
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
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
            onClick={() => router.push('/select-user')}
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
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy-icon lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
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
              <div>
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
              </div>

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
                <h2 className="text-xl font-semibold text-foreground mb-4">1. Consumption Summary per Person</h2>
                <p className="text-muted-foreground mb-4">Shows what each person consumed</p>
                <div className="space-y-4">
                  {settlement.personExpenses.map((expense: any) => {
                    // Create combined description with items and amounts
                    const consumptionParts = [];
                    let totalConsumed = 0;

                    expense.bills.forEach((bill: any) => {
                      totalConsumed += bill.consumptionShare;

                      // Combine item description with amount
                      // Show actual item names only for bills uploaded by this person
                      // For shared/custom-split bills that this person participates in, show "shared bill"
                      if (bill.splitType === 'custom' && bill.personShares) {
                        // Custom split bill - only show item names if this person created/uploaded the bill
                        if (bill.personName === expense.person.name) {
                          // This person is the original uploader - show item names only if few items
                          if (bill.items && bill.items.length <= 2 && bill.items.length > 0) {
                            const itemNames = bill.items.map((item: any) => item.name).join(', ');
                            consumptionParts.push(`paid for ${itemNames} ${formatCurrency(bill.consumptionShare)}`);
                          } else {
                            consumptionParts.push(`paid for bill ${formatCurrency(bill.consumptionShare)}`);
                          }
                        } else {
                          // This person is participating in someone else's custom split bill
                          consumptionParts.push(`shared bill ${formatCurrency(bill.consumptionShare)}`);
                        }
                      } else if (bill.splitType !== 'custom') {
                        // Equal split bill - show item names if this person uploaded it and has few items
                        if (bill.personName === expense.person.name) {
                          if (bill.items && bill.items.length <= 2 && bill.items.length > 0) {
                            const itemNames = bill.items.map((item: any) => item.name).join(', ');
                            consumptionParts.push(`paid for ${itemNames} ${formatCurrency(bill.consumptionShare)}`);
                          } else {
                            consumptionParts.push(`paid for bill ${formatCurrency(bill.consumptionShare)}`);
                          }
                        } else {
                          // This is someone else's equal split bill
                          consumptionParts.push(`shared bill ${formatCurrency(bill.consumptionShare)}`);
                        }
                      }
                    });

                    // Calculate additional consumption from shared bills (if any)
                    const additionalConsumption = expense.consumption - totalConsumed;
                    if (additionalConsumption > 0) {
                      consumptionParts.push(`shared bills ${formatCurrency(additionalConsumption)}`);
                    }

                    // Create combined descriptive text
                    const descriptiveText = expense.consumption > 0
                      ? `${expense.person.name} ${consumptionParts.join(' + ')}`
                      : `${expense.person.name} consumed nothing`;

                    return (
                      <div key={expense.person.id} className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className="text-primary font-medium text-sm">
                                {expense.person.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="font-medium text-foreground">{expense.person.name}:</span>
                          </div>
                          <div className="text-right">
                            {expense.consumption > 0 ? (
                              <div>
                                {expense.bills.map((bill: any, index: number) => (
                                  <div key={bill.id} className="flex items-center justify-between group">
                                    <div className="text-sm text-muted-foreground flex items-center">
                                      {formatCurrency(bill.consumptionShare)}
                                      {index < expense.bills.length - 1 && ' + '}
                                    </div>
                                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => editBill(bill)}
                                        className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                                        title="Edit bill"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => deleteBill(bill.id)}
                                        className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                                        title="Delete bill"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                {/* Also include consumption from shared equal-split bills that this person didn't create */}
                                {(() => {
                                  // Calculate additional consumption from equal-split bills not associated with this person
                                  const allBills = []; // We can't access all bills here, so we'll calculate based on the consumption field
                                  const additionalConsumption = expense.consumption - expense.bills.reduce((sum: number, bill: any) => sum + bill.consumptionShare, 0);

                                  if (additionalConsumption > 0) {
                                    return (
                                      <div className="flex items-center justify-between group">
                                        <div className="text-sm text-muted-foreground flex items-center">
                                          + {formatCurrency(additionalConsumption)} (shared bills)
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                                <div className="font-semibold text-foreground">
                                  = {formatCurrency(expense.consumption)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">0 (didn't spend any money)</span>
                            )}
                          </div>
                        </div>
                        {/* Add descriptive text */}
                        <div className="text-xs text-muted-foreground mt-2 italic">
                          {descriptiveText}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg mt-4">
                    <span className="font-semibold text-foreground">Total =</span>
                    <span className="font-bold text-lg text-primary">
                      {formatCurrency(settlement.totalExpenses)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Per Person Share */}
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
              </div>

              {/* Individual Balances */}
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  3. Calculation of who should pay or receive
                </h2>
                <p className="text-muted-foreground mb-4">Already paid:</p>
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
                            → uderpaid {formatCurrency(Math.abs(data.netBalance))}
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
