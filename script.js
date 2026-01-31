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

        // Data Structure:
        // this.bars = [ 
        //   { 
        //     id: 0,
        //     beats: [{ subdivision: 4 }, ...],
        //     tracks: [ { id: 0, type: 'kick', pattern: [[t,f,f,f], ...] } ]
        //   }, ...
        // ]
        this.bars = [];
        this.nextTrackId = 0;

        // Playback State
        this.currentBarIndex = 0;
        this.currentBeatIndex = 0; // Relative to Bar
        this.currentStepInBeat = 0;

        this.nextNoteTime = 0;
        this.lookahead = 25.0; // ms
        this.scheduleAheadTime = 0.1; // s
        this.timerID = null;

        // Initial setup
        this.addBar(); // Adds first bar
    }

    addBar() {
        const barId = this.bars.length;
        const newBar = {
            id: barId,
            beats: [],
            tracks: []
        };

        // Init beats
        for (let i = 0; i < this.timeSignature; i++) {
            newBar.beats.push({ subdivision: 4 });
        }

        // Add default track if it's the first bar, or maybe always adding empty?
        // User request "Add Track belongs to one bar".
        // Let's add one default kick track for convenience on new bars so it's not empty?
        // Or keep it empty. Let's add default Kick so user sees something.

        // Actually, for refactor, let's keep it consistent.
        // We create a default track for the new bar.
        const track = {
            id: this.nextTrackId++,
            type: 'kick',
            pattern: []
        };
        // Init pattern
        for (let b = 0; b < newBar.beats.length; b++) {
            track.pattern.push(new Array(newBar.beats[b].subdivision).fill(false));
        }
        newBar.tracks.push(track);

        this.bars.push(newBar);
        return newBar;
    }

    addTrack(barIndex, type = 'kick') {
        if (barIndex < 0 || barIndex >= this.bars.length) return;

        const bar = this.bars[barIndex];
        const track = {
            id: this.nextTrackId++,
            type: type,
            pattern: []
        };

        // Init pattern based on bar's beats
        for (let b = 0; b < bar.beats.length; b++) {
            track.pattern.push(new Array(bar.beats[b].subdivision).fill(false));
        }

        bar.tracks.push(track);
    }

    removeTrack(barIndex, trackIndex) {
        if (barIndex < 0 || barIndex >= this.bars.length) return;
        const bar = this.bars[barIndex];
        if (trackIndex >= 0 && trackIndex < bar.tracks.length) {
            bar.tracks.splice(trackIndex, 1);
        }
    }

    changeTrackType(barIndex, trackIndex, newType) {
        if (barIndex < 0 || barIndex >= this.bars.length) return;
        const bar = this.bars[barIndex];
        if (trackIndex >= 0 && trackIndex < bar.tracks.length) {
            bar.tracks[trackIndex].type = newType;
        }
    }

    toggleStep(barIndex, trackIndex, beatIndex, stepIndex) {
        if (this.bars[barIndex] && this.bars[barIndex].tracks[trackIndex]) {
            const pattern = this.bars[barIndex].tracks[trackIndex].pattern;
            if (pattern[beatIndex]) {
                pattern[beatIndex][stepIndex] = !pattern[beatIndex][stepIndex];
            }
        }
    }

    updateBeatSubdivision(barIndex, beatIndex, newSubdiv) {
        if (!this.bars[barIndex]) return;
        const bar = this.bars[barIndex];
        if (beatIndex < 0 || beatIndex >= bar.beats.length) return;

        bar.beats[beatIndex].subdivision = newSubdiv;

        // Update patterns for all tracks in this bar
        bar.tracks.forEach(track => {
            const oldBeatDetails = track.pattern[beatIndex];
            const newBeatDetails = new Array(newSubdiv).fill(false);

            // Copy exist data
            for (let i = 0; i < Math.min(oldBeatDetails.length, newSubdiv); i++) {
                newBeatDetails[i] = oldBeatDetails[i];
            }
            track.pattern[beatIndex] = newBeatDetails;
        });
    }

    updateBeatSubdivisionAllBars(beatIndex, delta) {
        console.log(`[Batch Update] Beat: ${beatIndex}, Delta: ${delta}`);
        this.bars.forEach((bar, barIndex) => {
            // Check if beatIndex exists in this bar
            if (beatIndex < bar.beats.length) {
                const currentSubdiv = bar.beats[beatIndex].subdivision;
                const newSubdiv = Math.max(1, currentSubdiv + delta); // Prevent < 1
                console.log(`  > Bar ${barIndex}: Updating Beat ${beatIndex} from ${currentSubdiv} to ${newSubdiv}`);
                this.updateBeatSubdivision(barIndex, beatIndex, newSubdiv);
            } else {
                console.log(`  > Bar ${barIndex}: Beat ${beatIndex} out of range (Length: ${bar.beats.length})`);
            }
        });
    }

    updateBeatSubdivisionBar(barIndex, delta) {
        console.log(`[Bar Update] Bar: ${barIndex}, Delta: ${delta}`);
        const bar = this.bars[barIndex];
        if (!bar) return;

        bar.beats.forEach((beat, bIndex) => {
            const currentSubdiv = beat.subdivision;
            const newSubdiv = Math.max(1, currentSubdiv + delta);
            this.updateBeatSubdivision(barIndex, bIndex, newSubdiv);
        });
    }

    removeStep(barIndex, beatIndex, stepIndex) {
        if (!this.bars[barIndex]) return;
        const bar = this.bars[barIndex];

        const currentSubdiv = bar.beats[beatIndex].subdivision;
        if (currentSubdiv <= 1) return;

        bar.beats[beatIndex].subdivision = currentSubdiv - 1;

        // Update patterns
        bar.tracks.forEach(track => {
            track.pattern[beatIndex].splice(stepIndex, 1);
        });
    }

    removeStepAllBars(beatIndex, stepIndex) {
        console.log(`[Batch Remove] Beat: ${beatIndex}, Step: ${stepIndex}`);
        this.bars.forEach((bar, barIndex) => {
            if (beatIndex < bar.beats.length) {
                console.log(`  > Bar ${barIndex}: Removing step`);
                this.removeStep(barIndex, beatIndex, stepIndex);
            }
        });
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.bpm;
        const currentBar = this.bars[this.currentBarIndex];
        if (!currentBar) {
            // Should not happen, but loop back safely
            this.currentBarIndex = 0;
            this.currentBeatIndex = 0;
            this.currentStepInBeat = 0;
            return;
        }

        const currentSubdiv = currentBar.beats[this.currentBeatIndex].subdivision;
        const stepTime = secondsPerBeat / currentSubdiv;

        this.nextNoteTime += stepTime;

        this.currentStepInBeat++;
        if (this.currentStepInBeat >= currentSubdiv) {
            this.currentStepInBeat = 0;
            this.currentBeatIndex++;
            if (this.currentBeatIndex >= currentBar.beats.length) {
                // End of Bar
                this.currentBeatIndex = 0;
                this.currentBarIndex++;
                if (this.currentBarIndex >= this.bars.length) {
                    // Loop Sequence
                    this.currentBarIndex = 0;
                }
            }
        }
    }

    scheduleNote(barIndex, beatIndex, stepInBeat, time) {
        const bar = this.bars[barIndex];
        if (!bar) return;

        bar.tracks.forEach((track, tIndex) => {
            if (track.pattern[beatIndex] && track.pattern[beatIndex][stepInBeat]) {
                this.audio.playInstrument(track.type, time);
            }
        });

        // Update UI
        const drawTime = (time - this.audio.ctx.currentTime) * 1000;
        setTimeout(() => {
            if (this.isPlaying) {
                ui.highlightStep(barIndex, beatIndex, stepInBeat);
            }
        }, Math.max(0, drawTime));
    }

    scheduler() {
        while (this.nextNoteTime < this.audio.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.currentBarIndex, this.currentBeatIndex, this.currentStepInBeat, this.nextNoteTime);
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
            ui.updatePlayButton(false);
        } else {
            // PLAY (or RESUME)
            this.isPlaying = true;
            this.nextNoteTime = this.audio.ctx.currentTime + 0.1;
            // Ensure we start from valid indices
            if (this.currentBarIndex >= this.bars.length) this.currentBarIndex = 0;

            this.scheduler();
            ui.updatePlayButton(true);
        }
    }

    stop() {
        this.isPlaying = false;
        clearTimeout(this.timerID);
        this.currentBarIndex = 0;
        this.currentBeatIndex = 0;
        this.currentStepInBeat = 0;
        ui.clearHighlights();
        ui.updatePlayButton(false);
    }

    updateSettings(bpm, timeSig) {
        this.bpm = bpm;

        if (this.timeSignature !== timeSig) {
            this.timeSignature = timeSig;
            // How to handle existing bars?
            // Resize all existing bars to new timeSig?
            // This might destruct data.
            this.bars.forEach(bar => {
                const oldBeats = bar.beats;
                const newBeats = [];
                // Resize beats structure
                for (let i = 0; i < timeSig; i++) {
                    if (i < oldBeats.length) {
                        newBeats.push(oldBeats[i]);
                    } else {
                        newBeats.push({ subdivision: 4 });
                    }
                }
                bar.beats = newBeats;

                // Resize tracks
                bar.tracks.forEach(track => {
                    const newPattern = [];
                    for (let b = 0; b < newBeats.length; b++) {
                        const subdiv = newBeats[b].subdivision;
                        const beatSteps = new Array(subdiv).fill(false);
                        if (track.pattern[b]) {
                            for (let s = 0; s < Math.min(subdiv, track.pattern[b].length); s++) {
                                beatSteps[s] = track.pattern[b][s];
                            }
                        }
                        newPattern.push(beatSteps);
                    }
                    track.pattern = newPattern;
                });
            });

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
        this.ctxAddBarBtn = document.getElementById('ctx-add-step-bar');
        this.ctxAddAllBtn = document.getElementById('ctx-add-step-all');
        this.ctxDelBtn = document.getElementById('ctx-del-step');
        this.ctxDelAllBtn = document.getElementById('ctx-del-step-all');
        this.ctxTarget = { bar: -1, beat: -1, step: -1 };

        this.setupListeners();
        this.setupContextMenu();
        this.renderGrid();
    }

    setupListeners() {
        // Controls
        this.playBtn.addEventListener('click', () => this.seq.play());
        document.getElementById('stop-btn').addEventListener('click', () => this.seq.stop());
        document.getElementById('clear-btn').addEventListener('click', () => {
            this.seq.bars.forEach(bar => {
                bar.tracks.forEach(track => {
                    track.pattern.forEach(beat => beat.fill(false));
                });
            });
            this.renderGrid();
        });

        // Settings
        this.bpmInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.bpmDisplay.innerText = val;
            this.seq.updateSettings(val, this.seq.timeSignature);
        });

        const updateParams = () => {
            this.seq.updateSettings(
                parseInt(this.bpmInput.value),
                parseInt(this.timeSigSelect.value)
            );
        };

        this.timeSigSelect.addEventListener('change', updateParams);

        // "Set All" subdivision
        this.subdivSelect.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            // Apply to ALL bars? Users usually expect this.
            this.seq.bars.forEach((bar, barIndex) => {
                for (let i = 0; i < bar.beats.length; i++) {
                    this.seq.updateBeatSubdivision(barIndex, i, val);
                }
            });
            this.renderGrid();
        });

    }

    setupContextMenu() {
        document.addEventListener('click', (e) => {
            if (!this.ctxMenu.classList.contains('hidden')) {
                this.ctxMenu.classList.add('hidden');
            }
        });

        this.grid.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const btn = e.target.closest('.step-btn');
            const beatCell = e.target.closest('.beat-cell');

            if (beatCell || btn) {
                // Determine target
                // We need bar index too!
                // Add data-bar to elements
                let barIndex = -1;
                let beatIndex = -1;
                let stepIndex = -1;

                if (btn) {
                    barIndex = parseInt(btn.dataset.bar);
                    beatIndex = parseInt(btn.dataset.beat);
                    stepIndex = parseInt(btn.dataset.step);

                    this.ctxDelBtn.classList.remove('disabled');
                    this.ctxDelBtn.innerText = `Delete Step ${stepIndex + 1}`;
                } else if (beatCell) {
                    // Try to find first button to get metadata
                    const firstBtn = beatCell.querySelector('.step-btn');
                    if (firstBtn) {
                        barIndex = parseInt(firstBtn.dataset.bar);
                        beatIndex = parseInt(firstBtn.dataset.beat);
                    }
                    stepIndex = -1;
                    this.ctxDelBtn.classList.add('disabled');
                    this.ctxDelBtn.innerText = "Delete This Step";
                }

                this.ctxTarget = { bar: barIndex, beat: beatIndex, step: stepIndex };

                this.ctxMenu.style.left = `${e.clientX}px`;
                this.ctxMenu.style.top = `${e.clientY}px`;
                this.ctxMenu.classList.remove('hidden');
            }
        });

        this.ctxAddBtn.addEventListener('click', () => {
            const t = this.ctxTarget;
            console.log("Ctx: Add Step", t);
            if (t.bar !== -1 && t.beat !== -1) {
                const currentSubdiv = this.seq.bars[t.bar].beats[t.beat].subdivision;
                this.seq.updateBeatSubdivision(t.bar, t.beat, currentSubdiv + 1);
                this.renderGrid();
            }
            this.ctxMenu.classList.add('hidden');
        });

        this.ctxAddBarBtn.addEventListener('click', () => {
            const t = this.ctxTarget;
            console.log("Ctx: Add Bar", t);
            if (t.bar !== -1) {
                this.seq.updateBeatSubdivisionBar(t.bar, 1);
                this.renderGrid();
            }
            this.ctxMenu.classList.add('hidden');
        });

        this.ctxAddAllBtn.addEventListener('click', () => {
            const t = this.ctxTarget;
            console.log("Ctx: Add All", t);
            if (t.beat !== -1) {
                this.seq.updateBeatSubdivisionAllBars(t.beat, 1);
                this.renderGrid();
            } else {
                console.warn("Ctx: Add All - Beat is -1");
            }
            this.ctxMenu.classList.add('hidden');
        });

        this.ctxDelBtn.addEventListener('click', () => {
            const t = this.ctxTarget;
            console.log("Ctx: Del Step", t);
            if (t.bar !== -1 && t.beat !== -1 && t.step !== -1) {
                this.seq.removeStep(t.bar, t.beat, t.step);
                this.renderGrid();
            }
            this.ctxMenu.classList.add('hidden');
        });

        this.ctxDelAllBtn.addEventListener('click', () => {
            const t = this.ctxTarget;
            console.log("Ctx: Del All", t);
            if (t.beat !== -1 && t.step !== -1) {
                this.seq.removeStepAllBars(t.beat, t.step);
                this.renderGrid();
            } else {
                console.warn("Ctx: Del All - Beat or Step is -1");
            }
            this.ctxMenu.classList.add('hidden');
        });
    }

    renderGrid() {
        this.grid.innerHTML = '';
        this.grid.className = 'sequencer-grid';

        // Render each BAR as a system
        this.seq.bars.forEach((bar, barIndex) => {

            // Container for this Bar
            const systemContainer = document.createElement('div');
            systemContainer.className = 'system-container';
            // Grid columns: Label + beats
            // Use minmax to ensure it doesn't squish on small screens
            systemContainer.style.gridTemplateColumns = `170px repeat(${bar.beats.length}, minmax(100px, 1fr))`;

            // 1. Header (Subdivision)
            const emptyHeader = document.createElement('div');
            emptyHeader.innerText = `Bar ${barIndex + 1}`;
            emptyHeader.className = 'grid-row-label';
            emptyHeader.style.color = '#8b9bb4';
            emptyHeader.style.fontSize = '0.9rem';
            emptyHeader.style.paddingLeft = '5px';
            systemContainer.appendChild(emptyHeader);

            bar.beats.forEach((beat, bIndex) => {
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
                    this.seq.updateBeatSubdivision(barIndex, bIndex, newSubdiv);
                    this.renderGrid();
                });

                beatHeader.appendChild(select);
                systemContainer.appendChild(beatHeader);
            });

            // 2. Tracks for this BAR
            const instrumentOptions = Object.keys(this.seq.audio.instruments);
            bar.tracks.forEach((track, tIndex) => {
                // Label
                const labelCell = document.createElement('div');
                labelCell.className = 'grid-row-label';
                labelCell.style.display = 'flex';
                labelCell.style.justifyContent = 'space-between';
                labelCell.style.alignItems = 'center';

                // Instrument Select
                const instSelect = document.createElement('select');
                instSelect.className = 'track-inst-select';

                instrumentOptions.forEach(optVal => {
                    const opt = document.createElement('option');
                    opt.value = optVal;
                    opt.innerText = optVal.toUpperCase();
                    if (track.type === optVal) opt.selected = true;
                    instSelect.appendChild(opt);
                });
                instSelect.addEventListener('change', (e) => {
                    this.seq.changeTrackType(barIndex, tIndex, e.target.value);
                });

                // Delete Button
                const delBtn = document.createElement('button');
                delBtn.innerText = 'X';
                delBtn.className = 'track-del-btn';
                delBtn.style.marginLeft = '5px';
                delBtn.addEventListener('click', () => {
                    this.seq.removeTrack(barIndex, tIndex);
                    this.renderGrid();
                });

                labelCell.appendChild(instSelect);
                labelCell.appendChild(delBtn);
                systemContainer.appendChild(labelCell);

                // Steps
                bar.beats.forEach((beat, bIndex) => {
                    const beatCell = document.createElement('div');
                    beatCell.className = 'beat-cell';
                    beatCell.style.display = 'grid';
                    beatCell.style.gridTemplateColumns = `repeat(${beat.subdivision}, 1fr)`;
                    beatCell.style.gap = '2px';

                    for (let s = 0; s < beat.subdivision; s++) {
                        const btn = document.createElement('div');
                        btn.className = `step-btn ${track.type}`;
                        if (track.pattern[bIndex] && track.pattern[bIndex][s]) {
                            btn.classList.add('active');
                        }

                        // ID for highlighting (Need bar/beat/step)
                        btn.dataset.bar = barIndex;
                        btn.dataset.beat = bIndex;
                        btn.dataset.step = s;

                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (!this.seq.audio.isInitialized) this.seq.audio.init();
                            this.seq.toggleStep(barIndex, tIndex, bIndex, s);
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

            // 3. Add Track Button INSIDE the Bar (Last Row of Grid or separate?)
            // We can append it to the label column of a new row, or just append a div to the container?
            // If we append to container, it becomes a grid item.
            // We want it to span full width?
            // Grid columns: 1 (170px) + N (beats)
            // Let's make it span 1 (label) and let beats be empty?
            // Or make it span all.
            const addTrackContainer = document.createElement('div');
            addTrackContainer.style.gridColumn = '1 / -1'; // Span all
            addTrackContainer.style.paddingTop = '5px';

            const addTrackBtn = document.createElement('button');
            addTrackBtn.innerText = '+ Add Track';
            addTrackBtn.className = 'action-btn';
            addTrackBtn.style.fontSize = '0.8rem';
            addTrackBtn.style.padding = '5px 10px';
            addTrackBtn.style.marginTop = '0'; // Override generic
            addTrackBtn.addEventListener('click', () => {
                this.seq.addTrack(barIndex, 'kick');
                this.renderGrid();
            });

            addTrackContainer.appendChild(addTrackBtn);
            systemContainer.appendChild(addTrackContainer);


            this.grid.appendChild(systemContainer);
        });

        // 4. Global Action (Add Bar)
        const actionContainer = document.createElement('div');
        actionContainer.style.textAlign = 'center';
        actionContainer.style.padding = '20px';
        actionContainer.style.display = 'flex';
        actionContainer.style.gap = '10px';
        actionContainer.style.justifyContent = 'center';

        const addBarBtn = document.createElement('button');
        addBarBtn.innerText = '+ Add Bar (続き)';
        addBarBtn.className = 'action-btn';
        addBarBtn.style.background = 'linear-gradient(135deg, #FF9966 0%, #FF5E62 100%)';
        addBarBtn.addEventListener('click', () => {
            this.seq.addBar();
            this.renderGrid();
        });

        actionContainer.appendChild(addBarBtn);
        this.grid.appendChild(actionContainer);
    }

    highlightStep(barIndex, beatIndex, stepIndex) {
        document.querySelectorAll('.current-step').forEach(el => el.classList.remove('current-step'));

        const selector = `[data-bar="${barIndex}"][data-beat="${beatIndex}"][data-step="${stepIndex}"]`;
        document.querySelectorAll(selector).forEach(el => {
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
