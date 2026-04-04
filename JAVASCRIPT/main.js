// main.js - Handles landing page, login, register functionality

// API Base URL
const API_BASE_URL = "https://bank-backend-blush.vercel.app/api";

// Check if user is already logged in
const token = localStorage.getItem("token");
if (
  (token && window.location.pathname.includes("login.html")) ||
  window.location.pathname.includes("register.html")
) {
  // Verify token and redirect
  verifyToken(token);
}

async function verifyToken(token) {
  try {
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const user = await response.json();
      if (user.role === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "dashboard.html";
      }
    }
  } catch (error) {
    console.error("Token verification failed:", error);
  }
}

// Login Form Handler
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const remember =
      document.querySelector('input[name="remember"]')?.checked || false;

    const loginBtn = document.getElementById("loginBtn");
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requiresTwoFactor) {
          // Show 2FA modal
          showTwoFactorModal(data.userId);
        } else {
          // Save token
          localStorage.setItem("token", data.token);
          if (remember) {
            localStorage.setItem("remember", "true");
          }

          // Redirect based on role
          if (data.user.role === "admin") {
            window.location.href = "admin.html";
          } else {
            window.location.href = "dashboard.html";
          }
        }
      } else {
        showNotification(data.error || "Login failed", "error");
      }
    } catch (error) {
      console.error("Login error:", error);
      showNotification("Connection error. Please try again.", "error");
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML =
        '<span>Sign In</span><i class="fas fa-arrow-right"></i>';
    }
  });
}





// Toggle password visibility
document.querySelectorAll(".toggle-password").forEach((button) => {
  button.addEventListener("click", function () {
    const input = this.previousElementSibling;
    const type =
      input.getAttribute("type") === "password" ? "text" : "password";
    input.setAttribute("type", type);
    this.querySelector("i").classList.toggle("fa-eye");
    this.querySelector("i").classList.toggle("fa-eye-slash");
  });
});

// Two Factor Authentication Modal
function showTwoFactorModal(userId) {
  const modal = document.createElement("div");
  modal.className = "modal show";
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
  const inputs = modal.querySelectorAll(".otp-digit");
  inputs.forEach((input, index) => {
    input.addEventListener("keyup", (e) => {
      if (e.key >= "0" && e.key <= "9") {
        if (index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      } else if (e.key === "Backspace") {
        if (index > 0) {
          inputs[index - 1].focus();
        }
      }

      // Auto-submit when all digits are filled
      const allFilled = Array.from(inputs).every((i) => i.value.length === 1);
      if (allFilled) {
        const code = Array.from(inputs)
          .map((i) => i.value)
          .join("");
        verify2FA(userId, code);
      }
    });
  });

  // Close modal
  modal.querySelector(".close-modal").addEventListener("click", () => {
    modal.remove();
  });

  modal.querySelector("#cancel2FA").addEventListener("click", () => {
    modal.remove();
  });

  // Verify 2FA
  modal.querySelector("#verify2FA").addEventListener("click", () => {
    const code = Array.from(inputs)
      .map((i) => i.value)
      .join("");
    verify2FA(userId, code);
  });
}

async function verify2FA(userId, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/verify-2fa`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, token }),
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem("token", data.token);

      // Close all modals
      document.querySelectorAll(".modal").forEach((m) => m.remove());

      // Redirect based on role
      if (data.user.role === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "dashboard.html";
      }
    } else {
      showNotification(data.error || "Invalid verification code", "error");
    }
  } catch (error) {
    console.error("2FA verification error:", error);
    showNotification("Verification failed", "error");
  }
}

// Face Verification Variables
let currentStream = null;
let capturedImageData = null;

// Initialize face verification when page loads
if (document.getElementById("registerForm")) {
  initializeFaceVerification();
}

function initializeFaceVerification() {
  const startCameraBtn = document.getElementById("startCameraBtn");
  const capturePhotoBtn = document.getElementById("capturePhotoBtn");
  const retakePhotoBtn = document.getElementById("retakePhotoBtn");
  const uploadPhotoBtn = document.getElementById("uploadPhotoBtn");
  const photoUpload = document.getElementById("photoUpload");
  const video = document.getElementById("video");
  const capturedImage = document.getElementById("capturedImage");
  const placeholderImage = document.getElementById("placeholderImage");
  const faceStatus = document.getElementById("faceStatus");
  const faceVerifiedCheckbox = document.getElementById("faceVerified");

  // Start Camera
  startCameraBtn.addEventListener("click", async () => {
    try {
      if (currentStream) {
        stopCamera();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });

      currentStream = stream;
      video.srcObject = stream;
      video.style.display = "block";
      capturedImage.style.display = "none";
      placeholderImage.style.display = "none";

      startCameraBtn.style.display = "none";
      capturePhotoBtn.style.display = "inline-block";
      uploadPhotoBtn.style.display = "none";
      retakePhotoBtn.style.display = "none";

      faceStatus.style.display = "block";
      faceStatus.className = "face-status info";
      faceStatus.innerHTML =
        '<i class="fas fa-camera"></i> Camera active. Position your face clearly and click Capture.';
    } catch (err) {
      console.error("Camera error:", err);
      faceStatus.style.display = "block";
      faceStatus.className = "face-status error";
      faceStatus.innerHTML =
        '<i class="fas fa-exclamation-triangle"></i> Unable to access camera. Please check permissions or use upload option.';
    }
  });

  // Capture Photo
  // Capture Photo - Updated with compression
  capturePhotoBtn.addEventListener("click", async () => {
    if (!currentStream) {
      faceStatus.innerHTML =
        '<i class="fas fa-exclamation-triangle"></i> Please start camera first';
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get original capture
    const originalDataUrl = canvas.toDataURL("image/jpeg", 0.9);

    // Show compression status
    faceStatus.style.display = "block";
    faceStatus.className = "face-status info";
    faceStatus.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Processing image...';

    // Compress the image
    const compressedDataUrl = await compressImage(
      originalDataUrl,
      300,
      300,
      0.6,
    );
    capturedImageData = compressedDataUrl;
    capturedImage.src = compressedDataUrl;

    // Stop camera
    stopCamera();

    // Update UI
    video.style.display = "none";
    capturedImage.style.display = "block";
    placeholderImage.style.display = "none";

    capturePhotoBtn.style.display = "none";
    retakePhotoBtn.style.display = "inline-block";
    uploadPhotoBtn.style.display = "inline-block";
    startCameraBtn.style.display = "none";

    // Validate and compress
    validateFaceImage(compressedDataUrl);

    faceStatus.style.display = "block";
    faceStatus.className = "face-status success";
    faceStatus.innerHTML =
      '<i class="fas fa-check-circle"></i> Photo captured and optimized!';
    faceVerifiedCheckbox.checked = true;
  });

  // Retake Photo
  retakePhotoBtn.addEventListener("click", () => {
    capturedImageData = null;
    capturedImage.style.display = "none";

    startCameraBtn.style.display = "inline-block";
    capturePhotoBtn.style.display = "none";
    retakePhotoBtn.style.display = "none";
    uploadPhotoBtn.style.display = "inline-block";

    faceStatus.style.display = "block";
    faceStatus.className = "face-status info";
    faceStatus.innerHTML =
      '<i class="fas fa-info-circle"></i> Please capture or upload a clear photo of your face';
    faceVerifiedCheckbox.checked = false;
  });

  // Upload Photo - Updated with compression
  uploadPhotoBtn.addEventListener("click", () => {
    photoUpload.click();
  });

  photoUpload.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        faceStatus.style.display = "block";
        faceStatus.className = "face-status error";
        faceStatus.innerHTML =
          '<i class="fas fa-exclamation-triangle"></i> File too large. Maximum 2MB.';
        return;
      }

      // Check file type
      if (!file.type.startsWith("image/")) {
        faceStatus.style.display = "block";
        faceStatus.className = "face-status error";
        faceStatus.innerHTML =
          '<i class="fas fa-exclamation-triangle"></i> Please upload an image file.';
        return;
      }

      faceStatus.style.display = "block";
      faceStatus.className = "face-status info";
      faceStatus.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Processing image...';

      const reader = new FileReader();
      reader.onload = async function (event) {
        // Compress the uploaded image
        const compressed = await compressImage(
          event.target.result,
          300,
          300,
          0.6,
        );
        capturedImageData = compressed;
        capturedImage.src = compressed;

        if (currentStream) {
          stopCamera();
        }

        video.style.display = "none";
        capturedImage.style.display = "block";
        placeholderImage.style.display = "none";

        startCameraBtn.style.display = "inline-block";
        capturePhotoBtn.style.display = "none";
        retakePhotoBtn.style.display = "inline-block";
        uploadPhotoBtn.style.display = "inline-block";

        validateFaceImage(compressed);

        faceStatus.style.display = "block";
        faceStatus.className = "face-status success";
        faceStatus.innerHTML =
          '<i class="fas fa-check-circle"></i> Photo uploaded and optimized!';
        faceVerifiedCheckbox.checked = true;
      };
      reader.readAsDataURL(file);
    }
  });
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
    currentStream = null;
  }
}

// Updated face image validation with size check
function validateFaceImage(imageData) {
  const img = new Image();
  img.onload = async () => {
    // Check dimensions
    if (img.width < 100 || img.height < 100) {
      const faceStatus = document.getElementById("faceStatus");
      faceStatus.className = "face-status error";
      faceStatus.innerHTML =
        '<i class="fas fa-exclamation-triangle"></i> Image too small. Please use a clearer photo.';
      document.getElementById("faceVerified").checked = false;
      return false;
    }

    // Check aspect ratio (should be roughly portrait)
    const aspectRatio = img.width / img.height;
    if (aspectRatio > 1.5 || aspectRatio < 0.5) {
      const faceStatus = document.getElementById("faceStatus");
      faceStatus.className = "face-status warning";
      faceStatus.innerHTML =
        '<i class="fas fa-exclamation-triangle"></i> Photo orientation looks off. Please use a front-facing photo.';
    }

    console.log(
      "Face image validated - dimensions:",
      img.width,
      "x",
      img.height,
    );

    // Compress the image
    const compressed = await compressImage(imageData, 300, 300, 0.6);
    capturedImageData = compressed;

    // Update preview with compressed version
    const capturedImage = document.getElementById("capturedImage");
    if (capturedImage) {
      capturedImage.src = compressed;
    }

    const faceStatus = document.getElementById("faceStatus");
    faceStatus.className = "face-status success";
    faceStatus.innerHTML =
      '<i class="fas fa-check-circle"></i> Photo accepted!';

    return true;
  };
  img.src = imageData;
}

// register form handler
const registerForm = document.getElementById("registerForm");
// Update the register form submission
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const passwordInput = document.getElementById("password");
    //const strengthBar = document.querySelector(".strength-bar");
    //const strengthText = document.querySelector(".strength-text");

    if (passwordInput) {
      passwordInput.addEventListener("input", () => {
        const strength = checkPasswordStrength(passwordInput.value);
        updatePasswordStrength(strength);
      });
    }

    const registerBtn = document.getElementById("registerBtn");
    const originalBtnText = registerBtn.innerHTML;

    // Validate face verification
    if (!capturedImageData) {
      showNotification(
        "Please complete face verification before registering",
        "error",
      );
      return;
    }

    // Check image size before sending (should be under 500KB after compression)
    const imageSize = Math.ceil(capturedImageData.length * 0.75); // Approximate size in bytes
    console.log("Compressed image size:", Math.round(imageSize / 1024), "KB");

    if (imageSize > 500 * 1024) {
      showNotification(
        "Face image is still too large. Please try capturing again with better lighting.",
        "error",
      );
      return;
    }

    // Validate passwords match
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm_password").value;

    if (password !== confirmPassword) {
      showNotification("Passwords do not match", "error");
      return;
    }

    // Validate password strength
    const strength = checkPasswordStrength(password);
    if (strength.score < 2) {
      showNotification(
        "Please use a stronger password (at least 8 characters with numbers and symbols)",
        "error",
      );
      return;
    }

    registerBtn.disabled = true;
    registerBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Creating account...';

    try {
      // Prepare user data
      const userData = {
        first_name: document.getElementById("first_name").value.trim(),
        last_name: document.getElementById("last_name").value.trim(),
        email: document.getElementById("email").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        country: document.getElementById("country").value,
        city: document.getElementById("city").value.trim(),
        address: document.getElementById("address").value.trim(),
        security_question_1: document.getElementById("security_question_1")
          .value,
        security_answer_1: document
          .getElementById("security_answer_1")
          .value.trim(),
        security_question_2: document.getElementById("security_question_2")
          .value,
        security_answer_2: document
          .getElementById("security_answer_2")
          .value.trim(),
        password: password,
        face_image: capturedImageData, // Already compressed
      };

      console.log(
        "Sending registration with compressed image size:",
        Math.round(capturedImageData.length / 1024),
        "KB",
      );

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("userFaceImage", capturedImageData);
        localStorage.setItem("userData", JSON.stringify(data.user));
        showNotification(
          "Account created successfully! Redirecting...",
          "success",
        );
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 1500);
      } else {
        showNotification(data.error || "Registration failed", "error");
        registerBtn.disabled = false;
        registerBtn.innerHTML = originalBtnText;
      }
    } catch (error) {
      console.error("Registration error:", error);
      if (error.message.includes("413")) {
        showNotification(
          "Image too large. Please try capturing with better lighting for a smaller file size.",
          "error",
        );
      } else {
        showNotification("Connection error. Please try again.", "error");
      }
      registerBtn.disabled = false;
      registerBtn.innerHTML = originalBtnText;
    }
  });
}

// Password strength checker - Enhanced version
function checkPasswordStrength(password) {
    let score = 0;
    const checks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        numbers: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password)
    };
    
    // Calculate score
    if (checks.length) score++;
    if (checks.uppercase) score++;
    if (checks.lowercase) score++;
    if (checks.numbers) score++;
    if (checks.special) score++;
    
    let strength = 'weak';
    let message = '';
    
    if (score >= 4) {
        strength = 'strong';
        message = 'Strong password';
    } else if (score >= 3) {
        strength = 'medium';
        message = 'Medium password';
    } else {
        strength = 'weak';
        message = 'Weak password';
    }
    
    return { 
        score, 
        strength, 
        message,
        checks 
    };
}

// Update password strength display
function updatePasswordStrength(strengthData) {
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.querySelector('.strength-text');
    
    if (strengthBar) {
        strengthBar.setAttribute('data-strength', strengthData.strength);
    }
    
    if (strengthText) {
        strengthText.textContent = strengthData.message;
        strengthText.className = `strength-text ${strengthData.strength}`;
    }
    
    // Update requirements list if it exists
    updatePasswordRequirements(strengthData.checks);
}

// Create and update password requirements list
function updatePasswordRequirements(checks) {
    // Check if requirements list exists, if not create it
    let requirementsList = document.querySelector('.password-requirements');
    const passwordGroup = document.querySelector('#password').closest('.form-group');
    
    if (!requirementsList && passwordGroup) {
        requirementsList = document.createElement('div');
        requirementsList.className = 'password-requirements';
        requirementsList.innerHTML = `
            <ul>
                <li id="req-length"><i class="fas fa-times-circle"></i> At least 8 characters</li>
                <li id="req-uppercase"><i class="fas fa-times-circle"></i> At least one uppercase letter</li>
                <li id="req-lowercase"><i class="fas fa-times-circle"></i> At least one lowercase letter</li>
                <li id="req-numbers"><i class="fas fa-times-circle"></i> At least one number</li>
                <li id="req-special"><i class="fas fa-times-circle"></i> At least one special character (!@#$%^&*)</li>
            </ul>
        `;
        passwordGroup.appendChild(requirementsList);
    }
    
    // Update each requirement
    if (requirementsList) {
        const reqLength = document.getElementById('req-length');
        const reqUppercase = document.getElementById('req-uppercase');
        const reqLowercase = document.getElementById('req-lowercase');
        const reqNumbers = document.getElementById('req-numbers');
        const reqSpecial = document.getElementById('req-special');
        
        if (reqLength) {
            reqLength.className = checks.length ? 'valid' : 'invalid';
            reqLength.innerHTML = checks.length ? 
                '<i class="fas fa-check-circle"></i> At least 8 characters' : 
                '<i class="fas fa-times-circle"></i> At least 8 characters';
        }
        
        if (reqUppercase) {
            reqUppercase.className = checks.uppercase ? 'valid' : 'invalid';
            reqUppercase.innerHTML = checks.uppercase ? 
                '<i class="fas fa-check-circle"></i> At least one uppercase letter' : 
                '<i class="fas fa-times-circle"></i> At least one uppercase letter';
        }
        
        if (reqLowercase) {
            reqLowercase.className = checks.lowercase ? 'valid' : 'invalid';
            reqLowercase.innerHTML = checks.lowercase ? 
                '<i class="fas fa-check-circle"></i> At least one lowercase letter' : 
                '<i class="fas fa-times-circle"></i> At least one lowercase letter';
        }
        
        if (reqNumbers) {
            reqNumbers.className = checks.numbers ? 'valid' : 'invalid';
            reqNumbers.innerHTML = checks.numbers ? 
                '<i class="fas fa-check-circle"></i> At least one number' : 
                '<i class="fas fa-times-circle"></i> At least one number';
        }
        
        if (reqSpecial) {
            reqSpecial.className = checks.special ? 'valid' : 'invalid';
            reqSpecial.innerHTML = checks.special ? 
                '<i class="fas fa-check-circle"></i> At least one special character (!@#$%^&*)' : 
                '<i class="fas fa-times-circle"></i> At least one special character (!@#$%^&*)';
        }
    }
}

// Initialize password strength listener
function initPasswordStrength() {
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('input', () => {
            const strength = checkPasswordStrength(passwordInput.value);
            updatePasswordStrength(strength);
        });
        
        // Initial check if password already has value
        if (passwordInput.value) {
            const strength = checkPasswordStrength(passwordInput.value);
            updatePasswordStrength(strength);
        }
    }
}

// Call this when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initPasswordStrength();

        // Also initialize other form elements
    const passwordInput = document.getElementById('password');
    if (passwordInput && passwordInput.value === '') {
        // Show initial requirements
        const strength = checkPasswordStrength('');
        updatePasswordStrength(strength);
    }
});


// Clean up camera when leaving page
window.addEventListener("beforeunload", () => {
  if (currentStream) {
    stopCamera();
  }
});

// Notification system
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
        <i class="fas fa-${type === "success" ? "check-circle" : type === "error" ? "exclamation-circle" : "info-circle"}"></i>
        <span>${message}</span>
    `;

  // Add styles for notification
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6"};
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
    notification.style.animation = "slideOut 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add animation styles
const style = document.createElement("style");
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
const mobileMenuBtn = document.querySelector(".mobile-menu");
const navLinks = document.querySelector(".nav-links");

if (mobileMenuBtn && navLinks) {
  mobileMenuBtn.addEventListener("click", () => {
    // Toggle a class instead of inline style (cleaner & easier to style with CSS)
    navLinks.classList.toggle("active");

    // Optional: change icon to X when open
    const icon = mobileMenuBtn.querySelector("i");
    if (icon) {
      icon.classList.toggle("fa-bars");
      icon.classList.toggle("fa-times");
    }
  });
}

// Add this function to main.js - Image compression
async function compressImage(
  dataUrl,
  maxWidth = 300,
  maxHeight = 300,
  quality = 0.7,
) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate new dimensions
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      // Create canvas and compress
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      // Compress to JPEG with specified quality
      const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(compressedDataUrl);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Optional: close menu when clicking a link (good UX)
/*navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        const icon = mobileMenuBtn.querySelector('i');
        if (icon) {
            icon.classList.add('fa-bars');
            icon.classList.remove('fa-times');
        }
    });
});*/

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
});


// PWA Installation Logic
// ========== PWA INSTALL BANNER (iOS + Android friendly) ==========
// ========== PWA INSTALL BANNER (Debug + iOS Modal) ==========
(function() {
    let deferredPrompt = null;
    let bannerShown = false;

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    console.log('iOS detected:', isIos);

    function isPWAInstalled() {
        const installed = window.matchMedia('(display-mode: standalone)').matches ||
                          window.navigator.standalone === true;
        console.log('PWA installed?', installed);
        return installed;
    }

    function isNativeApp() {
        const native = typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();
        console.log('Native app?', native);
        return native;
    }

    function shouldShowBanner() {
        if (isPWAInstalled()) return false;
        if (isNativeApp()) return false;
        if (localStorage.getItem('pwaBannerDismissed') === 'true') {
            console.log('Banner dismissed by user');
            return false;
        }
        return true;
    }

    function showPwaBanner() {
        const banner = document.getElementById('pwaInstallBanner');
        if (!banner) {
            console.error('Banner element #pwaInstallBanner not found!');
            return;
        }
        if (bannerShown) return;
        if (shouldShowBanner()) {
            banner.style.display = 'block';
            bannerShown = true;
            console.log('Banner shown');
        } else {
            console.log('Banner not shown because conditions not met');
        }
    }

    function dismissPwaBanner(permanent = true) {
        const banner = document.getElementById('pwaInstallBanner');
        if (banner) banner.style.display = 'none';
        if (permanent) localStorage.setItem('pwaBannerDismissed', 'true');
        bannerShown = false;
        console.log('Banner dismissed, permanent:', permanent);
    }

    function showIosInstructions() {
        const modal = document.getElementById('pwaInstructionsModal');
        if (!modal) {
            console.error('Modal element #pwaInstructionsModal not found!');
            alert('To install this app on iOS:\n\n1. Tap Share button\n2. Tap "Add to Home Screen"\n3. Tap Add');
            return;
        }
        modal.classList.add('show');
        console.log('iOS instructions modal opened');
    }

    async function installPwa() {
        console.log('Install button clicked. iOS?', isIos, 'deferredPrompt?', !!deferredPrompt);
        if (!isIos && deferredPrompt) {
            // Android/Chrome native prompt
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log('PWA install outcome:', outcome);
            deferredPrompt = null;
            dismissPwaBanner(true);
        } else {
            // iOS or no beforeinstallprompt
            showIosInstructions();
        }
    }

    // Wait for DOM to be ready before attaching events
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM ready – attaching PWA events');
        const banner = document.getElementById('pwaInstallBanner');
        const installBtn = document.getElementById('pwaInstallBtn');
        const dismissBtn = document.getElementById('pwaDismissBtn');

        if (installBtn) {
            installBtn.addEventListener('click', installPwa);
            console.log('Install button listener attached');
        } else {
            console.error('Install button #pwaInstallBtn not found!');
        }

        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => dismissPwaBanner(true));
            console.log('Dismiss button listener attached');
        } else {
            console.error('Dismiss button #pwaDismissBtn not found!');
        }

        // Close modal events
        const modal = document.getElementById('pwaInstructionsModal');
        const closeModalBtn = document.getElementById('closeInstructionsModal');
        const gotItBtn = document.getElementById('gotItBtn');
        const closeModal = () => {
            if (modal) modal.classList.remove('show');
            console.log('Modal closed');
        };
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
        if (gotItBtn) gotItBtn.addEventListener('click', closeModal);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
            console.log('Modal close handlers attached');
        } else {
            console.error('Modal #pwaInstructionsModal not found!');
        }

        // Show banner if conditions met
        if (deferredPrompt && shouldShowBanner()) {
            showPwaBanner();
        } else if (shouldShowBanner()) {
            // Wait 2 seconds then show banner (fallback for iOS or slow browsers)
            setTimeout(() => {
                if (shouldShowBanner()) showPwaBanner();
            }, 2000);
        }
    });

    // Listen for beforeinstallprompt (Android/Chrome)
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('beforeinstallprompt fired');
        e.preventDefault();
        deferredPrompt = e;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => showPwaBanner());
        } else {
            showPwaBanner();
        }
    });

    // Hide banner if user installs from browser menu
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && isPWAInstalled()) {
            dismissPwaBanner(false);
            console.log('Banner hidden because PWA now installed');
        }
    });
})();







// --- App Download Banner Logic ---
/*let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
});

// Check if running inside Capacitor native app
function isRunningInNativeApp() {
  return typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();
}

// Show banner if not in app and user hasn't dismissed it
function checkAndShowAppBanner() {
  if (isRunningInNativeApp()) {
    return; // In native app – never show banner
  }

  const bannerDismissed = localStorage.getItem('appBannerDismissed');
  if (bannerDismissed === 'true') return;

  const banner = document.getElementById('appDownloadBanner');
  if (banner) banner.style.display = 'block';
}

// Handle download button click
function setupAppBannerEvents() {
  const downloadBtn = document.getElementById('downloadAppBtn');
  const dismissBtn = document.getElementById('dismissBannerBtn');

  if (downloadBtn) {
    downloadBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const userAgent = navigator.userAgent.toLowerCase();
      // Replace with your actual Google Play Store link
      if (/android/.test(userAgent)) {
        window.location.href = 'https://play.google.com/store/apps/details?id=com.paystora.app'; // CHANGE THIS
      } else if (/iphone|ipad|ipod/.test(userAgent)) {
        window.location.href = 'https://apps.apple.com/app/idYOUR_APP_ID'; // CHANGE THIS
      } else {
        // Fallback: PWA install
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
              console.log('User accepted the install prompt');
            } else {
              console.log('User dismissed the install prompt');
            }
            deferredPrompt = null;
          });
        } else {
          alert('You can install this app as a PWA from your browser menu.');
        }
      }
    });
  }

  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      const banner = document.getElementById('appDownloadBanner');
      if (banner) banner.style.display = 'none';
      localStorage.setItem('appBannerDismissed', 'true');
    });
  }
}

// Call when DOM is ready (inside your existing DOMContentLoaded)
document.addEventListener('DOMContentLoaded', () => {
  checkAndShowAppBanner();
  setupAppBannerEvents();
});*/