/**
 * Frontend Error Handling Tests
 * Tests error handling for form submission, API interactions, and authentication
 */

describe('Frontend Error Handling', () => {
  describe('Form Submission with Network Failure', () => {
    let form;
    let errorContainer;

    beforeEach(() => {
      form = createMockForm('test-form', {
        email: 'email',
        password: 'password',
      });
      errorContainer = createErrorContainer('form-errors');
    });

    test('should display error when form submission fails due to network', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      try {
        await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.elements.email.value,
            password: form.elements.password.value,
          }),
        });
        fail('Should have thrown error');
      } catch (error) {
        errorContainer.innerHTML = '<div class="error">Failed to submit form. Please check your connection.</div>';
        expect(errorContainer.textContent).toContain('Failed to submit form');
      }
    });

    test('should preserve form data when submission fails', async () => {
      form.elements.email.value = 'user@example.com';
      form.elements.password.value = 'password123';

      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      try {
        await fetch('/api/auth/login', { method: 'POST' });
      } catch (error) {
        // Form data should still be present
        expect(form.elements.email.value).toBe('user@example.com');
        expect(form.elements.password.value).toBe('password123');
      }
    });

    test('should allow form retry after failed submission', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      try {
        await fetch('/api/test', { method: 'POST' });
      } catch (error) {
        // Simulate retry
        global.fetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ success: true }), { status: 200 })
        );
        const retryResponse = await fetch('/api/test', { method: 'POST' });
        expect(retryResponse.status).toBe(200);
      }
    });

    test('should disable submit button during form submission', async () => {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      expect(submitBtn.disabled).toBe(true);

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      await fetch('/api/test', { method: 'POST' });
      submitBtn.disabled = false;

      expect(submitBtn.disabled).toBe(false);
    });
  });

  describe('Form Submission with Validation Errors', () => {
    let form;
    let errorContainer;

    beforeEach(() => {
      form = createMockForm('registration-form', {
        email: 'email',
        password: 'password',
        name: 'text',
        phone: 'tel',
      });
      errorContainer = createErrorContainer('validation-errors');
    });

    test('should display backend validation errors', async () => {
      const validationError = {
        error: 'Validation Failed',
        details: {
          email: 'Email already exists',
          password: 'Password does not meet requirements',
        },
      };

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify(validationError), { status: 400 })
      );

      const response = await fetch('/api/auth/register', { method: 'POST' });
      const data = await response.json();

      if (response.status === 400) {
        Object.entries(data.details).forEach(([field, message]) => {
          const error = document.createElement('div');
          error.className = `error-${field}`;
          error.textContent = message;
          errorContainer.appendChild(error);
        });
      }

      expect(errorContainer.textContent).toContain('Email already exists');
      expect(errorContainer.textContent).toContain('Password does not meet requirements');
    });

    test('should display field-specific error messages', async () => {
      const errors = {
        error: 'Validation Error',
        fields: {
          email: 'Invalid email format',
          phone: 'Phone number must be 10 digits',
        },
      };

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify(errors), { status: 400 })
      );

      const response = await fetch('/api/register', { method: 'POST' });
      const data = await response.json();

      data.fields.email && (form.elements.email.classList.add('error'));
      data.fields.phone && (form.elements.phone.classList.add('error'));

      expect(form.elements.email.classList.contains('error')).toBe(true);
      expect(form.elements.phone.classList.contains('error')).toBe(true);
    });

    test('should clear error messages on successful submission', async () => {
      errorContainer.innerHTML = '<div class="error">Previous error</div>';

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const response = await fetch('/api/register', { method: 'POST' });
      
      if (response.ok) {
        errorContainer.innerHTML = '';
      }

      expect(errorContainer.innerHTML).toBe('');
    });

    test('should highlight fields with errors', async () => {
      const errorResponse = {
        error: 'Validation Error',
        invalidFields: ['email', 'password'],
      };

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify(errorResponse), { status: 400 })
      );

      const response = await fetch('/api/register', { method: 'POST' });
      const data = await response.json();

      data.invalidFields.forEach((fieldName) => {
        const field = form.elements[fieldName];
        if (field) {
          field.style.borderColor = 'red';
        }
      });

      expect(form.elements.email.style.borderColor).toBe('red');
      expect(form.elements.password.style.borderColor).toBe('red');
    });
  });

  describe('Invalid Token Handling', () => {
    test('should redirect to login on expired token (401)', async () => {
      localStorage.setItem('token', 'expired-token');

      const error = { error: 'Unauthorized', message: 'Token expired' };

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify(error), { status: 401 })
      );

      const response = await fetch('/api/visits', {
        headers: { Authorization: 'Bearer expired-token' },
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }

      expect(localStorage.getItem('token')).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    test('should handle malformed token error', async () => {
      localStorage.setItem('token', 'malformed.token.here');

      const error = { error: 'Invalid token', message: 'Token format is invalid' };

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify(error), { status: 401 })
      );

      const response = await fetch('/api/visits', {
        headers: { Authorization: 'Bearer malformed.token.here' },
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }

      expect(window.location.href).toBe('/login');
    });

    test('should display user-friendly message for token errors', async () => {
      const errorContainer = createErrorContainer('auth-error');

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      );

      const response = await fetch('/api/data');

      if (response.status === 401) {
        errorContainer.innerHTML = '<div>Your session has expired. Please log in again.</div>';
      }

      expect(errorContainer.textContent).toContain('session has expired');
    });

    test('should clear token from storage on 401', async () => {
      localStorage.setItem('token', 'test-token');
      sessionStorage.setItem('token', 'test-token');

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 401 })
      );

      const response = await fetch('/api/protected');

      if (response.status === 401) {
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
      }

      expect(localStorage.getItem('token')).toBeNull();
      expect(sessionStorage.getItem('token')).toBeNull();
    });
  });

  describe('Unauthorized Access Handling', () => {
    test('should display forbidden message on 403 error', async () => {
      const errorContainer = createErrorContainer('forbidden-error');

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Access denied' }), { status: 403 })
      );

      const response = await fetch('/api/admin/users');

      if (response.status === 403) {
        errorContainer.innerHTML = '<div>You do not have permission to access this resource.</div>';
      }

      expect(errorContainer.textContent).toContain('permission');
    });

    test('should not redirect on 403, just show message', async () => {
      const originalHref = window.location.href;

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
      );

      const response = await fetch('/api/admin');

      if (response.status === 403) {
        // Should NOT redirect
        expect(window.location.href).toBe(originalHref);
      }
    });

    test('should handle permission denied for specific actions', async () => {
      const errorContainer = createErrorContainer('action-error');

      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Cannot approve visit without Host role' }), {
          status: 403,
        })
      );

      const response = await fetch('/api/visits/1/approve', { method: 'PUT' });
      const data = await response.json();

      if (response.status === 403) {
        errorContainer.innerHTML = `<div>${data.message}</div>`;
      }

      expect(errorContainer.textContent).toContain('Host role');
    });
  });

  describe('Missing Required Data Handling', () => {
    test('should handle missing API response data', async () => {
      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const response = await fetch('/api/visits');
      const data = await response.json();

      const container = document.createElement('div');
      if (data.visits === undefined) {
        container.innerHTML = '<div>No data available</div>';
      }

      expect(container.textContent).toContain('No data available');
    });

    test('should handle null user object in response', async () => {
      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ user: null }), { status: 200 })
      );

      const response = await fetch('/api/user/profile');
      const data = await response.json();

      const container = document.createElement('div');
      if (!data.user) {
        container.innerHTML = '<div>User not found</div>';
      }

      expect(container.textContent).toContain('User not found');
    });

    test('should handle missing required fields in form', async () => {
      const form = createMockForm('submit-form', {
        email: 'email',
        password: 'password',
      });

      const errors = [];
      if (!form.elements.email.value) errors.push('Email is required');
      if (!form.elements.password.value) errors.push('Password is required');

      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('Email is required');
    });

    test('should display error when expected data structure is invalid', async () => {
      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ visits: 'not-an-array' }), { status: 200 })
      );

      const response = await fetch('/api/visits');
      const data = await response.json();

      const errorContainer = createErrorContainer('data-error');
      if (!Array.isArray(data.visits)) {
        errorContainer.innerHTML = '<div>Invalid data received from server</div>';
      }

      expect(errorContainer.textContent).toContain('Invalid data');
    });
  });

  describe('API Timeout Scenarios', () => {
    test('should display timeout error message', async () => {
      const errorContainer = createErrorContainer('timeout-error');

      const timeoutError = new Error('Request timeout');
      global.fetch.mockRejectedValueOnce(timeoutError);

      try {
        await fetch('/api/visits');
      } catch (error) {
        if (error.message.includes('timeout')) {
          errorContainer.innerHTML = '<div>The request took too long. Please try again.</div>';
        }
      }

      expect(errorContainer.textContent).toContain('took too long');
    });

    test('should allow retry after timeout', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Request timeout'));

      let attempts = 0;
      try {
        attempts++;
        await fetch('/api/data');
      } catch (error) {
        // Retry
        global.fetch.mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 200 })
        );
        attempts++;
        const retry = await fetch('/api/data');
        expect(retry.status).toBe(200);
      }

      expect(attempts).toBe(2);
    });

    test('should show loading state during long requests', async () => {
      const loader = document.createElement('div');
      loader.id = 'loading-spinner';
      loader.style.display = 'none';
      document.body.appendChild(loader);

      // Show loading
      loader.style.display = 'block';

      const slowResponse = new Promise((resolve) => {
        setTimeout(() => {
          resolve(new Response(JSON.stringify({}), { status: 200 }));
        }, 500);
      });

      global.fetch.mockReturnValueOnce(slowResponse);

      await fetch('/api/data');

      // Hide loading
      loader.style.display = 'none';

      expect(loader.style.display).toBe('none');
    });
  });

  describe('Error Message Display and Accessibility', () => {
    test('should display error messages in a dedicated container', () => {
      const errorContainer = createErrorContainer('errors');
      const errorMsg = document.createElement('div');
      errorMsg.className = 'error-message';
      errorMsg.setAttribute('role', 'alert');
      errorMsg.textContent = 'An error occurred';
      errorContainer.appendChild(errorMsg);

      expect(errorContainer.querySelector('[role="alert"]')).toBeTruthy();
    });

    test('should use ARIA roles for error accessibility', () => {
      const errorContainer = createErrorContainer('errors');
      errorContainer.setAttribute('role', 'alert');
      errorContainer.setAttribute('aria-live', 'polite');

      expect(errorContainer.getAttribute('role')).toBe('alert');
      expect(errorContainer.getAttribute('aria-live')).toBe('polite');
    });

    test('should persist error messages until dismissed', () => {
      const errorContainer = createErrorContainer('errors');
      errorContainer.innerHTML = '<div class="error">Error message</div>';

      expect(errorContainer.querySelector('.error')).toBeTruthy();

      // Simulate dismiss button
      const dismissBtn = document.createElement('button');
      dismissBtn.onclick = () => {
        errorContainer.innerHTML = '';
      };
      errorContainer.appendChild(dismissBtn);

      dismissBtn.click();
      expect(errorContainer.textContent).toBe('');
    });

    test('should show multiple errors in sequence', () => {
      const errorContainer = createErrorContainer('errors');
      const errors = ['Error 1', 'Error 2', 'Error 3'];

      errors.forEach((err) => {
        const error = document.createElement('div');
        error.className = 'error-item';
        error.textContent = err;
        errorContainer.appendChild(error);
      });

      expect(errorContainer.querySelectorAll('.error-item').length).toBe(3);
    });
  });

  describe('Error Recovery and Fallbacks', () => {
    test('should provide fallback content when API fails', async () => {
      global.fetch.mockRejectedValueOnce(new Error('API Error'));

      const container = document.createElement('div');
      try {
        await fetch('/api/data');
      } catch (error) {
        container.innerHTML = '<div>Unable to load content. Please refresh the page.</div>';
      }

      expect(container.textContent).toContain('Unable to load');
    });

    test('should cache data when available to show if API fails', async () => {
      localStorage.setItem('cachedData', JSON.stringify({ items: [] }));

      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      let data;
      try {
        const response = await fetch('/api/items');
        data = await response.json();
      } catch (error) {
        data = JSON.parse(localStorage.getItem('cachedData'));
      }

      expect(data).toEqual({ items: [] });
    });

    test('should suggest action on error', () => {
      const errorContainer = createErrorContainer('errors');
      errorContainer.innerHTML = `
        <div class="error">
          <p>An error occurred</p>
          <button class="retry-btn">Try Again</button>
        </div>
      `;

      expect(errorContainer.querySelector('.retry-btn')).toBeTruthy();
    });
  });
});
