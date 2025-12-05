'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { localStoragePeople } from '@/lib/localStorage';
import { showConfirmDialog } from '@/lib/notifications';
import { Navbar } from '@/components/navbar';

interface Person {
  id: string;
  name: string;
  amount?: number;
}

export default function SelectUserPage() {
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [isAddingPerson, setIsAddingPerson] = useState(false);
  const [newPersonNames, setNewPersonNames] = useState(['', '', '']);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch people from localStorage on mount
  useEffect(() => {
    let mounted = true;

    const fetchPeople = () => {
      try {
        const savedPeople = localStoragePeople.getPeople();
        console.log('Fetched people data:', savedPeople);
        if (mounted) {
          const mappedPeople = savedPeople.map((p: any) => {
            console.log('Person data:', p, 'amount:', p.amount, 'amount > 0:', p.amount > 0);
            return { id: p.id, name: p.name, amount: p.amount ?? 0 };
          });
          console.log('Mapped people:', mappedPeople);
          setPeople(mappedPeople);
        }
      } catch (err) {
        console.error('Unexpected error in fetchPeople:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchPeople();
    return () => {
      mounted = false;
    };
  }, []);

  const addMultiplePeople = () => {
    const namesToAdd = newPersonNames.filter(name => name.trim() !== '');
    if (namesToAdd.length === 0) return;

    try {
      console.log('Adding multiple people:', namesToAdd);
      let updatedPeople = [...people];

      namesToAdd.forEach(name => {
        updatedPeople = localStoragePeople.addPerson(name.trim());
      });

      console.log('Successfully added multiple people, updated list:', updatedPeople);
      setPeople(updatedPeople);
      setNewPersonNames(['', '', '']);
      setIsAddingPerson(false);
    } catch (err) {
      console.error('Unexpected addMultiplePeople error:', err);
    }
  };

  const deletePerson = (personId: string) => {
    try {
      const updatedPeople = localStoragePeople.deletePerson(personId);
      setPeople(updatedPeople);
      if (selectedPerson?.id === personId) {
        setSelectedPerson(null);
      }
    } catch (err) {
      console.error('Unexpected deletePerson error:', err);
    }
  };

  const handleContinue = () => {
    if (selectedPerson) {
      // Navigate to upload page with selected person info
      router.push(`/upload?userId=${selectedPerson.id}&userName=${encodeURIComponent(selectedPerson.name)}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-card rounded-xl shadow-lg p-6 mb-8 border">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Who's uploading the bill?</h1>
              <p className="text-muted-foreground">Select yourself or add a new person to get started</p>
            </div>
            {people.length > 0 && (
              <button
                onClick={async () => {
                  const confirmed = await showConfirmDialog('Are you sure you want to remove all people? This action cannot be undone.');
                  if (confirmed) {
                    localStoragePeople.clearPeople();
                    setPeople([]);
                    setSelectedPerson(null);
                  }
                }}
                className="px-4 py-2 border border-destructive text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
              >
                Remove All
              </button>
            )}
          </div>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* People List */}
              <div className="space-y-3 mb-6">
                {people.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <svg className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p>No people found. Add your first person to get started!</p>
                  </div>
                ) : (
                  people.map((person) => (
                    <div
                      key={person.id}
                      onClick={() => setSelectedPerson(person)}
                      className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedPerson?.id === person.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground/50 hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-muted rounded-full flex items-center justify-center">
                          <span className="text-muted-foreground font-medium text-sm sm:text-base">
                            {person.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-foreground truncate block">{person.name}</span>
                          {Boolean(person.amount && person.amount > 0) && (
                            <p className="text-sm text-muted-foreground">Current balance: Rp {(person.amount || 0).toLocaleString('id-ID')}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePerson(person.id);
                        }}
                        className="text-destructive hover:text-destructive/80 p-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
                
                {isAddingPerson && (
                  <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-primary-foreground font-medium">+</span>
                      </div>
                      <p className="font-medium text-foreground">Add New People</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[0, 1, 2].map((index) => (
                        <input
                          key={index}
                          type="text"
                          value={newPersonNames[index]}
                          onChange={(e) => {
                            const updatedNames = [...newPersonNames];
                            updatedNames[index] = e.target.value;
                            setNewPersonNames(updatedNames);
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              addMultiplePeople();
                            }
                          }}
                          placeholder={`Person ${index + 1} name`}
                          className="px-3 py-2 border border-input rounded focus:outline-none focus:border-ring bg-background"
                          autoFocus={index === 0}
                        />
                      ))}
                    </div>
                    <div className="flex justify-end space-x-2 mt-4">
                      <button
                        onClick={() => {
                          setNewPersonNames(['', '', '']);
                          setIsAddingPerson(false);
                        }}
                        className="px-3 py-1 text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addMultiplePeople}
                        disabled={newPersonNames.filter(name => name.trim() !== '').length === 0}
                        className="px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add People
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Add Person Button */}
              {!isAddingPerson && (
                <button
                  onClick={() => setIsAddingPerson(true)}
                  className="w-full p-3 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  + Add New Person
                </button>
              )}
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-between space-y-4 sm:space-y-0 sm:space-x-4">
          <button
            onClick={handleContinue}
            disabled={!selectedPerson || loading}
            className={`w-full sm:w-auto px-6 py-3 rounded-md font-medium transition-colors ${
              selectedPerson && !loading
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            Continue to Upload Bill
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full sm:w-auto px-6 py-3 border border-border rounded-md text-foreground hover:bg-accent"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
