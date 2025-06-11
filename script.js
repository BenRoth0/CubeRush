class CubeRush {
	constructor() {
		this.colors = ['#ff0000', '#0000ff', '#00ff00', '#ffff00', '#ff8c00', '#ffffff'];
		this.currentPattern = [];
		this.startTime = null;
		this.elapsedTime = 0;
		this.penalties = 0;
		this.isRunning = false;
		this.isPaused = false;
		this.timerInterval = null;

		this.createSounds();
	}

	createSounds() {
		this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

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

	stopTimer() {
		this.isPaused = true;
		this.playBeep(600, 300);
	}

	resumeTimer() {
		if (this.isRunning) {
			this.startTime = Date.now() - this.elapsedTime;
			this.isPaused = false;
		}
	}

	updateTimerDisplay() {
		const totalSeconds = Math.floor(this.elapsedTime / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		const centiseconds = Math.floor((this.elapsedTime % 1000) / 10);

		document.getElementById('timer').textContent =
			`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
	}

	addPenalty() {
		this.penalties++;
	}

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

	colorsMatch(color1, color2) {
		// Convert hex colors to RGB for comparison with tolerance
		const rgb1 = this.hexToRgb(color1);
		const rgb2 = this.hexToRgb(color2);

		const tolerance = 40; // Allow some variation in color detection

		return (
			Math.abs(rgb1.r - rgb2.r) < tolerance &&
			Math.abs(rgb1.g - rgb2.g) < tolerance &&
			Math.abs(rgb1.b - rgb2.b) < tolerance
		);
	}

	hexToRgb(hex) {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ? {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16)
		} : null;
	}

	showSuccess() {
		clearInterval(this.timerInterval);

		const totalSeconds = (this.elapsedTime / 1000).toFixed(2);
		document.getElementById('successTime').textContent =
			`${Math.floor(this.elapsedTime / 60000).toString().padStart(2, '0')}:${Math.floor((this.elapsedTime % 60000) / 1000).toString().padStart(2, '0')}.${Math.floor((this.elapsedTime % 1000) / 10).toString().padStart(2, '0')}`;

		document.getElementById('successPenalties').textContent = this.penalties;
		document.getElementById('successPopup').style.display = 'flex';

		// Play success sound sequence
		this.playBeep(1000, 200);
		setTimeout(() => this.playBeep(1200, 200), 200);
		setTimeout(() => this.playBeep(1400, 300), 400);
	}
}

// Camera Scanner Class
class CubeScanner {
	constructor() {
		this.video = document.getElementById('cameraVideo');
		this.canvas = document.getElementById('canvas');
		this.ctx = this.canvas.getContext('2d');
		this.stream = null;
		this.detectedColors = [];
	}

	async startCamera() {
		try {
			this.stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: 'environment', // Use back camera on mobile
					width: { ideal: 1280 },
					height: { ideal: 720 }
				}
			});
			this.video.srcObject = this.stream;
			return true;
		} catch (error) {
			console.error('Error accessing camera:', error);
			alert('Could not access camera. Please make sure camera permissions are enabled.');
			return false;
		}
	}

	stopCamera() {
		if (this.stream) {
			this.stream.getTracks().forEach(track => track.stop());
			this.stream = null;
		}
	}

	captureFrame() {
		const videoRect = this.video.getBoundingClientRect();
		this.canvas.width = this.video.videoWidth;
		this.canvas.height = this.video.videoHeight;

		this.ctx.drawImage(this.video, 0, 0);
		return this.canvas;
	}

	analyzeColors() {
		const canvas = this.captureFrame();
		const imageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);

		// Calculate grid positions (3x3 grid in center of image)
		const centerX = canvas.width / 2;
		const centerY = canvas.height / 2;
		const gridSize = Math.min(canvas.width, canvas.height) * 0.35;
		const squareSize = gridSize / 3;

		this.detectedColors = [];

		for (let row = 0; row < 3; row++) {
			for (let col = 0; col < 3; col++) {
				const x = Math.floor(centerX - gridSize / 2 + col * squareSize + squareSize / 2);
				const y = Math.floor(centerY - gridSize / 2 + row * squareSize + squareSize / 2);

				// Use multiple sampling points and larger radius for better accuracy
				const color = this.getEnhancedAverageColor(imageData, x, y, 25);
				const matchedColor = this.matchToGameColor(color);
				this.detectedColors.push(matchedColor);
			}
		}

		return this.detectedColors;
	}

	getEnhancedAverageColor(imageData, centerX, centerY, radius) {
		let r = 0, g = 0, b = 0, count = 0;
		const samples = [];

		// Take multiple samples in a cross pattern for better accuracy
		const samplePoints = [
			[0, 0], // center
			[-radius / 2, -radius / 2], [-radius / 2, radius / 2],
			[radius / 2, -radius / 2], [radius / 2, radius / 2],
			[-radius, 0], [radius, 0], [0, -radius], [0, radius]
		];

		for (let [dx, dy] of samplePoints) {
			const x = Math.round(centerX + dx);
			const y = Math.round(centerY + dy);

			if (x >= 0 && x < imageData.width && y >= 0 && y < imageData.height) {
				const index = (y * imageData.width + x) * 4;
				const pixelR = imageData.data[index];
				const pixelG = imageData.data[index + 1];
				const pixelB = imageData.data[index + 2];

				samples.push({ r: pixelR, g: pixelG, b: pixelB });
			}
		}

		// Remove outliers and average the remaining samples
		if (samples.length > 3) {
			samples.sort((a, b) => (a.r + a.g + a.b) - (b.r + b.g + b.b));
			const trimmed = samples.slice(1, -1); // Remove brightest and darkest

			for (let sample of trimmed) {
				r += sample.r;
				g += sample.g;
				b += sample.b;
				count++;
			}
		} else {
			for (let sample of samples) {
				r += sample.r;
				g += sample.g;
				b += sample.b;
				count++;
			}
		}

		return count > 0 ? {
			r: Math.floor(r / count),
			g: Math.floor(g / count),
			b: Math.floor(b / count)
		} : { r: 0, g: 0, b: 0 };
	}

	matchToGameColor(detectedColor) {
		const gameColors = [
			{ hex: '#ff0000', rgb: { r: 255, g: 0, b: 0 }, name: 'Red' },
			{ hex: '#0000ff', rgb: { r: 0, g: 0, b: 255 }, name: 'Blue' },
			{ hex: '#00ff00', rgb: { r: 0, g: 255, b: 0 }, name: 'Green' },
			{ hex: '#ffff00', rgb: { r: 255, g: 255, b: 0 }, name: 'Yellow' },
			{ hex: '#ff8c00', rgb: { r: 255, g: 140, b: 0 }, name: 'Orange' },
			{ hex: '#ffffff', rgb: { r: 255, g: 255, b: 255 }, name: 'White' }
		];

		let bestMatch = gameColors[0];
		let minDistance = this.colorDistance(detectedColor, gameColors[0].rgb);

		for (let color of gameColors) {
			const distance = this.colorDistance(detectedColor, color.rgb);
			if (distance < minDistance) {
				minDistance = distance;
				bestMatch = color;
			}
		}

		return bestMatch.hex;
	}

	colorDistance(color1, color2) {
		return Math.sqrt(
			Math.pow(color1.r - color2.r, 2) +
			Math.pow(color1.g - color2.g, 2) +
			Math.pow(color1.b - color2.b, 2)
		);
	}

	displayDetectedPattern(colors) {
		const squares = document.querySelectorAll('#detectedPatternResult .detected-square');
		colors.forEach((color, index) => {
			if (squares[index]) {
				squares[index].style.backgroundColor = color;
			}
		});
	}
}

// Initialize the game and scanner
const game = new CubeRush();
const scanner = new CubeScanner();

// Global functions for button interactions
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

async function openScanner() {
	if (!game.isRunning) return;

	game.stopTimer();
	document.getElementById('scannerOverlay').style.display = 'flex';

	const cameraStarted = await scanner.startCamera();
	if (!cameraStarted) {
		// If camera failed to start, close scanner and resume timer
		closeScanner();
	}
}

function closeScanner() {
	scanner.stopCamera();
	document.getElementById('scannerOverlay').style.display = 'none';

	if (game.isRunning) {
		game.resumeTimer();
	}
}

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

		// Close scanner and show results
		scanner.stopCamera();
		document.getElementById('scannerOverlay').style.display = 'none';
		document.getElementById('scanResultsPopup').style.display = 'flex';
	} catch (error) {
		console.error('Error during capture and analysis:', error);
		alert('Error analyzing the image. Please try again.');
		closeScanner();
	}
}

function scanAgain() {
	document.getElementById('scanResultsPopup').style.display = 'none';
	// Re-open the scanner
	setTimeout(() => {
		openScanner();
	}, 100);
}

function confirmMatch() {
	try {
		const isMatch = game.comparePatterns(scanner.detectedColors);

		document.getElementById('scanResultsPopup').style.display = 'none';

		if (isMatch) {
			// Success!
			game.showSuccess();

			document.getElementById('status').textContent = '🎉 SUCCESS!';
			document.getElementById('status').className = 'status waiting';

			document.getElementById('startBtn').disabled = false;
			document.getElementById('scanBtn').disabled = true;
		} else {
			// Wrong answer - no penalty timer, just resume immediately for multiplayer
			game.addPenalty();

			document.getElementById('status').textContent = 'Wrong answer! Keep trying...';
			document.getElementById('status').className = 'status running';

			// Resume the timer immediately for multiplayer gameplay
			game.resumeTimer();
			game.playBeep(400, 300); // Different sound for wrong answer
		}
	} catch (error) {
		console.error('Error in confirmMatch:', error);
		// Fallback: resume the game
		game.resumeTimer();
		document.getElementById('status').textContent = 'Game resumed! Keep trying...';
		document.getElementById('status').className = 'status running';
	}
}

function playAgain() {
	document.getElementById('successPopup').style.display = 'none';
	startGame();
}

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