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

// Register Form Handler
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  // Password strength checker
  const passwordInput = document.getElementById("password");
  const strengthBar = document.querySelector(".strength-bar");
  const strengthText = document.querySelector(".strength-text");

  if (passwordInput) {
    passwordInput.addEventListener("input", () => {
      const strength = checkPasswordStrength(passwordInput.value);
      updatePasswordStrength(strength);
    });
  }

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

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
      showNotification("Please use a stronger password", "error");
      return;
    }

    const registerBtn = document.getElementById("registerBtn");
    registerBtn.disabled = true;
    registerBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Creating account...';

    try {
      const userData = {
        first_name: document.getElementById("first_name").value,
        last_name: document.getElementById("last_name").value,
        email: document.getElementById("email").value,
        phone: document.getElementById("phone").value,
        password: password,
      };

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
        showNotification("Account created successfully!", "success");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 1500);
      } else {
        showNotification(data.error || "Registration failed", "error");
      }
    } catch (error) {
      console.error("Registration error:", error);
      showNotification("Connection error. Please try again.", "error");
    } finally {
      registerBtn.disabled = false;
      registerBtn.innerHTML =
        '<span>Create Account</span><i class="fas fa-user-plus"></i>';
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
    special: /[^A-Za-z0-9]/.test(password),
  };

  score = Object.values(checks).filter(Boolean).length;

  let strength = "weak";
  if (score >= 4) strength = "strong";
  else if (score >= 3) strength = "medium";

  return { score, strength, checks };
}

function updatePasswordStrength({ strength, checks }) {
  const strengthBar = document.querySelector(".strength-bar");
  const strengthText = document.querySelector(".strength-text");

  if (strengthBar) {
    strengthBar.setAttribute("data-strength", strength);
  }

  if (strengthText) {
    const texts = {
      weak: "Weak password",
      medium: "Medium password",
      strong: "Strong password",
    };
    strengthText.textContent = texts[strength] || "";
    strengthText.style.color =
      strength === "weak"
        ? "#ef4444"
        : strength === "medium"
          ? "#f59e0b"
          : "#10b981";
  }
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
  capturePhotoBtn.addEventListener("click", () => {
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

    capturedImageData = canvas.toDataURL("image/jpeg", 0.9);
    capturedImage.src = capturedImageData;

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

    // Validate face (simplified - you can add actual face detection API here)
    validateFaceImage(capturedImageData);

    faceStatus.style.display = "block";
    faceStatus.className = "face-status success";
    faceStatus.innerHTML =
      '<i class="fas fa-check-circle"></i> Photo captured successfully!';
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

  // Upload Photo
  uploadPhotoBtn.addEventListener("click", () => {
    photoUpload.click();
  });

  photoUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (event) {
        capturedImageData = event.target.result;
        capturedImage.src = capturedImageData;

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

        validateFaceImage(capturedImageData);

        faceStatus.style.display = "block";
        faceStatus.className = "face-status success";
        faceStatus.innerHTML =
          '<i class="fas fa-check-circle"></i> Photo uploaded successfully!';
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

function validateFaceImage(imageData) {
  // This is a placeholder for actual face detection
  // You can integrate with a face detection API like Face++ or AWS Rekognition
  // For now, we'll just do basic validation

  const img = new Image();
  img.onload = () => {
    // Check if image has reasonable dimensions
    if (img.width < 100 || img.height < 100) {
      const faceStatus = document.getElementById("faceStatus");
      faceStatus.className = "face-status error";
      faceStatus.innerHTML =
        '<i class="fas fa-exclamation-triangle"></i> Image too small. Please use a clearer photo.';
      document.getElementById("faceVerified").checked = false;
    } else {
      // In production, you'd send this to your backend for actual face detection
      console.log(
        "Face image validated - dimensions:",
        img.width,
        "x",
        img.height,
      );
    }
  };
  img.src = imageData;
}

// Update the register form submission
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validate face verification
    if (!capturedImageData) {
      showNotification(
        "Please complete face verification before registering",
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
      showNotification("Please use a stronger password", "error");
      return;
    }

    const registerBtn = document.getElementById("registerBtn");
    registerBtn.disabled = true;
    registerBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Creating account...';

    try {
      // Prepare user data
      const userData = {
        first_name: document.getElementById("first_name").value,
        last_name: document.getElementById("last_name").value,
        email: document.getElementById("email").value,
        phone: document.getElementById("phone").value,
        country: document.getElementById("country").value,
        city: document.getElementById("city").value,
        address: document.getElementById("address").value,
        security_question_1: document.getElementById("security_question_1")
          .value,
        security_answer_1: document.getElementById("security_answer_1").value,
        security_question_2: document.getElementById("security_question_2")
          .value,
        security_answer_2: document.getElementById("security_answer_2").value,
        password: password,
        face_image: capturedImageData, // Base64 encoded image
      };

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
        showNotification("Account created successfully!", "success");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 1500);
      } else {
        showNotification(data.error || "Registration failed", "error");
      }
    } catch (error) {
      console.error("Registration error:", error);
      showNotification("Connection error. Please try again.", "error");
    } finally {
      registerBtn.disabled = false;
      registerBtn.innerHTML =
        '<span>Create Account</span><i class="fas fa-user-plus"></i>';
    }
  });
}

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
