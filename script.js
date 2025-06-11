/**
 * ====================================================================
 * CUBE RUSH GAME - Main Game Logic Class
 * ====================================================================
 * This class handles the core game mechanics including:
 * - Pattern generation and display
 * - Timer management 
 * - Audio feedback
 * - Game state tracking
 * - Pattern comparison and validation
 */
class CubeRush {
	/**
	* Constructor for CubeRush
	* Initializes game state and audio system
	*/
	constructor() {
		// Game configuration - available colors for the Rubik's cube faces
		this.colors = ['#ff0000', '#0000ff', '#00ff00', '#ffff00', '#ff8c00', '#ffffff'];

		// Game state variables
		this.currentPattern = [];    // Stores the pattern player needs to match
		this.startTime = null;       // When the current game started
		this.elapsedTime = 0;        // Total time elapsed in milliseconds
		this.penalties = 0;          // Number of wrong attempts
		this.isRunning = false;      // Whether game is actively running
		this.isPaused = false;       // Whether timer is paused (during scanning)
		this.timerInterval = null;   // Reference to timer update interval

		// Initialize audio system
		this.createSounds();
	}

	/**
	* AUDIO SYSTEM INITIALIZATION
	* Creates Web Audio API context and beep sound generator
	*/
	createSounds() {
		this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

		/**
	 * Generate beep sounds for game feedback
	 * @param {number} frequency - Sound frequency in Hz (default: 800)
	 * @param {number} duration - Sound duration in milliseconds (default: 200)
	 */
		this.playBeep = (frequency = 800, duration = 200) => {
			const oscillator = this.audioContext.createOscillator();
			const gainNode = this.audioContext.createGain();

			oscillator.connect(gainNode);
			gainNode.connect(this.audioContext.destination);

			oscillator.frequency.value = frequency;
			oscillator.type = 'sine';

			gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
			gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);

			oscillator.start(this.audioContext.currentTime);
			oscillator.stop(this.audioContext.currentTime + duration / 1000);
		};
	}

	/**
	* PATTERN GENERATION
	* Creates a random 3x3 color pattern and displays it to the player
	* with animated sequence and audio feedback
	*/
	generatePattern() {
		this.currentPattern = [];
		const squares = document.querySelectorAll('.cube-square');

		squares.forEach((square, index) => {
			setTimeout(() => {
				const randomColor = this.colors[Math.floor(Math.random() * this.colors.length)];
				square.style.backgroundColor = randomColor;
				square.classList.add('animate');
				this.currentPattern.push(randomColor);

				setTimeout(() => square.classList.remove('animate'), 300);
				this.playBeep(400 + (index * 50), 150);
			}, index * 100);
		});
	}

	/**
	* TIMER MANAGEMENT FUNCTIONS
	* Handle game timing including start, stop, pause, and resume functionality
	*/

	/**
	* Start or resume the game timer
	* Updates display every 10ms for smooth centisecond precision
	*/
	startTimer() {
		this.startTime = Date.now() - this.elapsedTime;
		this.isRunning = true;
		this.isPaused = false;

		this.timerInterval = setInterval(() => {
			if (!this.isPaused) {
				this.elapsedTime = Date.now() - this.startTime;
				this.updateTimerDisplay();
			}
		}, 10);
	}

	/**
	* Pause the timer (used when camera scanner is open)
	* Plays audio feedback to indicate pause
	*/
	stopTimer() {
		this.isPaused = true;
		this.playBeep(600, 300);
	}

	/**
	* Resume the timer after being paused
	* Recalculates start time to account for pause duration
	*/
	resumeTimer() {
		if (this.isRunning) {
			this.startTime = Date.now() - this.elapsedTime;
			this.isPaused = false;
		}
	}

	/**
	* Update the timer display in MM:SS.CC format
	* Shows minutes, seconds, and centiseconds
	*/
	updateTimerDisplay() {
		const totalSeconds = Math.floor(this.elapsedTime / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		const centiseconds = Math.floor((this.elapsedTime % 1000) / 10);

		document.getElementById('timer').textContent =
			`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
	}

	/**
	* GAME STATE MANAGEMENT
	*/

	/**
	* Add a penalty for incorrect pattern matching
	* Used for scoring and performance tracking
	*/
	addPenalty() {
		this.penalties++;
	}

	/**
	* Reset all game state to initial values
	* Prepares for a new game round
	*/
	reset() {
		this.elapsedTime = 0;
		this.penalties = 0;
		this.isRunning = false;
		this.isPaused = false;
		this.currentPattern = [];

		if (this.timerInterval) {
			clearInterval(this.timerInterval);
		}

		this.updateTimerDisplay();
	}

	/**
	* ================================================================
	* COLOR MATCHING ALGORITHM OVERVIEW
	* ================================================================
	* This algorithm robustly matches detected cube face colors to the
	* six standard Rubik's cube colors (red, blue, green, yellow, orange, white).
	* 
	* 1. Sampling & Averaging:
	*    - For each grid square, a circular region of pixels is sampled from the camera frame.
	*    - The average RGB value is computed, with outliers trimmed to reduce noise.
	* 
	* 2. White Detection Priority:
	*    - If all RGB channels are high and close in value, the color is immediately classified as white.
	*    - This prevents confusion between white and light orange/yellow.
	* 
	* 3. Color Similarity Scoring:
	*    - For non-white colors, the algorithm compares the detected color to each game color.
	*    - It uses both RGB and HSV color spaces to calculate a similarity score:
	*        - RGB distance (numerical closeness)
	*        - Hue, saturation, and value differences (for lighting/camera variation)
	*    - Special handling penalizes orange if brightness is too high (to avoid white/orange mix-ups).
	* 
	* 4. Best Match Selection:
	*    - The color with the highest similarity score is selected as the match for that square.
	* 
	* This approach is robust to lighting changes, camera noise, and color variations,
	* ensuring accurate and fair gameplay.
	*/

	/**
	* Compare two color patterns for matching
	* @param {Array} detectedPattern - Array of hex color codes from camera detection
	* @returns {boolean} - True if patterns match, false otherwise
	*/
	comparePatterns(detectedPattern) {
		if (this.currentPattern.length !== detectedPattern.length) {
			return false;
		}

		for (let i = 0; i < this.currentPattern.length; i++) {
			if (!this.colorsMatch(this.currentPattern[i], detectedPattern[i])) {
				return false;
			}
		}
		return true;
	}

	/**
	* Check if two colors match within acceptable tolerance
	* Uses generous tolerance to account for lighting conditions and camera variations
	* @param {string} color1 - First color (hex format)
	* @param {string} color2 - Second color (hex format)  
	* @returns {boolean} - True if colors are close enough to be considered matching
	*/
	colorsMatch(color1, color2) {
		const rgb1 = this.hexToRgb(color1);
		const rgb2 = this.hexToRgb(color2);

		const tolerance = 120;

		return (
			Math.abs(rgb1.r - rgb2.r) < tolerance &&
			Math.abs(rgb1.g - rgb2.g) < tolerance &&
			Math.abs(rgb1.b - rgb2.b) < tolerance
		);
	}

	/**
	* Convert hex color code to RGB values
	* @param {string} hex - Hex color code (e.g., "#ff0000")
	* @returns {Object|null} - RGB object {r, g, b} or null if invalid hex
	*/
	hexToRgb(hex) {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ? {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16)
		} : null;
	}

	/**
	* SUCCESS HANDLING
	* Display success popup with final time and penalty count
	* Includes celebratory audio sequence
	*/
	showSuccess() {
		clearInterval(this.timerInterval);

		document.getElementById('successTime').textContent =
			`${Math.floor(this.elapsedTime / 60000).toString().padStart(2, '0')}:${Math.floor((this.elapsedTime % 60000) / 1000).toString().padStart(2, '0')}.${Math.floor((this.elapsedTime % 1000) / 10).toString().padStart(2, '0')}`;

		document.getElementById('successPenalties').textContent = this.penalties;
		document.getElementById('successPopup').style.display = 'flex';

		this.playBeep(1000, 200);
		setTimeout(() => this.playBeep(1200, 200), 200);
		setTimeout(() => this.playBeep(1400, 300), 400);
	}
}

/**
 * ====================================================================
 * CUBE SCANNER CLASS - Advanced Computer Vision System
 * ====================================================================
 * This class handles all camera and image processing functionality:
 * - Camera access and video stream management
 * - Real-time color detection and analysis  
 * - Advanced color matching algorithms using RGB and HSV color spaces
 * - Noise reduction and statistical analysis for accuracy
 */
class CubeScanner {
	/**
	* Constructor for CubeScanner
	* Initializes DOM references and state
	*/
	constructor() {
		this.video = document.getElementById('cameraVideo');
		this.canvas = document.getElementById('canvas');
		this.ctx = this.canvas.getContext('2d');
		this.stream = null;
		this.detectedColors = [];
	}

	/**
	* Initialize and start camera stream
	* Requests back camera on mobile devices for better cube scanning
	* @returns {Promise<boolean>} - True if camera started successfully, false otherwise
	*/
	async startCamera() {
		try {
			this.stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: { ideal: 'environment' },
					width: { ideal: 4096, max: 4096 },
					height: { ideal: 2160, max: 2160 },
					// Try to disable auto features if supported
					advanced: [
						{ focusMode: "manual" },
						{ whiteBalanceMode: "manual" },
						{ exposureMode: "manual" }
					]
				}
			});
			this.video.srcObject = this.stream;
			return true;
		}
		catch (error) {
			console.error('Error accessing camera:', error);
			alert('Could not access camera. Please make sure camera permissions are enabled.');
			return false;
		}
	}

	/**
	* Stop camera stream and release resources
	* Important for battery life and privacy
	*/
	stopCamera() {
		if (this.stream) {
			this.stream.getTracks().forEach(track => track.stop());
			this.stream = null;
		}
	}

	/**
	* Capture current video frame to canvas for analysis
	* @returns {HTMLCanvasElement} - Canvas containing the captured frame
	*/
	captureFrame() {
		this.canvas.width = this.video.videoWidth;
		this.canvas.height = this.video.videoHeight;
		this.ctx.drawImage(this.video, 0, 0);
		return this.canvas;
	}

	/**
	* Find which squares are white based on lowest saturation and channel difference
	* @param {Array} colorSamples - Array of {color}
	* @returns {Array} - Boolean array, true if white
	*/
	findWhiteSquares(colorSamples) {
		let minSat = 1000;
		let minDiff = 1000;
		colorSamples.forEach(({ color }) => {
			const hsv = this.rgbToHsv(color.r, color.g, color.b);
			const diff = Math.max(
				Math.abs(color.r - color.g),
				Math.abs(color.r - color.b),
				Math.abs(color.g - color.b)
			);
			if (hsv.s < minSat) minSat = hsv.s;
			if (diff < minDiff) minDiff = diff;
		});
		// Mark as white if both are very low (relative to grid)
		return colorSamples.map(({ color }) => {
			const hsv = this.rgbToHsv(color.r, color.g, color.b);
			const diff = Math.max(
				Math.abs(color.r - color.g),
				Math.abs(color.r - color.b),
				Math.abs(color.g - color.b)
			);
			return (hsv.s < minSat + 20 && diff < minDiff + 20);
		});
}

	/**
	* MAIN COLOR ANALYSIS FUNCTION
	* Analyzes captured image and detects colors in 3x3 grid pattern
	* Uses advanced sampling techniques for accurate color detection
	* @returns {Array} - Array of 9 hex color codes representing the detected pattern
	*/
	analyzeColors() {
		const canvas = this.captureFrame();
		const imageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);

		const centerX = canvas.width / 2;
		const centerY = canvas.height / 2;
		const gridSize = Math.min(canvas.width, canvas.height) * 0.4;
		const squareSize = gridSize / 3;

		this.detectedColors = [];
		const colorSamples = [];

		for (let row = 0; row < 3; row++) {
			for (let col = 0; col < 3; col++) {
				const x = Math.floor(centerX - gridSize / 2 + col * squareSize + squareSize / 2);
				const y = Math.floor(centerY - gridSize / 2 + row * squareSize + squareSize / 2);

				const sampleRadius = squareSize * 0.32; // 32% of the square size is a good default
				const color = this.getEnhancedAverageColor(imageData, x, y, sampleRadius);
				colorSamples.push({ color });
			}
		}

		// Normalize color samples by white balance
		const normalizedSamples = this.normalizeColorsByWhiteBalance(colorSamples);

		const isWhiteArr = this.findWhiteSquares(normalizedSamples);

		for (let i = 0; i < normalizedSamples.length; i++) {
			if (isWhiteArr[i]) {
				this.detectedColors.push('#ffffff');
			} else {
				const { color } = normalizedSamples[i];
				const matchedColor = this.matchToGameColorNoWhite(color);
				this.detectedColors.push(matchedColor);
			}
		}

		return this.detectedColors;
	}

	/**
	* Match to game color, but never return white (white is handled separately)
	* @param {Object} detectedColor - {r, g, b}
	* @returns {string} - Hex code of matched color
	*/
	matchToGameColorNoWhite(detectedColor) {
		const gameColors = [
			{ hex: '#ff0000', rgb: { r: 255, g: 0, b: 0 }, name: 'Red' },
			{ hex: '#0000ff', rgb: { r: 0, g: 0, b: 255 }, name: 'Blue' },
			{ hex: '#00ff00', rgb: { r: 0, g: 255, b: 0 }, name: 'Green' },
			{ hex: '#ffff00', rgb: { r: 255, g: 255, b: 0 }, name: 'Yellow' },
			{ hex: '#ff8c00', rgb: { r: 255, g: 140, b: 0 }, name: 'Orange' }
		];

		const { r, g, b } = detectedColor;
		const detectedHSV = this.rgbToHsv(r, g, b);

		let bestMatch = gameColors[0];
		let bestScore = -1;

		for (let color of gameColors) {
			const colorHSV = this.rgbToHsv(color.rgb.r, color.rgb.g, color.rgb.b);
			let score = this.calculateColorScoreImproved(detectedColor, detectedHSV, color.rgb, colorHSV);

			// Red: hue near 0 or 360, high sat
			if (color.name === 'Red') {
				if (!((detectedHSV.h < 20 || detectedHSV.h > 340) && detectedHSV.s > 25)) score -= 100;
			}
			// Orange: hue 20-45, high sat
			if (color.name === 'Orange') {
				if (!(detectedHSV.h >= 20 && detectedHSV.h <= 35 && detectedHSV.s > 25)) score -= 100;
			}
			// Yellow: hue 46-70, moderate sat
			if (color.name === 'Yellow') {
				if (!(detectedHSV.h >= 36 && detectedHSV.h <= 70 && detectedHSV.s > 15)) score -= 100;
			}
			// Green: hue 80-170
			if (color.name === 'Green') {
				if (!(detectedHSV.h >= 80 && detectedHSV.h <= 170)) score -= 50;
			}
			// Blue: hue 180-260
			if (color.name === 'Blue') {
				if (!(detectedHSV.h >= 180 && detectedHSV.h <= 260)) score -= 50;
			}

			if (score > bestScore) {
				bestScore = score;
				bestMatch = color;
			}
		}

		return bestMatch.hex;
	}

	/**
	* Improved color similarity score to help white/orange distinction
	* @param {Object} detectedRGB
	* @param {Object} detectedHSV
	* @param {Object} targetRGB
	* @param {Object} targetHSV
	* @returns {number}
	*/
	calculateColorScoreImproved(detectedRGB, detectedHSV, targetRGB, targetHSV) {
		const rgbDistance = Math.sqrt(
			Math.pow(detectedRGB.r - targetRGB.r, 2) +
			Math.pow(detectedRGB.g - targetRGB.g, 2) +
			Math.pow(detectedRGB.b - targetRGB.b, 2)
		);

		let hueDiff = Math.abs(detectedHSV.h - targetHSV.h);
		if (hueDiff > 180) hueDiff = 360 - hueDiff;

		const satDiff = Math.abs(detectedHSV.s - targetHSV.s);
		const valDiff = Math.abs(detectedHSV.v - targetHSV.v);

		const rgbScore = Math.max(0, 441 - rgbDistance);
		const hueScore = Math.max(0, 180 - hueDiff);
		const satScore = Math.max(0, 100 - satDiff);
		const valScore = Math.max(0, 100 - valDiff);

		return (hueScore * 0.4) + (rgbScore * 0.3) + (satScore * 0.2) + (valScore * 0.1);
	}

	/**
	* ADVANCED COLOR SAMPLING ALGORITHM
	* Uses statistical analysis and noise reduction for accurate color detection
	* @param {ImageData} imageData - Canvas image data
	* @param {number} centerX - X coordinate of sampling center
	* @param {number} centerY - Y coordinate of sampling center  
	* @param {number} radius - Sampling radius in pixels
	* @returns {Object} - RGB color object {r, g, b}
	*/
	getEnhancedAverageColor(imageData, centerX, centerY, radius) {
		const samples = [];
		const samplePoints = [];
		const step = 1;
		const radiusSq = radius * radius;

		for (let dx = -radius; dx <= radius; dx += step) {
			for (let dy = -radius; dy <= radius; dy += step) {
				const distSq = dx * dx + dy * dy;
				if (distSq <= radiusSq) {
					const weight = Math.exp(-distSq / (2 * (radius * 0.5) * (radius * 0.5)));
					samplePoints.push({ dx, dy, weight });
				}
			}
		}

		// Collect samples
		for (let { dx, dy, weight } of samplePoints) {
			const x = Math.round(centerX + dx);
			const y = Math.round(centerY + dy);

			if (x >= 0 && x < imageData.width && y >= 0 && y < imageData.height) {
				const index = (y * imageData.width + x) * 4;
				const pixelR = imageData.data[index];
				const pixelG = imageData.data[index + 1];
				const pixelB = imageData.data[index + 2];
				const brightness = (pixelR + pixelG + pixelB) / 3;
				samples.push({ r: pixelR, g: pixelG, b: pixelB, weight, brightness });
			}
		}

		// Ignore the darkest 20% of samples (likely gutter)
		samples.sort((a, b) => a.brightness - b.brightness);
		const start = Math.floor(samples.length * 0.2);
		const trimmed = samples.slice(start);

		let r = 0, g = 0, b = 0, totalWeight = 0;
		for (let sample of trimmed) {
			r += sample.r * sample.weight;
			g += sample.g * sample.weight;
			b += sample.b * sample.weight;
			totalWeight += sample.weight;
		}

		if (totalWeight > 0) {
			return {
				r: Math.round(r / totalWeight),
				g: Math.round(g / totalWeight),
				b: Math.round(b / totalWeight)
			};
		}

		return { r: 128, g: 128, b: 128 };
	}

	normalizeColorsByWhiteBalance(colorSamples) {
		// Find the brightest sample (by sum of r+g+b)
		let maxBrightness = 0;
		colorSamples.forEach(({ color }) => {
			const brightness = color.r + color.g + color.b;
			if (brightness > maxBrightness) maxBrightness = brightness;
		});
		// Scale all colors so the brightest becomes 255,255,255
		const scale = maxBrightness > 0 ? 765 / maxBrightness : 1; // 765 = 255*3
		return colorSamples.map(({ color }) => ({
			color: {
				r: Math.min(255, Math.round(color.r * scale)),
				g: Math.min(255, Math.round(color.g * scale)),
				b: Math.min(255, Math.round(color.b * scale))
			}
		}));
	}

	/**
	* Convert RGB to HSV color space
	* @param {number} r
	* @param {number} g
	* @param {number} b
	* @returns {Object} - {h, s, v}
	*/
	rgbToHsv(r, g, b) {
		r /= 255;
		g /= 255;
		b /= 255;

		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const diff = max - min;

		let h = 0;
		if (diff !== 0) {
			if (max === r) {
				h = ((g - b) / diff) % 6;
			} else if (max === g) {
				h = (b - r) / diff + 2;
			} else {
				h = (r - g) / diff + 4;
			}
		}
		h = Math.round(h * 60);
		if (h < 0) h += 360;

		const s = max === 0 ? 0 : diff / max;
		const v = max;

		return { h, s: s * 100, v: v * 100 };
	}

	/**
	* Display detected pattern in UI
	* @param {Array} colors - Array of hex color codes
	*/
	displayDetectedPattern(colors) {
		const squares = document.querySelectorAll('#detectedPatternResult .detected-square');
		colors.forEach((color, index) => {
			if (squares[index]) {
				squares[index].style.backgroundColor = color;
			}
		});
	}
}


/**
 * ====================================================================
 * GAME INITIALIZATION AND UI INTERACTIONS
 * ====================================================================
 * Handles all UI and event logic for Cube Rush
 */

// Initialize the game and scanner
const game = new CubeRush();
const scanner = new CubeScanner();

/**
 * Start a new game round
 */
function startGame() {
	game.reset();

	document.getElementById('status').textContent = 'Generating pattern...';
	document.getElementById('status').className = 'status waiting';
	document.getElementById('startBtn').disabled = true;
	document.getElementById('scanBtn').disabled = true;

	game.generatePattern();

	setTimeout(() => {
		game.startTimer();
		document.getElementById('status').textContent = 'GO! Match the pattern!';
		document.getElementById('status').className = 'status running';
		document.getElementById('scanBtn').disabled = false;

		game.playBeep(800, 300);
	}, 1000);
}

/**
 * Open the scanner overlay and start camera
 */
async function openScanner() {
	if (!game.isRunning) return;

	game.stopTimer();
	document.getElementById('scannerOverlay').style.display = 'flex';

	const cameraStarted = await scanner.startCamera();
	if (!cameraStarted) {
		closeScanner();
	}
}

/**
 * Close the scanner overlay and stop camera
 */
function closeScanner() {
	scanner.stopCamera();
	document.getElementById('scannerOverlay').style.display = 'none';

	if (game.isRunning) {
		game.resumeTimer();
	}
}

/**
 * Capture and analyze the cube pattern from camera
 */
function captureAndAnalyze() {
	try {
		const detectedColors = scanner.analyzeColors();
		scanner.displayDetectedPattern(detectedColors);

		const isMatch = game.comparePatterns(detectedColors);
		const resultDiv = document.getElementById('matchResultPopup');

		if (isMatch) {
			resultDiv.innerHTML = '<p style="color: #27ae60; font-weight: bold; font-size: 1.2rem;">✅ Perfect Match!</p>';
			resultDiv.className = 'match-result match-correct';
		} else {
			resultDiv.innerHTML = '<p style="color: #e74c3c; font-weight: bold; font-size: 1.2rem;">❌ Pattern doesn\'t match. Keep trying!</p>';
			resultDiv.className = 'match-result match-incorrect';
		}

		scanner.stopCamera();
		document.getElementById('scannerOverlay').style.display = 'none';
		document.getElementById('scanResultsPopup').style.display = 'flex';
	} catch (error) {
		console.error('Error during capture and analysis:', error);
		alert('Error analyzing the image. Please try again.');
		closeScanner();
	}
}

/**
 * Re-open the scanner for another attempt
 */
function scanAgain() {
	document.getElementById('scanResultsPopup').style.display = 'none';
	setTimeout(() => {
		openScanner();
	}, 100);
}

/**
 * Confirm the match and handle result
 */
function confirmMatch() {
	try {
		const isMatch = game.comparePatterns(scanner.detectedColors);

		document.getElementById('scanResultsPopup').style.display = 'none';

		if (isMatch) {
			game.showSuccess();

			document.getElementById('status').textContent = '🎉 SUCCESS!';
			document.getElementById('status').className = 'status waiting';

			document.getElementById('startBtn').disabled = false;
			document.getElementById('scanBtn').disabled = true;
		} else {
			game.addPenalty();

			document.getElementById('status').textContent = 'Wrong answer! Keep trying...';
			document.getElementById('status').className = 'status running';

			game.resumeTimer();
			game.playBeep(400, 300);
		}
	} catch (error) {
		console.error('Error in confirmMatch:', error);
		game.resumeTimer();
		document.getElementById('status').textContent = 'Game resumed! Keep trying...';
		document.getElementById('status').className = 'status running';
	}
}

/**
 * Start a new game after success
 */
function playAgain() {
	document.getElementById('successPopup').style.display = 'none';
	startGame();
}

/**
 * Close the success popup and reset UI
 */
function closeSuccess() {
	document.getElementById('successPopup').style.display = 'none';
	document.getElementById('startBtn').disabled = false;
	document.getElementById('scanBtn').disabled = true;
	document.getElementById('status').textContent = 'Ready to start!';
	document.getElementById('status').className = 'status waiting';
}

// Initialize timer display when page loads
document.addEventListener('DOMContentLoaded', function () {
	game.updateTimerDisplay();
});

// Prevent zoom on mobile
document.addEventListener('touchstart', function (event) {
	if (event.touches.length > 1) {
		event.preventDefault();
	}
});

let lastTouchEnd = 0;
document.addEventListener('touchend', function (event) {
	const now = (new Date()).getTime();
	if (now - lastTouchEnd <= 300) {
		event.preventDefault();
	}
	lastTouchEnd = now;
}, false);