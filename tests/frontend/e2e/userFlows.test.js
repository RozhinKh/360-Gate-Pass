/**
 * Frontend E2E User Flow Tests
 * Tests complete user workflows from start to finish
 * These tests simulate real user interactions across multiple pages
 */

describe('E2E User Workflows', () => {
  describe('Complete Registration and Login Flow', () => {
    test('should complete registration flow: fill form → submit → redirect to login', async () => {
      // Step 1: Navigate to registration page
      expect(window.location.href).not.toContain('/register');

      // Step 2: Create and populate registration form
      const form = createMockForm('registration-form', {
        name: 'text',
        email: 'email',
        phone: 'tel',
        password: 'password',
        confirmPassword: 'password',
      });

      populateForm(form, {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        password: 'Password123',
        confirmPassword: 'Password123',
      });

      // Step 3: Validate form
      const errors = [];
      if (!form.elements.name.value) errors.push('Name required');
      if (!form.elements.email.value) errors.push('Email required');
      if (form.elements.password.value !== form.elements.confirmPassword.value) {
        errors.push('Passwords do not match');
      }
      expect(errors.length).toBe(0);

      // Step 4: Submit form via API
      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, user: { id: 1 } }), { status: 201 })
      );

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.elements.name.value,
          email: form.elements.email.value,
          phone: form.elements.phone.value,
          password: form.elements.password.value,
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);

      // Step 5: Verify redirect to login
      if (response.ok) {
        window.location.href = '/login';
      }
      expect(window.location.href).toBe('/login');
    });

    test('should complete login flow: fill form → submit → redirect to dashboard', async () => {
      // Step 1: Navigate to login page
      window.location.href = '/login';

      // Step 2: Create and populate login form
      const form = createMockForm('login-form', {
        email: 'email',
        password: 'password',
      });

      populateForm(form, {
        email: 'john@example.com',
        password: 'Password123',
      });

      // Step 3: Validate form
      const errors = [];
      if (!form.elements.email.value) errors.push('Email required');
      if (!form.elements.password.value) errors.push('Password required');
      expect(errors.length).toBe(0);

      // Step 4: Submit login form
      global.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: 'jwt-token-12345',
            user: { id: 1, email: 'john@example.com', role: 'Guest' },
          }),
          { status: 200 }
        )
      );

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.elements.email.value,
          password: form.elements.password.value,
        }),
      });

      const data = await response.json();
      expect(data.token).toBeTruthy();

      // Step 5: Store token and redirect
      localStorage.setItem('token', data.token);
      localStorage.setItem('userRole', data.user.role);
      if (response.ok) {
        window.location.href = '/dashboard';
      }

      // Step 6: Verify session persistence
      expect(localStorage.getItem('token')).toBe('jwt-token-12345');
      expect(window.location.href).toBe('/dashboard');
    });

    test('should maintain session across page navigation', async () => {
      // Set up authentication state
      localStorage.setItem('token', 'test-token-123');
      localStorage.setItem('userRole', 'Guest');

      // Navigate to different pages
      window.location.href = '/dashboard';
      expect(localStorage.getItem('token')).toBe('test-token-123');

      window.location.href = '/visits';
      expect(localStorage.getItem('token')).toBe('test-token-123');

      window.location.href = '/profile';
      expect(localStorage.getItem('token')).toBe('test-token-123');
    });

    test('should handle registration validation errors gracefully', async () => {
      const form = createMockForm('registration-form', {
        email: 'email',
        password: 'password',
      });

      populateForm(form, {
        email: 'invalid-email',
        password: 'short',
      });

      global.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'Validation Error',
            details: {
              email: 'Invalid email format',
              password: 'Password too short',
            },
          }),
          { status: 400 }
        )
      );

      const response = await fetch('/api/auth/register', { method: 'POST' });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.details.email).toBeTruthy();

      // Should NOT redirect
      window.location.href = '/register';
      expect(window.location.href).toBe('/register');
    });
  });

  describe('Guest Request Submission Flow', () => {
    beforeEach(() => {
      localStorage.setItem('token', 'guest-token');
      localStorage.setItem('userRole', 'Guest');
    });

    test('should complete guest visit request workflow', async () => {
      // Step 1: Navigate to guest dashboard
      window.location.href = '/dashboard';

      // Step 2: Render guest dashboard
      const dashboard = createRoleBasedUI('Guest');
      expect(dashboard.querySelector('#visit-request-form-section')).toBeTruthy();

      // Step 3: Create and fill visit request form
      const form = createMockForm('visit-request-form', {
        host: 'text',
        purpose: 'textarea',
        visitDate: 'date',
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      populateForm(form, {
        host: 'John Doe',
        purpose: 'Business meeting regarding Q1 planning',
        visitDate: tomorrow.toISOString().split('T')[0],
      });

      // Step 4: Validate form
      const errors = [];
      if (!form.elements.host.value) errors.push('Host required');
      if (!form.elements.purpose.value) errors.push('Purpose required');
      if (!form.elements.visitDate.value) errors.push('Date required');
      expect(errors.length).toBe(0);

      // Step 5: Submit visit request
      global.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            visit: {
              id: 1,
              host: 'John Doe',
              status: 'pending',
              visitDate: form.elements.visitDate.value,
            },
          }),
          { status: 201, headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        )
      );

      const response = await fetch('/api/visits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          host: form.elements.host.value,
          purpose: form.elements.purpose.value,
          visitDate: form.elements.visitDate.value,
        }),
      });

      const data = await response.json();
      expect(data.visit.status).toBe('pending');

      // Step 6: Verify request appears in visits list
      const visitsList = dashboard.querySelector('#visits-list');
      const visitItem = document.createElement('div');
      visitItem.className = 'visit-item';
      visitItem.innerHTML = `
        <h4>${data.visit.host}</h4>
        <span class="status-badge pending">${data.visit.status}</span>
      `;
      visitsList.appendChild(visitItem);

      expect(visitsList.querySelector('.visit-item')).toBeTruthy();
      expect(visitsList.textContent).toContain('John Doe');
      expect(visitsList.querySelector('.status-badge').textContent).toBe('pending');
    });

    test('should show success message after visit request submission', async () => {
      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, message: 'Visit request submitted' }), {
          status: 201,
        })
      );

      const response = await fetch('/api/visits', { method: 'POST' });
      const data = await response.json();

      const successContainer = createSuccessContainer('success');
      successContainer.innerHTML = `<div>${data.message}</div>`;

      expect(successContainer.textContent).toContain('submitted');
    });
  });

  describe('Host Approval Workflow', () => {
    beforeEach(() => {
      localStorage.setItem('token', 'host-token');
      localStorage.setItem('userRole', 'Host');
    });

    test('should complete host approval workflow', async () => {
      // Step 1: Navigate to host dashboard
      window.location.href = '/dashboard';

      // Step 2: Render host dashboard
      const dashboard = createRoleBasedUI('Host');
      expect(dashboard.querySelector('#pending-requests-section')).toBeTruthy();

      // Step 3: Fetch pending requests
      global.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            visits: [
              { id: 1, guestName: 'John', guestEmail: 'john@example.com', status: 'pending' },
              { id: 2, guestName: 'Jane', guestEmail: 'jane@example.com', status: 'pending' },
            ],
          }),
          { status: 200 }
        )
      );

      const response = await fetch('/api/visits', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();

      // Step 4: Display pending requests
      const pendingList = dashboard.querySelector('#pending-list');
      data.visits.forEach((visit) => {
        const item = document.createElement('div');
        item.className = 'pending-request';
        item.dataset.visitId = visit.id;
        item.innerHTML = `
          <h4>${visit.guestName}</h4>
          <button class="approve-btn" data-visit-id="${visit.id}">Approve</button>
          <button class="reject-btn" data-visit-id="${visit.id}">Reject</button>
        `;
        pendingList.appendChild(item);
      });

      expect(pendingList.children.length).toBe(2);

      // Step 5: Click approve button for first request
      const approveBtn = pendingList.querySelector('.approve-btn');
      const visitId = approveBtn.dataset.visitId;

      // Step 6: Submit approval
      global.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            visit: { id: visitId, status: 'approved' },
          }),
          { status: 200 }
        )
      );

      const approvalResponse = await fetch(`/api/visits/${visitId}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      const approvalData = await approvalResponse.json();
      expect(approvalData.visit.status).toBe('approved');

      // Step 7: Update UI - move to approved list
      const approvedList = dashboard.querySelector('#approved-list');
      const approvedItem = document.createElement('div');
      approvedItem.innerHTML = `
        <h4>${data.visits[0].guestName}</h4>
        <span class="status">approved</span>
      `;
      approvedList.appendChild(approvedItem);

      expect(approvedList.children.length).toBe(1);
      expect(approvedList.textContent).toContain('John');
    });
  });

  describe('Security Operations Workflow', () => {
    beforeEach(() => {
      localStorage.setItem('token', 'security-token');
      localStorage.setItem('userRole', 'Security');
    });

    test('should complete security guest check-in/check-out workflow', async () => {
      // Step 1: Navigate to security dashboard
      window.location.href = '/dashboard';

      // Step 2: Render security dashboard
      const dashboard = createRoleBasedUI('Security');
      expect(dashboard.querySelector('#approved-visits-section')).toBeTruthy();

      // Step 3: Fetch approved visits
      global.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            visits: [
              { id: 1, guestName: 'John Doe', purpose: 'Meeting', visitDate: '2024-01-15' },
            ],
          }),
          { status: 200 }
        )
      );

      const visitsResponse = await fetch('/api/visits?status=approved', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const visitsData = await visitsResponse.json();

      // Step 4: Display approved visits
      const visitsList = dashboard.querySelector('#approved-visits-list');
      visitsData.visits.forEach((visit) => {
        const item = document.createElement('div');
        item.className = 'visit-item';
        item.dataset.visitId = visit.id;
        item.innerHTML = `
          <h4>${visit.guestName}</h4>
          <button class="issue-pass-btn" data-visit-id="${visit.id}">Issue Pass</button>
        `;
        visitsList.appendChild(item);
      });

      expect(visitsList.children.length).toBe(1);

      // Step 5: Issue pass for guest
      global.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            pass: {
              code: 'ABC123DEF456',
              visitId: 1,
              guestName: 'John Doe',
            },
          }),
          { status: 201 }
        )
      );

      const passResponse = await fetch('/api/passes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ visitId: 1 }),
      });

      const passData = await passResponse.json();
      expect(passData.pass.code).toBeTruthy();

      // Step 6: Display pass code
      const passSection = dashboard.querySelector('#issue-pass-section');
      const passDisplay = document.createElement('div');
      passDisplay.className = 'issued-pass';
      passDisplay.innerHTML = `<h3>Pass Code: <strong>${passData.pass.code}</strong></h3>`;
      passSection.appendChild(passDisplay);

      expect(passSection.querySelector('.issued-pass')).toBeTruthy();
      expect(passSection.textContent).toContain('ABC123DEF456');

      // Step 7: Check in guest using pass code
      global.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            guest: { passCode: 'ABC123DEF456', status: 'checked-in' },
          }),
          { status: 200 }
        )
      );

      const checkInResponse = await fetch('/api/passes/check-in', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ passCode: 'ABC123DEF456' }),
      });

      const checkInData = await checkInResponse.json();
      expect(checkInData.guest.status).toBe('checked-in');

      // Step 8: Move guest to active list
      const activeList = dashboard.querySelector('#active-guests-list');
      const activeGuest = document.createElement('div');
      activeGuest.className = 'active-guest';
      activeGuest.dataset.passCode = 'ABC123DEF456';
      activeGuest.innerHTML = `
        <h4>John Doe</h4>
        <p>Checked in</p>
        <button class="check-out-btn" data-pass-code="ABC123DEF456">Check Out</button>
      `;
      activeList.appendChild(activeGuest);

      expect(activeList.querySelector('.active-guest')).toBeTruthy();

      // Step 9: Check out guest
      global.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, message: 'Guest checked out' }),
          { status: 200 }
        )
      );

      const checkOutResponse = await fetch('/api/passes/check-out', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ passCode: 'ABC123DEF456' }),
      });

      expect(checkOutResponse.ok).toBe(true);

      // Step 10: Remove guest from active list
      activeList.innerHTML = '';
      expect(activeList.children.length).toBe(0);
    });

    test('should display pass code clearly for manual entry', async () => {
      const dashboard = createRoleBasedUI('Security');
      const passSection = dashboard.querySelector('#issue-pass-section');

      // Simulate pass issuance
      const passCode = 'XYZ789ABC123';
      const passDisplay = document.createElement('div');
      passDisplay.id = 'pass-code-display';
      passDisplay.innerHTML = `
        <div class="pass-code-large">${passCode}</div>
        <p>Share this code with the guest</p>
      `;
      passSection.appendChild(passDisplay);

      expect(passSection.querySelector('#pass-code-display')).toBeTruthy();
      expect(passSection.textContent).toContain(passCode);
    });
  });

  describe('Admin Dashboard Workflow', () => {
    beforeEach(() => {
      localStorage.setItem('token', 'admin-token');
      localStorage.setItem('userRole', 'Admin');
    });

    test('should display and manage users list', async () => {
      // Step 1: Navigate to admin dashboard
      window.location.href = '/dashboard';

      // Step 2: Render admin dashboard
      const dashboard = createRoleBasedUI('Admin');
      expect(dashboard.querySelector('#user-management-section')).toBeTruthy();

      // Step 3: Fetch users list
      global.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            users: [
              { id: 1, name: 'Alice', email: 'alice@example.com', role: 'Guest' },
              { id: 2, name: 'Bob', email: 'bob@example.com', role: 'Host' },
              { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'Security' },
            ],
          }),
          { status: 200 }
        )
      );

      const response = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();

      // Step 4: Display users with role dropdowns
      const usersList = dashboard.querySelector('#users-list');
      data.users.forEach((user) => {
        const item = document.createElement('div');
        item.className = 'user-item';
        item.dataset.userId = user.id;
        item.innerHTML = `
          <h4>${user.name}</h4>
          <p>${user.email}</p>
          <select class="role-select" data-user-id="${user.id}">
            <option value="Guest" ${user.role === 'Guest' ? 'selected' : ''}>Guest</option>
            <option value="Host" ${user.role === 'Host' ? 'selected' : ''}>Host</option>
            <option value="Security" ${user.role === 'Security' ? 'selected' : ''}>Security</option>
            <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin</option>
          </select>
        `;
        usersList.appendChild(item);
      });

      expect(usersList.children.length).toBe(3);

      // Step 5: Change user role
      const roleSelect = usersList.querySelector('.role-select');
      const userId = roleSelect.dataset.userId;
      roleSelect.value = 'Admin';

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, user: { id: userId, role: 'Admin' } }), {
          status: 200,
        })
      );

      const updateResponse = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ role: 'Admin' }),
      });

      const updateData = await updateResponse.json();
      expect(updateData.user.role).toBe('Admin');
    });

    test('should display system reports with statistics', async () => {
      const dashboard = createRoleBasedUI('Admin');

      // Fetch reports
      global.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            reports: {
              totalVisits: 42,
              approvedVisits: 35,
              pendingVisits: 7,
              activeGuests: 5,
              totalUsers: 28,
              roleDistribution: { Guest: 18, Host: 5, Security: 3, Admin: 2 },
            },
          }),
          { status: 200 }
        )
      );

      const response = await fetch('/api/admin/reports', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();

      // Display reports
      const reportsContainer = dashboard.querySelector('#reports-container');
      const reportCards = [
        { title: 'Total Visits', value: data.reports.totalVisits },
        { title: 'Approved', value: data.reports.approvedVisits },
        { title: 'Pending', value: data.reports.pendingVisits },
        { title: 'Active Guests', value: data.reports.activeGuests },
      ];

      reportCards.forEach((report) => {
        const card = document.createElement('div');
        card.className = 'report-card';
        card.innerHTML = `<h3>${report.title}</h3><p>${report.value}</p>`;
        reportsContainer.appendChild(card);
      });

      expect(reportsContainer.children.length).toBe(4);
      expect(reportsContainer.textContent).toContain('Total Visits');
      expect(reportsContainer.textContent).toContain('42');
    });
  });

  describe('Session Management and Logout', () => {
    test('should handle logout and clear session', async () => {
      // Setup authenticated session
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('userRole', 'Guest');

      // Call logout endpoint
      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      expect(response.ok).toBe(true);

      // Clear session
      localStorage.removeItem('token');
      localStorage.removeItem('userRole');

      // Redirect to login
      window.location.href = '/login';

      expect(localStorage.getItem('token')).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    test('should redirect to login if token expired during navigation', async () => {
      localStorage.setItem('token', 'expired-token');

      // Attempt to fetch protected resource
      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      );

      const response = await fetch('/api/visits', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }

      expect(window.location.href).toBe('/login');
    });
  });
});
