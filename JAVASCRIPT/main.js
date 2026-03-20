// main.js - Handles landing page, login, register functionality

// API Base URL
const API_BASE_URL = "https://bank-backend-blush.vercel.app/api";


// Check if user is already logged in
const token = localStorage.getItem('token');
if (token && window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html')) {
    // Verify token and redirect
    verifyToken(token);
}

async function verifyToken(token) {
    try {
        const response = await fetch(`${API_BASE_URL}/user/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const user = await response.json();
            if (user.role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'dashboard.html';
            }
        }
    } catch (error) {
        console.error('Token verification failed:', error);
    }
}

/*function toggleMobileMenu() {
  const navLinks = document.getElementById("nav-links");
  navLinks.classList.toggle("active");
}

// Close mobile menu when clicking outside
document.addEventListener("click", function (event) {
  const navLinks = document.getElementById("nav-links");
  const mobileBtn = document.querySelector("mobile-menu");

  if (!navLinks.contains(event.target) && !mobileBtn.contains(event.target)) {
    navLinks.classList.remove("active");
  }
});*/

// Login Form Handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const remember = document.querySelector('input[name="remember"]')?.checked || false;
        
        const loginBtn = document.getElementById('loginBtn');
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                if (data.requiresTwoFactor) {
                    // Show 2FA modal
                    showTwoFactorModal(data.userId);
                } else {
                    // Save token
                    localStorage.setItem('token', data.token);
                    if (remember) {
                        localStorage.setItem('remember', 'true');
                    }
                    
                    // Redirect based on role
                    if (data.user.role === 'admin') {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'dashboard.html';
                    }
                }
            } else {
                showNotification(data.error || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showNotification('Connection error. Please try again.', 'error');
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<span>Sign In</span><i class="fas fa-arrow-right"></i>';
        }
    });
}

// Register Form Handler
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    // Password strength checker
    const passwordInput = document.getElementById('password');
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.querySelector('.strength-text');
    
    if (passwordInput) {
        passwordInput.addEventListener('input', () => {
            const strength = checkPasswordStrength(passwordInput.value);
            updatePasswordStrength(strength);
        });
    }
    
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Validate passwords match
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm_password').value;
        
        if (password !== confirmPassword) {
            showNotification('Passwords do not match', 'error');
            return;
        }
        
        // Validate password strength
        const strength = checkPasswordStrength(password);
        if (strength.score < 2) {
            showNotification('Please use a stronger password', 'error');
            return;
        }
        
        const registerBtn = document.getElementById('registerBtn');
        registerBtn.disabled = true;
        registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
        
        try {
            const userData = {
                first_name: document.getElementById('first_name').value,
                last_name: document.getElementById('last_name').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                password: password
            };
            
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                localStorage.setItem('token', data.token);
                showNotification('Account created successfully!', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
            } else {
                showNotification(data.error || 'Registration failed', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            showNotification('Connection error. Please try again.', 'error');
        } finally {
            registerBtn.disabled = false;
            registerBtn.innerHTML = '<span>Create Account</span><i class="fas fa-user-plus"></i>';
        }
    });
}

// Password strength checker
function checkPasswordStrength(password) {
    let score = 0;
    const checks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        numbers: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password)
    };
    
    score = Object.values(checks).filter(Boolean).length;
    
    let strength = 'weak';
    if (score >= 4) strength = 'strong';
    else if (score >= 3) strength = 'medium';
    
    return { score, strength, checks };
}

function updatePasswordStrength({ strength, checks }) {
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.querySelector('.strength-text');
    
    if (strengthBar) {
        strengthBar.setAttribute('data-strength', strength);
    }
    
    if (strengthText) {
        const texts = {
            weak: 'Weak password',
            medium: 'Medium password',
            strong: 'Strong password'
        };
        strengthText.textContent = texts[strength] || '';
        strengthText.style.color = strength === 'weak' ? '#ef4444' : strength === 'medium' ? '#f59e0b' : '#10b981';
    }
}

// Toggle password visibility
document.querySelectorAll('.toggle-password').forEach(button => {
    button.addEventListener('click', function() {
        const input = this.previousElementSibling;
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        this.querySelector('i').classList.toggle('fa-eye');
        this.querySelector('i').classList.toggle('fa-eye-slash');
    });
});

// Two Factor Authentication Modal
function showTwoFactorModal(userId) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Two-Factor Authentication</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <p>Please enter the 6-digit code from your authenticator app.</p>
                <div class="otp-inputs">
                    <input type="text" maxlength="1" pattern="[0-9]" class="otp-digit" autofocus>
                    <input type="text" maxlength="1" pattern="[0-9]" class="otp-digit">
                    <input type="text" maxlength="1" pattern="[0-9]" class="otp-digit">
                    <input type="text" maxlength="1" pattern="[0-9]" class="otp-digit">
                    <input type="text" maxlength="1" pattern="[0-9]" class="otp-digit">
                    <input type="text" maxlength="1" pattern="[0-9]" class="otp-digit">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" id="cancel2FA">Cancel</button>
                <button class="btn btn-primary" id="verify2FA">Verify</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // OTP input handling
    const inputs = modal.querySelectorAll('.otp-digit');
    inputs.forEach((input, index) => {
        input.addEventListener('keyup', (e) => {
            if (e.key >= '0' && e.key <= '9') {
                if (index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }
            } else if (e.key === 'Backspace') {
                if (index > 0) {
                    inputs[index - 1].focus();
                }
            }
            
            // Auto-submit when all digits are filled
            const allFilled = Array.from(inputs).every(i => i.value.length === 1);
            if (allFilled) {
                const code = Array.from(inputs).map(i => i.value).join('');
                verify2FA(userId, code);
            }
        });
    });
    
    // Close modal
    modal.querySelector('.close-modal').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('#cancel2FA').addEventListener('click', () => {
        modal.remove();
    });
    
    // Verify 2FA
    modal.querySelector('#verify2FA').addEventListener('click', () => {
        const code = Array.from(inputs).map(i => i.value).join('');
        verify2FA(userId, code);
    });
}

async function verify2FA(userId, token) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-2fa`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId, token })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            
            // Close all modals
            document.querySelectorAll('.modal').forEach(m => m.remove());
            
            // Redirect based on role
            if (data.user.role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'dashboard.html';
            }
        } else {
            showNotification(data.error || 'Invalid verification code', 'error');
        }
    } catch (error) {
        console.error('2FA verification error:', error);
        showNotification('Verification failed', 'error');
    }
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Add styles for notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Mobile menu toggle
/*const mobileMenuBtn = document.querySelector('.mobile-menu');
if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        const navLinks = document.querySelector('.nav-links');
        navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
    });
}*/

const mobileMenuBtn = document.querySelector('.mobile-menu');

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        const navLinks = document.querySelector('.nav-links');

        if (navLinks.style.display === 'flex') {
            navLinks.style.display = 'none';
        } else {
            navLinks.style.display = 'flex';
            navLinks.style.flexDirection = 'row'; // 👈 THIS is the fix
        }
    });
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});