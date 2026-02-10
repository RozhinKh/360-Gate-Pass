/**
 * Security Dashboard - Main Application
 * Handles check-in/check-out operations and active guest monitoring
 */

const API_BASE_URL = 'http://localhost:3000/api';

// ============================================================================
// API Module
// ============================================================================

const API = {
  /**
   * Get approved visits without passes
   */
  getApprovedVisits: async () => {
    const response = await fetch(`${API_BASE_URL}/visits/approved`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch approved visits');
    }
    
    return response.json();
  },

  /**
   * Issue a pass for a visit
   */
  issuePass: async (visitId) => {
    const response = await fetch(`${API_BASE_URL}/passes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ visitId })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to issue pass');
    }
    
    return response.json();
  },

  /**
   * Check in a guest using pass code
   */
  checkIn: async (passCode) => {
    const response = await fetch(`${API_BASE_URL}/passes/check-in`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ passCode })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Check-in failed');
    }
    
    return response.json();
  },

  /**
   * Check out a guest using pass code
   */
  checkOut: async (passCode) => {
    const response = await fetch(`${API_BASE_URL}/passes/check-out`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ passCode })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Check-out failed');
    }
    
    return response.json();
  },

  /**
   * Get active guests with optional search and pagination
   */
  getActiveGuests: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `${API_BASE_URL}/passes/active-guests${queryString ? '?' + queryString : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch active guests');
    }
    
    return response.json();
  }
};

// ============================================================================
// State Management
// ============================================================================

const state = {
  approvedVisits: [],
  activeGuests: [],
  selectedVisitForPass: null,
  currentSearchTerm: '',
  autoRefreshInterval: null
};

// ============================================================================
// UI Helpers
// ============================================================================

function showErrorAlert(message) {
  const alert = document.getElementById('errorAlert');
  const text = document.getElementById('errorAlertText');
  text.textContent = message;
  alert.classList.add('show');
  
  // Auto hide after 5 seconds
  setTimeout(() => {
    alert.classList.remove('show');
  }, 5000);
}

function closeErrorAlert() {
  document.getElementById('errorAlert').classList.remove('show');
}

function showSuccessMessage(message) {
  const msg = document.getElementById('successMessage');
  const text = document.getElementById('successText');
  text.textContent = message;
  msg.classList.add('show');
  
  // Auto hide after 4 seconds
  setTimeout(() => {
    msg.classList.remove('show');
  }, 4000);
}

function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// ============================================================================
// Section 1: Approved Visits & Pass Issuance
// ============================================================================

async function loadApprovedVisits() {
  try {
    showLoadingState('approvedVisits');
    const data = await API.getApprovedVisits();
    state.approvedVisits = data.visits || data || [];
    renderApprovedVisits();
  } catch (error) {
    console.error('Error loading approved visits:', error);
    showErrorAlert(error.message);
    showEmptyState('approvedVisits');
  }
}

function showLoadingState(section) {
  if (section === 'approvedVisits') {
    document.getElementById('approvedVisitsBody').innerHTML = '';
    document.getElementById('approvedVisitsEmpty').classList.add('hidden');
    document.getElementById('approvedVisitsLoading').classList.remove('hidden');
  } else if (section === 'activeGuests') {
    document.getElementById('activeGuestsBody').innerHTML = '';
    document.getElementById('activeGuestsEmpty').classList.add('hidden');
    document.getElementById('activeGuestsLoading').classList.remove('hidden');
  }
}

function showEmptyState(section) {
  if (section === 'approvedVisits') {
    document.getElementById('approvedVisitsBody').innerHTML = '';
    document.getElementById('approvedVisitsLoading').classList.add('hidden');
    document.getElementById('approvedVisitsEmpty').classList.remove('hidden');
  } else if (section === 'activeGuests') {
    document.getElementById('activeGuestsBody').innerHTML = '';
    document.getElementById('activeGuestsLoading').classList.add('hidden');
    document.getElementById('activeGuestsEmpty').classList.remove('hidden');
  }
}

function renderApprovedVisits() {
  const tbody = document.getElementById('approvedVisitsBody');
  
  if (!state.approvedVisits || state.approvedVisits.length === 0) {
    showEmptyState('approvedVisits');
    return;
  }
  
  document.getElementById('approvedVisitsLoading').classList.add('hidden');
  document.getElementById('approvedVisitsEmpty').classList.add('hidden');
  
  tbody.innerHTML = state.approvedVisits.map(visit => `
    <tr>
      <td>${escapeHtml(visit.guestName || 'N/A')}</td>
      <td>${escapeHtml(visit.hostName || 'N/A')}</td>
      <td>${formatDate(visit.visitDate)}</td>
      <td>${escapeHtml(visit.purpose || 'N/A')}</td>
      <td>
        <button 
          class="primary-button" 
          onclick="openPassModal(${visit.visitId}, '${escapeHtml(visit.guestName || '')}', '${escapeHtml(visit.hostName || '')}')"
        >
          Issue Pass
        </button>
      </td>
    </tr>
  `).join('');
}

function openPassModal(visitId, guestName, hostName) {
  state.selectedVisitForPass = visitId;
  document.getElementById('modalGuestName').textContent = guestName;
  document.getElementById('modalHostName').textContent = hostName;
  document.getElementById('passCodeDisplay').classList.add('hidden');
  document.getElementById('modalConfirmBtn').disabled = false;
  document.getElementById('modalConfirmBtn').textContent = 'Issue Pass';
  document.getElementById('confirmSpinner').classList.remove('active');
  document.getElementById('passModal').classList.remove('hidden');
}

function closePassModal() {
  document.getElementById('passModal').classList.add('hidden');
  state.selectedVisitForPass = null;
}

document.getElementById('modalCancelBtn')?.addEventListener('click', closePassModal);

document.getElementById('modalConfirmBtn')?.addEventListener('click', async () => {
  if (!state.selectedVisitForPass) return;
  
  const btn = document.getElementById('modalConfirmBtn');
  const spinner = document.getElementById('confirmSpinner');
  
  btn.disabled = true;
  spinner.classList.add('active');
  
  try {
    const data = await API.issuePass(state.selectedVisitForPass);
    const passCode = data.passCode || data.pass_code || '';
    
    // Display the generated pass code
    document.getElementById('generatedPassCode').textContent = passCode;
    document.getElementById('passCodeDisplay').classList.remove('hidden');
    document.getElementById('modalConfirmBtn').style.display = 'none';
    document.getElementById('modalCancelBtn').textContent = 'Close';
    
    showSuccessMessage(`Pass issued successfully with code: ${passCode}`);
    
    // Reload approved visits after a short delay
    setTimeout(() => {
      loadApprovedVisits();
    }, 1500);
  } catch (error) {
    console.error('Error issuing pass:', error);
    showErrorAlert(error.message);
    btn.disabled = false;
    spinner.classList.remove('active');
  }
});

document.getElementById('copyPassBtn')?.addEventListener('click', function() {
  const passCode = document.getElementById('generatedPassCode').textContent;
  navigator.clipboard.writeText(passCode).then(() => {
    const btn = this;
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    
    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove('copied');
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
    showErrorAlert('Failed to copy pass code');
  });
});

// ============================================================================
// Section 2: Check-In/Check-Out Interface
// ============================================================================

function validatePassCode(code) {
  const cleanCode = code.trim();
  // Valid: 6-8 digits
  return /^\d{6,8}$/.test(cleanCode);
}

function clearCheckInForm() {
  document.getElementById('passCodeInput').value = '';
  document.getElementById('passCodeError').textContent = '';
  document.getElementById('passCodeInput').classList.remove('error');
  document.getElementById('passValidationFeedback').classList.add('hidden');
  document.getElementById('operationSuccess').classList.add('hidden');
  document.getElementById('validationSuccess').classList.add('hidden');
  document.getElementById('validationError').classList.add('hidden');
}

async function performCheckIn() {
  const passCode = document.getElementById('passCodeInput').value.trim();
  const errorEl = document.getElementById('passCodeError');
  const btn = document.getElementById('checkInBtn');
  const spinner = document.getElementById('checkInSpinner');
  
  // Validate format
  if (!validatePassCode(passCode)) {
    errorEl.textContent = 'Pass code must be 6-8 digits';
    document.getElementById('passCodeInput').classList.add('error');
    return;
  }
  
  document.getElementById('passCodeInput').classList.remove('error');
  errorEl.textContent = '';
  
  btn.disabled = true;
  spinner.classList.add('active');
  
  try {
    const data = await API.checkIn(passCode);
    
    // Show success message
    showSuccessMessage('Guest checked in successfully');
    
    // Display operation details
    displayOperationSuccess('Check-In', data);
    
    // Clear form after brief delay
    setTimeout(clearCheckInForm, 2000);
    
    // Refresh active guests list
    await loadActiveGuests();
  } catch (error) {
    console.error('Check-in error:', error);
    errorEl.textContent = error.message;
    document.getElementById('passCodeInput').classList.add('error');
  } finally {
    btn.disabled = false;
    spinner.classList.remove('active');
  }
}

async function performCheckOut() {
  const passCode = document.getElementById('passCodeInput').value.trim();
  const errorEl = document.getElementById('passCodeError');
  const btn = document.getElementById('checkOutBtn');
  const spinner = document.getElementById('checkOutSpinner');
  
  // Validate format
  if (!validatePassCode(passCode)) {
    errorEl.textContent = 'Pass code must be 6-8 digits';
    document.getElementById('passCodeInput').classList.add('error');
    return;
  }
  
  document.getElementById('passCodeInput').classList.remove('error');
  errorEl.textContent = '';
  
  btn.disabled = true;
  spinner.classList.add('active');
  
  try {
    const data = await API.checkOut(passCode);
    
    // Show success message
    showSuccessMessage('Guest checked out successfully');
    
    // Display operation details
    displayOperationSuccess('Check-Out', data);
    
    // Clear form after brief delay
    setTimeout(clearCheckInForm, 2000);
    
    // Refresh active guests list
    await loadActiveGuests();
  } catch (error) {
    console.error('Check-out error:', error);
    errorEl.textContent = error.message;
    document.getElementById('passCodeInput').classList.add('error');
  } finally {
    btn.disabled = false;
    spinner.classList.remove('active');
  }
}

function displayOperationSuccess(operationType, data) {
  const successDiv = document.getElementById('operationSuccess');
  const opMsg = document.getElementById('operationMessage');
  const guestName = document.getElementById('opGuestName');
  const hostName = document.getElementById('opHostName');
  const passCode = document.getElementById('opPassCode');
  const checkInDiv = document.getElementById('opCheckInTime');
  const checkOutDiv = document.getElementById('opCheckOutTime');
  const checkInVal = document.getElementById('opCheckInValue');
  const checkOutVal = document.getElementById('opCheckOutValue');
  
  opMsg.textContent = `${operationType} successful at ${formatDateTime(new Date())}`;
  guestName.textContent = data.guestName || data.guest_name || 'N/A';
  hostName.textContent = data.hostName || data.host_name || 'N/A';
  passCode.textContent = data.passCode || data.pass_code || 'N/A';
  
  if (operationType === 'Check-In' && data.entryTime) {
    checkInDiv.classList.remove('hidden');
    checkOutDiv.classList.add('hidden');
    checkInVal.textContent = formatDateTime(data.entryTime);
  } else if (operationType === 'Check-Out' && data.exitTime) {
    checkOutDiv.classList.remove('hidden');
    checkInDiv.classList.add('hidden');
    checkOutVal.textContent = formatDateTime(data.exitTime);
  } else {
    checkInDiv.classList.add('hidden');
    checkOutDiv.classList.add('hidden');
  }
  
  successDiv.classList.remove('hidden');
}

document.getElementById('checkInBtn')?.addEventListener('click', performCheckIn);
document.getElementById('checkOutBtn')?.addEventListener('click', performCheckOut);

// Allow Enter key to trigger check-in
document.getElementById('passCodeInput')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    performCheckIn();
  }
});

// ============================================================================
// Section 3: Active Guests Monitor
// ============================================================================

async function loadActiveGuests() {
  try {
    showLoadingState('activeGuests');
    const params = {};
    
    if (state.currentSearchTerm) {
      params.search = state.currentSearchTerm;
    }
    
    const data = await API.getActiveGuests(params);
    state.activeGuests = data.activeGuests || data.data || [];
    renderActiveGuests();
  } catch (error) {
    console.error('Error loading active guests:', error);
    showErrorAlert(error.message);
    showEmptyState('activeGuests');
  }
}

function renderActiveGuests() {
  const tbody = document.getElementById('activeGuestsBody');
  
  if (!state.activeGuests || state.activeGuests.length === 0) {
    showEmptyState('activeGuests');
    return;
  }
  
  document.getElementById('activeGuestsLoading').classList.add('hidden');
  document.getElementById('activeGuestsEmpty').classList.add('hidden');
  
  tbody.innerHTML = state.activeGuests.map(guest => `
    <tr>
      <td>${escapeHtml(guest.guestName || guest.guest_name || 'N/A')}</td>
      <td>${escapeHtml(guest.hostName || guest.host_name || 'N/A')}</td>
      <td><span class="success-badge">${escapeHtml(guest.passCode || guest.pass_code || 'N/A')}</span></td>
      <td>${formatDateTime(guest.entryTime || guest.entry_time)}</td>
      <td>${escapeHtml(guest.purpose || guest.visit_purpose || 'N/A')}</td>
    </tr>
  `).join('');
}

// Search functionality with debounce
let searchTimeout;
document.getElementById('activeGuestsSearch')?.addEventListener('input', (e) => {
  state.currentSearchTerm = e.target.value;
  
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadActiveGuests();
  }, 300);
});

// Manual refresh button
document.getElementById('manualRefreshBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('manualRefreshBtn');
  btn.style.opacity = '0.5';
  btn.style.pointerEvents = 'none';
  
  await loadActiveGuests();
  
  setTimeout(() => {
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
  }, 500);
});

// ============================================================================
// Auto-Refresh Mechanism (30 seconds)
// ============================================================================

function startAutoRefresh() {
  // Refresh immediately, then every 30 seconds
  loadActiveGuests();
  
  state.autoRefreshInterval = setInterval(() => {
    loadActiveGuests();
  }, 30000); // 30 seconds
}

function stopAutoRefresh() {
  if (state.autoRefreshInterval) {
    clearInterval(state.autoRefreshInterval);
    state.autoRefreshInterval = null;
  }
}

// ============================================================================
// Authentication & Authorization
// ============================================================================

async function checkAuthAndRole() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      redirectToLogin();
      return false;
    }
    
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      redirectToLogin();
      return false;
    }
    
    const user = await response.json();
    
    // Check if user has Security role
    if (user.role !== 'Security') {
      showErrorAlert('You do not have permission to access this page');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Auth check failed:', error);
    redirectToLogin();
    return false;
  }
}

function redirectToLogin() {
  window.location.href = '/frontend/pages/login.html';
}

// ============================================================================
// Logout
// ============================================================================

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  try {
    const token = localStorage.getItem('token');
    if (token) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    window.location.href = '/frontend/pages/login.html';
  }
});

// ============================================================================
// Utility Functions
// ============================================================================

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication and role
  const authorized = await checkAuthAndRole();
  if (!authorized) return;
  
  // Load initial data
  await loadApprovedVisits();
  await loadActiveGuests();
  
  // Start auto-refresh for active guests
  startAutoRefresh();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
  });
});
