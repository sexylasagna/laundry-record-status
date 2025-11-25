import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerRecord } from '../types';
import { fetchCustomers } from '../services/sheetsService';
import { saveLineupToFirestore, fetchLineupFromFirestore, LineupItem } from '../services/myDayService';

function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, '0');
  const day = `${today.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`; // YYYY-MM-DD in local time
}

function formatDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// Generate a random color based on customer ID (consistent per customer)
function getBadgeColor(customerId: string): string {
  const colors = [
    '#fce7f3', '#fbcfe8', '#f9a8d4', // Pink shades
    '#e9d5ff', '#ddd6fe', '#c084fc', // Purple shades
    '#bfdbfe', '#93c5fd', '#60a5fa', // Blue shades
    '#dbeafe', '#bfdbfe', '#93c5fd', // Light blue shades
    '#fef3c7', '#fde68a', '#fcd34d', // Yellow shades
    '#d1fae5', '#a7f3d0', '#6ee7b7', // Green shades
    '#fed7aa', '#fdba74', '#fb923c', // Orange shades
    '#fecdd3', '#fda4af', '#fb7185', // Rose shades
  ];
  
  // Use customer ID to get consistent color
  let hash = 0;
  for (let i = 0; i < customerId.length; i++) {
    hash = customerId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

// Equipment badges configuration
const EQUIPMENT_BADGES = [
  'Dryer 1',
  'Dryer 2',
  'Dryer 3',
  'Electrolux',
  'TCL',
];

export default function MyDayPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lineup, setLineup] = useState<LineupItem[]>([]);
  const [slotCount, setSlotCount] = useState(10); // Start with 10 slots
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [draggedCustomer, setDraggedCustomer] = useState<CustomerRecord | null>(null);
  const [draggedEquipment, setDraggedEquipment] = useState<string | null>(null);
  const [draggedEquipmentTag, setDraggedEquipmentTag] = useState<string | null>(null);
  const [draggingCustomerId, setDraggingCustomerId] = useState<string | null>(null);
  
  const todayDate = getTodayDate();

  // Initialize lineup array with specified number of empty positions
  const initializeLineup = (count: number): LineupItem[] => {
    return Array.from({ length: count }, (_, i) => ({
      customerId: '',
      customerName: '',
      totalWeightKg: 0,
      position: i + 1,
      equipment: [],
    }));
  };

  // Add more slots (adds 1 slot at a time)
  const addMoreSlots = () => {
    const newSlotCount = slotCount + 1;
    const newLineup = [...lineup];
    
    // Add one new empty slot
    newLineup.push({
      customerId: '',
      customerName: '',
      totalWeightKg: 0,
      position: slotCount + 1,
      equipment: [],
    });
    
    setSlotCount(newSlotCount);
    setLineup(newLineup);
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch customers - always show current day's in progress customers
        const customerData = await fetchCustomers();
        // Filter by status = 1 (In progress) only
        setCustomers(customerData.filter(c => c.status === 1));
        
        // Fetch existing lineup for today - if exists, load it; otherwise start fresh
        const existingLineup = await fetchLineupFromFirestore(todayDate);
        if (existingLineup && existingLineup.lineup.length > 0) {
          // Find the maximum position to determine how many slots we need
          const maxPosition = Math.max(...existingLineup.lineup.map(item => item.position), 10);
          const requiredSlots = Math.max(maxPosition, 10); // At least 10 slots
          setSlotCount(requiredSlots);
          
          // Fill in the lineup positions
          const filledLineup = initializeLineup(requiredSlots);
          existingLineup.lineup.forEach(item => {
            if (item.position >= 1 && item.position <= requiredSlots) {
              // Ensure equipment array exists
              filledLineup[item.position - 1] = {
                ...item,
                equipment: item.equipment || [],
              };
            }
          });
          setLineup(filledLineup);
        } else {
          // New day - start with empty lineup
          setSlotCount(10);
          setLineup(initializeLineup(10));
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setSlotCount(10);
        setLineup(initializeLineup(10));
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [todayDate]);

  const handleDragStart = (e: React.DragEvent, customer: CustomerRecord) => {
    setDraggedCustomer(customer);
    setDraggingCustomerId(customer.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggingCustomerId(null);
    setDraggedCustomer(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, position: number) => {
    e.preventDefault();
    
    if (!draggedCustomer) return;
    
    const newLineup = [...lineup];
    
    // Remove customer from any existing position and preserve their equipment
    const existingIndex = newLineup.findIndex(
      item => item.customerId === draggedCustomer.id
    );
    let preservedEquipment: string[] = [];
    if (existingIndex !== -1) {
      preservedEquipment = newLineup[existingIndex].equipment || [];
      newLineup[existingIndex] = {
        customerId: '',
        customerName: '',
        totalWeightKg: 0,
        position: existingIndex + 1,
        equipment: [],
      };
    }
    
    // Add customer to new position, preserving their equipment
    newLineup[position - 1] = {
      customerId: draggedCustomer.id,
      customerName: draggedCustomer.customerName,
      totalWeightKg: draggedCustomer.totalWeightKg,
      position: position,
      equipment: preservedEquipment.length > 0 ? preservedEquipment : (newLineup[position - 1].equipment || []),
    };
    
    setLineup(newLineup);
    setDraggedCustomer(null);
    setDraggingCustomerId(null);
  };

  const handleEquipmentDragStart = (e: React.DragEvent, equipment: string, isFromTag: boolean = false) => {
    setDraggedEquipment(equipment);
    setDraggedEquipmentTag(isFromTag ? equipment : null);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleEquipmentDrop = (e: React.DragEvent, position: number) => {
    e.preventDefault();
    
    if (!draggedEquipment || !position) return;
    
    const newLineup = [...lineup];
    const slot = newLineup[position - 1];
    
    // If dropping on a customer slot that has a customer
    if (slot.customerId) {
      // Remove equipment from source (if it was from another customer's tag)
      if (draggedEquipmentTag) {
        newLineup.forEach(item => {
          if (item.customerId && item.equipment?.includes(draggedEquipmentTag)) {
            item.equipment = item.equipment.filter(eq => eq !== draggedEquipmentTag);
          }
        });
      }
      
      // Add equipment to target customer if not already present
      const equipment = slot.equipment || [];
      if (!equipment.includes(draggedEquipment)) {
        slot.equipment = [...equipment, draggedEquipment];
        newLineup[position - 1] = { ...slot };
      }
    }
    
    setLineup(newLineup);
    setDraggedEquipment(null);
    setDraggedEquipmentTag(null);
  };

  const handleEquipmentRemove = (position: number, equipmentName: string) => {
    const newLineup = [...lineup];
    const slot = newLineup[position - 1];
    if (slot.equipment) {
      slot.equipment = slot.equipment.filter(eq => eq !== equipmentName);
      newLineup[position - 1] = { ...slot };
      setLineup(newLineup);
    }
  };

  const handleRemoveFromLineup = (position: number) => {
    const newLineup = [...lineup];
    newLineup[position - 1] = {
      customerId: '',
      customerName: '',
      totalWeightKg: 0,
      position: position,
      equipment: [],
    };
    // Clear dragging state when removing customer
    setDraggingCustomerId(null);
    setDraggedCustomer(null);
    setLineup(newLineup);
  };

  // Parse date and time from dateDropped string (format: "2025-10-27 08:25 PM")
  const parseDate = (dateStr: string): Date => {
    const parts = dateStr.trim().split(' ');
    const datePart = parts[0]; // "2025-10-27"
    const timePart = parts.slice(1).join(' '); // "08:25 PM"
    
    if (!timePart || timePart === '-') {
      // No time, just date
      return new Date(datePart);
    }
    
    // Parse time (format: "08:25 PM")
    const [time, period] = timePart.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    let hour24 = hours;
    if (period === 'PM' && hours !== 12) {
      hour24 = hours + 12;
    } else if (period === 'AM' && hours === 12) {
      hour24 = 0;
    }
    
    const dateTime = new Date(datePart);
    dateTime.setHours(hour24, minutes || 0, 0, 0);
    return dateTime;
  };

  const handleAutoArrange = () => {
    // Get available customers (those not in lineup)
    const available = customers.filter(
      customer => !lineup.some(item => item.customerId === customer.id)
    );
    
    if (available.length === 0) {
      console.log('No available customers to arrange');
      return;
    }

    // Sort by dateDropped (oldest first)
    available.sort((a, b) => {
      const dateA = parseDate(a.dateDropped);
      const dateB = parseDate(b.dateDropped);
      return dateA.getTime() - dateB.getTime();
    });

    // Determine how many slots we need (at least as many as available customers)
    const requiredSlots = Math.max(available.length, slotCount);
    
    // Update slot count if we need more slots
    if (requiredSlots > slotCount) {
      setSlotCount(requiredSlots);
    }

    // Create new lineup with the required number of slots
    const newLineup = initializeLineup(requiredSlots);
    
    // Place sorted customers in slots
    available.forEach((customer, index) => {
      if (index < requiredSlots) {
        newLineup[index] = {
          customerId: customer.id,
          customerName: customer.customerName,
          totalWeightKg: customer.totalWeightKg,
          position: index + 1,
          equipment: [],
        };
      }
    });

    setLineup(newLineup);
    console.log('Auto-arranged', available.length, 'customers into', requiredSlots, 'slots');
  };

  const handleAutoRemove = () => {
    // Clear all slots by reinitializing the lineup with empty slots
    const clearedLineup = initializeLineup(slotCount);
    setLineup(clearedLineup);
    console.log('Cleared all slots');
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    
    try {
      // Filter out empty positions
      const filledLineup = lineup.filter(item => item.customerId !== '');
      
      await saveLineupToFirestore({
        date: todayDate,
        lineup: filledLineup,
      });
      
      setSaveMessage('✅ Lineup saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving lineup:', error);
      setSaveMessage('❌ Error saving lineup. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Get customers that are not in lineup
  const availableCustomers = customers.filter(
    customer => !lineup.some(item => item.customerId === customer.id)
  );

  if (loading) {
    return (
      <div className="admin-page">
        <div className="muted">Loading...</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="my-day-header">
        <button 
          className="btn-back" 
          onClick={() => navigate('/admin')}
          title="Back to Admin"
        >
          ← Back
        </button>
        <h2>Schedule your line up today</h2>
        <div className="my-day-date">
          <strong>Date:</strong> {formatDate(todayDate)}
        </div>
        <button 
          className="btn-my-day-save" 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {saveMessage && (
          <div className={`save-message ${saveMessage.includes('✅') ? 'success' : 'error'}`}>
            {saveMessage}
          </div>
        )}
      </div>

      <div className="my-day-container">
        <div className="my-day-customers">
          <h3>Available Customers</h3>
          <div className="customer-badges">
            {availableCustomers.length === 0 ? (
              <div className="muted">No available customers</div>
            ) : (
              availableCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className={`customer-badge ${draggingCustomerId === customer.id ? 'dragging' : ''}`}
                  style={{ backgroundColor: getBadgeColor(customer.id) }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, customer)}
                  onDragEnd={handleDragEnd}
                >
                  {customer.customerName} - {customer.totalWeightKg}kg
                </div>
              ))
            )}
          </div>
          
          <h3 style={{ marginTop: '24px' }}>Equipment</h3>
          <div className="equipment-badges">
            {EQUIPMENT_BADGES.map((equipment) => (
              <div
                key={equipment}
                className="equipment-badge"
                draggable
                onDragStart={(e) => handleEquipmentDragStart(e, equipment, false)}
              >
                {equipment}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button 
              className="btn-auto-arrange" 
              onClick={handleAutoArrange}
            >
              Auto Arrange
            </button>
            <button 
              className="btn-auto-remove" 
              onClick={handleAutoRemove}
            >
              Auto Remove
            </button>
          </div>
        </div>

        <div className="my-day-lineup">
          <h3>Lineup (Drag customers to assign positions)</h3>
          <div className="lineup-grid">
            {lineup.map((item) => (
              <div
                key={item.position}
                className={`lineup-slot ${item.customerId ? 'filled' : 'empty'}`}
                onDragOver={(e) => {
                  handleDragOver(e);
                  if (draggedEquipment) {
                    e.preventDefault();
                  }
                }}
                onDrop={(e) => {
                  if (draggedCustomer) {
                    handleDrop(e, item.position);
                  } else if (draggedEquipment && item.customerId) {
                    handleEquipmentDrop(e, item.position);
                  }
                }}
              >
                <div className="lineup-number">({item.position})</div>
                {item.customerId ? (
                  <div className="lineup-customer-content">
                    <div className="lineup-customer-header">
                      <span className="lineup-customer-name">
                        {item.customerName} - {item.totalWeightKg}kg
                      </span>
                      <button
                        className="lineup-remove"
                        onClick={() => handleRemoveFromLineup(item.position)}
                        title="Remove customer"
                      >
                        ×
                      </button>
                    </div>
                    <div 
                      className="lineup-equipment-tags"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleEquipmentDrop(e, item.position)}
                    >
                      {item.equipment && item.equipment.length > 0 ? (
                        item.equipment.map((eq, idx) => (
                          <span
                            key={idx}
                            className="equipment-tag"
                            draggable
                            onDragStart={(e) => handleEquipmentDragStart(e, eq, true)}
                          >
                            {eq}
                            <button
                              className="equipment-tag-remove"
                              onClick={() => handleEquipmentRemove(item.position, eq)}
                              title="Remove equipment"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      ) : (
                        <div className="lineup-equipment-dropzone">Drop equipment here</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="lineup-empty-text">Drop customer here</div>
                )}
              </div>
            ))}
          </div>
          <button 
            className="btn-add-slots" 
            onClick={addMoreSlots}
          >
            + Add Slot
          </button>
        </div>
      </div>
    </div>
  );
}

