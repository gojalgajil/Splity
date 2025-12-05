'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { localStoragePeople } from '@/lib/localStorage';
import { localStorageBills } from '@/lib/localStorage';
import { ThemeToggle } from '@/components/theme-toggle';
import { Navbar } from '@/components/navbar';
import { formatCurrency, calculateSettlement } from '@/lib/settlement';

interface Person {
  id: string;
  name: string;
  amount: number;
}

const fmt = (amount: number) => `Rp ${amount.toLocaleString('id-ID')}`;

export default function Home() {
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [recentSettlement, setRecentSettlement] = useState<any>(null);

  useEffect(() => {
    // Load people from localStorage on mount
    const savedPeople = localStoragePeople.getPeople();
    setPeople(savedPeople);

    // Load recent settlement data
    if (savedPeople.length > 0) {
      const settlementData = calculateSettlement(savedPeople);
      setRecentSettlement(settlementData);
    }
  }, []);

  const handleUploadBill = () => {
    // If there's already a recent settlement, clear all bills first
    if (recentSettlement && recentSettlement.totalExpenses > 0) {
      // Clear all bills and payment status
      localStorageBills.clearBills();
      localStorage.removeItem('paymentStatus');

      // Clear recent settlement from state
      setRecentSettlement(null);
    }

    // Navigate to upload flow
    router.push('/select-user');
  };



  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Splity
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Manage complex expenses with ease. Multiple bills, multiple methods.
          </p>
        </div>


        {/* Action Buttons - Top Section */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 sm:justify-center">
          <button
            onClick={handleUploadBill}
            className="flex-1 sm:flex-none py-3 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg text-center shadow-sm transition-colors inline-flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>Upload Bill</span>
          </button>
          <Link
            href="/settlement"
            className="flex-1 sm:flex-none py-3 px-6 border border-border rounded-lg text-foreground hover:bg-accent transition-colors text-center font-medium inline-flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>View Settlement</span>
          </Link>
        </div>



{/* Recent Settlement */}
        {recentSettlement && recentSettlement.totalExpenses > 0 && (
          <div className="bg-card rounded-xl shadow-lg p-6 mb-8 border">
            <h2 className="text-xl font-semibold text-foreground mb-4">Recent Settlement</h2>
            
            {/* Summary */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 mb-4 border border-primary/20">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-foreground mb-2">Total Bill</h3>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(recentSettlement.totalExpenses)}
                </div>
                <p className="text-muted-foreground mt-1">
                  Split between {people.length} people
                </p>
              </div>

              {/* Payment Actions */}
              {recentSettlement.settlements && recentSettlement.settlements.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center mb-2">Payment Actions</h4>
                  {recentSettlement.settlements.slice(0, 3).map((settlement: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-background rounded-lg border border-border">
                      <div className="flex items-center min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center text-sm">
                            <span className="font-medium text-foreground">{settlement.from}</span>
                            <span className="text-muted-foreground mx-2">→</span>
                            <span className="font-medium text-foreground">{settlement.to}</span>
                          </div>
                        </div>
                      </div>
                      <span className="font-medium text-sm whitespace-nowrap">
                        {formatCurrency(settlement.amount)}
                      </span>
                    </div>
                  ))}
                  {recentSettlement.settlements.length > 3 && (
                    <div className="text-center text-xs text-muted-foreground mt-2">
                      +{recentSettlement.settlements.length - 3} more payment actions
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="text-lg font-medium text-foreground mb-2">
                    Split: {formatCurrency(recentSettlement.perPersonShare)} per person
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-4 text-center">
              <Link
                href="/settlement"
                className="text-primary hover:text-primary/80 text-sm font-medium"
              >
                View full settlement details →
              </Link>
            </div>
          </div>
        )}
      </div>


    </div>
  );
}
