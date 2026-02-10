/**
 * Frontend Test Setup
 * Configures jsdom environment and provides testing utilities for vanilla JavaScript
 */

// Mock localStorage
const localStorageMock = (() => {
  let store = {};

  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store = {};

  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock fetch globally
global.fetch = jest.fn();

// Mock window.location
delete window.location;
window.location = { href: '', pathname: '', reload: jest.fn(), replace: jest.fn() };

/**
 * Utility function to set up a DOM form element with specific fields
 * @param {string} formId - ID of the form element
 * @param {Object} fields - Object with field names and types
 * @returns {HTMLFormElement} - The created form element
 */
global.createMockForm = (formId, fields) => {
  const form = document.createElement('form');
  form.id = formId;

  Object.entries(fields).forEach(([name, type]) => {
    const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
    input.name = name;
    input.id = name;
    input.type = type !== 'textarea' ? type : 'text';
    form.appendChild(input);
  });

  // Add submit button
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Submit';
  form.appendChild(submitBtn);

  document.body.appendChild(form);
  return form;
};

/**
 * Utility function to populate form fields
 * @param {HTMLFormElement} form - The form element
 * @param {Object} data - Object with field names and values
 */
global.populateForm = (form, data) => {
  Object.entries(data).forEach(([name, value]) => {
    const field = form.elements[name];
    if (field) {
      field.value = value;
    }
  });
};

/**
 * Utility function to create an error container
 * @param {string} containerId - ID of the error container
 * @returns {HTMLElement} - The created error container
 */
global.createErrorContainer = (containerId) => {
  const container = document.createElement('div');
  container.id = containerId;
  container.className = 'error-messages';
  document.body.appendChild(container);
  return container;
};

/**
 * Utility function to create a success message container
 * @param {string} containerId - ID of the success message container
 * @returns {HTMLElement} - The created container
 */
global.createSuccessContainer = (containerId) => {
  const container = document.createElement('div');
  container.id = containerId;
  container.className = 'success-messages';
  document.body.appendChild(container);
  return container;
};

/**
 * Utility function to create role-based UI elements
 * @param {string} role - User role (Guest, Host, Security, Admin)
 * @returns {Object} - Object with visibility indicators for each dashboard section
 */
global.createRoleBasedUI = (role) => {
  const container = document.createElement('div');
  container.id = 'dashboard';
  container.dataset.userRole = role;

  // Create common elements
  const header = document.createElement('header');
  header.id = 'app-header';
  header.innerHTML = `<h1>Dashboard</h1><span class="user-role">${role}</span>`;
  container.appendChild(header);

  // Create role-specific sections
  if (role === 'Guest') {
    const visitForm = document.createElement('section');
    visitForm.id = 'visit-request-form-section';
    visitForm.innerHTML = '<h2>Submit Visit Request</h2>';
    container.appendChild(visitForm);

    const visitsList = document.createElement('section');
    visitsList.id = 'my-visits-section';
    visitsList.innerHTML = '<h2>My Visits</h2><div id="visits-list"></div>';
    container.appendChild(visitsList);
  } else if (role === 'Host') {
    const pendingSection = document.createElement('section');
    pendingSection.id = 'pending-requests-section';
    pendingSection.innerHTML = '<h2>Pending Requests</h2><div id="pending-list"></div>';
    container.appendChild(pendingSection);

    const approvedSection = document.createElement('section');
    approvedSection.id = 'approved-requests-section';
    approvedSection.innerHTML = '<h2>Approved Requests</h2><div id="approved-list"></div>';
    container.appendChild(approvedSection);
  } else if (role === 'Security') {
    const approvedSection = document.createElement('section');
    approvedSection.id = 'approved-visits-section';
    approvedSection.innerHTML = '<h2>Approved Visits</h2><div id="approved-visits-list"></div>';
    container.appendChild(approvedSection);

    const passSection = document.createElement('section');
    passSection.id = 'issue-pass-section';
    passSection.innerHTML = '<h2>Issue Pass</h2><form id="issue-pass-form"></form>';
    container.appendChild(passSection);

    const activeSection = document.createElement('section');
    activeSection.id = 'active-guests-section';
    activeSection.innerHTML = '<h2>Active Guests</h2><div id="active-guests-list"></div>';
    container.appendChild(activeSection);
  } else if (role === 'Admin') {
    const usersSection = document.createElement('section');
    usersSection.id = 'user-management-section';
    usersSection.innerHTML = '<h2>User Management</h2><div id="users-list"></div>';
    container.appendChild(usersSection);

    const reportsSection = document.createElement('section');
    reportsSection.id = 'reports-section';
    reportsSection.innerHTML = '<h2>System Reports</h2><div id="reports-container"></div>';
    container.appendChild(reportsSection);
  }

  document.body.appendChild(container);
  return container;
};

/**
 * Reset mocks between tests
 */
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = '';
  global.fetch.mockClear();
  document.body.innerHTML = '';
});

/**
 * Mock API response helper
 * @param {number} status - HTTP status code
 * @param {Object} data - Response data
 * @param {boolean} ok - Whether the response is ok
 * @returns {Promise} - Resolved promise with Response object
 */
global.mockFetchResponse = (status = 200, data = {}, ok = true) => {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      ok,
      headers: { 'Content-Type': 'application/json' },
    })
  );
};

/**
 * Mock fetch rejection helper
 * @param {string} message - Error message
 * @returns {Promise} - Rejected promise with error
 */
global.mockFetchError = (message = 'Network error') => {
  return Promise.reject(new Error(message));
};
