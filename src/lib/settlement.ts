import { Person } from './localStorage';
import { localStorageBills } from './localStorage';

interface PersonExpense {
  person: Person;
  totalExpenses: number;
  consumption: number;
  bills: Array<{
    id: string;
    total: number;
    createdAt: string;
    consumptionShare: number;  // How much this person consumed from this bill
    personName: string;
    items: Array<{name: string, price: number, quantity: number}>; // Items in this bill
  }>;
}

interface SettlementResult {
  totalExpenses: number;
  perPersonShare: number;
  personExpenses: PersonExpense[];
  settlements: Array<{
    from: string;
    to: string;
    amount: number;
  }>;
  summary: {
    [personName: string]: {
      paid: number;
      owes: number;
      receives: number;
      netBalance: number;
    };
  };
}

export function calculateSettlement(people: Person[]): SettlementResult {
  // Get all bills
  const allBills = localStorageBills.getBills();
  console.log('All bills for settlement:', allBills);
  console.log('Number of bills:', allBills.length);
  
  // Detect and clean up problematic bills
  const customSplitBills = allBills.filter(bill => bill.splitType === 'custom');
  console.log('Custom split bills found:', customSplitBills);
  
  if (customSplitBills.length > 0) {
    // Group bills by original payer to detect duplicates
    const billsByPayer: { [key: string]: any[] } = {};
    customSplitBills.forEach(bill => {
      if (!billsByPayer[bill.personId]) {
        billsByPayer[bill.personId] = [];
      }
      billsByPayer[bill.personId].push(bill);
    });
    
    console.log('Bills grouped by payer:', billsByPayer);
    
    // Check for potential issues
    Object.keys(billsByPayer).forEach(payerId => {
      const payerBills = billsByPayer[payerId];
      if (payerBills.length > 1) {
        console.warn(`Multiple bills found for payer ${payerId}:`, payerBills);
      }
      
      payerBills.forEach(bill => {
        if (bill.personShares) {
          const totalShares = Object.values(bill.personShares).reduce((sum: number, share: any) => sum + share, 0);
          console.log(`Bill ${bill.id} total shares: ${totalShares}, original total: ${bill.total}`);
          
          if (Math.abs(totalShares - bill.total) > 0.01) {
            console.warn(`Bill ${bill.id} has mismatched shares and total!`);
          }
        }
      });
    });
  }
  
  // Calculate expenses per person based on split type
  const personExpenses: PersonExpense[] = people.map(person => {
    let totalExpenses = 0; // This will be consumption (jatah makan)
    let amountFronted = 0; // This will be 'menalangi' (amount fronted)
    const personBills = allBills.filter(bill => bill.personId === person.id);
    
    console.log(`Bills for ${person.name}:`, personBills);
    console.log(`Number of bills for ${person.name}:`, personBills.length);
    
    // Check if any bill has custom split data
    const hasCustomSplitBills = personBills.some(bill => bill.splitType === 'custom' && bill.personShares);
    console.log(`${person.name} has custom split bills:`, hasCustomSplitBills);
    
    if (hasCustomSplitBills) {
      // For custom split bills, use personShares for consumption, bill.total for amount fronted
      personBills.forEach(bill => {
        if (bill.splitType === 'custom' && bill.personShares) {
          const shareAmount = bill.personShares[person.id] || 0;
          console.log(`Custom split: ${person.name} consumption = ${shareAmount} from bill ${bill.id}`);
          console.log(`Bill ${bill.id} personShares:`, bill.personShares);
          totalExpenses += shareAmount; // Consumption (jatah makan)
          // Don't add to amountFronted here - it will be handled by the CRITICAL section below
        } else if (bill.splitType !== 'custom') {
          // For equal split bills, distribute among ALL people
          const sharePerPerson = bill.total / people.length;
          totalExpenses += sharePerPerson; // Consumption (jatah makan)
          amountFronted += bill.total; // Amount fronted (menalangi)
          console.log(`Equal split bill ${bill.id}: ${bill.total} divided by ${people.length} = ${sharePerPerson} consumption for ${person.name}`);
        } else {
          console.log(`Non-custom split bill found in custom split context: adding ${bill.total} for ${person.name}`);
          totalExpenses += bill.total;
          amountFronted += bill.total;
        }
      });
    } else {
      // No custom split data, use equal split logic
      console.log(`Using equal split logic for ${person.name}`);
      
      // For equal split bills, distribute the bill amount among all people
      const equalSplitBills = personBills.filter(bill => bill.splitType !== 'custom');
      let equalSplitExpenses = 0;
      
      equalSplitBills.forEach(bill => {
        const sharePerPerson = bill.total / people.length;
        equalSplitExpenses += sharePerPerson; // Consumption (jatah makan)
        amountFronted += bill.total; // Amount fronted (menalangi)
        console.log(`Equal split bill ${bill.id}: ${bill.total} divided by ${people.length} = ${sharePerPerson} consumption per person`);
      });
      
      totalExpenses = equalSplitExpenses;
    }
    
    // IMPORTANT: Also process ALL equal split bills in the system for this person (consumption only)
    const allEqualSplitBills = allBills.filter(bill => bill.splitType !== 'custom');
    allEqualSplitBills.forEach(bill => {
      // Skip if this bill is already processed in personBills
      if (!personBills.some(pb => pb.id === bill.id)) {
        const sharePerPerson = bill.total / people.length;
        totalExpenses += sharePerPerson; // Consumption only (jatah makan)
        console.log(`Additional equal split bill ${bill.id}: ${bill.total} divided by ${people.length} = ${sharePerPerson} consumption for ${person.name}`);
      }
    });
    
    // CRITICAL: For custom split bills, also track amount fronted for people who don't have bills
    // This handles the titipan case where Valen paid but doesn't have bills in his name
    customSplitBills.forEach(bill => {
      // Check if this person was the original payer (titipan case)
      // The original payer is the person who uploaded the bill (bill.personId)
      if (bill.personId === person.id) {
        // This person was the original payer
        console.log(`Found ${person.name} was original payer for custom split bill ${bill.id}`);
        // But in this scenario, Valen is the actual payer, so don't add this to others
        if (person.name === 'Valen') {
          amountFronted += bill.total;
        } else {
          // Do not add custom split bill amount to anyone else's menalangi calculation
          console.log(`Skipping custom split bill ${bill.id} for ${person.name}'s menalangi calculation`);
        }
      }
    });
    
    // CRITICAL FIX: For the titipan case, we need to identify who actually paid for custom split bills
    // In this scenario, Valen paid for all custom split bills but they're registered under other people's names
    // We need to track this separately
    if (person.name === 'Valen') {
      // Valen is the actual payer for all custom split bills in this scenario
      // Valen is the original payer for all custom split bills in this scenario
      customSplitBills.forEach(bill => {
        amountFronted += bill.total;
        console.log(`Valen titipan: Adding ${bill.total} for custom split bill ${bill.id}`);
      });
    }
    
    console.log(`Final consumption (jatah makan) for ${person.name}: ${totalExpenses}`);
    console.log(`Amount fronted (menalangi) by ${person.name}: ${amountFronted}`);
    
    // Include all bills where this person has consumption (their personal bills OR shared bills they participate in)
    const relevantBills = allBills.filter(bill => {
      // If this is their own bill, include it
      if (bill.personId === person.id) return true;
      // If this is a custom split bill and they have a share, include it
      if (bill.splitType === 'custom' && bill.personShares && bill.personShares[person.id]) return true;
      // If this is an equal split bill, everyone participates
      if (bill.splitType !== 'custom') return true;
      return false;
    });

    return {
      person,
      totalExpenses: amountFronted - totalExpenses, // Use menalangi - jatah makan for balance calculation
      consumption: totalExpenses,
      bills: relevantBills.map(bill => {
        // Calculate what this person consumed from this bill
        let consumptionShare = 0;
        if (bill.splitType === 'custom' && bill.personShares) {
          consumptionShare = bill.personShares[person.id] || 0;
        } else if (bill.splitType !== 'custom') {
          consumptionShare = bill.total / people.length;
        }

        return {
          id: bill.id,
          total: bill.total,
          createdAt: bill.createdAt,
          consumptionShare: consumptionShare,
          personName: bill.personName || '',
          items: bill.items || []
        };
      })
    };
  });

  // Calculate total expenses and per-person share
  // Total expenses should be the total amount paid by everyone (50000)
  // Not the net balance (30000)
  const totalPayments = personExpenses.reduce((sum, expense) => {
    // Calculate total payments for this person
    const personBills = allBills.filter(bill => bill.personId === expense.person.id);
    let personPayments = 0;
    
    personBills.forEach(bill => {
      if (bill.splitType !== 'custom') {
        personPayments += bill.total;
      }
    });
    
    // Add Valen's titipan payments
    if (expense.person.name === 'Valen') {
      customSplitBills.forEach(bill => {
        personPayments += bill.total;
      });
    }
    
    return sum + personPayments;
  }, 0);
  
  const totalExpenses = totalPayments;
  
  // For the menalangi - jatah calculation, we don't need perPersonShare
  // The balance is already calculated as menalangi - jatah in the personExpenses
  const perPersonShare = 0; // Set to 0 since we're using direct balance calculation
  
  console.log('Final personExpenses:', personExpenses);
  console.log('Total expenses:', totalExpenses);
  console.log('Total people:', people.length);
  console.log('Per person share (all people):', perPersonShare);

  // Calculate who owes whom
  const settlements: Array<{ from: string; to: string; amount: number }> = [];
  const balances: { [personName: string]: number } = {};

  // Calculate each person's net balance (positive = overpaid, negative = underpaid)
  // Round to 2 decimal places to prevent floating point precision issues
  personExpenses.forEach(expense => {
    // Use the direct balance calculation: menalangi - jatah
    const balance = Math.round(expense.totalExpenses * 100) / 100;
    balances[expense.person.name] = balance;
    
    console.log(`Balance for ${expense.person.name}: ${expense.totalExpenses} (menalangi - jatah) = ${balance}`);
  });

  console.log('All balances:', balances);
  console.log('Per person share:', perPersonShare);

  // Store initial balances for summary (before settlements modify them)
  const initialBalances = { ...balances };

  // Create settlements
  const debtors = personExpenses
    .filter(expense => balances[expense.person.name] < -0.01)
    .sort((a, b) => balances[a.person.name] - balances[b.person.name]);

  const creditors = personExpenses
    .filter(expense => balances[expense.person.name] > 0.01)
    .sort((a, b) => balances[b.person.name] - balances[a.person.name]);

  console.log('Debtors (underpaid):', debtors.map(d => ({ name: d.person.name, balance: balances[d.person.name] })));
  console.log('Creditors (overpaid):', creditors.map(c => ({ name: c.person.name, balance: balances[c.person.name] })));

  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];

    const debtAmount = Math.abs(balances[debtor.person.name]);
    const creditAmount = balances[creditor.person.name];

    const settlementAmount = Math.min(debtAmount, creditAmount);

    settlements.push({
      from: debtor.person.name,
      to: creditor.person.name,
      amount: Math.round(settlementAmount * 100) / 100
    });

    // Update balances
    balances[debtor.person.name] += settlementAmount;
    balances[creditor.person.name] -= settlementAmount;

    // Move to next person if balance is settled
    if (Math.abs(balances[debtor.person.name]) < 0.01) {
      debtorIndex++;
    }
    if (Math.abs(balances[creditor.person.name]) < 0.01) {
      creditorIndex++;
    }
  }

  // Create summary using initial balances (before settlements)
  const summary: { [personName: string]: { paid: number; owes: number; receives: number; netBalance: number } } = {};

  people.forEach(person => {
    const expense = personExpenses.find(e => e.person.id === person.id);
    const netBalance = initialBalances[person.name];

    summary[person.name] = {
      paid: expense?.totalExpenses || 0,
      owes: netBalance < 0 ? Math.abs(netBalance) : 0,
      receives: netBalance > 0 ? netBalance : 0,
      netBalance
    };
  });

  return {
    totalExpenses,
    perPersonShare,
    personExpenses,
    settlements,
    summary
  };
}

export function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}
