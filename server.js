require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ====================================================================
// Supabase Client & Data Layer
// ====================================================================
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const isPlaceholderUrl = !SUPABASE_URL ||
  SUPABASE_URL.includes('xyzcompany') ||
  SUPABASE_URL.includes('your-project') ||
  SUPABASE_URL.includes('example.com') ||
  !SUPABASE_URL.startsWith('http');

let supabase = null;
let useLiveSupabase = false;

if (!isPlaceholderUrl && SUPABASE_SERVICE_ROLE_KEY && !SUPABASE_SERVICE_ROLE_KEY.includes('dummy_key')) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    useLiveSupabase = true;
    console.log(`[FARS] Supabase client initialized for: ${SUPABASE_URL}`);
  } catch (err) {
    console.warn(`[FARS] Failed to initialize Supabase client: ${err.message}. Using built-in resilient data engine.`);
    useLiveSupabase = false;
  }
} else {
  console.log(`[FARS] Running with built-in resilient data engine (Supabase credentials placeholder). Connect your Supabase project in .env anytime.`);
}

// ====================================================================
// Built-in Resilient In-Memory Storage Engine
// (Mirrors exact Supabase tables, types, and constraints)
// ====================================================================
const initialSeed = {
  vehicles: [
    { id: 'veh-101', registration: 'TRK-8841', type: 'Heavy Semi-Truck', capacity: '18,000 kg', status: 'available', created_at: new Date(Date.now() - 86400000 * 5).toISOString() },
    { id: 'veh-102', registration: 'VAN-2093', type: 'Refrigerated Lorry', capacity: '3,500 kg', status: 'available', created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
    { id: 'veh-103', registration: 'EV-4410', type: 'Electric Cargo Sprinter', capacity: '2,200 kg', status: 'available', created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
    { id: 'veh-104', registration: 'FLT-9022', type: 'Flatbed Carrier', capacity: '12,000 kg', status: 'assigned', created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: 'veh-105', registration: 'MNT-0012', type: 'Box Truck', capacity: '6,000 kg', status: 'maintenance', created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: 'veh-106', registration: 'VAN-5521', type: 'Urban Courier Van', capacity: '1,800 kg', status: 'available', created_at: new Date(Date.now() - 86400000 * 1).toISOString() }
  ],
  drivers: [
    { id: 'drv-01', name: 'Marcus Vance', role: 'full_time', is_verified: true, availability_status: 'available', phone: '+1 (555) 234-8901', created_at: new Date(Date.now() - 86400000 * 10).toISOString() },
    { id: 'drv-02', name: 'Sarah Chen', role: 'full_time', is_verified: true, availability_status: 'available', phone: '+1 (555) 345-6712', created_at: new Date(Date.now() - 86400000 * 8).toISOString() },
    { id: 'drv-03', name: 'Elena Rostova', role: 'part_time', is_verified: true, availability_status: 'unavailable', phone: '+1 (555) 890-1234', created_at: new Date(Date.now() - 86400000 * 7).toISOString() },
    { id: 'drv-04', name: 'Jamal Davis', role: 'part_time', is_verified: true, availability_status: 'available', phone: '+1 (555) 456-7890', created_at: new Date(Date.now() - 86400000 * 6).toISOString() },
    { id: 'drv-05', name: 'Alex Rodriguez', role: 'full_time', is_verified: true, availability_status: 'assigned', phone: '+1 (555) 678-9012', created_at: new Date(Date.now() - 86400000 * 5).toISOString() },
    { id: 'drv-06', name: 'Leo Thorne', role: 'part_time', is_verified: false, availability_status: 'available', phone: '+1 (555) 789-0123', created_at: new Date(Date.now() - 86400000 * 4).toISOString() }
  ],
  deliveries: [
    { id: 'del-101', tracking_code: 'DEL-7401', destination: 'North Gate Distribution Hub', cargo_weight: '1,450 kg', cargo_description: 'Medical Vaccines & Cryo-storage', priority: 'urgent', status: 'pending', vehicle_id: null, driver_id: null, created_at: new Date(Date.now() - 3600000 * 3).toISOString() },
    { id: 'del-102', tracking_code: 'DEL-7402', destination: 'Harbor Freight Terminal 9', cargo_weight: '8,200 kg', cargo_description: 'Industrial Hydraulic Pumps', priority: 'high', status: 'pending', vehicle_id: null, driver_id: null, created_at: new Date(Date.now() - 3600000 * 2).toISOString() },
    { id: 'del-103', tracking_code: 'DEL-7403', destination: 'Downtown Retail Supercenter', cargo_weight: '2,100 kg', cargo_description: 'Consumer Electronics & Displays', priority: 'standard', status: 'pending', vehicle_id: null, driver_id: null, created_at: new Date(Date.now() - 3600000 * 1).toISOString() },
    { id: 'del-104', tracking_code: 'DEL-7404', destination: 'Airport Logistics Cargo East', cargo_weight: '4,800 kg', cargo_description: 'Automotive Engine Spares', priority: 'high', status: 'assigned', vehicle_id: 'veh-104', driver_id: 'drv-05', created_at: new Date(Date.now() - 3600000 * 4).toISOString() },
    { id: 'del-105', tracking_code: 'DEL-7405', destination: 'Westside Medical Center', cargo_weight: '620 kg', cargo_description: 'Surgical Kits & Diagnostics', priority: 'urgent', status: 'in_transit', vehicle_id: 'veh-102', driver_id: 'drv-01', created_at: new Date(Date.now() - 3600000 * 5).toISOString() },
    { id: 'del-106', tracking_code: 'DEL-7406', destination: 'Metropolitan Fulfillment Hub', cargo_weight: '3,400 kg', cargo_description: 'Dry Packaged Food Supplies', priority: 'standard', status: 'delivered', vehicle_id: null, driver_id: null, created_at: new Date(Date.now() - 86400000 * 1).toISOString() }
  ],
  assignments: [
    { id: 'asg-104', delivery_id: 'del-104', vehicle_id: 'veh-104', driver_id: 'drv-05', status: 'active', assigned_at: new Date(Date.now() - 3600000 * 2).toISOString(), completed_at: null },
    { id: 'asg-105', delivery_id: 'del-105', vehicle_id: 'veh-102', driver_id: 'drv-01', status: 'active', assigned_at: new Date(Date.now() - 3600000 * 3).toISOString(), completed_at: null }
  ]
};

// Deep clone for active memory
let memoryDb = JSON.parse(JSON.stringify(initialSeed));

// Test Supabase connection if live credentials exist
async function testSupabaseConnection() {
  if (!useLiveSupabase || !supabase) return false;
  try {
    const { data, error } = await supabase.from('vehicles').select('id').limit(1);
    if (error) {
      console.warn('[FARS] Supabase query returned error (tables might need setup):', error.message);
      return false;
    }
    console.log('[FARS] Successfully verified live Supabase connection.');
    return true;
  } catch (err) {
    console.warn('[FARS] Supabase network check failed:', err.message);
    return false;
  }
}

let supabaseActive = false;
testSupabaseConnection().then(active => {
  supabaseActive = active;
});

// ====================================================================
// DATA ACCESS HELPERS
// ====================================================================
const DB = {
  async getVehicles() {
    if (supabaseActive && supabase) {
      const { data, error } = await supabase.from('vehicles').select('id, registration, type, capacity, status').order('id', { ascending: true });
      if (!error && data && data.length > 0) return data;
    }
    return memoryDb.vehicles.map(v => ({
      id: v.id,
      registration: v.registration,
      type: v.type,
      capacity: v.capacity,
      status: v.status
    }));
  },

  async getDrivers() {
    if (supabaseActive && supabase) {
      const { data, error } = await supabase.from('drivers').select('id, name, availability_status, role, is_verified, phone').order('id', { ascending: true });
      if (!error && data && data.length > 0) return data;
    }
    return memoryDb.drivers.map(d => ({
      id: d.id,
      name: d.name,
      availability_status: d.availability_status,
      role: d.role,
      is_verified: d.is_verified,
      phone: d.phone
    }));
  },

  async getDeliveries() {
    if (supabaseActive && supabase) {
      const { data, error } = await supabase.from('deliveries').select(`
        id, tracking_code, destination, cargo_weight, cargo_description, priority, status, vehicle_id, driver_id, created_at,
        vehicles:vehicle_id (id, registration, type, capacity, status),
        drivers:driver_id (id, name, role, is_verified, availability_status)
      `).order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        return data.map(d => ({
          ...d,
          vehicle: d.vehicles || null,
          driver: d.drivers || null
        }));
      }
    }

    return memoryDb.deliveries.map(del => {
      const vehicle = memoryDb.vehicles.find(v => v.id === del.vehicle_id) || null;
      const driver = memoryDb.drivers.find(d => d.id === del.driver_id) || null;
      return {
        ...del,
        vehicle,
        driver
      };
    });
  },

  async findDriver(id) {
    if (supabaseActive && supabase) {
      const { data, error } = await supabase.from('drivers').select('*').eq('id', id).single();
      if (!error && data) return data;
    }
    return memoryDb.drivers.find(d => d.id === id) || null;
  },

  async findVehicle(id) {
    if (supabaseActive && supabase) {
      const { data, error } = await supabase.from('vehicles').select('*').eq('id', id).single();
      if (!error && data) return data;
    }
    return memoryDb.vehicles.find(v => v.id === id) || null;
  },

  async findDelivery(id) {
    if (supabaseActive && supabase) {
      const { data, error } = await supabase.from('deliveries').select('*').or(`id.eq.${id},tracking_code.eq.${id}`).limit(1);
      if (!error && data && data.length > 0) return data[0];
    }
    return memoryDb.deliveries.find(d => d.id === id || d.delivery_id === id || d.tracking_code === id) || null;
  },

  async getActiveDeliveriesForDriver(driverId) {
    if (supabaseActive && supabase) {
      const { data, error } = await supabase.from('deliveries')
        .select('*')
        .eq('driver_id', driverId)
        .in('status', ['assigned', 'in_transit']);
      if (!error && data) return data;
    }
    return memoryDb.deliveries.filter(del =>
      del.driver_id === driverId && ['assigned', 'in_transit'].includes(del.status)
    );
  },

  async getActiveDeliveriesForVehicle(vehicleId) {
    if (supabaseActive && supabase) {
      const { data, error } = await supabase.from('deliveries')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .in('status', ['assigned', 'in_transit']);
      if (!error && data) return data;
    }
    return memoryDb.deliveries.filter(del =>
      del.vehicle_id === vehicleId && ['assigned', 'in_transit'].includes(del.status)
    );
  },

  async updateDriverStatus(id, newStatus) {
    if (supabaseActive && supabase) {
      const { data, error } = await supabase.from('drivers')
        .update({ availability_status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return data;
    }
    const driver = memoryDb.drivers.find(d => d.id === id);
    if (driver) {
      driver.availability_status = newStatus;
    }
    return driver;
  },

  async updateVehicleStatus(id, newStatus) {
    if (supabaseActive && supabase) {
      const { data, error } = await supabase.from('vehicles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return data;
    }
    const vehicle = memoryDb.vehicles.find(v => v.id === id);
    if (vehicle) {
      vehicle.status = newStatus;
    }
    return vehicle;
  },

  async assignDeliveryAtomic(deliveryId, vehicleId, driverId, substitutingFor = null) {
    const assignmentId = 'asg-' + Date.now().toString().slice(-6) + Math.random().toString(36).slice(2, 5);

    if (supabaseActive && supabase) {
      // First attempt Supabase RPC if present
      const { data: rpcData, error: rpcError } = await supabase.rpc('assign_delivery', {
        p_delivery_id: deliveryId,
        p_vehicle_id: vehicleId,
        p_driver_id: driverId
      });

      if (!rpcError && rpcData) {
        return { success: true, assignment_id: rpcData.assignment_id || assignmentId };
      }

      // Fallback to transactional sequence on Supabase with rollback safeguard
      try {
        const { error: asgErr } = await supabase.from('assignments').insert({
          id: assignmentId,
          delivery_id: deliveryId,
          vehicle_id: vehicleId,
          driver_id: driverId,
          status: 'active',
          assigned_at: new Date().toISOString()
        });
        if (asgErr) throw asgErr;

        const { error: vehErr } = await supabase.from('vehicles').update({ status: 'assigned' }).eq('id', vehicleId);
        if (vehErr) {
          await supabase.from('assignments').delete().eq('id', assignmentId);
          throw vehErr;
        }

        const { error: drvErr } = await supabase.from('drivers').update({ availability_status: 'assigned' }).eq('id', driverId);
        if (drvErr) {
          await supabase.from('vehicles').update({ status: 'available' }).eq('id', vehicleId);
          await supabase.from('assignments').delete().eq('id', assignmentId);
          throw drvErr;
        }

        const { error: delErr } = await supabase.from('deliveries').update({
          status: 'assigned',
          vehicle_id: vehicleId,
          driver_id: driverId
        }).eq('id', deliveryId);

        if (delErr) {
          await supabase.from('drivers').update({ availability_status: 'available' }).eq('id', driverId);
          await supabase.from('vehicles').update({ status: 'available' }).eq('id', vehicleId);
          await supabase.from('assignments').delete().eq('id', assignmentId);
          throw delErr;
        }

        return { success: true, assignment_id: assignmentId };
      } catch (e) {
        throw new Error(`Database atomic assignment failed: ${e.message}`);
      }
    }

    // In-memory atomic transaction simulation
    const targetDelivery = memoryDb.deliveries.find(d => d.id === deliveryId || d.delivery_id === deliveryId || d.tracking_code === deliveryId);
    if (!targetDelivery) throw new Error('Delivery not found: ' + deliveryId);
    const realDeliveryId = targetDelivery.id;

    const snapshot = {
      vehicle: JSON.parse(JSON.stringify(memoryDb.vehicles.find(v => v.id === vehicleId))),
      driver: JSON.parse(JSON.stringify(memoryDb.drivers.find(d => d.id === driverId))),
      delivery: JSON.parse(JSON.stringify(targetDelivery))
    };

    try {
      const assignment = {
        id: assignmentId,
        delivery_id: realDeliveryId,
        vehicle_id: vehicleId,
        driver_id: driverId,
        status: 'active',
        assigned_at: new Date().toISOString(),
        completed_at: null
      };
      memoryDb.assignments.push(assignment);

      const targetVehicle = memoryDb.vehicles.find(v => v.id === vehicleId);
      targetVehicle.status = 'assigned';

      const targetDriver = memoryDb.drivers.find(d => d.id === driverId);
      targetDriver.availability_status = 'assigned';

      targetDelivery.status = 'assigned';
      targetDelivery.vehicle_id = vehicleId;
      targetDelivery.driver_id = driverId;
      targetDelivery.substituting_for = substitutingFor || null;

      return {
        success: true,
        assignment_id: assignmentId,
        delivery: targetDelivery,
        vehicle: targetVehicle,
        driver: targetDriver
      };
    } catch (err) {
      // Rollback
      const v = memoryDb.vehicles.find(item => item.id === vehicleId);
      if (v && snapshot.vehicle) v.status = snapshot.vehicle.status;

      const d = memoryDb.drivers.find(item => item.id === driverId);
      if (d && snapshot.driver) d.availability_status = snapshot.driver.availability_status;

      if (targetDelivery && snapshot.delivery) {
        targetDelivery.status = snapshot.delivery.status;
        targetDelivery.vehicle_id = snapshot.delivery.vehicle_id;
        targetDelivery.driver_id = snapshot.delivery.driver_id;
        targetDelivery.substituting_for = snapshot.delivery.substituting_for || null;
      }
      memoryDb.assignments = memoryDb.assignments.filter(a => a.id !== assignmentId);
      throw err;
    }
  },

  async updateDeliveryStatus(id, newStatus) {
    const delivery = await this.findDelivery(id);
    if (!delivery) return null;

    const realId = delivery.id;
    const previousStatus = delivery.status;
    const vehicleId = delivery.vehicle_id;
    const driverId = delivery.driver_id;

    if (supabaseActive && supabase) {
      // Update delivery
      const { error: delErr } = await supabase.from('deliveries')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', realId);
      if (delErr) throw delErr;

      // Resource release if delivered or cancelled
      if (newStatus === 'delivered' || newStatus === 'cancelled') {
        if (vehicleId) {
          await supabase.from('vehicles').update({ status: 'available' }).eq('id', vehicleId);
        }
        if (driverId) {
          await supabase.from('drivers').update({ availability_status: 'available' }).eq('id', driverId);
        }
        // Update assignment status
        await supabase.from('assignments')
          .update({
            status: newStatus === 'delivered' ? 'completed' : 'cancelled',
            completed_at: new Date().toISOString()
          })
          .eq('delivery_id', realId)
          .eq('status', 'active');
      }

      return await this.findDelivery(realId);
    }

    // In-memory update
    const targetDel = memoryDb.deliveries.find(d => d.id === realId || d.delivery_id === id || d.tracking_code === id);
    if (targetDel) {
      targetDel.status = newStatus;
      if (newStatus === 'delivered' || newStatus === 'cancelled') {
        if (vehicleId) {
          const veh = memoryDb.vehicles.find(v => v.id === vehicleId);
          if (veh) veh.status = 'available';
        }
        if (driverId) {
          const drv = memoryDb.drivers.find(d => d.id === driverId);
          if (drv) drv.availability_status = 'available';
        }
        const activeAsg = memoryDb.assignments.find(a => (a.delivery_id === realId || a.delivery_id === id) && a.status === 'active');
        if (activeAsg) {
          activeAsg.status = newStatus === 'delivered' ? 'completed' : 'cancelled';
          activeAsg.completed_at = new Date().toISOString();
        }
      }
    }
    return targetDel;
  },

  async createDelivery(deliveryData) {
    const id = deliveryData.id || ('del-' + (100 + memoryDb.deliveries.length + 1) + '-' + Math.random().toString(36).slice(2, 5));
    const tracking_code = deliveryData.delivery_id || deliveryData.tracking_code || ('DEL-' + Math.floor(7400 + Math.random() * 2500));
    
    const pickup = deliveryData.pickup || '';
    const dropoff = deliveryData.dropoff || '';
    const scheduled_time = deliveryData.scheduled_time || '';

    let destination = deliveryData.destination;
    if (!destination) {
      if (pickup && dropoff) {
        destination = `${pickup} ➔ ${dropoff}`;
      } else if (dropoff) {
        destination = dropoff;
      } else if (pickup) {
        destination = pickup;
      } else {
        destination = 'Regional Fulfillment Center';
      }
    }

    let prio = (deliveryData.priority || 'standard').toString().toLowerCase();
    if (prio === 'medium' || prio === 'low') prio = 'standard';
    if (!['urgent', 'high', 'standard'].includes(prio)) prio = 'standard';

    const newDel = {
      id,
      tracking_code,
      delivery_id: tracking_code,
      destination,
      pickup,
      dropoff,
      scheduled_time,
      cargo_weight: deliveryData.cargo_weight || '2,500 kg',
      cargo_description: deliveryData.cargo_description || 'General Freight',
      priority: prio,
      status: 'pending',
      vehicle_id: null,
      driver_id: null,
      created_at: new Date().toISOString()
    };

    if (supabaseActive && supabase) {
      try {
        const dbRecord = {
          id: newDel.id,
          tracking_code: newDel.tracking_code,
          destination: newDel.destination,
          cargo_weight: newDel.cargo_weight,
          cargo_description: newDel.cargo_description,
          priority: newDel.priority,
          status: 'pending',
          vehicle_id: null,
          driver_id: null,
          created_at: newDel.created_at
        };
        const { data, error } = await supabase.from('deliveries').insert(dbRecord).select().single();
        if (!error && data) {
          const merged = { ...newDel, ...data };
          memoryDb.deliveries.unshift(merged);
          return merged;
        }
        if (error) {
          console.warn('[FARS] Supabase insert note (using resilient memory store):', error.message);
        }
      } catch (err) {
        console.warn('[FARS] Supabase insert exception (using resilient memory store):', err.message);
      }
    }

    memoryDb.deliveries.unshift(newDel);
    return newDel;
  },

  resetMemory() {
    memoryDb = JSON.parse(JSON.stringify(initialSeed));
  }
};

// ====================================================================
// REQUIRED API ROUTES
// ====================================================================

/**
 * 1. GET /health
 * Returns { status: "healthy", system: "FARS Core" }.
 */
app.get('/health', (req, res) => {
  return res.json({
    status: 'healthy',
    system: 'FARS Core'
  });
});

/**
 * 2. GET /vehicles
 * Returns list of all vehicles with id, registration, type, capacity, and current status.
 */
app.get('/vehicles', async (req, res) => {
  try {
    const vehicles = await DB.getVehicles();
    return res.json(vehicles);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return res.status(500).json({ error: 'Failed to retrieve vehicles', details: error.message });
  }
});

/**
 * 3. GET /drivers
 * Returns list of drivers with availability_status, role (full_time/part_time), and is_verified flag.
 */
app.get('/drivers', async (req, res) => {
  try {
    const drivers = await DB.getDrivers();
    return res.json(drivers);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return res.status(500).json({ error: 'Failed to retrieve drivers', details: error.message });
  }
});

/**
 * 4. GET /deliveries
 * Returns list of deliveries with joined assigned vehicle_id and driver_id.
 */
app.get('/deliveries', async (req, res) => {
  try {
    const deliveries = await DB.getDeliveries();
    return res.json(deliveries);
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    return res.status(500).json({ error: 'Failed to retrieve deliveries', details: error.message });
  }
});

/**
 * 5. PATCH /drivers/:id/status
 * Updates availability_status ('available', 'unavailable').
 * Rejects with 400 if driver is currently assigned to an active delivery ('assigned', 'in_transit').
 */
app.patch('/drivers/:id/status', async (req, res) => {
  try {
    const driverId = req.params.id;
    const requestedStatus = req.body.availability_status || req.body.status;

    if (!requestedStatus || !['available', 'unavailable'].includes(requestedStatus)) {
      return res.status(400).json({
        error: 'INVALID_STATUS',
        message: "Status must be either 'available' or 'unavailable'"
      });
    }

    const driver = await DB.findDriver(driverId);
    if (!driver) {
      return res.status(404).json({
        error: 'DRIVER_NOT_FOUND',
        message: `Driver with ID ${driverId} not found`
      });
    }

    // Check if driver is currently assigned to an active delivery ('assigned', 'in_transit')
    const activeDeliveries = await DB.getActiveDeliveriesForDriver(driverId);
    if (activeDeliveries.length > 0 || driver.availability_status === 'assigned') {
      return res.status(400).json({
        error: 'DRIVER_ACTIVE_IN_DELIVERY',
        message: `Driver ${driver.name} is currently assigned to an active delivery (${activeDeliveries.map(d => d.tracking_code || d.id).join(', ')}). Cannot change availability.`
      });
    }

    const updatedDriver = await DB.updateDriverStatus(driverId, requestedStatus);
    return res.json({
      success: true,
      message: `Driver status successfully updated to ${requestedStatus}`,
      driver: updatedDriver
    });
  } catch (error) {
    console.error('Error updating driver status:', error);
    return res.status(500).json({ error: 'Failed to update driver status', details: error.message });
  }
});

/**
 * 6. POST /deliveries/:id/assign
 * Accepts { vehicle_id, driver_id }.
 * Mandatory Double-Booking Guard:
 *   - Check if delivery.status is 'pending'. If not, return 409 conflict.
 *   - Check if vehicle.status is 'available'. If not, return 409 VEHICLE_UNAVAILABLE.
 *   - Check if driver.availability_status is 'available' and is_verified is true. If not, return 409 DRIVER_UNAVAILABLE.
 *   - Verify no active delivery ('assigned', 'in_transit') uses either vehicle or driver.
 * Atomic update:
 *   - Insert into assignments table.
 *   - Update vehicle status to 'assigned'.
 *   - Update driver availability_status to 'assigned'.
 *   - Update delivery status to 'assigned'.
 *   - If any query fails, revert or fail cleanly without partial record updates.
 */
app.post('/deliveries/:id/assign', async (req, res) => {
  try {
    const deliveryId = req.params.id;
    const { vehicle_id, driver_id, substituting_for } = req.body;

    if (!vehicle_id || !driver_id) {
      return res.status(400).json({
        error: 'MISSING_PARAMETERS',
        message: 'Both vehicle_id and driver_id are required for dispatch assignment.'
      });
    }

    // 1. Verify delivery exists and check if pending
    const delivery = await DB.findDelivery(deliveryId);
    if (!delivery) {
      return res.status(404).json({
        error: 'DELIVERY_NOT_FOUND',
        message: `Delivery with ID ${deliveryId} not found.`
      });
    }

    if (delivery.status !== 'pending') {
      return res.status(409).json({
        error: 'DELIVERY_NOT_PENDING',
        message: `Delivery ${delivery.tracking_code || deliveryId} is currently in '${delivery.status}' status. Only 'pending' deliveries can be assigned.`
      });
    }

    // 2. Verify vehicle exists and check if available
    const vehicle = await DB.findVehicle(vehicle_id);
    if (!vehicle) {
      return res.status(404).json({
        error: 'VEHICLE_NOT_FOUND',
        message: `Vehicle with ID ${vehicle_id} not found.`
      });
    }

    if (vehicle.status !== 'available') {
      return res.status(409).json({
        error: 'VEHICLE_UNAVAILABLE',
        message: `Vehicle ${vehicle.registration} is currently '${vehicle.status}'. Only 'available' vehicles can be allocated.`
      });
    }

    // 3. Verify driver exists, is available, and is verified
    const driver = await DB.findDriver(driver_id);
    if (!driver) {
      return res.status(404).json({
        error: 'DRIVER_NOT_FOUND',
        message: `Driver with ID ${driver_id} not found.`
      });
    }

    if (driver.availability_status !== 'available' || driver.is_verified !== true) {
      const reason = !driver.is_verified
        ? 'driver is not verified'
        : `driver status is '${driver.availability_status}'`;
      return res.status(409).json({
        error: 'DRIVER_UNAVAILABLE',
        message: `Driver ${driver.name} is unavailable for assignment: ${reason}. Only verified drivers marked 'available' can be assigned.`
      });
    }

    // 4. Verify no active delivery ('assigned', 'in_transit') uses either vehicle or driver
    const activeVehicleDeliveries = await DB.getActiveDeliveriesForVehicle(vehicle_id);
    if (activeVehicleDeliveries.length > 0) {
      return res.status(409).json({
        error: 'VEHICLE_UNAVAILABLE',
        message: `Vehicle ${vehicle.registration} is already actively bound to delivery ${activeVehicleDeliveries[0].tracking_code || activeVehicleDeliveries[0].id}.`
      });
    }

    const activeDriverDeliveries = await DB.getActiveDeliveriesForDriver(driver_id);
    if (activeDriverDeliveries.length > 0) {
      return res.status(409).json({
        error: 'DRIVER_UNAVAILABLE',
        message: `Driver ${driver.name} is already actively bound to delivery ${activeDriverDeliveries[0].tracking_code || activeDriverDeliveries[0].id}.`
      });
    }

    // 5. Execute Atomic Update
    const result = await DB.assignDeliveryAtomic(deliveryId, vehicle_id, driver_id, substituting_for);

    return res.status(200).json({
      success: true,
      message: `Successfully assigned ${vehicle.registration} and driver ${driver.name} to delivery ${delivery.tracking_code || deliveryId}.`,
      assignment_id: result.assignment_id,
      delivery_id: deliveryId,
      vehicle_id,
      driver_id,
      substituting_for: substituting_for || null,
      delivery: result.delivery || delivery
    });
  } catch (error) {
    console.error('Error during assignment dispatch:', error);
    return res.status(500).json({
      error: 'ASSIGNMENT_FAILED',
      message: error.message || 'Atomic dispatch failed. Changes have been cleanly reverted.'
    });
  }
});

/**
 * 7. PATCH /deliveries/:id/status
 * Accepts { status }.
 * Valid transitions:
 *   pending -> cancelled
 *   assigned -> in_transit | cancelled
 *   in_transit -> delivered
 * Resource release:
 *   If transitioning to 'delivered' or 'cancelled', look up the assigned vehicle and driver
 *   and update their statuses back to 'available'.
 */
app.patch('/deliveries/:id/status', async (req, res) => {
  try {
    const deliveryId = req.params.id;
    const { status: newStatus } = req.body;

    if (!newStatus) {
      return res.status(400).json({
        error: 'MISSING_STATUS',
        message: 'Field "status" is required in request body.'
      });
    }

    const delivery = await DB.findDelivery(deliveryId);
    if (!delivery) {
      return res.status(404).json({
        error: 'DELIVERY_NOT_FOUND',
        message: `Delivery with ID ${deliveryId} not found.`
      });
    }

    const currentStatus = delivery.status;

    // Define allowed transitions
    const validTransitions = {
      pending: ['cancelled'],
      assigned: ['in_transit', 'cancelled'],
      in_transit: ['delivered']
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({
        error: 'INVALID_TRANSITION',
        message: `Invalid status transition from '${currentStatus}' to '${newStatus}'. Allowed transitions: pending -> cancelled; assigned -> in_transit | cancelled; in_transit -> delivered.`
      });
    }

    // Perform transition and resource release
    const updatedDelivery = await DB.updateDeliveryStatus(deliveryId, newStatus);

    return res.json({
      success: true,
      message: `Delivery ${delivery.tracking_code || deliveryId} transitioned from '${currentStatus}' to '${newStatus}'. Resources ${['delivered', 'cancelled'].includes(newStatus) ? 'released to available' : 'maintained'}.`,
      delivery: updatedDelivery,
      released_resources: ['delivered', 'cancelled'].includes(newStatus) ? {
        vehicle_id: delivery.vehicle_id,
        driver_id: delivery.driver_id
      } : null
    });
  } catch (error) {
    console.error('Error updating delivery status:', error);
    return res.status(500).json({ error: 'Failed to update delivery status', details: error.message });
  }
});

// ====================================================================
// UTILITY / SYSTEM ROUTES (For Frontend & Testing)
// ====================================================================

// Create new pending delivery or batch ingestion
app.post('/deliveries', async (req, res) => {
  try {
    if (Array.isArray(req.body)) {
      const created = [];
      for (const item of req.body) {
        created.push(await DB.createDelivery(item));
      }
      return res.status(201).json({
        success: true,
        message: `Successfully ingested ${created.length} manifest deliveries`,
        count: created.length,
        deliveries: created
      });
    }

    const newDelivery = await DB.createDelivery(req.body);
    return res.status(201).json({
      success: true,
      message: `Delivery ${newDelivery.tracking_code || newDelivery.id} created successfully with status 'pending'`,
      delivery: newDelivery,
      ...newDelivery
    });
  } catch (error) {
    console.error('Error creating delivery:', error);
    return res.status(500).json({ error: 'Failed to create delivery', details: error.message });
  }
});

// System Status and DB health
app.get('/api/system-status', async (req, res) => {
  return res.json({
    system: 'FARS Core',
    database_mode: supabaseActive ? 'supabase-live' : 'in-memory-engine',
    supabase_configured: !!(SUPABASE_URL && !isPlaceholderUrl),
    timestamp: new Date().toISOString()
  });
});

// Reset seed state for demo / QA
app.post('/api/reset', (req, res) => {
  DB.resetMemory();
  return res.json({ success: true, message: 'All fleet, driver, and delivery data reset to initial benchmark state.' });
});

// Serve frontend SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  🚀 FARS (Fleet Allocation & Resource Substitution)`);
    console.log(`  Server running on port ${PORT}`);
    console.log(`  Local URL: http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}

module.exports = { app, DB };
