// Configuration
const API_BASE_URL = 'http://localhost:5000';

// DOM Elements
const themeToggle = document.getElementById('themeToggle');
const platformOptions = document.querySelectorAll('.platform-option');
const urlInput = document.getElementById('urlInput');
const clearInput = document.getElementById('clearInput');
const downloadBtn = document.getElementById('downloadBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const statusMessage = document.getElementById('statusMessage');
const platformHint = document.getElementById('platformHint');
const downloadInfo = document.getElementById('downloadInfo');
const videoTitle = document.getElementById('videoTitle');
const videoDuration = document.getElementById('videoDuration');
const videoQuality = document.getElementById('videoQuality');
const videoSize = document.getElementById('videoSize');
const downloadActions = document.getElementById('downloadActions');

// Current state
let currentPlatform = 'instagram';
let isProcessing = false;

// Initialize the app
function initApp() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeToggle(savedTheme);
    setupEventListeners();
    updatePlatformHint();
    checkServerStatus();
}

// Check if backend server is running
async function checkServerStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (response.ok) {
            console.log('✅ Backend server is connected');
        }
    } catch (error) {
        console.warn('⚠️ Backend server not reachable. Make sure Flask is running on port 5000');
        showStatus('Warning: Backend server not connected. Please start the Flask server.', 'error');
    }
}

// Set up all event listeners
function setupEventListeners() {
    themeToggle.addEventListener('click', toggleTheme);
    
    platformOptions.forEach(option => {
        option.addEventListener('click', () => selectPlatform(option));
    });
    
    clearInput.addEventListener('click', () => {
        urlInput.value = '';
        urlInput.focus();
    });
    
    urlInput.addEventListener('input', validateURL);
    downloadBtn.addEventListener('click', startDownload);
    
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            startDownload();
        }
    });
}

// Theme functionality
function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeToggle(newTheme);
}

function updateThemeToggle(theme) {
    const icon = themeToggle.querySelector('i');
    const text = themeToggle.querySelector('span');
    if (theme === 'dark') {
        icon.className = 'fas fa-sun';
        text.textContent = 'Light Mode';
    } else {
        icon.className = 'fas fa-moon';
        text.textContent = 'Dark Mode';
    }
}

// Platform selection
function selectPlatform(selectedOption) {
    platformOptions.forEach(option => {
        option.classList.remove('active');
    });
    selectedOption.classList.add('active');
    currentPlatform = selectedOption.dataset.platform;
    updatePlatformHint();
    if (urlInput.value.trim()) {
        autoDetectPlatform();
    }
}

function updatePlatformHint() {
    const platformNames = {
        'instagram': 'Instagram',
        'tiktok': 'TikTok',
        'youtube': 'YouTube'
    };
    const hintText = `Currently selected: ${platformNames[currentPlatform]}. Paste any ${platformNames[currentPlatform]} video URL.`;
    platformHint.querySelector('span').textContent = hintText;
}

// URL validation and platform auto-detection
function validateURL() {
    const url = urlInput.value.trim();
    if (!url) {
        clearStatus();
        return;
    }
    autoDetectPlatform();
}

function autoDetectPlatform() {
    const url = urlInput.value.trim().toLowerCase();
    if (url.includes('instagram.com') || url.includes('instagr.am')) {
        setPlatform('instagram');
    } else if (url.includes('tiktok.com')) {
        setPlatform('tiktok');
    } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
        setPlatform('youtube');
    }
}

function setPlatform(platform) {
    if (currentPlatform === platform) return;
    currentPlatform = platform;
    platformOptions.forEach(option => {
        option.classList.remove('active');
        if (option.dataset.platform === platform) {
            option.classList.add('active');
        }
    });
    updatePlatformHint();
}

// Download process - REAL API CALL
async function startDownload() {
    const url = urlInput.value.trim();
    
    if (!url) {
        showStatus('Please enter a video URL', 'error');
        urlInput.focus();
        return;
    }
    
    if (!isValidURL(url)) {
        showStatus('Please enter a valid URL', 'error');
        return;
    }
    
    if (!isValidPlatformURL(url, currentPlatform)) {
        showStatus(`This doesn't look like a valid ${currentPlatform} URL`, 'error');
        return;
    }
    
    isProcessing = true;
    updateUIForProcessing(true);
    
    try {
        // REAL API CALL TO FLASK BACKEND
        const response = await fetch(`${API_BASE_URL}/api/download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: url,
                platform: currentPlatform
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            handleBackendResponse(data);
        } else {
            handleBackendError(data.message || 'Download failed');
        }
        
    } catch (error) {
        handleBackendError(`Failed to connect to server: ${error.message}`);
    }
}

// Validate URL format
function isValidURL(url) {
    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
}

// Validate platform-specific URL
function isValidPlatformURL(url, platform) {
    const urlLower = url.toLowerCase();
    switch(platform) {
        case 'instagram':
            return urlLower.includes('instagram.com') || urlLower.includes('instagr.am');
        case 'tiktok':
            return urlLower.includes('tiktok.com');
        case 'youtube':
            return urlLower.includes('youtube.com') || urlLower.includes('youtu.be');
        default:
            return false;
    }
}

// Update UI for processing state
function updateUIForProcessing(processing) {
    isProcessing = processing;
    if (processing) {
        downloadBtn.disabled = true;
        loadingSpinner.classList.remove('hidden');
        downloadBtn.querySelector('span').textContent = 'Processing...';
        clearStatus();
        downloadInfo.classList.add('hidden');
    } else {
        downloadBtn.disabled = false;
        loadingSpinner.classList.add('hidden');
        downloadBtn.querySelector('span').textContent = 'Download Video';
    }
}

// Handle backend response
function handleBackendResponse(response) {
    updateUIForProcessing(false);
    if (response.success) {
        showStatus(response.message, 'success');
        displayVideoInfo(response.video);
    } else {
        showStatus(response.message || 'Download failed', 'error');
    }
}

// Handle backend error
function handleBackendError(error) {
    updateUIForProcessing(false);
    showStatus(`Error: ${error}`, 'error');
    console.error('Backend error:', error);
}

// Display video information
function displayVideoInfo(video) {
    videoTitle.textContent = video.title;
    videoDuration.textContent = video.duration;
    
    downloadInfo.classList.remove('hidden');
    downloadActions.innerHTML = '';
    
    video.formats.forEach((format, index) => {
        const qualityOption = document.createElement('a');
        qualityOption.href = `${API_BASE_URL}${format.download_url}`;
        qualityOption.className = 'quality-option';
        qualityOption.download = '';
        qualityOption.innerHTML = `
            <div class="quality-label">${format.quality}</div>
            <div class="quality-size">${format.size}</div>
            <span style="color: var(--primary-color); margin-top: 8px;">
                <i class="fas fa-download"></i> Download
            </span>
        `;
        
        if (index === 0) {
            videoQuality.textContent = format.quality;
            videoSize.textContent = format.size;
        }
        
        downloadActions.appendChild(qualityOption);
    });
}

// Status message functions
function showStatus(message, type) {
    clearStatus();
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    
    let iconClass = '';
    switch(type) {
        case 'success':
            iconClass = 'fas fa-check-circle';
            break;
        case 'error':
            iconClass = 'fas fa-exclamation-circle';
            break;
        case 'info':
            iconClass = 'fas fa-info-circle';
            break;
    }
    
    statusMessage.innerHTML = `<i class="${iconClass}"></i> ${message}`;
    statusMessage.classList.remove('hidden');
    
    if (type === 'success') {
        setTimeout(() => {
            if (statusMessage.classList.contains(type)) {
                statusMessage.classList.add('hidden');
            }
        }, 5000);
    }
}

function clearStatus() {
    statusMessage.classList.add('hidden');
    statusMessage.className = 'status-message hidden';
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);