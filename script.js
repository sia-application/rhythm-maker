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

        // State
        this.currentBeatIndex = 0;
        this.currentStepInBeat = 0;

        this.nextNoteTime = 0;
        this.lookahead = 25.0; // ms
        this.scheduleAheadTime = 0.1; // s
        this.timerID = null;

        // Data: Beats array stores subdivision for each beat
        this.beats = [];

        // Pattern Data: Map of Instrument -> 2D Array [beatIndex][stepIndex]
        this.instruments = ['kick', 'snare', 'hihat', 'tom'];
        this.pattern = {};

        // Initial setup
        this.initBeats();
        this.resetPattern();
    }

    initBeats() {
        this.beats = [];
        for (let i = 0; i < this.timeSignature; i++) {
            this.beats.push({ subdivision: 4 }); // Default 16th notes
        }
    }

    resetPattern() {
        // pattern[inst] = [ [bool, bool, ...], [bool...], ... ]
        this.instruments.forEach(inst => {
            if (!this.pattern[inst]) this.pattern[inst] = [];

            // Resize/Reset based on current beats
            // For now, simpler to just ensure structure matches this.beats
            // We want to preserve data if possible?
            // Let's create a new structure and copy over what fits.

            const newPattern = [];
            for (let b = 0; b < this.timeSignature; b++) {
                const subdiv = this.beats[b].subdivision;
                const beatSteps = new Array(subdiv).fill(false);

                // Copy if exists
                if (this.pattern[inst][b]) {
                    for (let s = 0; s < Math.min(subdiv, this.pattern[inst][b].length); s++) {
                        beatSteps[s] = this.pattern[inst][b][s];
                    }
                }
                newPattern.push(beatSteps);
            }
            this.pattern[inst] = newPattern;
        });
    }

    toggleStep(inst, beatIndex, stepIndex) {
        if (this.pattern[inst] && this.pattern[inst][beatIndex]) {
            this.pattern[inst][beatIndex][stepIndex] = !this.pattern[inst][beatIndex][stepIndex];
        }
    }

    updateBeatSubdivision(beatIndex, newSubdiv) {
        if (beatIndex < 0 || beatIndex >= this.beats.length) return;
        this.beats[beatIndex].subdivision = newSubdiv;

        // Update pattern for this beat
        this.instruments.forEach(inst => {
            const oldBeatDetails = this.pattern[inst][beatIndex];
            const newBeatDetails = new Array(newSubdiv).fill(false);

            // Copy exist data
            for (let i = 0; i < Math.min(oldBeatDetails.length, newSubdiv); i++) {
                newBeatDetails[i] = oldBeatDetails[i];
            }
            this.pattern[inst][beatIndex] = newBeatDetails;
        });
    }

    removeStep(beatIndex, stepIndex) {
        if (beatIndex < 0 || beatIndex >= this.beats.length) return;
        const currentSubdiv = this.beats[beatIndex].subdivision;
        if (currentSubdiv <= 1) return; // Don't remove last step

        this.beats[beatIndex].subdivision = currentSubdiv - 1;

        // Update pattern
        this.instruments.forEach(inst => {
            // Remove the specific step
            this.pattern[inst][beatIndex].splice(stepIndex, 1);
        });
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.bpm;
        const currentSubdiv = this.beats[this.currentBeatIndex].subdivision;
        const stepTime = secondsPerBeat / currentSubdiv;

        this.nextNoteTime += stepTime;

        this.currentStepInBeat++;
        if (this.currentStepInBeat >= currentSubdiv) {
            this.currentStepInBeat = 0;
            this.currentBeatIndex++;
            if (this.currentBeatIndex >= this.beats.length) {
                this.currentBeatIndex = 0;
            }
        }
    }

    scheduleNote(beatIndex, stepInBeat, time) {
        this.instruments.forEach(inst => {
            if (this.pattern[inst][beatIndex][stepInBeat]) {
                this.audio.playInstrument(inst, time);
            }
        });

        // Update UI
        const drawTime = (time - this.audio.ctx.currentTime) * 1000;
        setTimeout(() => {
            if (this.isPlaying) {
                ui.highlightStep(beatIndex, stepInBeat);
            }
        }, Math.max(0, drawTime));
    }

    scheduler() {
        while (this.nextNoteTime < this.audio.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.currentBeatIndex, this.currentStepInBeat, this.nextNoteTime);
            this.nextNote(); // Advances currentBeatIndex/StepInBeat
        }
        this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
    }

    play() {
        if (!this.audio.isInitialized) this.audio.init();

        if (this.isPlaying) {
            // PAUSE
            this.isPlaying = false;
            clearTimeout(this.timerID);
            ui.updatePlayButton(false);
        } else {
            // PLAY (or RESUME)
            this.isPlaying = true;
            this.nextNoteTime = this.audio.ctx.currentTime + 0.1;
            // Ensure we start from valid indices if something changed
            if (this.currentBeatIndex >= this.beats.length) this.currentBeatIndex = 0;

            this.scheduler();
            ui.updatePlayButton(true);
        }
    }

    stop() {
        this.isPlaying = false;
        clearTimeout(this.timerID);
        this.currentBeatIndex = 0;
        this.currentStepInBeat = 0;
        ui.clearHighlights();
        ui.updatePlayButton(false);
    }

    updateSettings(bpm, timeSig) {
        this.bpm = bpm;

        if (this.timeSignature !== timeSig) {
            this.timeSignature = timeSig;
            // Re-init beats if length changes
            // Try to preserve existing beats? (e.g. from 4 to 3, keep first 3)
            const oldBeats = this.beats;
            this.beats = [];
            for (let i = 0; i < timeSig; i++) {
                if (i < oldBeats.length) {
                    this.beats.push(oldBeats[i]);
                } else {
                    this.beats.push({ subdivision: 4 });
                }
            }
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
        this.ctxMenu = document.getElementById('context-menu');
        this.ctxAddBtn = document.getElementById('ctx-add-step');
        this.ctxDelBtn = document.getElementById('ctx-del-step');
        this.ctxTarget = { beat: -1, step: -1 };

        this.setupListeners();
        this.setupContextMenu();
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
            // Just update BPM and Time Sig. Subdivision invalidates.
            this.seq.updateSettings(
                parseInt(this.bpmInput.value),
                parseInt(this.timeSigSelect.value)
            );
        };

        this.timeSigSelect.addEventListener('change', updateParams);

        // "Set All" subdivision
        this.subdivSelect.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            for (let i = 0; i < this.seq.beats.length; i++) {
                this.seq.updateBeatSubdivision(i, val);
            }
            this.renderGrid();
        });

    }

    setupContextMenu() {
        // Hide menu on click elsewhere
        document.addEventListener('click', (e) => {
            if (!this.ctxMenu.classList.contains('hidden')) {
                this.ctxMenu.classList.add('hidden');
            }
        });

        // Context Menu Handler
        this.grid.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const btn = e.target.closest('.step-btn');
            const beatCell = e.target.closest('.beat-cell');

            if (beatCell || btn) {
                // Determine target
                if (btn) {
                    this.ctxTarget.beat = parseInt(btn.dataset.beat);
                    this.ctxTarget.step = parseInt(btn.dataset.step);
                    this.ctxDelBtn.classList.remove('disabled');
                    this.ctxDelBtn.innerText = `Delete Step ${this.ctxTarget.step + 1}`;
                } else if (beatCell) {
                    // Clicked in cell but not on button (maybe gap?) - fallback to add only
                    // We need to find which beat it is.
                    // Since beatCell children are buttons with dataset, we can get beat from first child
                    const firstBtn = beatCell.querySelector('.step-btn');
                    if (firstBtn) {
                        this.ctxTarget.beat = parseInt(firstBtn.dataset.beat);
                        this.ctxTarget.step = -1;
                    }
                    this.ctxDelBtn.classList.add('disabled');
                    this.ctxDelBtn.innerText = "Delete This Step";
                }

                // Show menu
                this.ctxMenu.style.left = `${e.clientX}px`;
                this.ctxMenu.style.top = `${e.clientY}px`;
                this.ctxMenu.classList.remove('hidden');
            }
        });

        // Menu Actions
        this.ctxAddBtn.addEventListener('click', () => {
            if (this.ctxTarget.beat !== -1) {
                const currentSubdiv = this.seq.beats[this.ctxTarget.beat].subdivision;
                this.seq.updateBeatSubdivision(this.ctxTarget.beat, currentSubdiv + 1);
                this.renderGrid();
            }
            this.ctxMenu.classList.add('hidden');
        });

        this.ctxDelBtn.addEventListener('click', () => {
            if (this.ctxTarget.beat !== -1 && this.ctxTarget.step !== -1) {
                this.seq.removeStep(this.ctxTarget.beat, this.ctxTarget.step);
                this.renderGrid();
            }
            this.ctxMenu.classList.add('hidden');
        });
    }

    renderGrid() {
        this.grid.innerHTML = '';

        // Grid Layout:
        // Column 1: Labels
        // Column 2..N+1: Beats

        // We will use CSS Grid for the main structure
        // grid-template-columns: 100px repeat(timeSig, 1fr)
        this.grid.style.gridTemplateColumns = `100px repeat(${this.seq.timeSignature}, 1fr)`;

        // 1. Header Row (Subdivision Controls)
        // Leading empty cell for labels column
        const emptyHeader = document.createElement('div');
        this.grid.appendChild(emptyHeader);

        // Beat headers
        this.seq.beats.forEach((beat, bIndex) => {
            const beatHeader = document.createElement('div');
            beatHeader.className = 'beat-header';

            const select = document.createElement('select');
            select.className = 'beat-subdiv-select';
            [4, 3, 2, 6, 8, 12].forEach(val => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.innerText = val;
                if (beat.subdivision === val) opt.selected = true;
                select.appendChild(opt);
            });

            select.addEventListener('change', (e) => {
                const newSubdiv = parseInt(e.target.value);
                this.seq.updateBeatSubdivision(bIndex, newSubdiv);
                this.renderGrid(); // Re-render to show new step count
            });

            beatHeader.appendChild(select);
            this.grid.appendChild(beatHeader);
        });

        // 2. Instrument Rows
        this.seq.instruments.forEach(inst => {
            // Label
            const label = document.createElement('div');
            label.className = 'grid-row-label';
            label.innerText = inst.toUpperCase();
            this.grid.appendChild(label);

            // Beat Cells
            this.seq.beats.forEach((beat, bIndex) => {
                const beatCell = document.createElement('div');
                beatCell.className = 'beat-cell';
                // Internal grid for steps within the beat
                beatCell.style.display = 'grid';
                beatCell.style.gridTemplateColumns = `repeat(${beat.subdivision}, 1fr)`;
                beatCell.style.gap = '2px';

                for (let s = 0; s < beat.subdivision; s++) {
                    const btn = document.createElement('div');
                    btn.className = `step-btn ${inst}`;

                    // Active state from pattern
                    if (this.seq.pattern[inst][bIndex] && this.seq.pattern[inst][bIndex][s]) {
                        btn.classList.add('active');
                    }

                    // Click handler (Main Click)
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation(); // prevent grid context menu if we had left click logic there logic, but standard click is fine
                        if (!this.seq.audio.isInitialized) this.seq.audio.init();
                        this.seq.toggleStep(inst, bIndex, s);
                        btn.classList.toggle('active');
                        if (!this.seq.isPlaying) {
                            this.seq.audio.playInstrument(inst);
                        }
                    });

                    // ID for highlighting
                    btn.dataset.beat = bIndex;
                    btn.dataset.step = s;
                    btn.dataset.inst = inst;

                    beatCell.appendChild(btn);
                }
                this.grid.appendChild(beatCell);
            });
        });
    }

    highlightStep(beatIndex, stepIndex) {
        // Remove old highlights
        document.querySelectorAll('.current-step').forEach(el => el.classList.remove('current-step'));

        // Add new
        // We select by beat and step
        document.querySelectorAll(`[data-beat="${beatIndex}"][data-step="${stepIndex}"]`).forEach(el => {
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

// GameMode class removed

// Modify Sequencer to notify GameMode
// We'll Monkey Patch it or modify the class directly in the previous tool.
// Since I'm appending GameMode, I'll add the hook here.

// ScheduleNote monkey patch removed


// Global instances
const audio = new AudioEngine();
const sequencer = new Sequencer(audio);
let ui;

document.addEventListener('DOMContentLoaded', () => {
    ui = new UI(sequencer);
});
