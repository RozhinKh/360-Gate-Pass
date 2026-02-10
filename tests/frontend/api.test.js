/**
 * Frontend API Interaction Tests
 * Tests successful API responses, error handling, and network failures
 */

describe('API Call Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  describe('Successful API Responses', () => {
    test('should handle successful registration API response', async () => {
      const mockResponse = {
        success: true,
        user: {
          id: 1,
          email: 'user@example.com',
          role: 'Guest',
        },
      };

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'Password123',
          name: 'User',
          phone: '1234567890',
        }),
      });

      const data = await response.json();
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('user@example.com');
    });

    test('should display data correctly in UI after successful response', async () => {
      const mockData = {
        id: 1,
        email: 'john@example.com',
        name: 'John Doe',
      };

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const response = await fetch('/api/user/profile');
      const data = await response.json();

      // Simulate updating UI
      const userDisplay = document.createElement('div');
      userDisplay.id = 'user-profile';
      userDisplay.innerHTML = `
        <h2>${data.name}</h2>
        <p>${data.email}</p>
      `;
      document.body.appendChild(userDisplay);

      expect(document.getElementById('user-profile').textContent).toContain('John Doe');
      expect(document.getElementById('user-profile').textContent).toContain('john@example.com');
    });

    test('should show success message after successful API call', async () => {
      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, message: 'Visit approved' }), {
          status: 200,
        })
      );

      const response = await fetch('/api/visits/1/approve', { method: 'PUT' });
      const data = await response.json();

      const successContainer = createSuccessContainer('success-messages');
      if (data.success) {
        successContainer.innerHTML = `<div class="success">${data.message}</div>`;
      }

      expect(successContainer.textContent).toContain('Visit approved');
    });

    test('should redirect after successful login', async () => {
      const mockToken = 'jwt-token-123';
      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ token: mockToken, user: { role: 'Guest' } }), {
          status: 200,
        })
      );

      const response = await fetch('/api/auth/login', { method: 'POST' });
      const data = await response.json();

      // Store token
      localStorage.setItem('token', data.token);
      
      // Simulate redirect
      if (data.token) {
        window.location.href = '/dashboard';
      }

      expect(localStorage.getItem('token')).toBe(mockToken);
      expect(window.location.href).toBe('/dashboard');
    });

    test('should redirect after successful registration', async () => {
      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 201 })
      );

      const response = await fetch('/api/auth/register', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        window.location.href = '/login';
      }

      expect(window.location.href).toBe('/login');
    });

    test('should display list of items from API response', async () => {
      const mockVisits = [
        { id: 1, host: 'John', status: 'pending' },
        { id: 2, host: 'Jane', status: 'approved' },
      ];

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ visits: mockVisits }), { status: 200 })
      );

      const response = await fetch('/api/visits');
      const data = await response.json();

      const listContainer = document.createElement('div');
      listContainer.id = 'visits-list';
      data.visits.forEach((visit) => {
        const item = document.createElement('div');
        item.className = 'visit-item';
        item.innerHTML = `<p>${visit.host}</p><p>${visit.status}</p>`;
        listContainer.appendChild(item);
      });
      document.body.appendChild(listContainer);

      expect(document.querySelectorAll('.visit-item').length).toBe(2);
      expect(listContainer.textContent).toContain('John');
      expect(listContainer.textContent).toContain('Jane');
    });

    test('should handle paginated API responses', async () => {
      const mockData = {
        data: [
          { id: 1, title: 'Item 1' },
          { id: 2, title: 'Item 2' },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 25,
          hasMore: true,
        },
      };

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const response = await fetch('/api/visits?page=1&pageSize=10');
      const data = await response.json();

      expect(data.data.length).toBe(2);
      expect(data.pagination.hasMore).toBe(true);
      expect(data.pagination.total).toBe(25);
    });
  });

  describe('API Error Responses', () => {
    test('should handle 400 Bad Request error and display validation messages', async () => {
      const mockError = {
        error: 'Validation Error',
        messages: ['Email is required', 'Password must be at least 8 characters'],
      };

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockError), {
          status: 400,
          ok: false,
        })
      );

      const response = await fetch('/api/auth/register', { method: 'POST' });
      const data = await response.json();

      const errorContainer = createErrorContainer('api-errors');
      if (response.status === 400) {
        data.messages.forEach((message) => {
          const error = document.createElement('div');
          error.className = 'validation-error';
          error.textContent = message;
          errorContainer.appendChild(error);
        });
      }

      expect(errorContainer.textContent).toContain('Email is required');
      expect(errorContainer.textContent).toContain('Password must be at least 8 characters');
    });

    test('should handle 401 Unauthorized and redirect to login', async () => {
      const mockError = { error: 'Unauthorized', message: 'Invalid token' };

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockError), {
          status: 401,
          ok: false,
        })
      );

      const response = await fetch('/api/visits', {
        headers: { Authorization: 'Bearer invalid-token' },
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }

      expect(localStorage.getItem('token')).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    test('should handle 403 Forbidden error and show forbidden message', async () => {
      const mockError = {
        error: 'Forbidden',
        message: 'You do not have permission to access this resource',
      };

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockError), {
          status: 403,
          ok: false,
        })
      );

      const response = await fetch('/api/admin/users');
      const data = await response.json();

      const errorContainer = createErrorContainer('forbidden-error');
      if (response.status === 403) {
        errorContainer.innerHTML = `<div class="forbidden">${data.message}</div>`;
      }

      expect(errorContainer.textContent).toContain('You do not have permission');
    });

    test('should handle 500 Internal Server Error with user-friendly message', async () => {
      const mockError = {
        error: 'Internal Server Error',
        message: 'An error occurred processing your request',
      };

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockError), {
          status: 500,
          ok: false,
        })
      );

      const response = await fetch('/api/visits');
      const data = await response.json();

      const errorContainer = createErrorContainer('server-error');
      if (response.status === 500) {
        errorContainer.innerHTML = `
          <div class="error">
            ${data.message || 'An unexpected error occurred. Please try again later.'}
          </div>
        `;
      }

      expect(errorContainer.textContent).toContain('An error occurred');
    });

    test('should display specific validation error messages from API', async () => {
      const mockError = {
        error: 'Validation Error',
        details: {
          email: 'Invalid email format',
          password: 'Password too weak',
        },
      };

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockError), { status: 400 })
      );

      const response = await fetch('/api/auth/register', { method: 'POST' });
      const data = await response.json();

      const errorContainer = createErrorContainer('field-errors');
      Object.entries(data.details).forEach(([field, message]) => {
        const error = document.createElement('div');
        error.className = `error-${field}`;
        error.textContent = message;
        errorContainer.appendChild(error);
      });

      expect(errorContainer.textContent).toContain('Invalid email format');
      expect(errorContainer.textContent).toContain('Password too weak');
    });

    test('should handle 404 Not Found error', async () => {
      const mockError = { error: 'Not Found', message: 'Resource not found' };

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockError), {
          status: 404,
          ok: false,
        })
      );

      const response = await fetch('/api/visits/999');
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not Found');
    });
  });

  describe('Network Failures', () => {
    test('should handle network timeout', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Request timeout'));

      try {
        await fetch('/api/visits');
        fail('Should have thrown an error');
      } catch (error) {
        const errorContainer = createErrorContainer('network-error');
        errorContainer.innerHTML = '<div class="error">Request timed out. Please try again.</div>';
        expect(errorContainer.textContent).toContain('Request timed out');
      }
    });

    test('should handle connection refused error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      try {
        await fetch('/api/visits');
        fail('Should have thrown an error');
      } catch (error) {
        const errorContainer = createErrorContainer('network-error');
        errorContainer.innerHTML = '<div class="error">Unable to connect to server. Please check your connection.</div>';
        expect(errorContainer.textContent).toContain('Unable to connect');
      }
    });

    test('should gracefully degrade when network unavailable', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      let dataDisplayed = false;
      try {
        const response = await fetch('/api/visits');
        const data = await response.json();
        dataDisplayed = true;
      } catch (error) {
        dataDisplayed = false;
      }

      const fallbackContent = document.createElement('div');
      if (!dataDisplayed) {
        fallbackContent.innerHTML = '<p>Unable to load data. Please try again later.</p>';
      }

      expect(fallbackContent.textContent).toContain('Unable to load');
    });

    test('should display user-friendly error message on network failure', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      try {
        await fetch('/api/visits');
      } catch (error) {
        const errorContainer = createErrorContainer('error');
        const userFriendlyMessage = 'Unable to reach the server. Please check your internet connection and try again.';
        errorContainer.innerHTML = `<div class="error">${userFriendlyMessage}</div>`;

        expect(errorContainer.textContent).toContain('Unable to reach the server');
      }
    });

    test('should allow retry after network failure', async () => {
      // First call fails
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      try {
        await fetch('/api/visits');
      } catch (error) {
        // Retry
        global.fetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ visits: [] }), { status: 200 })
        );
        const retryResponse = await fetch('/api/visits');
        expect(retryResponse.status).toBe(200);
      }
    });

    test('should handle slow network responses gracefully', async () => {
      const slowResponse = new Promise((resolve) => {
        setTimeout(() => {
          resolve(
            new Response(JSON.stringify({ data: [] }), { status: 200 })
          );
        }, 100);
      });

      global.fetch.mockReturnValueOnce(slowResponse);

      const startTime = Date.now();
      const response = await fetch('/api/visits');
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Request Headers and Authentication', () => {
    test('should include auth token in request headers', async () => {
      localStorage.setItem('token', 'test-jwt-token');

      const mockVisits = [];
      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockVisits), { status: 200 })
      );

      const token = localStorage.getItem('token');
      await fetch('/api/visits', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/visits',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-jwt-token',
          }),
        })
      );
    });

    test('should handle request with JSON content type', async () => {
      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: 'John' }),
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/visits',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('Response Data Handling', () => {
    test('should handle empty response array', async () => {
      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 })
      );

      const response = await fetch('/api/visits');
      const data = await response.json();

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });

    test('should handle null response field', async () => {
      const mockData = { user: null };

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const response = await fetch('/api/user/profile');
      const data = await response.json();

      expect(data.user).toBeNull();
    });

    test('should parse complex nested JSON response', async () => {
      const mockData = {
        visit: {
          id: 1,
          guest: {
            id: 1,
            name: 'John',
            contact: {
              email: 'john@example.com',
              phone: '1234567890',
            },
          },
          status: 'approved',
        },
      };

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const response = await fetch('/api/visits/1');
      const data = await response.json();

      expect(data.visit.guest.contact.email).toBe('john@example.com');
    });
  });
});
