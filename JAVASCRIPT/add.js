// DOM elements
const forgotModal = document.getElementById('forgotPasswordModal');
const forgotLink = document.querySelector('.forgot-link');
const closeModalBtn = forgotModal.querySelector('.close-modal');
const cancelBtn = document.getElementById('cancelForgotBtn');

// Step elements
const step1 = document.getElementById('forgotStep1');
const step2 = document.getElementById('forgotStep2');
const step3 = document.getElementById('forgotStep3');

// Buttons
const sendCodeBtn = document.getElementById('sendResetCodeBtn');
const verifyOtpBtn = document.getElementById('verifyOtpBtn');
const resetPasswordBtn = document.getElementById('resetPasswordBtn');
const resendOtpBtn = document.getElementById('resendOtpBtn');

// Inputs
const resetEmail = document.getElementById('resetEmail');
const resetOtp = document.getElementById('resetOtp');
const newPassword = document.getElementById('newPassword');
const confirmNewPassword = document.getElementById('confirmNewPassword');

let resendTimer = null;
let timerInterval = null;

// Show modal when "Forgot Password?" is clicked
if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        resetModal();          // reset all steps
        forgotModal.style.display = 'flex';   // show modal
    });
}

// Close modal functions
function closeForgotModal() {
    forgotModal.style.display = 'none';   // hide modal
    resetModal();
}

function resetModal() {
    step1.style.display = 'block';
    step2.style.display = 'none';
    step3.style.display = 'none';
    resetEmail.value = '';
    resetOtp.value = '';
    newPassword.value = '';
    confirmNewPassword.value = '';
    if (timerInterval) clearInterval(timerInterval);
    const timerSpan = document.getElementById('resendTimer');
    if (timerSpan) timerSpan.textContent = '';
}

closeModalBtn.addEventListener('click', closeForgotModal);
cancelBtn.addEventListener('click', closeForgotModal);

// Click outside modal to close
forgotModal.addEventListener('click', (e) => {
    if (e.target === forgotModal) closeForgotModal();
});

// Step 1: Send OTP
sendCodeBtn.addEventListener('click', async () => {
    const email = resetEmail.value.trim();
    if (!email) {
        showNotification('Please enter your email', 'error');
        return;
    }

    sendCodeBtn.disabled = true;
    sendCodeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
        const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();

        if (response.ok) {
            showNotification(data.message || 'Reset code sent', 'success');
            step1.style.display = 'none';
            step2.style.display = 'block';
            startResendTimer();
        } else {
            showNotification(data.error || 'Failed to send code', 'error');
        }
    } catch (err) {
        console.error(err);
        showNotification('Network error. Please try again.', 'error');
    } finally {
        sendCodeBtn.disabled = false;
        sendCodeBtn.innerHTML = 'Send Reset Code';
    }
});

// Resend OTP
resendOtpBtn.addEventListener('click', async () => {
    const email = resetEmail.value.trim();
    if (!email) {
        showNotification('Email is required', 'error');
        return;
    }

    resendOtpBtn.disabled = true;
    try {
        const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();
        if (response.ok) {
            showNotification('A new code has been sent', 'success');
            resetOtp.value = '';
            startResendTimer();
        } else {
            showNotification(data.error || 'Failed to resend code', 'error');
        }
    } catch (err) {
        showNotification('Network error', 'error');
    } finally {
        resendOtpBtn.disabled = false;
    }
});

function startResendTimer() {
    let seconds = 60;
    const timerSpan = document.getElementById('resendTimer');
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (seconds <= 0) {
            clearInterval(timerInterval);
            timerSpan.textContent = '';
            resendOtpBtn.disabled = false;
        } else {
            timerSpan.textContent = `${seconds}s`;
            seconds--;
            resendOtpBtn.disabled = true;
        }
    }, 1000);
}

// Step 2: Verify OTP
verifyOtpBtn.addEventListener('click', async () => {
    const email = resetEmail.value.trim();
    const otp = resetOtp.value.trim();

    if (!otp || otp.length !== 6) {
        showNotification('Please enter the 6-digit code', 'error');
        return;
    }

    verifyOtpBtn.disabled = true;
    verifyOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';

    try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-reset-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        const data = await response.json();

        if (response.ok && data.valid) {
            step2.style.display = 'none';
            step3.style.display = 'block';
        } else {
            showNotification(data.error || 'Invalid code', 'error');
        }
    } catch (err) {
        console.error(err);
        showNotification('Verification failed', 'error');
    } finally {
        verifyOtpBtn.disabled = false;
        verifyOtpBtn.innerHTML = 'Verify Code';
    }
});

// Step 3: Reset Password
resetPasswordBtn.addEventListener('click', async () => {
    const email = resetEmail.value.trim();
    const otp = resetOtp.value.trim();
    const pwd = newPassword.value;
    const confirmPwd = confirmNewPassword.value;

    if (!pwd || pwd !== confirmPwd) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    // Optional password strength check (reuse your existing function)
    const strength = checkPasswordStrength(pwd);
    if (strength.score < 2) {
        showNotification('Please use a stronger password', 'error');
        return;
    }

    resetPasswordBtn.disabled = true;
    resetPasswordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';

    try {
        const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp, new_password: pwd })
        });
        const data = await response.json();

        if (response.ok) {
            showNotification('Password reset successful. You can now log in.', 'success');
            closeForgotModal();
        } else {
            showNotification(data.error || 'Failed to reset password', 'error');
        }
    } catch (err) {
        console.error(err);
        showNotification('Reset failed', 'error');
    } finally {
        resetPasswordBtn.disabled = false;
        resetPasswordBtn.innerHTML = 'Reset Password';
    }
});