class CubeRush {
    constructor() {
        this.colors = ['#ff0000', '#0000ff', '#00ff00', '#ffff00', '#ff8c00', '#ffffff'];
        this.startTime = null;
        this.elapsedTime = 0;
        this.penalties = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.timerInterval = null;
        
        // Create audio contexts for sound effects
        this.createSounds();
    }
    
    createSounds() {
        // Create simple beep sounds using Web Audio API
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
        const squares = document.querySelectorAll('.cube-square');
        squares.forEach((square, index) => {
            setTimeout(() => {
                const randomColor = this.colors[Math.floor(Math.random() * this.colors.length)];
                square.style.backgroundColor = randomColor;
                square.classList.add('animate');
                setTimeout(() => square.classList.remove('animate'), 300);
                
                // Play a soft tone for each square
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
        this.isPaused = true;  // Don't set isRunning to false, just pause
        // Don't clear the interval - let it keep running but paused
        
        // Play stop sound
        this.playBeep(600, 300);
    }
    
    resumeTimer() {
        if (this.isRunning) {  // Only resume if game is actually running
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
        // Penalties are just for tracking - no actual game logic changes
    }
    
    reset() {
        this.elapsedTime = 0;
        this.penalties = 0;
        this.isRunning = false;
        this.isPaused = false;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        this.updateTimerDisplay();
    }
}

// Initialize the game
const game = new CubeRush();

// Global functions for button interactions
function startGame() {
    game.reset();
    
    // Update UI
    document.getElementById('status').textContent = 'Generating pattern...';
    document.getElementById('status').className = 'status waiting';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('gotItBtn').disabled = true;
    // document.getElementById('correctBtn').style.display = 'none';
    // document.getElementById('wrongBtn').style.display = 'none';
    // document.getElementById('penaltyDisplay').style.display = 'none';
    
    // Generate pattern
    game.generatePattern();
    
    // Start timer after pattern is fully generated
    setTimeout(() => {
        game.startTimer();
        document.getElementById('status').textContent = 'GO! Match the pattern!';
        document.getElementById('status').className = 'status running';
        document.getElementById('gotItBtn').disabled = false;
        
        // Play start sound
        game.playBeep(800, 300);
    }, 1000);
}

function gotIt() {
    if (!game.isRunning || game.isPaused) return;
    
    game.stopTimer();
    
    // Show verification popup
    document.getElementById('verificationPopup').style.display = 'flex';
}

function markCorrect() {
    // Hide verification popup
    document.getElementById('verificationPopup').style.display = 'none';
    
    // Game completed successfully
    const totalSeconds = (game.elapsedTime / 1000).toFixed(2);
    document.getElementById('status').textContent = 
        `🎉 SUCCESS! Time: ${totalSeconds}s (Wrong attempts: ${game.penalties})`;
    document.getElementById('status').className = 'status waiting';
    
    // Reset UI
    document.getElementById('startBtn').disabled = false;
    document.getElementById('gotItBtn').disabled = true;
    
    // Play success sound
    game.playBeep(1000, 200);
    setTimeout(() => game.playBeep(1200, 200), 200);
    setTimeout(() => game.playBeep(1400, 300), 400);

    showSuccessPopup();
}

function markWrong() {
    // Hide verification popup
    document.getElementById('verificationPopup').style.display = 'none';
    
    // Add penalty for tracking
    game.addPenalty();
    
    // DON'T resume timer here - wait for the countdown
    // Timer stays paused until countdown completes
    
    // Show resume popup with penalty info
    document.getElementById('resumePopup').style.display = 'flex';
    
    // Update status
    document.getElementById('status').textContent = 'Wrong answer! Check popup for instructions...';
    document.getElementById('status').className = 'status stopped';
    
    // Play penalty sound
    game.playBeep(200, 500);
}

function startResume() {
    // Hide the "Got It" button and show countdown
    document.querySelector('#resumePopup .btn').style.display = 'none';
    document.getElementById('countdownDisplay').style.display = 'block';
    
    let countdown = 3;
    document.getElementById('countdownNumber').textContent = countdown;
    
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            document.getElementById('countdownNumber').textContent = countdown;
        } else {
            clearInterval(countdownInterval);
            
            // Hide popup and resume game
            document.getElementById('resumePopup').style.display = 'none';
            document.getElementById('countdownDisplay').style.display = 'none';
            document.querySelector('#resumePopup .btn').style.display = 'inline-block';
            
            // NOW resume the timer - this happens AFTER countdown finishes
            game.resumeTimer();
            
            // Update status
            document.getElementById('status').textContent = 'Game resumed! Keep trying...';
            document.getElementById('status').className = 'status running';
            
            // Play resume sound
            game.playBeep(800, 200);
        }
    }, 1000);
}

// Initialize timer display when page loads
document.addEventListener('DOMContentLoaded', function() {
    game.updateTimerDisplay();
});

// Prevent zoom on mobile
document.addEventListener('touchstart', function(event) {
    if (event.touches.length > 1) {
        event.preventDefault();
    }
});

let lastTouchEnd = 0;
document.addEventListener('touchend', function(event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);

//--------------- Success Popup ----------------------------------------------

function showSuccessPopup() {
    document.getElementById('successTime').textContent = document.getElementById('timer').textContent;
    document.getElementById('successPenalties').textContent = game.penalties;
    document.getElementById('successPopup').style.display = 'flex';
}

function closeSuccess() {
    document.getElementById('successPopup').style.display = 'none';
}

function playAgain() {
    closeSuccess();
    // Call your start game function here
    if (typeof startGame === 'function') {
        startGame();
    }
}
