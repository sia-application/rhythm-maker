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
            'tom': { freq: 100, decay: 0.4, type: 'triangle' },
            'metronome': { freq: 1000, decay: 0.05, type: 'square' }
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
            case 'metronome':
                this.playTone(t, 'square', 1000, 0.05);
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

        // Tracks: List of { id, type, pattern }
        // pattern is 2D array [beatIndex][stepIndex]
        this.tracks = [];
        this.nextTrackId = 0;

        // Initial setup
        this.initBeats();

        // Default Track
        this.addTrack('kick');
    }

    initBeats() {
        this.beats = [];
        for (let i = 0; i < this.timeSignature; i++) {
            this.beats.push({ subdivision: 4 }); // Default 16th notes
        }
    }

    addBar() {
        // Add beats equal to current timeSignature
        const newBeatsCount = this.timeSignature;
        // Add to beats array
        for (let i = 0; i < newBeatsCount; i++) {
            this.beats.push({ subdivision: 4 });
        }

        // Update all tracks with new empty patterns
        // We need to calculate start index for new beats
        const startIndex = this.beats.length - newBeatsCount;

        this.tracks.forEach(track => {
            for (let b = 0; b < newBeatsCount; b++) {
                track.pattern.push(new Array(4).fill(false));
            }
        });
    }

    addTrack(type = 'kick') {
        const track = {
            id: this.nextTrackId++,
            type: type,
            pattern: []
        };

        // Init pattern for current beats
        // Use beats.length instead of timeSignature
        for (let b = 0; b < this.beats.length; b++) {
            const subdiv = this.beats[b].subdivision;
            track.pattern.push(new Array(subdiv).fill(false));
        }

        this.tracks.push(track);
        return track;
    }

    removeTrack(index) {
        if (index >= 0 && index < this.tracks.length) {
            this.tracks.splice(index, 1);
        }
    }

    changeTrackType(index, newType) {
        if (index >= 0 && index < this.tracks.length) {
            this.tracks[index].type = newType;
        }
    }

    resetPattern() {
        // Iterate tracks and resize patterns
        this.tracks.forEach(track => {
            const newPattern = [];
            // Use beats.length to cover extended sequence
            for (let b = 0; b < this.beats.length; b++) {
                const subdiv = this.beats[b].subdivision;
                const beatSteps = new Array(subdiv).fill(false);

                // Copy if exists
                if (track.pattern[b]) {
                    for (let s = 0; s < Math.min(subdiv, track.pattern[b].length); s++) {
                        beatSteps[s] = track.pattern[b][s];
                    }
                }
                newPattern.push(beatSteps);
            }
            track.pattern = newPattern;
        });
    }

    toggleStep(trackIndex, beatIndex, stepIndex) {
        if (this.tracks[trackIndex]) {
            this.tracks[trackIndex].pattern[beatIndex][stepIndex] = !this.tracks[trackIndex].pattern[beatIndex][stepIndex];
        }
    }

    updateBeatSubdivision(beatIndex, newSubdiv) {
        if (beatIndex < 0 || beatIndex >= this.beats.length) return;
        this.beats[beatIndex].subdivision = newSubdiv;

        // Update patterns for all tracks
        this.tracks.forEach(track => {
            const oldBeatDetails = track.pattern[beatIndex];
            const newBeatDetails = new Array(newSubdiv).fill(false);

            // Copy exist data
            for (let i = 0; i < Math.min(oldBeatDetails.length, newSubdiv); i++) {
                newBeatDetails[i] = oldBeatDetails[i];
            }
            track.pattern[beatIndex] = newBeatDetails;
        });
    }

    removeStep(beatIndex, stepIndex) {
        if (beatIndex < 0 || beatIndex >= this.beats.length) return;
        const currentSubdiv = this.beats[beatIndex].subdivision;
        if (currentSubdiv <= 1) return; // Don't remove last step

        this.beats[beatIndex].subdivision = currentSubdiv - 1;

        // Update patterns
        this.tracks.forEach(track => {
            track.pattern[beatIndex].splice(stepIndex, 1);
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
        this.tracks.forEach((track, tIndex) => {
            if (track.pattern[beatIndex][stepInBeat]) {
                this.audio.playInstrument(track.type, time);
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
            this.seq.tracks.forEach(track => {
                track.pattern.forEach(beat => beat.fill(false));
            });
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
        this.grid.className = 'sequencer-grid'; // Ensure class

        const beatsPerSystem = this.seq.timeSignature; // Wrap every bar
        const totalBeats = this.seq.beats.length;
        const totalSystems = Math.ceil(totalBeats / beatsPerSystem);

        for (let sysIndex = 0; sysIndex < totalSystems; sysIndex++) {
            const startBeat = sysIndex * beatsPerSystem;
            const endBeat = Math.min(startBeat + beatsPerSystem, totalBeats);
            const currentSystemBeats = this.seq.beats.slice(startBeat, endBeat);

            // Container for this system
            const systemContainer = document.createElement('div');
            systemContainer.className = 'system-container';
            // Grid columns: Label + beats in this system
            // Use minmax to ensure it doesn't squish on small screens
            systemContainer.style.gridTemplateColumns = `170px repeat(${currentSystemBeats.length}, minmax(100px, 1fr))`;

            // 1. Header (Subdivision)
            const emptyHeader = document.createElement('div');
            emptyHeader.innerText = `Bar ${sysIndex + 1}`;
            emptyHeader.className = 'grid-row-label'; // Reuse label style
            emptyHeader.style.color = '#8b9bb4';
            emptyHeader.style.fontSize = '0.9rem';
            emptyHeader.style.paddingLeft = '5px';
            systemContainer.appendChild(emptyHeader);

            currentSystemBeats.forEach((beat, i) => {
                const globalBeatIndex = startBeat + i;
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
                    this.seq.updateBeatSubdivision(globalBeatIndex, newSubdiv);
                    this.renderGrid();
                });

                beatHeader.appendChild(select);
                systemContainer.appendChild(beatHeader);
            });

            // 2. Tracks
            const instrumentOptions = Object.keys(this.seq.audio.instruments);
            this.seq.tracks.forEach((track, tIndex) => {
                // Label
                const labelCell = document.createElement('div');
                labelCell.className = 'grid-row-label';
                labelCell.style.display = 'flex';
                labelCell.style.justifyContent = 'space-between';
                labelCell.style.alignItems = 'center';

                // Controls (only needed on first system? or all? User might want to change inst anywhere. Let's keep small controls)
                // Instrument Select
                const instSelect = document.createElement('select');
                instSelect.className = 'track-inst-select';

                // Only show full controls on first system to save space? Or repeating is fine?
                // Plan said "Controls... repeated or handled gracefully".
                // Let's repeat for now but maybe make them smaller or just minimal on subsequent systems if cluttered.
                // Actually, if we have 10 systems, changing instrument on system 10 should change it for the whole track.
                // Repeating controls is robust.

                instrumentOptions.forEach(optVal => {
                    const opt = document.createElement('option');
                    opt.value = optVal;
                    opt.innerText = optVal.toUpperCase();
                    if (track.type === optVal) opt.selected = true;
                    instSelect.appendChild(opt);
                });
                instSelect.addEventListener('change', (e) => {
                    this.seq.changeTrackType(tIndex, e.target.value);
                });

                // Delete (only on first system to prevent accidental deletes mid-song?)
                // Let's put delete button only on the first system.
                labelCell.appendChild(instSelect);

                if (sysIndex === 0) {
                    const delBtn = document.createElement('button');
                    delBtn.innerText = 'X';
                    delBtn.className = 'track-del-btn';
                    delBtn.style.marginLeft = '5px';
                    delBtn.addEventListener('click', () => {
                        this.seq.removeTrack(tIndex);
                        this.renderGrid();
                    });
                    labelCell.appendChild(delBtn);
                }

                systemContainer.appendChild(labelCell);

                // Steps
                currentSystemBeats.forEach((beat, i) => {
                    const globalBeatIndex = startBeat + i;
                    const beatCell = document.createElement('div');
                    beatCell.className = 'beat-cell';
                    beatCell.style.display = 'grid';
                    beatCell.style.gridTemplateColumns = `repeat(${beat.subdivision}, 1fr)`;
                    beatCell.style.gap = '2px';

                    for (let s = 0; s < beat.subdivision; s++) {
                        const btn = document.createElement('div');
                        btn.className = `step-btn ${track.type}`;
                        if (track.pattern[globalBeatIndex] && track.pattern[globalBeatIndex][s]) {
                            btn.classList.add('active');
                        }

                        // ID for highlighting (Global indices)
                        btn.dataset.beat = globalBeatIndex;
                        btn.dataset.step = s;

                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (!this.seq.audio.isInitialized) this.seq.audio.init();
                            this.seq.toggleStep(tIndex, globalBeatIndex, s);
                            btn.classList.toggle('active');
                            if (!this.seq.isPlaying) {
                                this.seq.audio.playInstrument(track.type);
                            }
                        });
                        beatCell.appendChild(btn);
                    }
                    systemContainer.appendChild(beatCell);
                });
            });

            this.grid.appendChild(systemContainer);
        }

        // 3. Actions (Add Track / Add Bar)
        const actionContainer = document.createElement('div');
        actionContainer.style.textAlign = 'center';
        actionContainer.style.padding = '20px';
        actionContainer.style.display = 'flex';
        actionContainer.style.gap = '10px';
        actionContainer.style.justifyContent = 'center';

        const addTrackBtn = document.createElement('button');
        addTrackBtn.innerText = '+ Add Track';
        addTrackBtn.className = 'action-btn';
        addTrackBtn.addEventListener('click', () => {
            this.seq.addTrack('kick');
            this.renderGrid();
        });

        const addBarBtn = document.createElement('button');
        addBarBtn.innerText = '+ Add Bar (続き)';
        addBarBtn.className = 'action-btn';
        addBarBtn.style.background = 'linear-gradient(135deg, #FF9966 0%, #FF5E62 100%)';
        addBarBtn.addEventListener('click', () => {
            this.seq.addBar();
            this.renderGrid();
        });

        actionContainer.appendChild(addTrackBtn);
        actionContainer.appendChild(addBarBtn);
        this.grid.appendChild(actionContainer);
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

// Global instances
const audio = new AudioEngine();
const sequencer = new Sequencer(audio);
let ui;

document.addEventListener('DOMContentLoaded', () => {
    ui = new UI(sequencer);
});
