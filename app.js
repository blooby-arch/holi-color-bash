const app = {
  // Pointing to your perfectly set up local folder
  modelPath: './models', 
  
  selectedColors: [],
  targetColors: [], 
  linkParams: { colors: 'colors' },
  happyHoliText: 'Happy Holi!',

  // UI elements
  loadingOverlay: document.getElementById('loading-overlay'),
  appContainer: document.getElementById('app-container'),
  sections: document.querySelectorAll('.section'),
  swatches: document.querySelectorAll('.color-swatch'),
  selectedColorsText: document.getElementById('selected-colors-text'),
  generateBtn: document.getElementById('generate-link-btn'),
  shareInput: document.getElementById('share-link-input'),
  copyStatus: document.getElementById('copy-status'),
  imageInput: document.getElementById('image-upload'),
  uploadStage: document.getElementById('upload-stage'),
  resultStage: document.getElementById('result-stage'),
  canvas: document.getElementById('canvas-overlay'),
  downloadBtn: document.getElementById('download-btn'),
  createOwnBtn: document.getElementById('create-own-btn'),

  // Webcam UI elements
  uploadOptions: document.getElementById('upload-options'),
  startCameraBtn: document.getElementById('start-camera-btn'),
  webcamContainer: document.getElementById('webcam-container'),
  videoElement: document.getElementById('webcam-video'),
  captureBtn: document.getElementById('capture-btn'),
  closeCameraBtn: document.getElementById('close-camera-btn'),
  stream: null,

  async init() {
    console.log("Holi Color Bash: Initialization Started.");
    this.addEventListeners();
    this.checkForUrlParams();

    try {
      await this.loadFaceApiModels();
      console.log("Face API Models loaded successfully.");
    } catch (error) {
      console.error("Failed to load face-api models.", error);
    } finally {
      this.loadingOverlay.classList.remove('active');
      this.appContainer.classList.remove('hidden');
    }
  },

  showSection(sectionId) {
    this.sections.forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
  },

  handleColorClick(event) {
    const swatch = event.target;
    const color = swatch.dataset.color;

    swatch.classList.toggle('selected');
    if (this.selectedColors.includes(color)) {
      this.selectedColors = this.selectedColors.filter(c => c !== color);
    } else {
      this.selectedColors.push(color);
    }

    const numSelected = this.selectedColors.length;
    this.generateBtn.disabled = numSelected === 0;
    this.selectedColorsText.textContent = numSelected > 0
      ? `Selected ${numSelected} color(s).` : "";
  },

  generateShareableLink() {
    if (this.selectedColors.length === 0) return;
    const colorsString = encodeURIComponent(this.selectedColors.join(','));
    const origin = window.location.origin + window.location.pathname;
    const url = `${origin}?${this.linkParams.colors}=${colorsString}`;

    this.shareInput.value = url;
    this.showSection('user1-share');
  },

  copyLinkToClipboard() {
    this.shareInput.select();
    document.execCommand('copy');
    this.copyStatus.textContent = 'Link copied! Happy sharing.';
    setTimeout(() => this.copyStatus.textContent = '', 3000);
  },

  checkForUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const colorsParam = params.get(this.linkParams.colors);

    if (colorsParam) {
      this.targetColors = decodeURIComponent(colorsParam).split(',');
      this.showSection('user2-bash');
    } else {
      this.showSection('user1-select');
    }
  },

  async loadFaceApiModels() {
    return Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(this.modelPath),
      faceapi.nets.faceLandmark68Net.loadFromUri(this.modelPath)
    ]);
  },

  // --- WEBCAM LOGIC ---
  async startWebcam() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      this.videoElement.srcObject = this.stream;
      this.uploadOptions.style.display = 'none';
      this.webcamContainer.classList.remove('hidden');
    } catch (err) {
      console.error("Error accessing webcam:", err);
      alert("Could not access the webcam. Please ensure you have granted camera permissions.");
    }
  },

  stopWebcam() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.webcamContainer.classList.add('hidden');
    this.uploadOptions.style.display = 'flex';
  },

  capturePhoto() {
    if (!this.stream) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.videoElement.videoWidth;
    tempCanvas.height = this.videoElement.videoHeight;
    const ctx = tempCanvas.getContext('2d');

    ctx.translate(tempCanvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(this.videoElement, 0, 0, tempCanvas.width, tempCanvas.height);

    this.stopWebcam();
    this.transitionToProcessing();

    const img = new Image();
    img.src = tempCanvas.toDataURL('image/png');
    img.onload = () => { this.processImage(img); };
  },

  // --- FILE UPLOAD LOGIC ---
  async handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    this.transitionToProcessing();

    try {
      const img = await faceapi.bufferToImage(file);
      await this.processImage(img);
    } catch (error) {
      console.error("Error processing image:", error);
      alert("Something went wrong with image analysis. Ensure it's a clear portrait.");
      this.restartProcess();
    }
  },

  transitionToProcessing() {
    this.uploadStage.classList.remove('active');
    this.resultStage.classList.add('active');
    this.resultStage.querySelector('p').textContent = 'Analyzing facial features...';
    this.downloadBtn.disabled = true;
  },

  // --- REWRITTEN CORE IMAGE PROCESSING ---
  async processImage(img) {
    this.canvas.width = img.width;
    this.canvas.height = img.height;
    const ctx = this.canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, img.width, img.height); 

    const options = new faceapi.TinyFaceDetectorOptions();
    const result = await faceapi.detectSingleFace(img, options).withFaceLandmarks();

    if (!result) {
      this.resultStage.querySelector('p').textContent = 'No face found. Please try a different photo.';
      return;
    }

    this.resultStage.querySelector('p').textContent = 'Applying vibrant Holi colors...';

    const landmarks = result.landmarks;
    const jaw = landmarks.getJawOutline();
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    // 1. Precise Cheek Calculation
    // We find the exact middle point between the outer edge of the eye and the jawline, 
    // aligned vertically with the tip of the nose.
    const leftCheekCenter = {
      x: (leftEye[0].x + jaw[2].x) / 2,
      y: nose[3].y 
    };
    
    const rightCheekCenter = {
      x: (rightEye[3].x + jaw[14].x) / 2,
      y: nose[3].y 
    };

    // Splash size based strictly on face width to stay proportional
    const faceWidth = jaw[16].x - jaw[0].x;
    const splashRadius = faceWidth * 0.35; 

    // 2. Assign Colors (Like the reference image: one color per side if available)
    const color1 = this.targetColors[0] || '#FF1F84';
    const color2 = this.targetColors[1] || color1; // Use second color for right cheek, or repeat first

    // 3. Draw the powder
    this.drawGulalSplash(ctx, leftCheekCenter, splashRadius, color1);
    this.drawGulalSplash(ctx, rightCheekCenter, splashRadius, color2);

    this.addHoliText(ctx, img);

    this.resultStage.querySelector('p').textContent = 'Virtual Gulal Applied!';
    this.downloadBtn.disabled = false;
  },

  // --- REWRITTEN REALISTIC POWDER DRAWING ---
  drawGulalSplash(ctx, center, radius, hexColor) {
    // Convert HEX to RGB
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);

    ctx.save();
    
    // We use standard blending, but layer it to look like thick, faded powder
    const gradient = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
    
    // Vibrant, opaque center (like thick powder)
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.9)`);
    // Still solid but starting to fade
    gradient.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.6)`);
    // Soft, translucent edge dusting
    gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.15)`);
    // completely transparent boundary
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    // Draw a perfectly soft circle over the cheek coordinates
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  addHoliText(ctx, img) {
    const fontSize = Math.max(img.width, img.height) * 0.08;
    ctx.font = `bold ${fontSize}px 'Poppins', sans-serif`;
    ctx.textAlign = 'center';
    
    // White text with a bright colored drop-shadow
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = this.targetColors[0] || '#FF1F84'; 
    ctx.shadowBlur = fontSize * 0.3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillText(this.happyHoliText, img.width / 2, img.height - fontSize * 1.2);
    ctx.restore(); 
  },

  downloadFinalImage() {
    const image = this.canvas.toDataURL("image/jpeg", 0.9);
    const link = document.createElement('a');
    link.href = image;
    link.download = 'holi_color_bash.jpg';
    link.click();
  },

  restartProcess() {
    this.canvas.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.imageInput.value = '';
    this.uploadStage.classList.add('active');
    this.resultStage.classList.remove('active');
    this.downloadBtn.disabled = true;
  },

  addEventListeners() {
    this.swatches.forEach(s => s.addEventListener('click', this.handleColorClick.bind(this)));
    this.generateBtn.addEventListener('click', this.generateShareableLink.bind(this));
    document.getElementById('back-to-select-btn').addEventListener('click', () => this.showSection('user1-select'));
    document.getElementById('copy-link-btn').addEventListener('click', this.copyLinkToClipboard.bind(this));
    
    this.imageInput.addEventListener('change', this.handleImageUpload.bind(this));
    this.startCameraBtn.addEventListener('click', this.startWebcam.bind(this));
    this.captureBtn.addEventListener('click', this.capturePhoto.bind(this));
    this.closeCameraBtn.addEventListener('click', this.stopWebcam.bind(this));

    this.downloadBtn.addEventListener('click', this.downloadFinalImage.bind(this));
    document.getElementById('restart-btn').addEventListener('click', this.restartProcess.bind(this));
    this.createOwnBtn.addEventListener('click', () => {
      window.location.href = window.location.pathname; 
    });
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());