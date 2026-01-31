/**
 * Rhythm Maker App
 * Handles Audio, Sequencing, and UI interactions.
 */

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isInitialized = false;
        // Instruments
        this.instruments = {
            'kick': { freq: 150, decay: 0.5, type: 'sine' },
            'snare': { freq: 200, decay: 0.2, type: 'noise' },
            'hihat': { freq: 800, decay: 0.1, type: 'noise' },
            'tom': { freq: 100, decay: 0.4, type: 'triangle' }
        };
    }

    init() {
        if (this.isInitialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5;
        this.masterGain.connect(this.ctx.destination);
        this.isInitialized = true;
        console.log("AudioEngine initialized");

        // Resume context if suspended (browser policy)
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(time, type, freq, decay) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);
        // Pitch drop for kick
        if (type === 'sine') {
            osc.frequency.exponentialRampToValueAtTime(0.01, time + decay);
        }

        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(time);
        osc.stop(time + decay);
    }

    playNoise(time, decay) {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * decay;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        // Filter for hihat/snare distinction would go here (Highpass/Bandpass)
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1000;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(time);
    }

    playInstrument(name, time = 0) {
        if (!this.isInitialized) return;
        // Fallback to now if time is 0 (immediate play)
        const t = time || this.ctx.currentTime;

        switch (name) {
            case 'kick':
                this.playTone(t, 'sine', 150, 0.5);
                break;
            case 'tom':
                this.playTone(t, 'triangle', 100, 0.4);
                break;
            case 'snare':
                this.playTone(t, 'triangle', 200, 0.1); // Body
                this.playNoise(t, 0.2); // Snap
                break;
            case 'hihat':
                // Highpass noise
                this.playNoise(t, 0.05);
                break;
        }
    }
}

class Sequencer {
    constructor(audioEngine) {
        this.audio = audioEngine;
        this.isPlaying = false;
        this.bpm = 120;
        this.timeSignature = 4; // Beats per bar
        this.subdivision = 4; // Steps per beat (4 = 16th, 3 = triplet)

        // State
        this.currentStep = 0;
        this.nextNoteTime = 0;
        this.lookahead = 25.0; // ms
        this.scheduleAheadTime = 0.1; // s
        this.timerID = null;

        // Pattern Data: Map of Instrument -> Boolean Array
        this.instruments = ['kick', 'snare', 'hihat', 'tom'];
        this.pattern = {};
        this.resetPattern();
    }

    resetPattern() {
        const totalSteps = this.timeSignature * this.subdivision;
        this.instruments.forEach(inst => {
            // Preserve existing pattern if length matches, else resize/clear
            if (this.pattern[inst] && this.pattern[inst].length === totalSteps) {
                // Keep it
            } else {
                this.pattern[inst] = new Array(totalSteps).fill(false);
            }
        });
        // UI should update after this
    }

    toggleStep(inst, stepIndex) {
        if (this.pattern[inst]) {
            this.pattern[inst][stepIndex] = !this.pattern[inst][stepIndex];
        }
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.bpm;
        // subdivision determines how much of a beat one step is.
        // e.g. subdivision 4 (16th notes) -> 0.25 beats per step
        // subdivision 3 (triplets) -> 0.333 beats per step
        const stepTime = secondsPerBeat / (this.subdivision / 1); // /1 just to be explicit logic

        this.nextNoteTime += stepTime;

        this.currentStep++;
        const totalSteps = this.timeSignature * this.subdivision;
        if (this.currentStep === totalSteps) {
            this.currentStep = 0;
        }
    }

    scheduleNote(stepNumber, time) {
        // Play sounds
        this.instruments.forEach(inst => {
            if (this.pattern[inst][stepNumber]) {
                this.audio.playInstrument(inst, time);
            }
        });

        // Update UI (visual callback)
        // We use requestAnimationFrame or a custom event to sync UI slightly later
        // or just schedule the visual class toggle
        const drawTime = (time - this.audio.ctx.currentTime) * 1000;
        setTimeout(() => {
            if (this.isPlaying) {
                ui.highlightStep(stepNumber);
            }
        }, Math.max(0, drawTime));
    }

    scheduler() {
        while (this.nextNoteTime < this.audio.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.currentStep, this.nextNoteTime);
            this.nextNote();
        }
        this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
    }

    play() {
        if (!this.audio.isInitialized) this.audio.init();

        if (this.isPlaying) {
            // PAUSE
            this.isPlaying = false;
            clearTimeout(this.timerID);
            // We do NOT reset currentStep so we can resume
            ui.updatePlayButton(false);
        } else {
            // PLAY (or RESUME)
            this.isPlaying = true;
            this.nextNoteTime = this.audio.ctx.currentTime + 0.1;
            this.scheduler();
            ui.updatePlayButton(true);
        }
    }

    stop() {
        this.isPlaying = false;
        clearTimeout(this.timerID);
        this.currentStep = 0; // Reset
        ui.clearHighlights();
        ui.updatePlayButton(false);
    }

    updateSettings(bpm, timeSig, subdiv) {
        this.bpm = bpm;
        const needsReset = (this.timeSignature !== timeSig || this.subdivision !== subdiv);
        this.timeSignature = timeSig;
        this.subdivision = subdiv;

        if (needsReset) {
            this.resetPattern();
            ui.renderGrid();
        }
    }
}

class UI {
    constructor(sequencer) {
        this.seq = sequencer;
        this.grid = document.getElementById('sequencer-grid');
        this.bpmInput = document.getElementById('bpm-input');
        this.bpmDisplay = document.getElementById('bpm-display');
        this.timeSigSelect = document.getElementById('time-sig-select');
        this.subdivSelect = document.getElementById('subdiv-select');
        this.playBtn = document.getElementById('play-btn');

        this.setupListeners();
        this.renderGrid();
    }

    setupListeners() {
        // Controls
        this.playBtn.addEventListener('click', () => this.seq.play());
        document.getElementById('stop-btn').addEventListener('click', () => this.seq.stop());
        document.getElementById('clear-btn').addEventListener('click', () => {
            this.seq.instruments.forEach(inst => this.seq.pattern[inst].fill(false));
            this.renderGrid();
        });

        // Settings
        this.bpmInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.bpmDisplay.innerText = val;
            this.seq.updateSettings(val, this.seq.timeSignature, this.seq.subdivision);
        });

        const updateParams = () => {
            this.seq.updateSettings(
                parseInt(this.bpmInput.value),
                parseInt(this.timeSigSelect.value),
                parseInt(this.subdivSelect.value)
            );
        };

        this.timeSigSelect.addEventListener('change', updateParams);
        this.subdivSelect.addEventListener('change', updateParams);
    }

    renderGrid() {
        this.grid.innerHTML = '';

        // Setup Grid CSS columns
        const totalSteps = this.seq.timeSignature * this.seq.subdivision;
        // +1 for label column
        this.grid.style.gridTemplateColumns = `100px repeat(${totalSteps}, 1fr)`;

        // Render Rows
        this.seq.instruments.forEach(inst => {
            // Label
            const label = document.createElement('div');
            label.className = 'grid-row-label';
            label.innerText = inst.toUpperCase();
            this.grid.appendChild(label);

            // Buttons
            for (let i = 0; i < totalSteps; i++) {
                const btn = document.createElement('div');
                btn.className = `step-btn ${inst}`;
                if (this.seq.pattern[inst][i]) btn.classList.add('active');

                // Beat Markers (every 'subdivision' steps)
                if (i % this.seq.subdivision === 0) {
                    btn.classList.add('beat-marker');
                }

                btn.addEventListener('click', () => {
                    // Ensure audio is initialized on first user interaction
                    if (!this.seq.audio.isInitialized) {
                        this.seq.audio.init();
                    }
                    this.seq.toggleStep(inst, i);
                    btn.classList.toggle('active');
                    if (!this.seq.isPlaying) {
                        this.seq.audio.playInstrument(inst);
                    }
                });

                // Assign ID for highlighting
                btn.dataset.step = i;
                btn.dataset.inst = inst;

                this.grid.appendChild(btn);
            }
        });
    }

    highlightStep(stepIndex) {
        // Remove old highlights
        document.querySelectorAll('.current-step').forEach(el => el.classList.remove('current-step'));

        // Add new
        document.querySelectorAll(`[data-step="${stepIndex}"]`).forEach(el => {
            el.classList.add('current-step');
        });
    }

    clearHighlights() {
        document.querySelectorAll('.current-step').forEach(el => el.classList.remove('current-step'));
    }

    updatePlayButton(isPlaying) {
        const icon = this.playBtn.querySelector('span');
        icon.innerText = isPlaying ? "||" : "▶";
    }
}

class GameMode {
    constructor(sequencer) {
        this.seq = sequencer;
        this.isActive = false;
        this.score = 0;
        this.combo = 0;

        // Settings
        this.noteSpeed = 200; // px per second
        this.judgmentLineY = 0; // set in start
        this.trackHeight = 0;

        // Runtime
        this.notes = []; // { id, time, hit, element, type }
        this.startTime = 0;

        // Elements
        this.view = document.getElementById('game-view');
        this.trackContainer = document.getElementById('track-container');
        this.scoreEl = document.getElementById('score-val');
        this.comboEl = document.getElementById('combo-val');
        this.messageEl = document.getElementById('game-message');

        this.setupListeners();
    }

    setupListeners() {
        document.getElementById('toggle-game-mode').addEventListener('click', () => this.toggleMode());
        // Close button removed from HTML, so listener removed here

        // Input handling
        // We capture keydown or click
        const handleInput = (e) => {
            if (!this.isActive || !this.seq.isPlaying) return;
            // Prevent default space scrolling
            if (e.type === 'keydown' && e.code === 'Space') e.preventDefault();

            this.checkHit();

            // Visual feedback of input
            const line = document.querySelector('.judgment-line');
            if (line) {
                line.style.transform = 'scaleY(1.5)';
                line.style.background = '#fff';
                setTimeout(() => {
                    line.style.transform = 'scaleY(1)';
                    line.style.background = '';
                }, 100);
            }
        };

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.key === 'f' || e.key === 'j') handleInput(e);
        });

        // Listen to document to catch all clicks/taps
        document.addEventListener('mousedown', (e) => {
            // Ignore clicks on buttons/inputs
            if (e.target.closest('button, input, select')) return;
            handleInput(e);
        });

        document.addEventListener('touchstart', (e) => {
            if (e.target.closest('button, input, select')) return;
            e.preventDefault();
            handleInput(e);
        }, { passive: false });
    }

    toggleMode() {
        const seqView = document.getElementById('sequencer-view');

        if (this.isActive) {
            this.stopGame();
        } else {
            // Enter Game Mode
            this.isActive = true;
            seqView.classList.replace('active-view', 'hidden-view');
            this.view.classList.replace('hidden-view', 'active-view');

            // Adjust Lookahead for Game Mode to allow notes to spawn high up
            this.seq.scheduleAheadTime = 2.0;

            // Calc layout
            const rect = this.trackContainer.getBoundingClientRect();
            this.trackHeight = rect.height;
            this.judgmentLineY = this.trackHeight * 0.8; // Match CSS bottom: 20%

            this.messageEl.innerHTML = "Press PLAY to Start<br><span style='font-size:0.5em'>Controls: Space, F, J, or Click</span>";
            this.messageEl.style.opacity = 1;
        }
    }

    stopGame() {
        this.isActive = false;
        if (this.seq.isPlaying) this.seq.stop();

        // Reset Lookahead
        this.seq.scheduleAheadTime = 0.1;

        const seqView = document.getElementById('sequencer-view');
        this.view.classList.replace('active-view', 'hidden-view');
        seqView.classList.replace('hidden-view', 'active-view');

        this.clearNotes();
        this.resetScore();
    }

    resetScore() {
        this.score = 0;
        this.combo = 0;
        this.updateScoreUI();
    }

    updateScoreUI() {
        this.scoreEl.innerText = this.score;
        this.comboEl.innerText = this.combo;
    }

    spawnNote(inst, time) {
        if (!this.isActive) return;

        const noteEl = document.createElement('div');
        noteEl.className = 'game-note';
        // different colors for instruments potentially
        if (inst === 'kick') noteEl.style.background = '#00f2ff';
        if (inst === 'snare') noteEl.style.background = '#ff0055';

        // Randomize X slightly for visual interest or based on instrument
        // Let's do fixed lanes: Kick(L), Snare(R), others mid
        let left = '50%';
        if (inst === 'kick') left = '35%';
        if (inst === 'snare') left = '65%';
        if (inst === 'hihat') left = '50%';

        noteEl.style.left = left;
        noteEl.style.top = '-50px'; // Start above

        this.trackContainer.appendChild(noteEl);

        this.notes.push({
            id: Math.random(),
            time: time, // audio context time when it should hit
            hit: false,
            element: noteEl,
            type: inst
        });
    }

    checkHit() {
        const now = this.seq.audio.ctx.currentTime;
        const hitWindow = 0.150; // +/- 150ms

        // Find closest unhit note
        // potential issue: with a loop, notes might be far in future?
        // We only track spawned notes.

        // Sort by proximity to now
        const playableNotes = this.notes.filter(n => !n.hit && Math.abs(n.time - now) < hitWindow);

        if (playableNotes.length > 0) {
            // Hit the closest one
            playableNotes.sort((a, b) => Math.abs(a.time - now) - Math.abs(b.time - now));
            const note = playableNotes[0];

            note.hit = true;
            note.element.style.transform = 'scale(1.5)';
            note.element.style.opacity = '0';

            // Score calc
            const diff = Math.abs(note.time - now);
            let pts = 0;
            let label = "";
            if (diff < 0.05) { pts = 300; label = "PERFECT"; }
            else if (diff < 0.1) { pts = 100; label = "GOOD"; }
            else { pts = 50; label = "BAD"; }

            this.score += pts;
            this.combo++;
            this.showFeedback(label);
        } else {
            // Miss click?
            this.combo = 0;
            // this.showFeedback("MISS");
        }
        this.updateScoreUI();
    }

    showFeedback(text) {
        this.messageEl.innerText = text;
        this.messageEl.style.opacity = 1;
        this.messageEl.style.animation = 'none';
        this.messageEl.offsetHeight; /* trigger reflow */
        this.messageEl.style.animation = 'pop 0.2s ease-out';

        // Fade out
        setTimeout(() => {
            if (this.messageEl.innerText === text) this.messageEl.style.opacity = 0.5;
        }, 500);
    }

    update(time) {
        if (!this.isActive) return;

        // Calculate note positions
        // distance = speed * (targetTime - currentTime)
        // If targetTime > currentTime, it's approaching.
        // We want it to be at judgmentLineY when targetTime == currentTime.
        // position = judgmentLineY - (targetTime - currentTime) * speed

        // We need to look ahead and spawn notes
        // This needs to be hooked into sequencer's scheduler or we peek directly

        // Update existing notes
        for (let i = this.notes.length - 1; i >= 0; i--) {
            const note = this.notes[i];
            const timeDiff = note.time - time;

            // Position
            // If timeDiff is 1 second, it is 'speed' pixels above line
            const y = this.judgmentLineY - (timeDiff * this.noteSpeed);

            note.element.style.top = `${y}px`;

            // Remove if off screen (missed)
            if (y > this.trackHeight + 50) {
                if (!note.hit) {
                    this.combo = 0;
                    this.updateScoreUI();
                    this.showFeedback("MISS");
                }
                note.element.remove();
                this.notes.splice(i, 1);
            }
        }
        // Removed recursive requestAnimationFrame as it is handled by the global loop
    }
}

// Modify Sequencer to notify GameMode
// We'll Monkey Patch it or modify the class directly in the previous tool.
// Since I'm appending GameMode, I'll add the hook here.

const oldSchedule = Sequencer.prototype.scheduleNote;
Sequencer.prototype.scheduleNote = function (stepNumber, time) {
    // Call original
    // We need to implement the original logic here because simple monkeypatch might lose 'this' context if not careful, 
    // but applying to prototype is fine.

    // Play sounds (Copied from original to ensure it works, or call bound original)
    // Actually, I can just rewrite the method on the instance or prototype.
    // Let's rely on the fact that I can't easily call 'super' on a monkeypatch.

    // Re-implementing logic for safety and injection:
    this.instruments.forEach(inst => {
        if (this.pattern[inst][stepNumber]) {
            this.audio.playInstrument(inst, time);

            // GAME MODE HOOK
            if (gameMode && gameMode.isActive) {
                gameMode.spawnNote(inst, time);
            }
        }
    });

    // Update UI
    const drawTime = (time - this.audio.ctx.currentTime) * 1000;
    setTimeout(() => {
        if (this.isPlaying) {
            ui.highlightStep(stepNumber);
        }
    }, Math.max(0, drawTime));
};


// Global instances
const audio = new AudioEngine();
const sequencer = new Sequencer(audio);
let ui;
let gameMode;

document.addEventListener('DOMContentLoaded', () => {
    ui = new UI(sequencer);
    gameMode = new GameMode(sequencer);

    // Star loop
    const loop = () => {
        if (gameMode.isActive) gameMode.update(audio.ctx.currentTime);
        requestAnimationFrame(loop);
    }
    loop();
});
