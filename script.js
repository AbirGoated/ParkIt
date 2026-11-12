const TOTAL_SLOTS = 20;
const SECONDS_PER_PARKING_HOUR = 10;
const RATES = { car: 30, bike: 15 };
const CAR_COLORS = ['#d95f52', '#3f91c4', '#e0b34e', '#6eae83', '#9a82c7', '#d6d9dc', '#e17c9a', '#d07a42'];
const BIKE_COLORS = ['#e45f4f', '#4a9dc5', '#e0b24e', '#73ad7d', '#a58ad0', '#d7dce0'];

let slots = [];
let activeFilter = 'all';
let selectedSlotId = null;
let activity = [];
let toastTimer;

const $ = id => document.getElementById(id);
const topRow = $('topParkingRow');
const bottomRow = $('bottomParkingRow');

async function apiRequest(endpoint, method = 'GET', data = null) {
  const options = { method };
  if (data) {
    options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    options.body = new URLSearchParams(data).toString();
  }
  const response = await fetch(endpoint, options);
  if (!response.ok) throw new Error(`Server error: ${response.status}`);
  return response.json();
}

async function refreshSlots() {
  const data = await apiRequest('/api/slots');
  slots = data.slots.map(item => ({
    id: item.id,
    vehicle: item.occupied ? {
      number: item.reg,
      type: item.type,
      parkedAt: Date.now() - item.elapsedSeconds * 1000
    } : null
  }));
  renderSlots();
}

function handleApiError(error) {
  console.error(error);
  showToast('Could not communicate with the C++ server.');
}

function normalisePlate(value) {
  return value.trim().toUpperCase().replace(/\s+/g, ' ');
}

function getElapsedSeconds(vehicle) {
  return Math.max(0, (Date.now() - vehicle.parkedAt) / 1000);
}

function getDuration(vehicle) {
  const totalMinutes = Math.floor(getElapsedSeconds(vehicle) * 6);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { totalMinutes, hours, minutes, label: `${hours}h ${minutes}m` };
}

function getBill(vehicle) {
  const hours = Math.max(1, Math.ceil(getElapsedSeconds(vehicle) / SECONDS_PER_PARKING_HOUR));
  return { hours, amount: hours * RATES[vehicle.type] };
}

function carSvg(color, slotId) {
  return `
    <svg viewBox="0 0 76 132" role="img" aria-label="Top view car" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="carPaint-${slotId}" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".42"/><stop offset=".38" stop-color="${color}"/><stop offset="1" stop-color="#101820" stop-opacity=".5"/></linearGradient>
        <linearGradient id="glass-${slotId}" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#a9d0dc"/><stop offset=".45" stop-color="#294553"/><stop offset="1" stop-color="#101c25"/></linearGradient>
      </defs>
      <ellipse cx="38" cy="67" rx="31" ry="61" fill="#11181c" opacity=".45"/>
      <rect x="4" y="22" width="9" height="25" rx="3" fill="#111518"/><rect x="63" y="22" width="9" height="25" rx="3" fill="#111518"/>
      <rect x="4" y="86" width="9" height="25" rx="3" fill="#111518"/><rect x="63" y="86" width="9" height="25" rx="3" fill="#111518"/>
      <path d="M20 5 Q25 1 38 1 Q51 1 56 5 L66 25 Q71 34 71 49 L71 105 Q70 121 57 127 Q38 133 19 127 Q6 121 5 105 L5 49 Q5 34 10 25Z" fill="url(#carPaint-${slotId})" stroke="#dce5e7" stroke-opacity=".7" stroke-width="1.5"/>
      <path d="M20 15 Q24 9 38 9 Q52 9 56 15 L62 34 L14 34Z" fill="url(#glass-${slotId})" stroke="#d7e5e9" stroke-opacity=".75" stroke-width="1.2"/>
      <path d="M14 40 Q38 34 62 40 L62 83 Q38 89 14 83Z" fill="url(#carPaint-${slotId})" stroke="#ffffff" stroke-opacity=".2"/>
      <path d="M17 45 Q38 41 59 45 L59 77 Q38 81 17 77Z" fill="url(#glass-${slotId})" stroke="#c6dce2" stroke-opacity=".65" stroke-width="1.1"/>
      <path d="M17 88 L59 88 L54 111 Q38 118 22 111Z" fill="url(#glass-${slotId})" stroke="#d7e5e9" stroke-opacity=".65" stroke-width="1.2"/>
      <path d="M23 5 L28 2 H48 L53 5" fill="none" stroke="#f4f5e9" stroke-width="2" stroke-linecap="round"/>
      <path d="M9 29 L15 31 M67 29 L61 31" stroke="#e9f2e9" stroke-width="3" stroke-linecap="round"/>
      <path d="M9 105 L15 103 M67 105 L61 103" stroke="#f0d08a" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M25 121 Q38 126 51 121" fill="none" stroke="#e86c5d" stroke-width="3" stroke-linecap="round"/>
      <path d="M28 53 L28 70 M48 53 L48 70" stroke="#d7e5e9" stroke-opacity=".35" stroke-width="1"/>
    </svg>`;
}

function bikeSvg(color, slotId) {
  return `
    <svg viewBox="0 0 64 132" role="img" aria-label="Top view motorcycle" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bikePaint-${slotId}" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#ffffff" stop-opacity=".45"/><stop offset=".4" stop-color="${color}"/><stop offset="1" stop-color="#101820"/></linearGradient>
      </defs>
      <ellipse cx="32" cy="66" rx="12" ry="61" fill="#101519" opacity=".5"/>
      <rect x="24" y="4" width="16" height="26" rx="7" fill="#11171b" stroke="#9aa8ad" stroke-width="1.5"/>
      <rect x="26" y="102" width="12" height="26" rx="6" fill="#11171b" stroke="#9aa8ad" stroke-width="1.5"/>
      <path d="M19 24 Q32 15 45 24 L43 42 Q32 49 21 42Z" fill="url(#bikePaint-${slotId})" stroke="#dce5e7" stroke-width="1.2"/>
      <path d="M21 43 Q32 37 43 43 L40 70 Q32 78 24 70Z" fill="#202d34" stroke="#aebdc1" stroke-width="1.2"/>
      <path d="M24 49 Q32 44 40 49 L38 67 Q32 72 26 67Z" fill="url(#bikePaint-${slotId})"/>
      <path d="M23 72 Q32 67 41 72 L43 91 Q32 99 21 91Z" fill="#202a30" stroke="#aebdc1" stroke-width="1.1"/>
      <path d="M19 25 L8 18 M45 25 L56 18" stroke="#c2cdd0" stroke-width="3" stroke-linecap="round"/>
      <path d="M8 18 L5 12 M56 18 L59 12" stroke="#11181c" stroke-width="4" stroke-linecap="round"/>
      <path d="M25 12 L39 12" stroke="#e5f1df" stroke-width="3" stroke-linecap="round"/>
      <circle cx="32" cy="19" r="4" fill="#f4d68d" stroke="#fff2c5"/>
      <path d="M24 91 Q32 96 40 91" stroke="#d6e0e2" stroke-width="2" fill="none"/>
      <circle cx="32" cy="113" r="3" fill="#e66d5e"/>
      <path d="M18 37 L13 41 M46 37 L51 41" stroke="#e6bd72" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
}

function vehicleIllustration(vehicle, slotId) {
  const palette = vehicle.type === 'bike' ? BIKE_COLORS : CAR_COLORS;
  const color = palette[(slotId - 1) % palette.length];
  return vehicle.type === 'bike' ? bikeSvg(color, slotId) : carSvg(color, slotId);
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function addActivity(message, type = 'entry') {
  activity.unshift({ message, type, time: new Date() });
  activity = activity.slice(0, 6);
  renderActivity();
}

function renderActivity() {
  $('activityCount').textContent = `${activity.length} ${activity.length === 1 ? 'event' : 'events'}`;
  if (!activity.length) {
    $('activityList').innerHTML = '<div class="empty-activity"><span class="empty-icon">↗</span><span>No activity yet. New arrivals will appear here.</span></div>';
    return;
  }
  $('activityList').innerHTML = activity.map(item => `
    <div class="activity-item">
      <span class="activity-bullet ${item.type === 'exit' ? 'exit' : ''}"></span>
      <span class="activity-main">${item.message}</span>
      <span class="activity-time">${item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>`).join('');
}

function renderStats() {
  const occupied = slots.filter(slot => slot.vehicle).length;
  const available = TOTAL_SLOTS - occupied;
  const percent = Math.round(occupied / TOTAL_SLOTS * 100);
  $('totalCount').textContent = TOTAL_SLOTS;
  $('availableCount').textContent = available;
  $('occupiedCount').textContent = occupied;
  $('occupancyPercent').textContent = `${percent}%`;
  $('occupancyBar').style.width = `${percent}%`;
}

function slotMarkup(slot, query) {
  const vehicle = slot.vehicle;
  const highlighted = query && vehicle && vehicle.number.includes(query);
  const visual = vehicle
    ? `<span class="slot-vehicle">${vehicleIllustration(vehicle, slot.id)}</span><span class="slot-plate">${escapeHtml(vehicle.number)}</span><span class="slot-status">● OCCUPIED</span>`
    : '<span class="slot-empty-mark">P</span><span class="slot-status">AVAILABLE</span>';

  return `<button class="slot ${vehicle ? 'occupied' : ''} ${highlighted ? 'highlight' : ''}" data-slot="${slot.id}" aria-label="Slot ${slot.id}, ${vehicle ? `occupied by ${escapeHtml(vehicle.number)}` : 'available'}">
    <span class="slot-number">BAY ${String(slot.id).padStart(2, '0')}</span>
    ${visual}
  </button>`;
}

function renderSlots() {
  const query = normalisePlate($('searchInput').value);
  const visible = slots.filter(slot => {
    const matchesFilter = activeFilter === 'all' ||
      (activeFilter === 'available' && !slot.vehicle) ||
      (activeFilter === 'occupied' && !!slot.vehicle);
    const matchesSearch = !query || (slot.vehicle && slot.vehicle.number.includes(query));
    return matchesFilter && matchesSearch;
  });
  const visibleIds = new Set(visible.map(slot => slot.id));
  const renderRow = (start, end) => slots.slice(start - 1, end).map(slot => {
    if (!visibleIds.has(slot.id)) return '<div class="slot" style="visibility:hidden" aria-hidden="true"></div>';
    return slotMarkup(slot, query);
  }).join('');
  topRow.innerHTML = renderRow(1, 10);
  bottomRow.innerHTML = renderRow(11, 20);
  renderStats();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function openModal(id) {
  $(id).classList.add('open');
  $(id).setAttribute('aria-hidden', 'false');
}

function closeModal(id) {
  $(id).classList.remove('open');
  $(id).setAttribute('aria-hidden', 'true');
}

function openParkModal() {
  $('parkError').textContent = '';
  $('vehicleNumber').value = '';
  if (!slots.some(slot => !slot.vehicle)) {
    showToast('The parking lot is full.');
    return;
  }
  openModal('parkModal');
  setTimeout(() => $('vehicleNumber').focus(), 50);
}

function openVehicleDetails(slotId) {
  const slot = slots.find(item => item.id === slotId);
  if (!slot || !slot.vehicle) return;
  selectedSlotId = slotId;
  updateVehicleDetails();
  openModal('vehicleModal');
}

function updateVehicleDetails() {
  const slot = slots.find(item => item.id === selectedSlotId);
  if (!slot || !slot.vehicle) return;
  const vehicle = slot.vehicle;
  const duration = getDuration(vehicle);
  const bill = getBill(vehicle);
  $('detailSlot').textContent = `· ${String(slot.id).padStart(2, '0')}`;
  $('detailPlate').textContent = vehicle.number;
  $('detailType').textContent = vehicle.type === 'car' ? 'Car' : 'Bike';
  $('detailRate').textContent = `₹${RATES[vehicle.type]} / hour`;
  $('detailDuration').textContent = duration.label;
  $('detailCharge').textContent = `₹${bill.amount}`;
}

async function processExit() {
  const slot = slots.find(item => item.id === selectedSlotId);
  if (!slot || !slot.vehicle) return;
  try {
    const result = await apiRequest('/api/exit', 'POST', { reg: slot.vehicle.number });
    if (!result.success) {
      showToast(result.message);
      await refreshSlots();
      closeModal('vehicleModal');
      return;
    }
    const hours = result.hours;
    const minutes = result.simulatedMinutes;
    const durationHours = Math.floor(minutes / 60);
    const durationMinutes = minutes % 60;
    $('receiptPlate').textContent = result.reg;
    $('receiptSlot').textContent = `#${String(result.slot).padStart(2, '0')}`;
    $('receiptDuration').textContent = `${durationHours}h ${durationMinutes}m (${hours} billed ${hours === 1 ? 'hour' : 'hours'})`;
    $('receiptRate').textContent = `₹${result.rate} / hour`;
    $('receiptTotal').textContent = `₹${result.amount}`;
    addActivity(`<strong>${escapeHtml(result.reg)}</strong> exited · ₹${result.amount} collected`, 'exit');
    closeModal('vehicleModal');
    await refreshSlots();
    openModal('receiptModal');
  } catch (error) {
    handleApiError(error);
  }
}

$('openParkModal').addEventListener('click', openParkModal);

$('parkForm').addEventListener('submit', async event => {
  event.preventDefault();
  const number = normalisePlate($('vehicleNumber').value);
  const type = document.querySelector('input[name="vehicleType"]:checked').value;
  const error = $('parkError');
  if (!number) {
    error.textContent = 'Enter a vehicle registration number.';
    return;
  }
  try {
    const result = await apiRequest('/api/park', 'POST', { reg: number, type });
    if (!result.success) {
      error.textContent = result.message;
      return;
    }
    await refreshSlots();
    addActivity(`<strong>${escapeHtml(number)}</strong> parked in space #${String(result.slot).padStart(2, '0')}`);
    closeModal('parkModal');
    $('searchInput').value = '';
    activeFilter = 'all';
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === 'all');
    });
    renderSlots();
    showToast(`${number} assigned to space #${String(result.slot).padStart(2, '0')}.`);
  } catch (error) {
    handleApiError(error);
  }
});

function handleSlotClick(event) {
  const button = event.target.closest('[data-slot]');
  if (button) openVehicleDetails(Number(button.dataset.slot));
}

topRow.addEventListener('click', handleSlotClick);
bottomRow.addEventListener('click', handleSlotClick);
$('exitVehicleBtn').addEventListener('click', processExit);
$('searchInput').addEventListener('input', renderSlots);

document.querySelectorAll('.filter-btn').forEach(button => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.toggle('active', btn === button));
  renderSlots();
}));

document.querySelectorAll('[data-close]').forEach(button => {
  button.addEventListener('click', () => closeModal(button.dataset.close));
});

document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', event => {
    if (event.target === backdrop) closeModal(backdrop.id);
  });
});

document.querySelectorAll('input[name="vehicleType"]').forEach(input => {
  input.addEventListener('change', () => {
    document.querySelectorAll('.type-option').forEach(option => {
      option.classList.toggle('selected', option.querySelector('input').checked);
    });
  });
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop.open').forEach(modal => closeModal(modal.id));
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    $('searchInput').focus();
  }
});

$('currentDate').textContent = new Date().toLocaleDateString('en-IN', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
});
$('lotCount').textContent = `${TOTAL_SLOTS} spaces`;
renderActivity();
refreshSlots().catch(handleApiError);
setInterval(() => {
  if (selectedSlotId && $('vehicleModal').classList.contains('open')) updateVehicleDetails();
}, 500);