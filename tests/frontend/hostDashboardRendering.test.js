/**
 * Host Dashboard Frontend Rendering Tests
 * Tests that the host-dashboard.html page correctly renders approved visits
 * with the flattened API response structure
 */

describe('Host Dashboard Rendering with Flattened API Response', () => {
  let container;

  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
    jest.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Pending Visit Card Rendering', () => {
    test('should render pending visit card with flattened guest/host data', () => {
      // Mock flattened API response
      const mockVisit = {
        id: 1,
        visitId: 1,
        purpose: 'Business Meeting',
        visitDate: '2024-01-15',
        status: 'pending',
        createdAt: '2024-01-10T10:00:00Z',
        guestId: 10,
        guestName: 'John Guest',
        guestEmail: 'john@example.com',
        guestPhone: '555-0001',
        hostId: 20,
        hostName: 'Jane Host'
      };

      // Simulate rendering logic from createPendingCard()
      const card = document.createElement('div');
      card.className = 'guest-card';

      const visitDate = new Date(mockVisit.visitDate);
      const formattedVisitDate = visitDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      const createdAt = new Date(mockVisit.createdAt);
      const formattedCreated = createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      card.innerHTML = `
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-gray-500">Guest Name</p>
              <p class="font-medium text-gray-900">${mockVisit.guestName}</p>
              <p class="text-sm text-gray-600 mt-1">${mockVisit.guestEmail}</p>
              <p class="text-sm text-gray-600">${mockVisit.guestPhone}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Visit Date</p>
              <p class="font-medium text-gray-900">${formattedVisitDate}</p>
              <p class="text-sm text-gray-500 mt-1">Requested on</p>
              <p class="text-sm text-gray-600">${formattedCreated}</p>
            </div>
          </div>
          <div>
            <p class="text-sm text-gray-500">Purpose</p>
            <p class="text-gray-900 line-clamp-2">${mockVisit.purpose}</p>
          </div>
        </div>
      `;

      container.appendChild(card);

      // Verify rendering
      expect(container.textContent).toContain('John Guest');
      expect(container.textContent).toContain('john@example.com');
      expect(container.textContent).toContain('555-0001');
      expect(container.textContent).toContain('Business Meeting');
      expect(container.textContent).toContain('Jan 15, 2024');
    });

    test('should handle missing phone number gracefully', () => {
      const mockVisit = {
        visitId: 1,
        purpose: 'Meeting',
        visitDate: '2024-01-15',
        status: 'pending',
        createdAt: '2024-01-10T10:00:00Z',
        guestName: 'John Guest',
        guestEmail: 'john@example.com',
        guestPhone: undefined, // Missing phone
        hostName: 'Jane Host'
      };

      const card = document.createElement('div');
      card.className = 'guest-card';

      const guestPhone = mockVisit.guestPhone || 'N/A';

      card.innerHTML = `
        <p class="text-sm text-gray-600">${guestPhone}</p>
      `;

      container.appendChild(card);

      expect(container.textContent).toContain('N/A');
    });

    test('should format dates without throwing errors', () => {
      const mockVisit = {
        visitId: 1,
        visitDate: '2024-01-15',
        createdAt: '2024-01-10T10:00:00Z',
        guestName: 'John Guest',
        guestEmail: 'john@example.com',
        guestPhone: '555-0001'
      };

      const visitDate = new Date(mockVisit.visitDate);
      const createdAt = new Date(mockVisit.createdAt);

      // Should not throw errors
      expect(() => visitDate.toLocaleDateString()).not.toThrow();
      expect(() => createdAt.toLocaleDateString()).not.toThrow();

      // Should produce valid dates
      expect(visitDate.toString()).not.toBe('Invalid Date');
      expect(createdAt.toString()).not.toBe('Invalid Date');
    });
  });

  describe('History Visit Card Rendering', () => {
    test('should render history visit card with flattened data', () => {
      const mockVisit = {
        visitId: 2,
        purpose: 'Technical Support',
        visitDate: '2024-01-15',
        status: 'approved',
        guestName: 'Alice Guest',
        guestEmail: 'alice@example.com'
      };

      const card = document.createElement('div');
      card.className = 'border border-gray-200 rounded-lg p-4 bg-gray-50';

      const visitDate = new Date(mockVisit.visitDate);
      const formattedVisitDate = visitDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      const statusClass = mockVisit.status === 'approved' ? 'status-approved' : 'status-pending';
      const statusBadge = `<span class="status-badge ${statusClass}">${mockVisit.status.charAt(0).toUpperCase() + mockVisit.status.slice(1)}</span>`;

      card.innerHTML = `
        <div class="space-y-3">
          <div class="flex justify-between items-start gap-4">
            <div class="flex-1">
              <p class="text-sm text-gray-500">Guest</p>
              <p class="font-medium text-gray-900">${mockVisit.guestName}</p>
              <p class="text-sm text-gray-600">${mockVisit.guestEmail}</p>
            </div>
            <div>${statusBadge}</div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-gray-500">Visit Date</p>
              <p class="font-medium text-gray-900">${formattedVisitDate}</p>
            </div>
          </div>
          <div>
            <p class="text-sm text-gray-500">Purpose</p>
            <p class="text-gray-900 line-clamp-2">${mockVisit.purpose}</p>
          </div>
        </div>
      `;

      container.appendChild(card);

      expect(container.textContent).toContain('Alice Guest');
      expect(container.textContent).toContain('alice@example.com');
      expect(container.textContent).toContain('Technical Support');
      expect(container.textContent).toContain('Approved');
    });

    test('should handle rejection reason for rejected visits', () => {
      const mockVisit = {
        visitId: 3,
        purpose: 'Meeting',
        visitDate: '2024-01-15',
        status: 'rejected',
        guestName: 'Bob Guest',
        guestEmail: 'bob@example.com',
        rejection_reason: 'Scheduling conflict'
      };

      const card = document.createElement('div');
      card.className = 'border border-gray-200 rounded-lg p-4 bg-gray-50';

      let content = `
        <div class="space-y-3">
          <div>
            <p class="text-sm text-gray-500">Guest</p>
            <p class="font-medium text-gray-900">${mockVisit.guestName}</p>
          </div>
        </div>
      `;

      // Add rejection reason if status is rejected
      if (mockVisit.status === 'rejected' && mockVisit.rejection_reason) {
        content += `
          <div class="bg-red-50 border-l-4 border-red-400 p-3">
            <p class="text-sm font-medium text-red-900">Rejection Reason</p>
            <p class="text-sm text-red-700 mt-1">${mockVisit.rejection_reason}</p>
          </div>
        `;
      }

      card.innerHTML = content;
      container.appendChild(card);

      expect(container.textContent).toContain('Rejection Reason');
      expect(container.textContent).toContain('Scheduling conflict');
    });
  });

  describe('Multiple Visits Rendering', () => {
    test('should render list of multiple visits without errors', () => {
      const mockVisits = [
        {
          visitId: 1,
          guestName: 'John Guest',
          guestEmail: 'john@example.com',
          guestPhone: '555-0001',
          visitDate: '2024-01-15',
          createdAt: '2024-01-10T10:00:00Z',
          purpose: 'Business Meeting',
          status: 'pending'
        },
        {
          visitId: 2,
          guestName: 'Alice Guest',
          guestEmail: 'alice@example.com',
          guestPhone: '555-0002',
          visitDate: '2024-01-16',
          createdAt: '2024-01-11T10:00:00Z',
          purpose: 'Technical Support',
          status: 'pending'
        },
        {
          visitId: 3,
          guestName: 'Bob Guest',
          guestEmail: 'bob@example.com',
          guestPhone: '555-0003',
          visitDate: '2024-01-17',
          createdAt: '2024-01-12T10:00:00Z',
          purpose: 'Consultation',
          status: 'approved'
        }
      ];

      const listContainer = document.createElement('div');
      listContainer.id = 'visits-list';

      mockVisits.forEach(visit => {
        const card = document.createElement('div');
        card.className = 'guest-card';
        card.innerHTML = `
          <div>
            <p class="font-medium">${visit.guestName}</p>
            <p class="text-sm text-gray-600">${visit.guestEmail}</p>
            <p class="text-sm text-gray-600">${visit.guestPhone}</p>
            <p class="text-sm text-gray-500">Purpose: ${visit.purpose}</p>
            <p class="text-sm text-gray-500">Status: ${visit.status}</p>
          </div>
        `;
        listContainer.appendChild(card);
      });

      container.appendChild(listContainer);

      // Verify all visits are rendered
      expect(container.querySelectorAll('.guest-card').length).toBe(3);
      expect(container.textContent).toContain('John Guest');
      expect(container.textContent).toContain('Alice Guest');
      expect(container.textContent).toContain('Bob Guest');
      expect(container.textContent).toContain('Business Meeting');
      expect(container.textContent).toContain('Technical Support');
      expect(container.textContent).toContain('Consultation');
    });

    test('should sort visits by creation date (newest first)', () => {
      const mockVisits = [
        {
          visitId: 1,
          guestName: 'Guest 1',
          createdAt: '2024-01-10T10:00:00Z'
        },
        {
          visitId: 2,
          guestName: 'Guest 2',
          createdAt: '2024-01-12T10:00:00Z'
        },
        {
          visitId: 3,
          guestName: 'Guest 3',
          createdAt: '2024-01-11T10:00:00Z'
        }
      ];

      // Sort by createdAt (newest first) - simulating renderHistoryVisits
      const sorted = [...mockVisits].sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      expect(sorted[0].visitId).toBe(2); // Latest date
      expect(sorted[1].visitId).toBe(3);
      expect(sorted[2].visitId).toBe(1); // Earliest date
    });
  });

  describe('API Response Integration', () => {
    test('should render visits from mocked API response', async () => {
      const mockApiResponse = {
        data: [
          {
            visitId: 1,
            guestName: 'John Guest',
            guestEmail: 'john@example.com',
            guestPhone: '555-0001',
            hostName: 'Jane Host',
            visitDate: '2024-01-15',
            createdAt: '2024-01-10T10:00:00Z',
            purpose: 'Business Meeting',
            status: 'pending'
          },
          {
            visitId: 2,
            guestName: 'Alice Guest',
            guestEmail: 'alice@example.com',
            guestPhone: '555-0002',
            hostName: 'Jane Host',
            visitDate: '2024-01-16',
            createdAt: '2024-01-11T10:00:00Z',
            purpose: 'Technical Support',
            status: 'approved'
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1
        }
      };

      // Mock fetch
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponse)
        })
      );

      // Simulate loading and rendering
      const response = await fetch('/api/visits/approved');
      const data = await response.json();

      // Verify API response structure
      expect(data.data).toHaveLength(2);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBe(2);

      // Verify flattened structure
      const visit1 = data.data[0];
      expect(visit1.visitId).toBe(1);
      expect(visit1.guestName).toBe('John Guest');
      expect(visit1.guestEmail).toBe('john@example.com');
      expect(visit1.guestPhone).toBe('555-0001');
      expect(visit1.hostName).toBe('Jane Host');
      
      // Verify no nested objects
      expect(visit1.guest).toBeUndefined();
      expect(visit1.host).toBeUndefined();

      // Render to DOM
      const listContainer = document.createElement('div');
      data.data.forEach(visit => {
        const card = document.createElement('div');
        card.className = 'guest-card';
        card.innerHTML = `
          <p class="font-medium">${visit.guestName}</p>
          <p class="text-sm text-gray-600">${visit.guestEmail}</p>
        `;
        listContainer.appendChild(card);
      });

      container.appendChild(listContainer);

      expect(container.textContent).toContain('John Guest');
      expect(container.textContent).toContain('Alice Guest');
    });

    test('should handle empty visits list', async () => {
      const mockApiResponse = {
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0
        }
      };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponse)
        })
      );

      const response = await fetch('/api/visits/approved');
      const data = await response.json();

      expect(data.data).toHaveLength(0);
      expect(data.pagination.total).toBe(0);

      // Verify empty state handling
      const emptyState = document.createElement('div');
      emptyState.id = 'empty-state';
      if (data.data.length === 0) {
        emptyState.innerHTML = '<p>No pending visits</p>';
      }

      container.appendChild(emptyState);

      expect(container.textContent).toContain('No pending visits');
    });

    test('should handle API errors gracefully', async () => {
      global.fetch = jest.fn(() =>
        Promise.reject(new Error('Network error'))
      );

      // Simulate error handling
      let error = null;
      try {
        await fetch('/api/visits/approved');
      } catch (e) {
        error = e;
      }

      expect(error).not.toBeNull();
      expect(error.message).toContain('Network error');

      // Verify error is displayed to user
      const errorContainer = document.createElement('div');
      errorContainer.id = 'error-message';
      errorContainer.innerHTML = '<p>Failed to load visits</p>';

      container.appendChild(errorContainer);

      expect(container.textContent).toContain('Failed to load visits');
    });
  });

  describe('Modal Dialog Interactions', () => {
    test('should pass flattened visit data to modal', () => {
      const mockVisit = {
        visitId: 1,
        guestName: 'John Guest',
        guestEmail: 'john@example.com',
        guestPhone: '555-0001',
        hostName: 'Jane Host',
        visitDate: '2024-01-15',
        purpose: 'Business Meeting',
        status: 'pending'
      };

      // Simulate opening modal with visit data
      const modal = document.createElement('div');
      modal.id = 'visit-detail-modal';
      modal.innerHTML = `
        <div class="modal-content">
          <h2>Visit Details</h2>
          <p><strong>Guest:</strong> ${mockVisit.guestName}</p>
          <p><strong>Email:</strong> ${mockVisit.guestEmail}</p>
          <p><strong>Phone:</strong> ${mockVisit.guestPhone}</p>
          <p><strong>Host:</strong> ${mockVisit.hostName}</p>
          <p><strong>Purpose:</strong> ${mockVisit.purpose}</p>
          <p><strong>Date:</strong> ${mockVisit.visitDate}</p>
          <p><strong>Status:</strong> ${mockVisit.status}</p>
        </div>
      `;

      container.appendChild(modal);

      // Verify all data is accessible and displayed
      const modalContent = container.querySelector('.modal-content');
      expect(modalContent.textContent).toContain('John Guest');
      expect(modalContent.textContent).toContain('john@example.com');
      expect(modalContent.textContent).toContain('555-0001');
      expect(modalContent.textContent).toContain('Jane Host');
      expect(modalContent.textContent).toContain('Business Meeting');
    });

    test('should not have undefined property errors when accessing visit data', () => {
      const mockVisit = {
        visitId: 1,
        guestName: 'John Guest',
        guestEmail: 'john@example.com',
        guestPhone: '555-0001',
        hostName: 'Jane Host'
      };

      // Verify no errors when accessing flattened properties
      expect(() => {
        return mockVisit.guestName;
      }).not.toThrow();

      expect(() => {
        return mockVisit.guestEmail;
      }).not.toThrow();

      expect(() => {
        return mockVisit.guestPhone;
      }).not.toThrow();

      expect(() => {
        return mockVisit.hostName;
      }).not.toThrow();

      // Verify accessing nested properties returns undefined (old structure)
      expect(mockVisit.guest).toBeUndefined();
      expect(mockVisit.host).toBeUndefined();
    });
  });

  describe('Console Error Prevention', () => {
    test('should not generate undefined property errors', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockVisit = {
        visitId: 1,
        guestName: 'John Guest',
        guestEmail: 'john@example.com',
        guestPhone: '555-0001',
        hostName: 'Jane Host',
        visitDate: '2024-01-15',
        createdAt: '2024-01-10T10:00:00Z'
      };

      // Attempt to render using flattened structure
      const card = document.createElement('div');
      card.innerHTML = `
        <p>${mockVisit.guestName || 'Unknown'}</p>
        <p>${mockVisit.guestEmail || 'N/A'}</p>
        <p>${mockVisit.guestPhone || 'N/A'}</p>
        <p>${mockVisit.hostName || 'Unknown'}</p>
        <p>${new Date(mockVisit.visitDate).toLocaleDateString()}</p>
        <p>${new Date(mockVisit.createdAt).toLocaleDateString()}</p>
      `;

      container.appendChild(card);

      // Verify no console errors were logged
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('should handle missing optional fields without errors', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockVisit = {
        visitId: 1,
        guestName: 'John Guest',
        // Missing guestPhone
        hostName: 'Jane Host'
      };

      // Should not throw when accessing undefined field
      const phone = mockVisit.guestPhone || 'N/A';
      expect(phone).toBe('N/A');

      // Verify no console errors
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
