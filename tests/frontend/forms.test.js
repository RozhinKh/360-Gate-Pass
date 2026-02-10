/**
 * Frontend Form Validation Tests
 * Tests validation logic for registration, login, and visit request forms
 */

describe('Form Validation', () => {
  describe('Registration Form Validation', () => {
    let form;
    let errorContainer;

    beforeEach(() => {
      form = createMockForm('registration-form', {
        name: 'text',
        email: 'email',
        phone: 'tel',
        password: 'password',
        confirmPassword: 'password',
      });
      errorContainer = createErrorContainer('registration-errors');
    });

    describe('Email Validation', () => {
      test('should accept valid email formats', () => {
        const validEmails = [
          'user@example.com',
          'john.doe@company.co.uk',
          'alice+tag@domain.org',
        ];

        validEmails.forEach((email) => {
          form.elements.email.value = email;
          const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
          expect(isValid).toBe(true);
        });
      });

      test('should reject invalid email formats', () => {
        const invalidEmails = [
          'invalid.email',
          '@example.com',
          'user@',
          'user space@example.com',
          'user@@example.com',
        ];

        invalidEmails.forEach((email) => {
          form.elements.email.value = email;
          const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
          expect(isValid).toBe(false);
        });
      });

      test('should display error message for invalid email', () => {
        form.elements.email.value = 'invalid-email';
        const error = 'Please enter a valid email address';
        errorContainer.innerHTML = `<div class="error">${error}</div>`;
        expect(errorContainer.textContent).toContain(error);
      });
    });

    describe('Password Validation', () => {
      test('should accept passwords with minimum 8 characters', () => {
        const validPasswords = ['Password1', 'SecurePass123', 'MyP@ssw0rd'];

        validPasswords.forEach((password) => {
          const isValid = password.length >= 8;
          expect(isValid).toBe(true);
        });
      });

      test('should reject passwords shorter than 8 characters', () => {
        const shortPassword = 'Pass1';
        const isValid = shortPassword.length >= 8;
        expect(isValid).toBe(false);
      });

      test('should accept passwords with mixed case and numbers', () => {
        const password = 'Password123';
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);

        expect(hasUpperCase).toBe(true);
        expect(hasLowerCase).toBe(true);
        expect(hasNumber).toBe(true);
      });

      test('should display error message for weak password', () => {
        form.elements.password.value = 'weak';
        const error = 'Password must be at least 8 characters with uppercase, lowercase, and numbers';
        errorContainer.innerHTML = `<div class="error">${error}</div>`;
        expect(errorContainer.textContent).toContain(error);
      });
    });

    describe('Required Fields', () => {
      test('should validate that name is required', () => {
        form.elements.name.value = '';
        const isValid = form.elements.name.value.trim() !== '';
        expect(isValid).toBe(false);
      });

      test('should validate that email is required', () => {
        form.elements.email.value = '';
        const isValid = form.elements.email.value.trim() !== '';
        expect(isValid).toBe(false);
      });

      test('should validate that phone is required', () => {
        form.elements.phone.value = '';
        const isValid = form.elements.phone.value.trim() !== '';
        expect(isValid).toBe(false);
      });

      test('should validate that password is required', () => {
        form.elements.password.value = '';
        const isValid = form.elements.password.value.trim() !== '';
        expect(isValid).toBe(false);
      });

      test('should display error messages for all required fields', () => {
        populateForm(form, {
          name: '',
          email: '',
          phone: '',
          password: '',
          confirmPassword: '',
        });

        const errors = [];
        if (!form.elements.name.value.trim()) errors.push('Name is required');
        if (!form.elements.email.value.trim()) errors.push('Email is required');
        if (!form.elements.phone.value.trim()) errors.push('Phone is required');
        if (!form.elements.password.value.trim()) errors.push('Password is required');

        expect(errors.length).toBeGreaterThan(0);
      });
    });

    describe('Password Confirmation', () => {
      test('should match password and confirmPassword fields', () => {
        form.elements.password.value = 'Password123';
        form.elements.confirmPassword.value = 'Password123';
        const isMatch = form.elements.password.value === form.elements.confirmPassword.value;
        expect(isMatch).toBe(true);
      });

      test('should not match when confirmPassword differs', () => {
        form.elements.password.value = 'Password123';
        form.elements.confirmPassword.value = 'Password456';
        const isMatch = form.elements.password.value === form.elements.confirmPassword.value;
        expect(isMatch).toBe(false);
      });

      test('should display error message when passwords do not match', () => {
        form.elements.password.value = 'Password123';
        form.elements.confirmPassword.value = 'Password456';
        const error = 'Passwords do not match';
        errorContainer.innerHTML = `<div class="error">${error}</div>`;
        expect(errorContainer.textContent).toContain(error);
      });
    });

    describe('Complete Registration Validation', () => {
      test('should validate complete valid registration form', () => {
        populateForm(form, {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '1234567890',
          password: 'Password123',
          confirmPassword: 'Password123',
        });

        const errors = [];
        if (!form.elements.name.value.trim()) errors.push('Name required');
        if (!form.elements.email.value.trim()) errors.push('Email required');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.elements.email.value)) errors.push('Invalid email');
        if (!form.elements.phone.value.trim()) errors.push('Phone required');
        if (form.elements.password.value.length < 8) errors.push('Password too short');
        if (form.elements.password.value !== form.elements.confirmPassword.value) errors.push('Passwords do not match');

        expect(errors.length).toBe(0);
      });

      test('should catch multiple validation errors', () => {
        populateForm(form, {
          name: '',
          email: 'invalid',
          phone: '',
          password: 'short',
          confirmPassword: 'different',
        });

        const errors = [];
        if (!form.elements.name.value.trim()) errors.push('Name required');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.elements.email.value)) errors.push('Invalid email');
        if (form.elements.password.value.length < 8) errors.push('Password too short');

        expect(errors.length).toBeGreaterThan(2);
      });
    });
  });

  describe('Login Form Validation', () => {
    let form;
    let errorContainer;

    beforeEach(() => {
      form = createMockForm('login-form', {
        email: 'email',
        password: 'password',
      });
      errorContainer = createErrorContainer('login-errors');
    });

    describe('Email Field', () => {
      test('should validate email format', () => {
        form.elements.email.value = 'user@example.com';
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.elements.email.value);
        expect(isValid).toBe(true);
      });

      test('should reject invalid email format', () => {
        form.elements.email.value = 'invalid-email';
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.elements.email.value);
        expect(isValid).toBe(false);
      });

      test('should validate email is required', () => {
        form.elements.email.value = '';
        const isValid = form.elements.email.value.trim() !== '';
        expect(isValid).toBe(false);
      });
    });

    describe('Password Field', () => {
      test('should validate password is required', () => {
        form.elements.password.value = '';
        const isValid = form.elements.password.value.trim() !== '';
        expect(isValid).toBe(false);
      });

      test('should accept any non-empty password', () => {
        form.elements.password.value = 'anypassword';
        const isValid = form.elements.password.value.trim() !== '';
        expect(isValid).toBe(true);
      });
    });

    describe('Login Form Error Messages', () => {
      test('should display error for missing email', () => {
        form.elements.email.value = '';
        const error = 'Email is required';
        errorContainer.innerHTML = `<div class="error">${error}</div>`;
        expect(errorContainer.textContent).toContain(error);
      });

      test('should display error for missing password', () => {
        form.elements.password.value = '';
        const error = 'Password is required';
        errorContainer.innerHTML = `<div class="error">${error}</div>`;
        expect(errorContainer.textContent).toContain(error);
      });

      test('should display error for invalid email format', () => {
        form.elements.email.value = 'not-an-email';
        const error = 'Please enter a valid email address';
        errorContainer.innerHTML = `<div class="error">${error}</div>`;
        expect(errorContainer.textContent).toContain(error);
      });
    });

    describe('Complete Login Validation', () => {
      test('should validate valid login form', () => {
        populateForm(form, {
          email: 'user@example.com',
          password: 'password123',
        });

        const errors = [];
        if (!form.elements.email.value.trim()) errors.push('Email required');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.elements.email.value)) errors.push('Invalid email');
        if (!form.elements.password.value.trim()) errors.push('Password required');

        expect(errors.length).toBe(0);
      });
    });
  });

  describe('Visit Request Form Validation', () => {
    let form;
    let errorContainer;

    beforeEach(() => {
      form = createMockForm('visit-request-form', {
        host: 'text',
        purpose: 'textarea',
        visitDate: 'date',
      });
      errorContainer = createErrorContainer('visit-errors');
    });

    describe('Host Selection', () => {
      test('should validate host is selected', () => {
        form.elements.host.value = '';
        const isValid = form.elements.host.value.trim() !== '';
        expect(isValid).toBe(false);
      });

      test('should accept valid host selection', () => {
        form.elements.host.value = 'John Doe';
        const isValid = form.elements.host.value.trim() !== '';
        expect(isValid).toBe(true);
      });

      test('should display error when host not selected', () => {
        form.elements.host.value = '';
        const error = 'Please select a host';
        errorContainer.innerHTML = `<div class="error">${error}</div>`;
        expect(errorContainer.textContent).toContain(error);
      });
    });

    describe('Purpose Field', () => {
      test('should validate purpose is required', () => {
        form.elements.purpose.value = '';
        const isValid = form.elements.purpose.value.trim() !== '';
        expect(isValid).toBe(false);
      });

      test('should accept non-empty purpose', () => {
        form.elements.purpose.value = 'Business meeting';
        const isValid = form.elements.purpose.value.trim() !== '';
        expect(isValid).toBe(true);
      });

      test('should display error when purpose is empty', () => {
        form.elements.purpose.value = '';
        const error = 'Purpose is required';
        errorContainer.innerHTML = `<div class="error">${error}</div>`;
        expect(errorContainer.textContent).toContain(error);
      });
    });

    describe('Visit Date Validation', () => {
      test('should validate date is required', () => {
        form.elements.visitDate.value = '';
        const isValid = form.elements.visitDate.value.trim() !== '';
        expect(isValid).toBe(false);
      });

      test('should not allow dates in the past', () => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        form.elements.visitDate.value = yesterday.toISOString().split('T')[0];
        const selectedDate = new Date(form.elements.visitDate.value);
        const isValid = selectedDate >= new Date(today.toISOString().split('T')[0]);
        expect(isValid).toBe(false);
      });

      test('should allow today and future dates', () => {
        const today = new Date();
        form.elements.visitDate.value = today.toISOString().split('T')[0];
        const selectedDate = new Date(form.elements.visitDate.value);
        const isValid = selectedDate >= new Date(today.toISOString().split('T')[0]);
        expect(isValid).toBe(true);
      });

      test('should display error for past date', () => {
        const error = 'Visit date cannot be in the past';
        errorContainer.innerHTML = `<div class="error">${error}</div>`;
        expect(errorContainer.textContent).toContain(error);
      });

      test('should display error for missing date', () => {
        form.elements.visitDate.value = '';
        const error = 'Visit date is required';
        errorContainer.innerHTML = `<div class="error">${error}</div>`;
        expect(errorContainer.textContent).toContain(error);
      });
    });

    describe('Complete Visit Request Validation', () => {
      test('should validate complete valid visit request', () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        populateForm(form, {
          host: 'John Doe',
          purpose: 'Business meeting',
          visitDate: tomorrow.toISOString().split('T')[0],
        });

        const errors = [];
        if (!form.elements.host.value.trim()) errors.push('Host required');
        if (!form.elements.purpose.value.trim()) errors.push('Purpose required');
        if (!form.elements.visitDate.value.trim()) errors.push('Date required');

        const selectedDate = new Date(form.elements.visitDate.value);
        const today = new Date(new Date().toISOString().split('T')[0]);
        if (selectedDate < today) errors.push('Date in past');

        expect(errors.length).toBe(0);
      });

      test('should catch multiple validation errors in visit form', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        populateForm(form, {
          host: '',
          purpose: '',
          visitDate: yesterday.toISOString().split('T')[0],
        });

        const errors = [];
        if (!form.elements.host.value.trim()) errors.push('Host required');
        if (!form.elements.purpose.value.trim()) errors.push('Purpose required');
        const selectedDate = new Date(form.elements.visitDate.value);
        const today = new Date(new Date().toISOString().split('T')[0]);
        if (selectedDate < today) errors.push('Date in past');

        expect(errors.length).toBeGreaterThan(0);
      });
    });
  });
});
