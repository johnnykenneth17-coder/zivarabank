// Face Verification Variables
let currentStream = null;
let capturedImageData = null;

// Initialize face verification when page loads
if (document.getElementById('registerForm')) {
    initializeFaceVerification();
}

function initializeFaceVerification() {
    const startCameraBtn = document.getElementById('startCameraBtn');
    const capturePhotoBtn = document.getElementById('capturePhotoBtn');
    const retakePhotoBtn = document.getElementById('retakePhotoBtn');
    const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
    const photoUpload = document.getElementById('photoUpload');
    const video = document.getElementById('video');
    const capturedImage = document.getElementById('capturedImage');
    const placeholderImage = document.getElementById('placeholderImage');
    const faceStatus = document.getElementById('faceStatus');
    const faceVerifiedCheckbox = document.getElementById('faceVerified');
    
    // Start Camera
    startCameraBtn.addEventListener('click', async () => {
        try {
            if (currentStream) {
                stopCamera();
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user' } 
            });
            
            currentStream = stream;
            video.srcObject = stream;
            video.style.display = 'block';
            capturedImage.style.display = 'none';
            placeholderImage.style.display = 'none';
            
            startCameraBtn.style.display = 'none';
            capturePhotoBtn.style.display = 'inline-block';
            uploadPhotoBtn.style.display = 'none';
            retakePhotoBtn.style.display = 'none';
            
            faceStatus.style.display = 'block';
            faceStatus.className = 'face-status info';
            faceStatus.innerHTML = '<i class="fas fa-camera"></i> Camera active. Position your face clearly and click Capture.';
            
        } catch (err) {
            console.error('Camera error:', err);
            faceStatus.style.display = 'block';
            faceStatus.className = 'face-status error';
            faceStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Unable to access camera. Please check permissions or use upload option.';
        }
    });
    
    // Capture Photo
    capturePhotoBtn.addEventListener('click', () => {
        if (!currentStream) {
            faceStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Please start camera first';
            return;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        capturedImageData = canvas.toDataURL('image/jpeg', 0.9);
        capturedImage.src = capturedImageData;
        
        // Stop camera
        stopCamera();
        
        // Update UI
        video.style.display = 'none';
        capturedImage.style.display = 'block';
        placeholderImage.style.display = 'none';
        
        capturePhotoBtn.style.display = 'none';
        retakePhotoBtn.style.display = 'inline-block';
        uploadPhotoBtn.style.display = 'inline-block';
        startCameraBtn.style.display = 'none';
        
        // Validate face (simplified - you can add actual face detection API here)
        validateFaceImage(capturedImageData);
        
        faceStatus.style.display = 'block';
        faceStatus.className = 'face-status success';
        faceStatus.innerHTML = '<i class="fas fa-check-circle"></i> Photo captured successfully!';
        faceVerifiedCheckbox.checked = true;
    });
    
    // Retake Photo
    retakePhotoBtn.addEventListener('click', () => {
        capturedImageData = null;
        capturedImage.style.display = 'none';
        
        startCameraBtn.style.display = 'inline-block';
        capturePhotoBtn.style.display = 'none';
        retakePhotoBtn.style.display = 'none';
        uploadPhotoBtn.style.display = 'inline-block';
        
        faceStatus.style.display = 'block';
        faceStatus.className = 'face-status info';
        faceStatus.innerHTML = '<i class="fas fa-info-circle"></i> Please capture or upload a clear photo of your face';
        faceVerifiedCheckbox.checked = false;
    });
    
    // Upload Photo
    uploadPhotoBtn.addEventListener('click', () => {
        photoUpload.click();
    });
    
    photoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                capturedImageData = event.target.result;
                capturedImage.src = capturedImageData;
                
                if (currentStream) {
                    stopCamera();
                }
                
                video.style.display = 'none';
                capturedImage.style.display = 'block';
                placeholderImage.style.display = 'none';
                
                startCameraBtn.style.display = 'inline-block';
                capturePhotoBtn.style.display = 'none';
                retakePhotoBtn.style.display = 'inline-block';
                uploadPhotoBtn.style.display = 'inline-block';
                
                validateFaceImage(capturedImageData);
                
                faceStatus.style.display = 'block';
                faceStatus.className = 'face-status success';
                faceStatus.innerHTML = '<i class="fas fa-check-circle"></i> Photo uploaded successfully!';
                faceVerifiedCheckbox.checked = true;
            };
            reader.readAsDataURL(file);
        }
    });
}

function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
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
            const faceStatus = document.getElementById('faceStatus');
            faceStatus.className = 'face-status error';
            faceStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Image too small. Please use a clearer photo.';
            document.getElementById('faceVerified').checked = false;
        } else {
            // In production, you'd send this to your backend for actual face detection
            console.log('Face image validated - dimensions:', img.width, 'x', img.height);
        }
    };
    img.src = imageData;
}

// Update the register form submission
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Validate face verification
        if (!capturedImageData) {
            showNotification('Please complete face verification before registering', 'error');
            return;
        }
        
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
            // Prepare user data
            const userData = {
                first_name: document.getElementById('first_name').value,
                last_name: document.getElementById('last_name').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                country: document.getElementById('country').value,
                city: document.getElementById('city').value,
                address: document.getElementById('address').value,
                security_question_1: document.getElementById('security_question_1').value,
                security_answer_1: document.getElementById('security_answer_1').value,
                security_question_2: document.getElementById('security_question_2').value,
                security_answer_2: document.getElementById('security_answer_2').value,
                password: password,
                face_image: capturedImageData // Base64 encoded image
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
                localStorage.setItem('userFaceImage', capturedImageData);
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

// Clean up camera when leaving page
window.addEventListener('beforeunload', () => {
    if (currentStream) {
        stopCamera();
    }
});




// Initialize password strength when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initPasswordStrength();
    
    // Also initialize other form elements
    const passwordInput = document.getElementById('password');
    if (passwordInput && passwordInput.value === '') {
        // Show initial requirements
        const strength = checkPasswordStrength('');
        updatePasswordStrength(strength);
    }
});