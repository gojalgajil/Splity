// Local Storage utilities for Split Bill App

const STORAGE_KEYS = {
  PEOPLE: 'split-bill-people',
  BILLS: 'split-bill-bills',
} as const;

export interface Person {
  id: string;
  name: string;
  amount: number;
}

export interface Bill {
  id: string;
  personId: string;
  personName: string;
  items: BillItem[];
  tax: number | null;
  serviceCharge: number | null;
  total: number;
  createdAt: string;
  splitType?: 'equal' | 'custom' | 'both';
  personShares?: { [personId: string]: number };
}

export interface BillItem {
  name: string;
  quantity: number;
  price: number;
}

// People management
export const localStoragePeople = {
  // Get all people from localStorage
  getPeople(): Person[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PEOPLE);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Error loading people from localStorage:', error);
      return [];
    }
  },

  // Save people to localStorage
  savePeople(people: Person[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(people));
    } catch (error) {
      console.error('Error saving people to localStorage:', error);
    }
  },

  // Add a new person
  addPerson(name: string): Person[] {
    const people = this.getPeople();
    const newPerson: Person = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      amount: 0,
    };
    
    const updatedPeople = [...people, newPerson];
    this.savePeople(updatedPeople);
    return updatedPeople;
  },

  // Update a person
  updatePerson(id: string, updates: Partial<Person>): Person[] {
    const people = this.getPeople();
    const updatedPeople = people.map(person =>
      person.id === id ? { ...person, ...updates } : person
    );
    this.savePeople(updatedPeople);
    return updatedPeople;
  },

  // Delete a person
  deletePerson(id: string): Person[] {
    const people = this.getPeople();
    const updatedPeople = people.filter(person => person.id !== id);
    this.savePeople(updatedPeople);
    return updatedPeople;
  },

  // Clear all people
  clearPeople(): void {
    localStorage.removeItem(STORAGE_KEYS.PEOPLE);
  },
};

// Bills management
export const localStorageBills = {
  // Get all bills from localStorage
  getBills(): Bill[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BILLS);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Error loading bills from localStorage:', error);
      return [];
    }
  },

  // Save bills to localStorage
  saveBills(bills: Bill[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(bills));
    } catch (error) {
      console.error('Error saving bills to localStorage:', error);
    }
  },

  // Add a new bill
  addBill(bill: Omit<Bill, 'id' | 'createdAt'>): Bill[] {
    const bills = this.getBills();
    const newBill: Bill = {
      ...bill,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    
    const updatedBills = [...bills, newBill];
    this.saveBills(updatedBills);
    return updatedBills;
  },

  // Delete a bill
  deleteBill(id: string): Bill[] {
    const bills = this.getBills();
    const updatedBills = bills.filter(bill => bill.id !== id);
    this.saveBills(updatedBills);
    return updatedBills;
  },

  // Clear all bills
  clearBills(): void {
    localStorage.removeItem(STORAGE_KEYS.BILLS);
  },

  // Get bills by person ID
  getBillsByPerson(personId: string): Bill[] {
    const bills = this.getBills();
    return bills.filter(bill => bill.personId === personId);
  },
};