// Core Game Setup
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

let width, height;
let cx, cy; // Center X, Y

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    cx = width / 2;
    cy = height / 2;
}
window.addEventListener('resize', resize);
resize();

// 3D Perspective Helper
function project(x, y) {
    const depth = (y / height); // 0.0 (Far) to 1.0 (Near)
    const scale = 0.5 + 0.5 * (depth * depth); // More dramatic scale
    const sx = cx + (x - cx) * scale;
    const sy = y;
    return { x: sx, y: sy, scale: scale };
}

// Background Grid Effect
class BackgroundGrid {
    constructor() {
        this.offsetY = 0;
        this.speed = 2;
    }

    update() {
        this.offsetY = (this.offsetY + this.speed) % 80;
    }

    draw(ctx) {
        ctx.save();
        ctx.strokeStyle = 'rgba(76, 224, 179, 0.15)'; // Tac Green
        ctx.lineWidth = 1;

        // Vertical lines (Perspective)
        for (let i = -10; i <= 10; i++) {
            const x = cx + i * 100;
            ctx.beginPath();
            ctx.moveTo(cx + (x - cx) * 0.1, 0); // Converge at top
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Horizontal lines (Moving forward)
        for (let i = 0; i < 20; i++) {
            const y = (this.offsetY + i * 80) % height;
            // Only draw if in lower half to simulate ground plane perception
            if (y > height * 0.2) {
                const alpha = (y / height) * 0.3;
                ctx.strokeStyle = `rgba(76, 224, 179, ${alpha})`;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}
const bgGrid = new BackgroundGrid();

// Word Dictionary
const WORDS_EASY = [
    "VOID", "CORE", "NEON", "GLOW", "FLUX", "GRID", "DATA", "CODE",
    "HACK", "BIOS", "LINK", "NODE", "SYNC", "WAVE", "BEAM", "NULL",
    "ZERO", "BYTE", "MEGA", "GIGA", "TERA", "WARP", "STAR", "MOON",
    "GATE", "LOCK", "KEY", "PATH", "ROOT", "BOOT", "LOAD", "SAVE"
];

const WORDS_MEDIUM = [
    "SYSTEM", "MATRIX", "VECTOR", "PIXEL", "SPRITE", "RENDER", "SHADER",
    "BUFFER", "MEMORY", "KERNEL", "SERVER", "CLIENT", "SOCKET", "PACKET",
    "ROUTER", "SWITCH", "ACCESS", "DENIED", "UPLINK", "TROJAN", "BINARY",
    "DRIVER", "LATENCY", "BANDWIDTH", "PROTOCOL", "NETWORK", "VIRTUAL",
    "DIGITAL", "ANALOG", "CIRCUIT", "SILICON", "OPTICAL", "QUANTUM"
];

const WORDS_HARD = [
    "ALGORITHM", "ENCRYPTION", "FIREWALL", "PROCESSOR", "INTERFACE",
    "COMPILER", "DEBUGGER", "DATABASE", "MAINFRAME", "CYBERPUNK",
    "ASSEMBLY", "INTERRUPT", "REGISTRY", "ETHERNET", "KERNELPANIC",
    "OVERCLOCK", "BLUEPRINT", "CRYPTOGRAPHY", "HEURISTIC", "ITERATION",
    "RECURSION", "TELEMETRY", "SUBROUTINE", "THROUGHPUT", "BLOCKCHAIN"
];

// Audio Context (Synthesized Sounds)
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playTone(freq, type, duration) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// Advanced Audio (War FX)
function createNoiseBuffer() {
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    return buffer;
}
const noiseBuffer = createNoiseBuffer();

// Load Assets
const explosionImg = new Image();
explosionImg.src = 'Explosion.png';

const playerImg = new Image();
playerImg.src = 'spiked ship 3. small.blue_.PNG';

function sfxWarExplosion() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 1000;
    noiseFilter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(2.0, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

    noise.connect(noiseFilter);
    noiseFilter.connect(gain);
    gain.connect(audioCtx.destination);

    noise.start();
}

function sfxShoot() { playTone(800, 'square', 0.1); }
function sfxLock() { playTone(1200, 'sine', 0.1); }
function sfxError() { playTone(150, 'sawtooth', 0.2); }
function sfxReward() { playTone(600, 'sine', 0.1); setTimeout(() => playTone(800, 'sine', 0.2), 100); }

// Game Classes
class Player {
    constructor() {
        this.x = width / 2;
        this.y = height - 100;
        this.angle = 0;
        this.targetAngle = 0;
    }

    update(targetX, targetY) {
        if (targetX !== null) {
            this.targetAngle = Math.atan2(targetY - this.y, targetX - this.x) + Math.PI / 2;
        } else {
            this.targetAngle = 0;
        }
        let diff = this.targetAngle - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.angle += diff * 0.15;
    }

    draw(ctx) {
        const p = project(this.x, this.y);
        const s = p.scale;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(this.angle);
        ctx.scale(s, s);

        const shipW = 100;
        const shipH = 100;

        ctx.shadowBlur = 30;
        ctx.shadowColor = '#ffd700'; // Gold glow for player
        ctx.drawImage(playerImg, -shipW / 2, -shipH / 2, shipW, shipH);

        // Engine flame
        ctx.fillStyle = `rgba(0, 240, 255, ${Math.random() * 0.5 + 0.5})`;
        ctx.beginPath();
        ctx.arc(0, shipH / 2 - 10, 10 + Math.random() * 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

class Enemy {
    constructor(word) {
        this.word = word;
        this.matchedIndex = 0;
        this.x = Math.random() * (width - 200) + 100;
        this.y = -100;
        this.speed = Math.random() * 0.8 + 0.5;
        this.isLocked = false;
        this.markedForDeletion = false;
        this.rotation = 0;
        this.pulse = 0;
    }

    update(difficultyMultiplier) {
        this.y += this.speed * difficultyMultiplier;
        this.rotation += 0.02;
        this.pulse += 0.1;
        if (this.y > height) {
            this.markedForDeletion = true;
            return 'damage';
        }
        return null;
    }

    draw(ctx) {
        const p = project(this.x, this.y);
        const s = p.scale;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(s, s);

        const isLocked = this.isLocked;
        const baseColor = isLocked ? '#ff0044' : '#ffffff'; // Red if locked, White otherwise

        // Enemy Vessel Design - "Tactical Drone"
        // 1. Core
        ctx.shadowBlur = isLocked ? 20 : 0;
        ctx.shadowColor = baseColor;
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();

        // 2. Rotating Rings
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 30, 10, this.rotation, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = isLocked ? '#ffbd00' : '#888';
        ctx.beginPath();
        ctx.ellipse(0, 0, 30, 10, -this.rotation, 0, Math.PI * 2);
        ctx.stroke();

        // 3. Central Eye
        const pulseSize = 10 + Math.sin(this.pulse) * 2;
        ctx.fillStyle = isLocked ? '#ff3333' : '#4ce0b3'; /* Red vs Teal */
        ctx.beginPath();
        ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
        ctx.fill();

        // Word Label (High contrast plate)
        ctx.font = '900 36px "Share Tech Mono"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const totalW = ctx.measureText(this.word).width;

        // Label Background
        ctx.fillStyle = 'rgba(10, 20, 30, 0.9)';
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(-totalW / 2 - 10, -70, totalW + 20, 30); /* Sharp rect */
        ctx.fill();
        ctx.stroke();

        let labelY = -50;
        const remaining = this.word.substring(this.matchedIndex);
        const matched = this.word.substring(0, this.matchedIndex);
        const startX = -totalW / 2;

        if (matched.length > 0) {
            ctx.fillStyle = '#ff9900'; // Tactical Orange for matched
            ctx.shadowBlur = 0;
            ctx.fillText(matched, startX + ctx.measureText(matched).width / 2, labelY);
        }

        ctx.fillStyle = '#ffffff'; // White for remaining
        const offset = ctx.measureText(matched).width;
        ctx.fillText(remaining, startX + offset + ctx.measureText(remaining).width / 2, labelY);

        ctx.restore();
    }
}

class Projectile {
    constructor(x, y, target) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.speed = 20; // Faster lasers
        this.active = true;
        this.trail = [];
    }

    update() {
        if (!this.target || this.target.markedForDeletion) {
            this.active = false;
            return;
        }

        const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;

        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 8) this.trail.shift();

        const dist = Math.hypot(this.x - this.target.x, this.y - this.target.y);
        if (dist < 30) {
            this.active = false;
            return 'hit';
        }
    }

    draw(ctx) {
        ctx.strokeStyle = '#fff'; // White Tracer
        ctx.lineWidth = 2;
        ctx.lineCap = 'butt';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#fff';

        ctx.beginPath();
        for (let i = 0; i < this.trail.length; i++) {
            const p = project(this.trail[i].x, this.trail[i].y);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        }
        const curr = project(this.x, this.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();

        // Leading Spark
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(curr.x, curr.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Particle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.life = 1;
        const angle = Math.random() * Math.PI * 2;

        if (type === 'spark') {
            this.vx = Math.cos(angle) * (Math.random() * 15 + 5);
            this.vy = Math.sin(angle) * (Math.random() * 15 + 5);
            this.decay = Math.random() * 0.05 + 0.02;
            this.color = '#fff';
            this.size = Math.random() * 3 + 1;
        } else if (type === 'fire') {
            this.vx = Math.cos(angle) * (Math.random() * 6);
            this.vy = Math.sin(angle) * (Math.random() * 6);
            this.decay = Math.random() * 0.04 + 0.01;
            const hue = Math.random() * 40 + 340; // Red/Crimson
            this.color = `hsl(${hue}, 100%, 60%)`;
            this.size = Math.random() * 20 + 10;
        } else if (type === 'smoke') {
            this.vx = Math.cos(angle) * 2;
            this.vy = Math.sin(angle) * 2 - 2;
            this.decay = 0.02;
            this.color = 'rgba(50, 50, 50, 0.5)';
            this.size = Math.random() * 30 + 10;
        }
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;

        if (this.type === 'spark') {
            this.vx *= 0.9;
            this.vy *= 0.9;
        } else {
            this.size += 0.5;
            this.vx *= 0.95;
            this.vy *= 0.95;
        }
    }

    draw(ctx) {
        const p = project(this.x, this.y);
        const s = p.scale * this.size;

        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;

        ctx.beginPath();
        ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Shockwave {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 1;
        this.maxRadius = 80;
        this.alpha = 1;
        this.speed = 5;
    }

    update() {
        this.radius += this.speed;
        this.alpha -= 0.05;
    }

    draw(ctx) {
        if (this.alpha <= 0) return;
        ctx.save();
        const p = project(this.x, this.y);
        ctx.translate(p.x, p.y);
        ctx.scale(1, 0.5); // Perspective oval

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 200, 0, ${this.alpha})`;
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.restore();
    }
}

class TextExplosion {
    constructor(x, y, text) {
        this.particles = [];
        const chars = text.split('');
        const totalW = 12 * chars.length; // Approximate width based on font

        chars.forEach((char, i) => {
            const offsetX = (i * 14) - (totalW / 2);
            this.particles.push({
                char: char,
                x: x + offsetX,
                y: y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4 - 2, // Slight upward bias
                rotation: 0,
                vRot: (Math.random() - 0.5) * 0.2,
                alpha: 1,
                scale: 1
            });
        });
    }

    update() {
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.vRot;
            p.alpha -= 0.02;
            p.scale += 0.02;
        });
    }

    draw(ctx) {
        ctx.save();
        ctx.font = 'bold 20px "Share Tech Mono"';
        this.particles.forEach(p => {
            if (p.alpha <= 0) return;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.scale(p.scale, p.scale);
            ctx.fillStyle = `rgba(0, 255, 0, ${p.alpha})`; // Neon green debris
            ctx.fillText(p.char, 0, 0);
            ctx.restore();
        });
        ctx.restore();
    }

    isDead() {
        return this.particles.every(p => p.alpha <= 0);
    }
}

class SpriteExplosion {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.frame = 0;
        this.totalFrames = 12;
        this.frameSpeed = 0.5; // Controls animation speed
        this.currentFrame = 0;
        this.active = true;
    }

    update() {
        this.currentFrame += this.frameSpeed;
        this.frame = Math.floor(this.currentFrame);
        if (this.frame >= this.totalFrames) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        const p = project(this.x, this.y);
        const s = p.scale * 4; // Scale up the explosion

        // Calculate frame position in sprite sheet (12 frames horizontal)
        const frameWidth = explosionImg.width / 12;
        const frameHeight = explosionImg.height;

        ctx.translate(p.x, p.y);
        ctx.scale(s, s);

        // Draw the specific frame centered
        ctx.drawImage(
            explosionImg,
            this.frame * frameWidth, 0, frameWidth, frameHeight,
            -frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight
        );

        ctx.restore();
    }

    isDead() {
        return !this.active;
    }
}

// Game Manager
const Game = {
    active: false,
    paused: false,
    currentDifficulty: 'easy', // Default
    score: 0,
    health: 100,
    wave: 1,
    spawnTimer: 0,
    shakeTimer: 0,
    shakeIntensity: 0,
    lockedTarget: null,

    // Reward Tracking
    highScore: parseInt(localStorage.getItem('neonTypeHighScore')) || 0,
    milestone: 500,
    lastScore: 0,

    // Stats Tracking
    stats: {
        keysTyped: 0,
        keysHit: 0,
        currentStreak: 0,
        maxStreak: 0,
        scoreHistory: [] // [0, 50, 120...] per wave or interval
    },

    player: new Player(),
    enemies: [],
    projectiles: [],
    player: new Player(),
    enemies: [],
    projectiles: [],
    particles: [],
    effects: [], // New array for complex effects

    start() {
        this.active = true;
        this.score = 0;
        this.health = 100;
        this.wave = 1;
        this.spawnTimer = 0;
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.effects = [];
        this.lockedTarget = null;
        this.paused = false;

        // Reset Stats
        this.stats = {
            keysTyped: 0,
            keysHit: 0,
            currentStreak: 0,
            maxStreak: 0,
            scoreHistory: [0]
        };

        // Reset Milestone tracking (but keep High Score)
        this.lastScore = 0;
        this.milestone = 500;

        document.getElementById('start-screen').classList.remove('active');
        document.getElementById('game-over-screen').classList.remove('active');
        document.getElementById('pause-screen').classList.remove('active');
        this.updateUI();

        requestAnimationFrame(loop);
    },

    togglePause() {
        if (!this.active) return;
        this.paused = !this.paused;

        const pauseScreen = document.getElementById('pause-screen');
        if (this.paused) {
            pauseScreen.classList.add('active');
        } else {
            pauseScreen.classList.remove('active');
        }
    },

    gameOver() {
        this.active = false;

        const summaryScore = document.getElementById('summary-score');
        const summaryWave = document.getElementById('summary-wave');
        const summaryAcc = document.getElementById('summary-accuracy');
        const summaryStreak = document.getElementById('summary-streak');
        const newRecordMsg = document.getElementById('new-record-msg');

        // Stats Calc
        const accuracy = this.stats.keysTyped > 0
            ? Math.floor((this.stats.keysHit / this.stats.keysTyped) * 100)
            : 0;

        summaryScore.innerText = this.score;
        summaryWave.innerText = this.wave;
        summaryAcc.innerText = accuracy + '%';
        summaryStreak.innerText = this.stats.maxStreak;

        // Check High Score
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('neonTypeHighScore', this.highScore);
            newRecordMsg.classList.remove('hidden');
            this.showReward("NEW HIGH SCORE!");
        } else {
            newRecordMsg.classList.add('hidden');
        }

        // Graph
        this.drawGraph();

        document.getElementById('game-over-screen').classList.add('active');
    },

    drawGraph() {
        const c = document.getElementById('perf-graph');
        const cc = c.getContext('2d');
        // Fit canvas to container
        c.width = c.clientWidth;
        c.height = c.clientHeight;

        const data = this.stats.scoreHistory;
        if (data.length < 2) return;

        const pad = 10;
        const gw = c.width - pad * 2;
        const gh = c.height - pad * 2;
        const maxVal = Math.max(...data, 100);

        cc.clearRect(0, 0, c.width, c.height);
        cc.strokeStyle = '#ff5e00';
        cc.lineWidth = 2;
        cc.beginPath();

        data.forEach((val, i) => {
            const x = pad + (i / (data.length - 1)) * gw;
            const y = c.height - pad - (val / maxVal) * gh;
            if (i === 0) cc.moveTo(x, y);
            else cc.lineTo(x, y);
        });
        cc.stroke();

        // Gradient fill
        cc.lineTo(c.width - pad, c.height - pad);
        cc.lineTo(pad, c.height - pad);
        cc.fillStyle = 'rgba(255, 94, 0, 0.2)';
        cc.fill();
    },

    showReward(text) {
        const el = document.getElementById('reward-message');
        el.innerText = text;
        el.classList.remove('active');
        void el.offsetWidth; // Trigger reflow
        el.classList.add('active');
        sfxReward();
    },

    spawnEnemy() {
        let list;
        if (this.currentDifficulty === 'hard') list = WORDS_HARD;
        else if (this.currentDifficulty === 'medium') list = WORDS_MEDIUM;
        else list = WORDS_EASY;

        const word = list[Math.floor(Math.random() * list.length)];
        this.enemies.push(new Enemy(word));
    },

    handleInput(char) {
        if (!this.active || this.paused) return;

        this.stats.keysTyped++;

        // If locked on a target
        if (this.lockedTarget) {
            const desiredChar = this.lockedTarget.word[this.lockedTarget.matchedIndex];

            if (char === desiredChar) {
                // Correct Type
                this.stats.keysHit++;
                this.stats.currentStreak++;
                if (this.stats.currentStreak > this.stats.maxStreak) this.stats.maxStreak = this.stats.currentStreak;

                this.lockedTarget.matchedIndex++;
                this.shoot(this.lockedTarget);
                // ... rest of logic
            } else {
                // Wrong Type
                this.stats.currentStreak = 0;
                sfxError();
            }

            if (this.lockedTarget && this.lockedTarget.matchedIndex >= this.lockedTarget.word.length) {
                this.destroyEnemy(this.lockedTarget);
                this.lockedTarget = null;
            }
        } else {
            // Not locked
            const compatible = this.enemies.filter(e => e.word.startsWith(char) && e.y > 0);
            if (compatible.length > 0) {
                this.stats.keysHit++;
                this.stats.currentStreak++;
                if (this.stats.currentStreak > this.stats.maxStreak) this.stats.maxStreak = this.stats.currentStreak;

                compatible.sort((a, b) => b.y - a.y);
                const target = compatible[0];
                this.lockedTarget = target;
                target.isLocked = true;
                target.matchedIndex++;
                sfxLock();
                this.shoot(target);
            } else {
                this.stats.currentStreak = 0;
                sfxError();
            }
        }
    },

    shoot(target) {
        this.projectiles.push(new Projectile(this.player.x, this.player.y, target));
        sfxShoot();
    },

    destroyEnemy(enemy) {
        enemy.markedForDeletion = true;
        this.score += enemy.word.length * 10;

        // Create War Explosion
        // 1. Sparks (High speed shrapnel)
        for (let i = 0; i < 20; i++) {
            this.particles.push(new Particle(enemy.x, enemy.y, 'spark'));
        }
        // 2. Fire (Core explosion)
        for (let i = 0; i < 10; i++) {
            this.particles.push(new Particle(enemy.x, enemy.y, 'fire'));
        }
        // 3. Smoke (Lingering clouds)
        for (let i = 0; i < 15; i++) {
            this.particles.push(new Particle(enemy.x, enemy.y, 'smoke'));
        }

        // Add special destruction effects
        this.effects.push(new Shockwave(enemy.x, enemy.y));
        this.effects.push(new TextExplosion(enemy.x, enemy.y, enemy.word));
        this.effects.push(new SpriteExplosion(enemy.x, enemy.y));

        // Screen Shake
        this.shakeTimer = 15;
        this.shakeIntensity = 10;

        sfxWarExplosion();
        this.updateUI();

        // Check Milestone
        if (this.score >= this.milestone) {
            this.showReward(`DEFENSE WAVE CLEARED`);
            this.milestone += 500;
            this.health = Math.min(100, this.health + 20); // Heal 20%
            this.updateUI();
        }
    },

    takeDamage(amount) {
        this.health -= amount;
        if (this.health < 0) this.health = 0;
        this.updateUI();
        sfxError(); // Glitch sound

        // Screen flash
        canvas.style.filter = "brightness(2) sepia(1) hue-rotate(-50deg)";
        setTimeout(() => canvas.style.filter = "none", 50);

        if (this.health <= 0) this.gameOver();
    },

    updateUI() {
        document.getElementById('score-display').innerText = this.score;
        document.getElementById('wave-display').innerText = this.wave;

        const bar = document.getElementById('health-bar-fill');
        bar.style.width = this.health + '%';

        // Dynamic Health Color
        if (this.health < 30) {
            bar.style.background = 'linear-gradient(90deg, #ff0044, #ff3333)';
            bar.style.boxShadow = '0 0 15px rgba(255, 50, 50, 0.5)';
        } else if (this.health < 60) {
            bar.style.background = 'linear-gradient(90deg, #b8860b, #ffcc00)';
            bar.style.boxShadow = '0 0 15px rgba(255, 204, 0, 0.5)';
        } else {
            bar.style.background = 'linear-gradient(90deg, #3aa381, #4ce0b3)';
            bar.style.boxShadow = '0 0 15px rgba(76, 224, 179, 0.4)';
        }
    },

    logic() {
        // Spawning
        const spawnRate = Math.max(60, 120 - (this.wave * 5)); // Frames between spawn
        this.spawnTimer++;
        if (this.spawnTimer > spawnRate) {
            this.spawnEnemy();
            this.spawnTimer = 0;
        }

        // Wave grouping (optional simple mechanic: Wave increases        // Wave grouping
        if (Math.floor(this.score / 500) + 1 > this.wave) {
            this.wave++;
            this.stats.scoreHistory.push(this.score); // Record history point
            this.updateUI();
        }

        // Player Update
        let targetX = null, targetY = null;
        if (this.lockedTarget && !this.lockedTarget.markedForDeletion) {
            targetX = this.lockedTarget.x;
            targetY = this.lockedTarget.y;
        }
        this.player.update(targetX, targetY);

        // Enemies Update
        this.enemies.forEach(e => {
            const result = e.update(1 + (this.wave * 0.1));
            if (result === 'damage') {
                this.takeDamage(20); // 20 damage per miss
                if (this.lockedTarget === e) this.lockedTarget = null;
            }
        });

        // Projectiles Update
        this.projectiles.forEach(p => {
            if (p.update() === 'hit') {
                // Hit logic handled in deletion
            }
        });

        // Particles Update
        this.particles.forEach(p => p.update());

        // Effects Update
        this.effects.forEach((e, i) => {
            e.update();
            if ((e.alpha !== undefined && e.alpha <= 0) || (e.isDead && e.isDead())) {
                this.effects.splice(i, 1);
            }
        });

        // Update Shake
        if (this.shakeTimer > 0) {
            this.shakeTimer--;
        } else {
            this.shakeIntensity = 0;
        }

        // Cleanup
        this.enemies = this.enemies.filter(e => !e.markedForDeletion);
        this.projectiles = this.projectiles.filter(p => p.active);
        this.particles = this.particles.filter(p => p.life > 0);
    },

    render() {
        ctx.clearRect(0, 0, width, height);

        ctx.save(); // Save before shake

        // Apply Screen Shake
        if (this.shakeIntensity > 0) {
            const dx = (Math.random() - 0.5) * this.shakeIntensity;
            const dy = (Math.random() - 0.5) * this.shakeIntensity;
            ctx.translate(dx, dy);
        }

        // 3D Moving Grid Floor
        const time = Date.now() * 0.2;
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();

        // Vertical perspective lines
        for (let i = -10; i <= 10; i++) {
            // Logic X at top horizon (Far Z) vs Bottom (Near Z)
            // We just interp logic X from center
            const xOffset = i * 100; // Spacing

            const pTop = project(cx + xOffset, 0); // Horizon
            const pBot = project(cx + xOffset, height); // Near

            ctx.moveTo(pTop.x, pTop.y);
            ctx.lineTo(pBot.x, pBot.y);
        }

        // Horizontal moving lines (Z-depth)
        const gridSize = 100;
        const offset = time % gridSize;

        for (let i = 0; i < height / 10; i++) { // Render logic slices
            const logicY = (i * gridSize - offset);
            if (logicY < 0 || logicY > height) continue;

            const pLeft = project(0, logicY);
            const pRight = project(width, logicY);

            ctx.moveTo(pLeft.x, pLeft.y);
            ctx.lineTo(pRight.x, pRight.y);
        }
        ctx.stroke();

        // Draw Player Laser Sight (3D)
        if (this.lockedTarget && !this.lockedTarget.markedForDeletion) {
            ctx.beginPath();
            ctx.setLineDash([]);
        }

        this.player.draw(ctx);
        this.enemies.forEach(e => e.draw(ctx));
        this.projectiles.forEach(p => p.draw(ctx));
        this.particles.forEach(p => p.draw(ctx));
        this.effects.forEach(e => e.draw(ctx));

        ctx.restore(); // Restore after shake
    }
};

function loop() {
    if (!Game.active) return;
    if (Game.paused) {
        requestAnimationFrame(loop);
        return;
    }

    // Logic
    Game.logic();

    // Render
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Background Grid
    bgGrid.update();
    bgGrid.draw(ctx);

    // 2. Game Elements
    Game.particles.forEach(p => p.draw(ctx));
    Game.enemies.forEach(e => e.draw(ctx));
    Game.projectiles.forEach(p => p.draw(ctx));
    Game.player.draw(ctx);
    Game.effects.forEach(e => e.draw(ctx));

    // 3. Global Vignette & CRT Scanlines (Subtle Action Mode)
    ctx.save();

    // Scanlines (Very subtle texture)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
    for (let i = 0; i < height; i += 4) {
        ctx.fillRect(0, i, width, 2);
    }

    // Vignette (Corner darkening only - does not obscure text)
    const maxDim = Math.max(width, height);
    const grad = ctx.createRadialGradient(cx, cy, maxDim * 0.6, cx, cy, maxDim);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.5)'); // Reduced intensity
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();

    // Loop
    requestAnimationFrame(loop);
}

// Input Binding
window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        Game.togglePause();
        return;
    }

    if (e.key.length === 1) {
        Game.handleInput(e.key.toUpperCase());
    }
});

document.getElementById('start-btn').addEventListener('click', () => Game.start());
document.getElementById('restart-btn').addEventListener('click', () => Game.start());
document.getElementById('resume-btn').addEventListener('click', () => Game.togglePause());

document.getElementById('menu-btn').addEventListener('click', () => {
    document.getElementById('game-over-screen').classList.remove('active');
    document.getElementById('start-screen').classList.add('active');
});

// Difficulty Selection
document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Remove active class from all
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        // Add to clicked
        e.target.classList.add('active');
        // Set game difficulty
        Game.currentDifficulty = e.target.getAttribute('data-diff');
    });
});
