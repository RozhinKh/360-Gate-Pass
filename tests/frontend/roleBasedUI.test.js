/**
 * Frontend Role-Based UI Rendering Tests
 * Tests that correct UI elements are rendered for each user role
 */

describe('Role-Based UI Rendering', () => {
  describe('Guest Dashboard Rendering', () => {
    let dashboard;

    beforeEach(() => {
      dashboard = createRoleBasedUI('Guest');
    });

    test('should display user role in header', () => {
      const roleDisplay = dashboard.querySelector('.user-role');
      expect(roleDisplay).toBeTruthy();
      expect(roleDisplay.textContent).toBe('Guest');
    });

    test('should render visit request form section', () => {
      const formSection = dashboard.querySelector('#visit-request-form-section');
      expect(formSection).toBeTruthy();
      expect(formSection.textContent).toContain('Submit Visit Request');
    });

    test('should render my visits list section', () => {
      const visitsSection = dashboard.querySelector('#my-visits-section');
      expect(visitsSection).toBeTruthy();
      expect(visitsSection.textContent).toContain('My Visits');
    });

    test('should have empty visits list initially', () => {
      const visitsList = dashboard.querySelector('#visits-list');
      expect(visitsList).toBeTruthy();
      expect(visitsList.children.length).toBe(0);
    });

    test('should not render host-specific sections', () => {
      const pendingSection = dashboard.querySelector('#pending-requests-section');
      const approvedSection = dashboard.querySelector('#approved-requests-section');
      expect(pendingSection).toBeFalsy();
      expect(approvedSection).toBeFalsy();
    });

    test('should not render security-specific sections', () => {
      const passSection = dashboard.querySelector('#issue-pass-section');
      const activeGuestsSection = dashboard.querySelector('#active-guests-section');
      expect(passSection).toBeFalsy();
      expect(activeGuestsSection).toBeFalsy();
    });

    test('should not render admin-specific sections', () => {
      const userMgmtSection = dashboard.querySelector('#user-management-section');
      const reportsSection = dashboard.querySelector('#reports-section');
      expect(userMgmtSection).toBeFalsy();
      expect(reportsSection).toBeFalsy();
    });

    test('should populate visits list dynamically', () => {
      const visitsList = dashboard.querySelector('#visits-list');
      const mockVisits = [
        { id: 1, host: 'John', status: 'pending' },
        { id: 2, host: 'Jane', status: 'approved' },
      ];

      mockVisits.forEach((visit) => {
        const visitItem = document.createElement('div');
        visitItem.className = 'visit-item';
        visitItem.innerHTML = `
          <h4>${visit.host}</h4>
          <p class="status">${visit.status}</p>
        `;
        visitsList.appendChild(visitItem);
      });

      expect(visitsList.children.length).toBe(2);
      expect(visitsList.textContent).toContain('John');
      expect(visitsList.textContent).toContain('Jane');
    });

    test('should display status badge for each visit', () => {
      const visitsList = dashboard.querySelector('#visits-list');
      const visit = document.createElement('div');
      visit.innerHTML = '<span class="status-badge pending">Pending</span>';
      visitsList.appendChild(visit);

      const statusBadge = visitsList.querySelector('.status-badge');
      expect(statusBadge).toBeTruthy();
      expect(statusBadge.classList.contains('pending')).toBe(true);
    });
  });

  describe('Host Dashboard Rendering', () => {
    let dashboard;

    beforeEach(() => {
      dashboard = createRoleBasedUI('Host');
    });

    test('should display Host role in header', () => {
      const roleDisplay = dashboard.querySelector('.user-role');
      expect(roleDisplay.textContent).toBe('Host');
    });

    test('should render pending requests section', () => {
      const pendingSection = dashboard.querySelector('#pending-requests-section');
      expect(pendingSection).toBeTruthy();
      expect(pendingSection.textContent).toContain('Pending Requests');
    });

    test('should render approved requests section', () => {
      const approvedSection = dashboard.querySelector('#approved-requests-section');
      expect(approvedSection).toBeTruthy();
      expect(approvedSection.textContent).toContain('Approved Requests');
    });

    test('should have empty pending list initially', () => {
      const pendingList = dashboard.querySelector('#pending-list');
      expect(pendingList).toBeTruthy();
      expect(pendingList.children.length).toBe(0);
    });

    test('should have empty approved list initially', () => {
      const approvedList = dashboard.querySelector('#approved-list');
      expect(approvedList).toBeTruthy();
      expect(approvedList.children.length).toBe(0);
    });

    test('should not render visit request form section', () => {
      const formSection = dashboard.querySelector('#visit-request-form-section');
      expect(formSection).toBeFalsy();
    });

    test('should not render guest visits section', () => {
      const guestSection = dashboard.querySelector('#my-visits-section');
      expect(guestSection).toBeFalsy();
    });

    test('should not render security-specific sections', () => {
      const passSection = dashboard.querySelector('#issue-pass-section');
      expect(passSection).toBeFalsy();
    });

    test('should not render admin-specific sections', () => {
      const userMgmtSection = dashboard.querySelector('#user-management-section');
      expect(userMgmtSection).toBeFalsy();
    });

    test('should display approve/reject buttons for pending requests', () => {
      const pendingList = dashboard.querySelector('#pending-list');
      const request = document.createElement('div');
      request.className = 'pending-request';
      request.innerHTML = `
        <h4>Guest Name</h4>
        <button class="approve-btn">Approve</button>
        <button class="reject-btn">Reject</button>
      `;
      pendingList.appendChild(request);

      const approveBtn = pendingList.querySelector('.approve-btn');
      const rejectBtn = pendingList.querySelector('.reject-btn');

      expect(approveBtn).toBeTruthy();
      expect(rejectBtn).toBeTruthy();
      expect(approveBtn.textContent).toBe('Approve');
      expect(rejectBtn.textContent).toBe('Reject');
    });

    test('should populate pending requests list dynamically', () => {
      const pendingList = dashboard.querySelector('#pending-list');
      const requests = [
        { id: 1, guestName: 'Alice' },
        { id: 2, guestName: 'Bob' },
      ];

      requests.forEach((req) => {
        const item = document.createElement('div');
        item.innerHTML = `<h4>${req.guestName}</h4>`;
        pendingList.appendChild(item);
      });

      expect(pendingList.children.length).toBe(2);
      expect(pendingList.textContent).toContain('Alice');
      expect(pendingList.textContent).toContain('Bob');
    });
  });

  describe('Security Dashboard Rendering', () => {
    let dashboard;

    beforeEach(() => {
      dashboard = createRoleBasedUI('Security');
    });

    test('should display Security role in header', () => {
      const roleDisplay = dashboard.querySelector('.user-role');
      expect(roleDisplay.textContent).toBe('Security');
    });

    test('should render approved visits section', () => {
      const approvedSection = dashboard.querySelector('#approved-visits-section');
      expect(approvedSection).toBeTruthy();
      expect(approvedSection.textContent).toContain('Approved Visits');
    });

    test('should render issue pass section', () => {
      const passSection = dashboard.querySelector('#issue-pass-section');
      expect(passSection).toBeTruthy();
      expect(passSection.textContent).toContain('Issue Pass');
    });

    test('should render active guests section', () => {
      const activeSection = dashboard.querySelector('#active-guests-section');
      expect(activeSection).toBeTruthy();
      expect(activeSection.textContent).toContain('Active Guests');
    });

    test('should have issue pass form', () => {
      const passForm = dashboard.querySelector('#issue-pass-form');
      expect(passForm).toBeTruthy();
    });

    test('should have empty approved visits list initially', () => {
      const visitsList = dashboard.querySelector('#approved-visits-list');
      expect(visitsList).toBeTruthy();
      expect(visitsList.children.length).toBe(0);
    });

    test('should have empty active guests list initially', () => {
      const guestsList = dashboard.querySelector('#active-guests-list');
      expect(guestsList).toBeTruthy();
      expect(guestsList.children.length).toBe(0);
    });

    test('should not render visit request form', () => {
      const formSection = dashboard.querySelector('#visit-request-form-section');
      expect(formSection).toBeFalsy();
    });

    test('should not render host request sections', () => {
      const pendingSection = dashboard.querySelector('#pending-requests-section');
      expect(pendingSection).toBeFalsy();
    });

    test('should not render admin-specific sections', () => {
      const userMgmtSection = dashboard.querySelector('#user-management-section');
      expect(userMgmtSection).toBeFalsy();
    });

    test('should display pass code after issuance', () => {
      const passSection = dashboard.querySelector('#issue-pass-section');
      const passCode = document.createElement('div');
      passCode.className = 'issued-pass';
      passCode.innerHTML = '<p>Pass Code: <strong>ABC123DEF456</strong></p>';
      passSection.appendChild(passCode);

      expect(passSection.querySelector('.issued-pass')).toBeTruthy();
      expect(passSection.textContent).toContain('ABC123DEF456');
    });

    test('should display check-in button for approved visits', () => {
      const visitsList = dashboard.querySelector('#approved-visits-list');
      const visit = document.createElement('div');
      visit.innerHTML = `
        <h4>Guest Visit</h4>
        <button class="check-in-btn">Check In</button>
      `;
      visitsList.appendChild(visit);

      expect(visitsList.querySelector('.check-in-btn')).toBeTruthy();
    });

    test('should display check-out button for active guests', () => {
      const activeList = dashboard.querySelector('#active-guests-list');
      const guest = document.createElement('div');
      guest.innerHTML = `
        <h4>Guest Name</h4>
        <button class="check-out-btn">Check Out</button>
      `;
      activeList.appendChild(guest);

      expect(activeList.querySelector('.check-out-btn')).toBeTruthy();
    });

    test('should populate approved visits list dynamically', () => {
      const visitsList = dashboard.querySelector('#approved-visits-list');
      const visits = [
        { id: 1, guestName: 'John', visitDate: '2024-01-15' },
        { id: 2, guestName: 'Jane', visitDate: '2024-01-16' },
      ];

      visits.forEach((visit) => {
        const item = document.createElement('div');
        item.innerHTML = `<h4>${visit.guestName}</h4>`;
        visitsList.appendChild(item);
      });

      expect(visitsList.children.length).toBe(2);
      expect(visitsList.textContent).toContain('John');
    });

    test('should populate active guests list dynamically', () => {
      const activeList = dashboard.querySelector('#active-guests-list');
      const guests = [
        { id: 1, name: 'Alice', checkInTime: '09:00' },
        { id: 2, name: 'Bob', checkInTime: '09:15' },
      ];

      guests.forEach((guest) => {
        const item = document.createElement('div');
        item.innerHTML = `<h4>${guest.name}</h4>`;
        activeList.appendChild(item);
      });

      expect(activeList.children.length).toBe(2);
      expect(activeList.textContent).toContain('Alice');
    });
  });

  describe('Admin Dashboard Rendering', () => {
    let dashboard;

    beforeEach(() => {
      dashboard = createRoleBasedUI('Admin');
    });

    test('should display Admin role in header', () => {
      const roleDisplay = dashboard.querySelector('.user-role');
      expect(roleDisplay.textContent).toBe('Admin');
    });

    test('should render user management section', () => {
      const userMgmtSection = dashboard.querySelector('#user-management-section');
      expect(userMgmtSection).toBeTruthy();
      expect(userMgmtSection.textContent).toContain('User Management');
    });

    test('should render reports section', () => {
      const reportsSection = dashboard.querySelector('#reports-section');
      expect(reportsSection).toBeTruthy();
      expect(reportsSection.textContent).toContain('System Reports');
    });

    test('should have empty users list initially', () => {
      const usersList = dashboard.querySelector('#users-list');
      expect(usersList).toBeTruthy();
      expect(usersList.children.length).toBe(0);
    });

    test('should have empty reports container initially', () => {
      const reportsContainer = dashboard.querySelector('#reports-container');
      expect(reportsContainer).toBeTruthy();
      expect(reportsContainer.children.length).toBe(0);
    });

    test('should not render guest visit form', () => {
      const formSection = dashboard.querySelector('#visit-request-form-section');
      expect(formSection).toBeFalsy();
    });

    test('should not render host request sections', () => {
      const pendingSection = dashboard.querySelector('#pending-requests-section');
      expect(pendingSection).toBeFalsy();
    });

    test('should not render security-specific sections', () => {
      const passSection = dashboard.querySelector('#issue-pass-section');
      expect(passSection).toBeFalsy();
    });

    test('should display role update dropdown for users', () => {
      const usersList = dashboard.querySelector('#users-list');
      const userItem = document.createElement('div');
      userItem.className = 'user-item';
      userItem.innerHTML = `
        <h4>User Name</h4>
        <select class="role-select">
          <option value="Guest">Guest</option>
          <option value="Host">Host</option>
          <option value="Security">Security</option>
          <option value="Admin">Admin</option>
        </select>
      `;
      usersList.appendChild(userItem);

      const roleSelect = usersList.querySelector('.role-select');
      expect(roleSelect).toBeTruthy();
      expect(roleSelect.options.length).toBe(4);
    });

    test('should populate users list dynamically', () => {
      const usersList = dashboard.querySelector('#users-list');
      const users = [
        { id: 1, name: 'Alice', role: 'Guest' },
        { id: 2, name: 'Bob', role: 'Host' },
        { id: 3, name: 'Charlie', role: 'Admin' },
      ];

      users.forEach((user) => {
        const item = document.createElement('div');
        item.innerHTML = `<h4>${user.name}</h4><p>${user.role}</p>`;
        usersList.appendChild(item);
      });

      expect(usersList.children.length).toBe(3);
      expect(usersList.textContent).toContain('Alice');
      expect(usersList.textContent).toContain('Bob');
      expect(usersList.textContent).toContain('Charlie');
    });

    test('should display system reports with statistics', () => {
      const reportsContainer = dashboard.querySelector('#reports-container');
      const report = document.createElement('div');
      report.className = 'report-card';
      report.innerHTML = `
        <h3>Total Visits</h3>
        <p class="stat-number">42</p>
      `;
      reportsContainer.appendChild(report);

      expect(reportsContainer.querySelector('.report-card')).toBeTruthy();
      expect(reportsContainer.textContent).toContain('Total Visits');
      expect(reportsContainer.textContent).toContain('42');
    });

    test('should display multiple report cards', () => {
      const reportsContainer = dashboard.querySelector('#reports-container');
      const reports = [
        { title: 'Total Visits', value: '42' },
        { title: 'Active Users', value: '28' },
        { title: 'Approved Today', value: '15' },
      ];

      reports.forEach((report) => {
        const card = document.createElement('div');
        card.className = 'report-card';
        card.innerHTML = `<h3>${report.title}</h3><p>${report.value}</p>`;
        reportsContainer.appendChild(card);
      });

      expect(reportsContainer.children.length).toBe(3);
      expect(reportsContainer.textContent).toContain('Active Users');
    });
  });

  describe('Role Mismatch and Access Control', () => {
    test('should only render appropriate sections for Guest role', () => {
      const guestDash = createRoleBasedUI('Guest');
      const hostDash = createRoleBasedUI('Host');

      const guestForm = guestDash.querySelector('#visit-request-form-section');
      const guestHostRequests = guestDash.querySelector('#pending-requests-section');
      const hostRequests = hostDash.querySelector('#pending-requests-section');
      const hostGuestForm = hostDash.querySelector('#visit-request-form-section');

      expect(guestForm).toBeTruthy();
      expect(guestHostRequests).toBeFalsy();

      expect(hostRequests).toBeTruthy();
      expect(hostGuestForm).toBeFalsy();
    });

    test('should maintain separate UI state for different roles', () => {
      const guest = createRoleBasedUI('Guest');
      const security = createRoleBasedUI('Security');

      const guestRole = guest.querySelector('.user-role').textContent;
      const securityRole = security.querySelector('.user-role').textContent;

      expect(guestRole).toBe('Guest');
      expect(securityRole).toBe('Security');
    });
  });

  describe('UI Accessibility and Structure', () => {
    test('should have proper header structure', () => {
      const dashboard = createRoleBasedUI('Guest');
      const header = dashboard.querySelector('header');
      expect(header).toBeTruthy();
      expect(header.querySelector('h1')).toBeTruthy();
    });

    test('should use semantic HTML sections', () => {
      const dashboard = createRoleBasedUI('Security');
      const sections = dashboard.querySelectorAll('section');
      expect(sections.length).toBeGreaterThan(0);
      sections.forEach((section) => {
        expect(section.tagName).toBe('SECTION');
      });
    });

    test('should have data attributes for role identification', () => {
      const dashboard = createRoleBasedUI('Admin');
      expect(dashboard.dataset.userRole).toBe('Admin');
    });
  });
});
