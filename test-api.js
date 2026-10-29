// Comprehensive Automated Test Suite for FARS API
const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting FARS Backend Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} - ${details}`);
      failed++;
    }
  }

  try {
    // Reset data first
    await request('/api/reset', { method: 'POST' });

    // 1. GET /health
    const health = await request('/health');
    assert(health.status === 200 && health.data.status === 'healthy' && health.data.system === 'FARS Core',
      'GET /health returns 200 and healthy status');

    // 2. GET /vehicles
    const vehicles = await request('/vehicles');
    assert(vehicles.status === 200 && Array.isArray(vehicles.data) && vehicles.data.length >= 6,
      'GET /vehicles returns list of vehicles');
    const firstVeh = vehicles.data[0];
    assert(firstVeh.id && firstVeh.registration && firstVeh.type && firstVeh.capacity && firstVeh.status,
      'Vehicle object has id, registration, type, capacity, status');

    // 3. GET /drivers
    const drivers = await request('/drivers');
    assert(drivers.status === 200 && Array.isArray(drivers.data) && drivers.data.length >= 6,
      'GET /drivers returns list of drivers');
    const firstDrv = drivers.data[0];
    assert(firstDrv.id && firstDrv.name && firstDrv.availability_status && firstDrv.role && typeof firstDrv.is_verified === 'boolean',
      'Driver object has availability_status, role, is_verified');

    // 4. GET /deliveries
    const deliveries = await request('/deliveries');
    assert(deliveries.status === 200 && Array.isArray(deliveries.data) && deliveries.data.length >= 6,
      'GET /deliveries returns list of deliveries');
    const assignedDel = deliveries.data.find(d => d.id === 'del-104');
    assert(assignedDel && assignedDel.vehicle_id === 'veh-104' && assignedDel.driver_id === 'drv-05',
      'Deliveries return joined assigned vehicle_id and driver_id');

    // 5. PATCH /drivers/:id/status
    // 5a. Driver available -> unavailable
    const updateDrv = await request('/drivers/drv-02/status', { method: 'PATCH' }, { availability_status: 'unavailable' });
    assert(updateDrv.status === 200 && updateDrv.data.driver.availability_status === 'unavailable',
      'PATCH /drivers/:id/status updates to unavailable');

    // 5b. Driver unavailable -> available
    const updateDrvBack = await request('/drivers/drv-02/status', { method: 'PATCH' }, { availability_status: 'available' });
    assert(updateDrvBack.status === 200 && updateDrvBack.data.driver.availability_status === 'available',
      'PATCH /drivers/:id/status updates back to available');

    // 5c. Rejects 400 if driver is assigned to active delivery
    const rejectActiveDrv = await request('/drivers/drv-05/status', { method: 'PATCH' }, { availability_status: 'unavailable' });
    assert(rejectActiveDrv.status === 400 && rejectActiveDrv.data.error === 'DRIVER_ACTIVE_IN_DELIVERY',
      'PATCH /drivers/:id/status rejects with 400 if driver assigned to active delivery');

    // 6. POST /deliveries/:id/assign Double-Booking Guard
    // 6a. Reject if delivery not pending (del-104 is assigned)
    const rejectNotPending = await request('/deliveries/del-104/assign', { method: 'POST' }, {
      vehicle_id: 'veh-101',
      driver_id: 'drv-01'
    });
    assert(rejectNotPending.status === 409 && rejectNotPending.data.error === 'DELIVERY_NOT_PENDING',
      'POST /deliveries/:id/assign rejects 409 if delivery is not pending');

    // 6b. Reject if vehicle in maintenance
    const rejectVehMaint = await request('/deliveries/del-101/assign', { method: 'POST' }, {
      vehicle_id: 'veh-105',
      driver_id: 'drv-01'
    });
    assert(rejectVehMaint.status === 409 && rejectVehMaint.data.error === 'VEHICLE_UNAVAILABLE',
      'POST /deliveries/:id/assign rejects 409 if vehicle not available (maintenance)');

    // 6c. Reject if vehicle already assigned
    const rejectVehAssigned = await request('/deliveries/del-101/assign', { method: 'POST' }, {
      vehicle_id: 'veh-104',
      driver_id: 'drv-01'
    });
    assert(rejectVehAssigned.status === 409 && rejectVehAssigned.data.error === 'VEHICLE_UNAVAILABLE',
      'POST /deliveries/:id/assign rejects 409 if vehicle already assigned');

    // 6d. Reject if driver unverified (drv-06)
    const rejectUnverified = await request('/deliveries/del-101/assign', { method: 'POST' }, {
      vehicle_id: 'veh-101',
      driver_id: 'drv-06'
    });
    assert(rejectUnverified.status === 409 && rejectUnverified.data.error === 'DRIVER_UNAVAILABLE',
      'POST /deliveries/:id/assign rejects 409 if driver is unverified');

    // 6e. Reject if driver unavailable (drv-03)
    const rejectUnavailable = await request('/deliveries/del-101/assign', { method: 'POST' }, {
      vehicle_id: 'veh-101',
      driver_id: 'drv-03'
    });
    assert(rejectUnavailable.status === 409 && rejectUnavailable.data.error === 'DRIVER_UNAVAILABLE',
      'POST /deliveries/:id/assign rejects 409 if driver status is unavailable');

    // 6f. Valid atomic assignment: del-101 + veh-101 + drv-02
    const validAssign = await request('/deliveries/del-101/assign', { method: 'POST' }, {
      vehicle_id: 'veh-101',
      driver_id: 'drv-02'
    });
    assert(validAssign.status === 200 && validAssign.data.success === true,
      'POST /deliveries/:id/assign succeeds for valid pending delivery, available vehicle and driver');

    // Check states after assignment
    const checkVeh = (await request('/vehicles')).data.find(v => v.id === 'veh-101');
    const checkDrv = (await request('/drivers')).data.find(d => d.id === 'drv-02');
    const checkDel = (await request('/deliveries')).data.find(d => d.id === 'del-101');
    assert(checkVeh.status === 'assigned' && checkDrv.availability_status === 'assigned' && checkDel.status === 'assigned',
      'Atomic update reflected in vehicle, driver, and delivery');

    // 7. PATCH /deliveries/:id/status & Resource Release
    // 7a. Reject invalid transition: assigned -> delivered (must go through in_transit)
    const invalidTrans = await request('/deliveries/del-101/status', { method: 'PATCH' }, { status: 'delivered' });
    assert(invalidTrans.status === 400 && invalidTrans.data.error === 'INVALID_TRANSITION',
      'PATCH /deliveries/:id/status rejects invalid transition (assigned -> delivered)');

    // 7b. Valid transition: assigned -> in_transit
    const transInTransit = await request('/deliveries/del-101/status', { method: 'PATCH' }, { status: 'in_transit' });
    assert(transInTransit.status === 200 && transInTransit.data.delivery.status === 'in_transit',
      'PATCH /deliveries/:id/status allows assigned -> in_transit');

    // 7c. Valid transition: in_transit -> delivered (releases resources)
    const transDelivered = await request('/deliveries/del-101/status', { method: 'PATCH' }, { status: 'delivered' });
    assert(transDelivered.status === 200 && transDelivered.data.delivery.status === 'delivered',
      'PATCH /deliveries/:id/status allows in_transit -> delivered');

    // 7d. Verify resource release
    const releasedVeh = (await request('/vehicles')).data.find(v => v.id === 'veh-101');
    const releasedDrv = (await request('/drivers')).data.find(d => d.id === 'drv-02');
    assert(releasedVeh.status === 'available' && releasedDrv.availability_status === 'available',
      'Delivered status properly releases vehicle and driver back to available');

    // 7e. Test cancellation release: assign del-102 and cancel
    await request('/deliveries/del-102/assign', { method: 'POST' }, {
      vehicle_id: 'veh-103',
      driver_id: 'drv-04'
    });
    const cancelDel = await request('/deliveries/del-102/status', { method: 'PATCH' }, { status: 'cancelled' });
    assert(cancelDel.status === 200 && cancelDel.data.delivery.status === 'cancelled',
      'PATCH /deliveries/:id/status allows cancellation');

    const cancelVeh = (await request('/vehicles')).data.find(v => v.id === 'veh-103');
    const cancelDrv = (await request('/drivers')).data.find(d => d.id === 'drv-04');
    assert(cancelVeh.status === 'available' && cancelDrv.availability_status === 'available',
      'Cancelled status properly releases vehicle and driver back to available');

    console.log(`\n========================================`);
    console.log(`🏁 Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    if (failed > 0) process.exit(1);
  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  }
}

runTests();
