import { Person } from './localStorage';
import { localStorageBills } from './localStorage';

interface PersonExpense {
  person: Person;
  totalExpenses: number;
  consumption: number;
  amountFronted: number;
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

  // Determine actual payer for custom splits (uploader pays if they don't consume)
  const customBillPayers: Set<string> = new Set();
  customSplitBills.forEach(bill => {
    const uploader = bill.personId;
    const uploaderShare = bill.personShares ? bill.personShares[uploader] || 0 : 0;
    if (uploaderShare === 0) {
      customBillPayers.add(uploader);
    }
  });
  
  // If no such uploader, fall back to first uploader for all
  const actualPayerForCustom = customBillPayers.size > 0 ? customBillPayers.values().next().value : (customSplitBills.length > 0 ? customSplitBills[0].personId : null);
  console.log(`actualPayerForCustom: ${actualPayerForCustom}`);
  
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
  
  // Calculate expenses per person
  const personExpenses: PersonExpense[] = people.map(person => {
    const personBills = allBills.filter(bill => bill.personId === person.id);

    console.log(`Bills for ${person.name}:`, personBills);
    console.log(`Number of bills for ${person.name}:`, personBills.length);

    // Amount fronted: sum of totals for all bills uploaded by this person
    let amountFronted = personBills.reduce((sum, bill) => sum + bill.total, 0);
    console.log(`Amount fronted by ${person.name}: ${amountFronted}`);

    // Consumption: calculate from all bills they participate in
    let consumption = 0;
    allBills.forEach(bill => {
      if (bill.splitType === 'custom' && bill.personShares) {
        // Custom split: use the person's share
        consumption += bill.personShares[person.id] || 0;
        console.log(`Custom bill ${bill.id}: ${person.name} consumption += ${bill.personShares[person.id] || 0}`);
      } else if (bill.splitType !== 'custom') {
        // Equal split: everyone gets equal share
        consumption += bill.total / people.length;
        console.log(`Equal bill ${bill.id}: ${person.name} consumption += ${bill.total / people.length}`);
      }
    });

    console.log(`Total consumption for ${person.name}: ${consumption}`);

    // Balance = amount fronted - consumption
    const balance = amountFronted - consumption;
    console.log(`Balance for ${person.name}: ${amountFronted} - ${consumption} = ${balance}`);

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
      totalExpenses: balance, // Now stores the net balance directly
      consumption: consumption,
      amountFronted: amountFronted,
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

  // Total expenses = sum of all amount fronted by everyone
  const totalExpenses = personExpenses.reduce((sum, expense) => sum + expense.amountFronted, 0);
  
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
    const paidAmount = expense?.amountFronted || 0;

    summary[person.name] = {
      paid: paidAmount,
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
