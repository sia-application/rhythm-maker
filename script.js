/**
 * Rhythm Maker App
 * Handles Audio, Sequencing, and UI interactions.
 */

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isInitialized = false;
        this.activeNodes = new Set(); // Track scheduled nodes
        // Instruments
        this.instruments = {
            'metronome': { freq: 1000, decay: 0.05, type: 'square' },
            'kick': { freq: 150, decay: 0.5, type: 'sine' },
            'bassdrum': { freq: 60, decay: 0.8, type: 'sine' },
            'snare': { freq: 200, decay: 0.2, type: 'noise' },
            'hihat': { freq: 800, decay: 0.1, type: 'noise' },
            'openhihat': { freq: 800, decay: 0.4, type: 'noise' },
            'pedalhat': { freq: 500, decay: 0.05, type: 'noise' },
            'tomH': { freq: 200, decay: 0.3, type: 'triangle' },
            'tomM': { freq: 140, decay: 0.4, type: 'triangle' },
            'tomL': { freq: 90, decay: 0.5, type: 'triangle' },
            'ride': { freq: 400, decay: 0.8, type: 'ride' },
            'crash': { freq: 200, decay: 1.5, type: 'noise' },
            'clap': { freq: 0, decay: 0.3, type: 'noise' },
            'rim': { freq: 1000, decay: 0.02, type: 'square' },
            'cowbell': { freq: 540, decay: 0.1, type: 'cowbell' },
            'shaker': { freq: 3000, decay: 0.1, type: 'noise' }
        };
    }

    init() {
        if (this.isInitialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        const volEl = document.getElementById('master-vol');
        this.masterGain.gain.value = volEl ? parseFloat(volEl.value) : 0.5;
        this.masterGain.connect(this.ctx.destination);
        this.isInitialized = true;
        console.log("AudioEngine initialized");

        // Resume context if suspended (browser policy)
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(time, type, freq, decay, volume = 1.0) {
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

        this.activeNodes.add(osc);
        osc.onended = () => this.activeNodes.delete(osc);

        osc.start(time);
        osc.stop(time + decay);
    }

    playNoise(time, decay, volume = 1.0) {
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
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        this.activeNodes.add(noise);
        noise.onended = () => this.activeNodes.delete(noise);

        noise.start(time);
        // noise stop is automatic as it's a buffer source with specific length
    }

    stopAll() {
        if (!this.ctx) return;
        this.activeNodes.forEach(node => {
            try {
                node.stop();
            } catch (e) {
                // Ignore errors if node already stopped
            }
        });
        this.activeNodes.clear();
    }

    playInstrument(name, time = 0, trackVolume = 1.0) {
        if (!this.isInitialized) return;
        // Fallback to now if time is 0 (immediate play)
        const t = time || this.ctx.currentTime;

        // Apply track volume if needed. 
        // We create a temporary gain node for the instrument play if we want to be precise,
        // but for simple synthesis, we can pass it down to playTone/playNoise.

        const v = trackVolume;

        switch (name) {
            case 'kick':
                this.playTone(t, 'sine', 150, 0.5, v);
                break;
            case 'bassdrum':
                this.playTone(t, 'sine', 60, 0.8, v);
                break;
            case 'tomH':
                this.playTone(t, 'triangle', 200, 0.3, v);
                break;
            case 'tomM':
                this.playTone(t, 'triangle', 140, 0.4, v);
                break;
            case 'tomL':
                this.playTone(t, 'triangle', 90, 0.5, v);
                break;
            case 'snare':
                this.playTone(t, 'triangle', 200, 0.1, v); // Body
                this.playNoise(t, 0.2, v); // Snap
                break;
            case 'hihat':
                this.playNoise(t, 0.05, v);
                break;
            case 'openhihat':
                this.playNoise(t, 0.4, v);
                break;
            case 'pedalhat':
                this.playNoise(t, 0.08, v);
                break;
            case 'crash':
                this.playNoise(t, 1.5, v);
                break;
            case 'ride':
                this.playTone(t, 'square', 400, 0.1, v);
                this.playNoise(t, 0.8, v);
                break;
            case 'clap':
                // Clap is 3 tiny bursts + 1 decay
                for (let i = 0; i < 3; i++) {
                    this.playNoise(t + (i * 0.01), 0.01, v);
                }
                this.playNoise(t + 0.03, 0.3, v);
                break;
            case 'rim':
                this.playTone(t, 'square', 1000, 0.02, v);
                break;
            case 'cowbell':
                this.playTone(t, 'square', 540, 0.1, v);
                this.playTone(t, 'square', 800, 0.08, v);
                break;
            case 'shaker':
                this.playNoise(t, 0.1, v);
                break;
            case 'metronome':
                this.playTone(t, 'square', 1000, 0.05, v);
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
        this.noteSpeed = 1.0; // Default speed
        this.playbackMode = 'loop'; // 'loop' or 'stop'
        this.updateScheduleAheadTime();
        this.timerID = null;

        // Initial setup
        this.lastSelectedInstrument = 'metronome';
        this.addBar(); // Adds first bar
    }

    updateScheduleAheadTime() {
        // High speed = Low travel time.
        // Low speed = High travel time.
        // Travel time (s) = 2.0 / speed. 
        // We need scheduleAheadTime to be at least (travelTime + buffer).
        const travelTimeSeconds = 2.0 / this.noteSpeed;
        this.scheduleAheadTime = travelTimeSeconds + 0.3; // 300ms buffer
    }

    addBar() {
        const barId = this.bars.length;
        const bar = {
            id: barId,
            beats: [],
            tracks: []
        };
        // Default: 4 beats, subdivision 4
        for (let i = 0; i < this.timeSignature; i++) {
            bar.beats.push({ subdivision: 4 });
        }
        // Add default tracks
        // Default to just last selected instrument (1 track) as requested.
        const defaultTracks = [this.lastSelectedInstrument];

        defaultTracks.forEach(type => {
            const track = {
                type: type,
                volume: 1.0,
                pattern: []
            };
            // Init pattern for each beat
            bar.beats.forEach(() => {
                track.pattern.push(new Array(4).fill(false));
            });
            bar.tracks.push(track);
        });

        this.bars.push(bar);
        return bar;
    }

    removeBar(barIndex) {
        // if (this.bars.length <= 1) return; // Allow deleting all bars
        if (barIndex < 0 || barIndex >= this.bars.length) return;
        this.bars.splice(barIndex, 1);

        // Adjust current Bar index if needed
        if (this.currentBarIndex >= this.bars.length) {
            this.currentBarIndex = this.bars.length - 1;
        }
    }

    addTrack(barIndex, type = null) {
        if (barIndex < 0 || barIndex >= this.bars.length) return;

        const useType = type || this.lastSelectedInstrument;
        const bar = this.bars[barIndex];
        const track = {
            id: this.nextTrackId++,
            type: useType,
            volume: 1.0,
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
            this.lastSelectedInstrument = newType;
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

    addBeat(barIndex) {
        if (!this.bars[barIndex]) return;
        const bar = this.bars[barIndex];
        // Add beat definition
        bar.beats.push({ subdivision: 4 });
        // Add beat data to tracks
        bar.tracks.forEach(track => {
            track.pattern.push(new Array(4).fill(false));
        });
    }

    removeBeat(barIndex) {
        if (!this.bars[barIndex]) return;
        const bar = this.bars[barIndex];
        if (bar.beats.length <= 1) return; // Keep at least 1 beat

        bar.beats.pop();
        bar.tracks.forEach(track => {
            track.pattern.pop();
        });
    }

    removeBeatAt(barIndex, beatIndex) {
        if (!this.bars[barIndex]) return;
        const bar = this.bars[barIndex];
        if (bar.beats.length <= 1) return; // Keep at least 1 beat
        if (beatIndex < 0 || beatIndex >= bar.beats.length) return;

        bar.beats.splice(beatIndex, 1);
        bar.tracks.forEach(track => {
            track.pattern.splice(beatIndex, 1);
        });
    }

    moveBeat(barIndex, fromIndex, toIndex) {
        if (!this.bars[barIndex]) return;
        const bar = this.bars[barIndex];
        if (fromIndex < 0 || fromIndex >= bar.beats.length) return;
        if (toIndex < 0 || toIndex >= bar.beats.length) return;
        if (fromIndex === toIndex) return;

        // Move Beat Definition
        const [movedBeat] = bar.beats.splice(fromIndex, 1);
        bar.beats.splice(toIndex, 0, movedBeat);

        // Move Steps in All Tracks
        bar.tracks.forEach(track => {
            if (track.pattern.length > fromIndex) {
                const [movedPattern] = track.pattern.splice(fromIndex, 1);
                track.pattern.splice(toIndex, 0, movedPattern);
            }
        });
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
        // If step does not exist at this index, return
        if (stepIndex === -1 || stepIndex >= currentSubdiv) return;

        bar.beats[beatIndex].subdivision = currentSubdiv - 1;

        // Update patterns
        bar.tracks.forEach(track => {
            track.pattern[beatIndex].splice(stepIndex, 1);
        });
    }

    insertStep(barIndex, beatIndex, stepIndex) {
        console.log(`[Sequencer] insertStep: Bar ${barIndex}, Beat ${beatIndex}, Target StepIndex (insert after): ${stepIndex}`);
        if (!this.bars[barIndex]) return;
        const bar = this.bars[barIndex];
        if (beatIndex < 0 || beatIndex >= bar.beats.length) return;

        const currentSubdiv = bar.beats[beatIndex].subdivision;
        // If stepIndex is not -1 and out of bounds, do not add (User request)
        if (stepIndex !== -1 && stepIndex >= currentSubdiv) {
            console.log(`  > Skip: Step index ${stepIndex} out of bounds for sub ${currentSubdiv}`);
            return;
        }

        bar.beats[beatIndex].subdivision = currentSubdiv + 1;

        bar.tracks.forEach((track, tIdx) => {
            if (track.pattern[beatIndex]) {
                const oldLen = track.pattern[beatIndex].length;
                // Insert at stepIndex + 1. If stepIndex is -1 (from beatCell), append at end.
                const insertPos = (stepIndex === -1) ? oldLen : (stepIndex + 1);
                console.log(`  > Track ${tIdx}: Splicing at ${insertPos}`);
                track.pattern[beatIndex].splice(insertPos, 0, false);
            }
        });
    }

    insertStepAllBars(beatIndex, stepIndex) {
        console.log(`[Sequencer] insertStepAllBars: Beat ${beatIndex}, Step ${stepIndex}`);
        this.bars.forEach((bar, barIndex) => {
            if (beatIndex < bar.beats.length) {
                this.insertStep(barIndex, beatIndex, stepIndex);
            }
        });
    }

    insertStepBar(barIndex, stepIndex) {
        console.log(`[Sequencer] insertStepBar: Bar ${barIndex}, Step ${stepIndex}`);
        const bar = this.bars[barIndex];
        if (!bar) return;
        bar.beats.forEach((beat, bIndex) => {
            // No longer capping with Math.min to ensure we respect step existence
            this.insertStep(barIndex, bIndex, stepIndex);
        });
    }

    insertStepGlobal(stepIndex) {
        console.log(`[Sequencer] insertStepGlobal: Step ${stepIndex}`);
        this.bars.forEach((bar, barIndex) => {
            bar.beats.forEach((beat, bIndex) => {
                this.insertStep(barIndex, bIndex, stepIndex);
            });
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

    removeStepBar(barIndex, stepIndex) {
        console.log(`[Bar Remove] Bar: ${barIndex}, Target Step Index: ${stepIndex}`);
        const bar = this.bars[barIndex];
        if (!bar) return;
        bar.beats.forEach((beat, bIndex) => {
            this.removeStep(barIndex, bIndex, stepIndex);
        });
    }

    removeStepGlobal(stepIndex) {
        console.log(`[Sequencer] removeStepGlobal: Step ${stepIndex}`);
        this.bars.forEach((bar, barIndex) => {
            bar.beats.forEach((beat, bIndex) => {
                this.removeStep(barIndex, bIndex, stepIndex);
            });
        });
    }

    setStepState(barIndex, trackIndex, beatIndex, stepIndex, state) {
        if (this.bars[barIndex] && this.bars[barIndex].tracks[trackIndex]) {
            const track = this.bars[barIndex].tracks[trackIndex];
            if (track.pattern[beatIndex]) {
                track.pattern[beatIndex][stepIndex] = state;
            }
        }
    }

    setColumnState(barIndex, beatIndex, stepIndex, state) {
        if (this.bars[barIndex]) {
            this.bars[barIndex].tracks.forEach(track => {
                if (track.pattern[beatIndex] && stepIndex < track.pattern[beatIndex].length) {
                    track.pattern[beatIndex][stepIndex] = state;
                }
            });
        }
    }

    setColumnAllBarsState(beatIndex, stepIndex, state) {
        console.log(`[Sequencer] setColumnAllBarsState: Beat ${beatIndex}, Step ${stepIndex}, State ${state}`);
        this.bars.forEach(bar => {
            if (beatIndex < bar.beats.length) {
                bar.tracks.forEach(track => {
                    if (track.pattern[beatIndex] && stepIndex < track.pattern[beatIndex].length) {
                        track.pattern[beatIndex][stepIndex] = state;
                    }
                });
            }
        });
    }

    setBarStepState(barIndex, stepIndex, state) {
        console.log(`[Sequencer] setBarStepState: Bar ${barIndex}, Step ${stepIndex}, State ${state}`);
        if (this.bars[barIndex]) {
            this.bars[barIndex].beats.forEach((beat, beatIndex) => {
                this.bars[barIndex].tracks.forEach(track => {
                    if (track.pattern[beatIndex] && stepIndex < track.pattern[beatIndex].length) {
                        track.pattern[beatIndex][stepIndex] = state;
                    }
                });
            });
        }
    }

    setBarState(barIndex, state) {
        console.log(`[Sequencer] setBarState: Bar ${barIndex}, State ${state}`);
        if (this.bars[barIndex]) {
            this.bars[barIndex].tracks.forEach(track => {
                track.pattern.forEach(beatPattern => {
                    beatPattern.fill(state);
                });
            });
        }
    }

    setGlobalStepState(stepIndex, state) {
        console.log(`[Sequencer] setGlobalStepState: Step ${stepIndex}, State ${state}`);
        this.bars.forEach(bar => {
            bar.beats.forEach((beat, bIdx) => {
                bar.tracks.forEach(track => {
                    if (track.pattern[bIdx] && stepIndex < track.pattern[bIdx].length) {
                        track.pattern[bIdx][stepIndex] = state;
                    }
                });
            });
        });
    }

    setGlobalState(state) {
        this.bars.forEach(bar => {
            bar.tracks.forEach(track => {
                track.pattern.forEach(beatPattern => {
                    beatPattern.fill(state);
                });
            });
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
                    // End of Project
                    if (this.playbackMode === 'stop') {
                        this.stop();
                        return;
                    }
                    // Loop Sequence
                    this.currentBarIndex = 0;
                }
            }
        }
    }

    scheduleNote(barIndex, beatIndex, stepInBeat, time) {
        const bar = this.bars[barIndex];
        if (!bar) return;

        const now = this.audio.ctx.currentTime;

        bar.tracks.forEach((track, tIndex) => {
            if (track.pattern[beatIndex] && track.pattern[beatIndex][stepInBeat]) {
                this.audio.playInstrument(track.type, time);

                // Trigger Game Note
                if (this.onNoteTrigger) {
                    const travelTime = 2.0 / this.noteSpeed; // travel time to the line in SECONDS
                    const spawnDelay = (time - travelTime - now) * 1000;
                    // We call it for all notes in lookahead.
                    // spawnNote will handle negative delay for notes that should have started.
                    setTimeout(() => {
                        if (this.isPlaying) {
                            this.onNoteTrigger(barIndex, tIndex, time);
                        }
                    }, spawnDelay);
                }
            }
        });

        // Update UI
        const drawTime = (time - now) * 1000;
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
            this.audio.stopAll();
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
        this.audio.stopAll();
        this.currentBarIndex = 0;
        this.currentBeatIndex = 0;
        this.currentStepInBeat = 0;
        ui.clearHighlights();
        if (ui.game) {
            ui.game.clearActiveNotes();
        }
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

class RhythmGame {
    constructor(sequencer) {
        this.seq = sequencer;
        this.score = 0;
        this.combo = 0;
        this.container = document.getElementById('game-lanes');
        this.scoreEl = document.getElementById('game-score');
        this.hitEl = document.getElementById('game-hits');
        this.totalNotesEl = document.getElementById('game-total-notes');
        this.comboEl = document.getElementById('game-combo');
        this.statusEl = document.getElementById('game-status');
        this.lanes = [];
        this.activeNotes = []; // { el, time, lane, judged, timeoutID }
        this.laneMap = {}; // trackIndex -> laneIndex
        this.isGameMode = false;
        this.hitCriteria = 'nice'; // 'nice', 'great', or 'excellent'
        this.lastNoteTime = 0;
    }

    init() {
        this.container.innerHTML = '';
        this.lanes = [];
        this.score = 0;
        this.combo = 0;
        this.hitCount = 0;
        this.clearActiveNotes();
        this.totalNotes = this.calculateTotalNotes();
        console.log("RhythmGame: Initializing...", this.seq.bars);
        this.updateUI();

        // Create lanes based on tracks in the target bar
        const bar0 = this.seq.bars[0];
        if (!bar0) {
            console.error("RhythmGame: No bars found");
            return;
        }

        const tracks = bar0.tracks;
        if (tracks.length === 0) {
            console.warn("RhythmGame: No tracks found in Bar 0, adding default lane mapping");
            // Placeholder lane if no tracks exist?
        }

        bar0.tracks.forEach((track, i) => {
            const lane = document.createElement('div');
            lane.className = 'game-lane';
            lane.dataset.laneIndex = i;

            const flash = document.createElement('div');
            flash.className = 'lane-hit-flash';
            lane.appendChild(flash);

            lane.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.handleInput(i);
            });

            this.container.appendChild(lane);
            this.lanes.push({ el: lane, flash: flash });
            this.laneMap[i] = i;
        });

        console.log(`RhythmGame: Created ${this.lanes.length} lanes`);

        const judgmentLine = document.createElement('div');
        judgmentLine.className = 'judgment-line';
        this.container.appendChild(judgmentLine);
    }

    calculateTotalNotes() {
        let count = 0;
        this.seq.bars.forEach(bar => {
            bar.tracks.forEach(track => {
                track.pattern.forEach(beatPattern => {
                    beatPattern.forEach(step => {
                        if (step) count++;
                    });
                });
            });
        });
        return count;
    }

    spawnNote(trackIndex, targetTime) {
        if (!this.isGameMode) return;
        const laneIndex = this.laneMap[trackIndex];
        if (laneIndex === undefined) return;

        const lane = this.lanes[laneIndex];
        const note = document.createElement('div');
        note.className = 'game-note';
        lane.el.appendChild(note);

        const travelTimeToLine = (2.0 / this.seq.noteSpeed) * 1000; // ms
        const now = performance.now();
        const audioNow = this.seq.audio.ctx.currentTime;

        // Calculate the total animation duration to make it hit the line at travelTimeToLine
        // Start: -20px, Line: laneHeight - 40px, End: laneHeight
        const laneHeight = this.container.offsetHeight || 500;
        const distToLine = (laneHeight - 40) - (-20);
        const totalDist = laneHeight - (-20);

        // duration * (distToLine / totalDist) = travelTimeToLine
        // duration = travelTimeToLine * (totalDist / distToLine)
        const animationDuration = travelTimeToLine * (totalDist / distToLine);

        // Exact time it should hit judgment line (relative to performance.now)
        const perfTargetTime = now + (targetTime - audioNow) * 1000;

        // Prevent duplicate notes at the same time and lane
        const isDuplicate = this.activeNotes.some(n => n.lane === laneIndex && Math.abs(n.targetTime - perfTargetTime) < 50);
        if (isDuplicate) return;

        // Calculate delay: if negative, we need to skip some animation
        const spawnDelayMs = perfTargetTime - travelTimeToLine - now;

        note.style.animation = `note-fall ${animationDuration}ms linear forwards`;
        if (spawnDelayMs < 0) {
            note.style.animationDelay = `${spawnDelayMs}ms`;
        }

        const noteObj = {
            el: note,
            targetTime: perfTargetTime,
            lane: laneIndex,
            judged: false,
            timeoutID: null
        };

        this.activeNotes.push(noteObj);

        noteObj.timeoutID = setTimeout(() => {
            if (!noteObj.judged) {
                this.judgeNote(noteObj, Infinity);
            }
            if (note.parentNode) {
                note.remove();
            }
            const idx = this.activeNotes.indexOf(noteObj);
            if (idx > -1) this.activeNotes.splice(idx, 1);
        }, animationDuration + 100);
    }

    handleInput(laneIndex = -1) {
        if (!this.isGameMode) return;

        const now = performance.now();
        let targetNote = null;
        let minDiff = Infinity;

        this.activeNotes.forEach(note => {
            if (note.judged) return;
            if (laneIndex !== -1 && note.lane !== laneIndex) return;

            const diff = Math.abs(now - note.targetTime);
            if (diff < minDiff) {
                minDiff = diff;
                targetNote = note;
            }
        });

        if (targetNote && minDiff < 200) {
            this.judgeNote(targetNote, minDiff);
        }

        if (laneIndex !== -1) {
            const flash = this.lanes[laneIndex].flash;
            flash.classList.add('active');
            setTimeout(() => flash.classList.remove('active'), 100);
        } else {
            this.lanes.forEach(l => {
                l.flash.classList.add('active');
                setTimeout(() => l.flash.classList.remove('active'), 100);
            });
        }
    }

    judgeNote(note, diff) {
        note.judged = true;
        let rating = 'MISS';
        let scoreAdd = 0;
        let ratingClass = 'note-miss';
        let isHit = false;

        if (diff <= 50) {
            rating = 'EXCELLENT';
            scoreAdd = 100;
            ratingClass = 'note-excellent';
            this.combo++;
            isHit = true;
        } else if (diff <= 100) {
            rating = 'GREAT';
            scoreAdd = 50;
            ratingClass = 'note-great';
            this.combo++;
            if (this.hitCriteria === 'nice' || this.hitCriteria === 'great') {
                isHit = true;
            }
        } else if (diff <= 150) {
            rating = 'NICE';
            scoreAdd = 20;
            ratingClass = 'note-nice';
            this.combo++;
            if (this.hitCriteria === 'nice') {
                isHit = true;
            }
        } else {
            rating = 'MISS';
            this.combo = 0;
            ratingClass = 'note-miss';
        }

        if (isHit) {
            this.hitCount++;
        }

        this.score += scoreAdd;
        this.showJudgment(rating, ratingClass);
        this.updateUI();

        if (note.el && diff !== Infinity) {
            note.el.style.display = 'none';
            note.el.remove();
            // Clear the MISS judgment timeout since it was hit/missed early
            if (note.timeoutID) {
                clearTimeout(note.timeoutID);
                note.timeoutID = null;
            }
            // Remove from activeNotes array immediately
            const idx = this.activeNotes.indexOf(note);
            if (idx > -1) this.activeNotes.splice(idx, 1);
        }
    }

    clearActiveNotes() {
        this.activeNotes.forEach(note => {
            if (note.timeoutID) {
                clearTimeout(note.timeoutID);
            }
            if (note.el) {
                note.el.remove();
            }
        });
        this.activeNotes = [];

        // Also clear any floating judgments and reset status
        const floats = this.container.querySelectorAll('.judgment-float');
        floats.forEach(el => el.remove());
        if (this.statusEl) {
            this.statusEl.innerText = 'READY';
            this.statusEl.className = 'game-status';
        }
    }

    showJudgment(text, className) {
        const el = document.createElement('div');
        el.className = `judgment-float ${className}`;
        el.innerText = text;
        this.container.appendChild(el);
        setTimeout(() => el.remove(), 500);
        this.statusEl.innerText = text;
        this.statusEl.className = `game-status ${className}`;
    }

    updateUI() {
        if (this.scoreEl) this.scoreEl.innerText = this.score;
        if (this.hitEl) this.hitEl.innerText = this.hitCount;
        if (this.totalNotesEl) this.totalNotesEl.innerText = this.totalNotes;
        if (this.comboEl) this.comboEl.innerText = this.combo;
    }
}

class UI {
    constructor(sequencer) {
        this.seq = sequencer;
        this.grid = document.getElementById('sequencer-grid');
        this.bpmInput = document.getElementById('bpm-input');
        this.bpmNumber = document.getElementById('bpm-number');
        this.timeSigSelect = document.getElementById('time-sig-select');
        this.subdivSelect = document.getElementById('subdiv-select');
        this.playBtn = document.getElementById('play-btn');
        this.masterVol = document.getElementById('master-vol');
        this.volNumber = document.getElementById('vol-number');
        this.ctxMenu = document.getElementById('context-menu');
        this.ctxAddBtn = document.getElementById('ctx-add-step');
        this.ctxAddBarBtn = document.getElementById('ctx-add-step-bar');
        this.ctxAddAllBtn = document.getElementById('ctx-add-step-all');
        this.ctxAddGlobalBtn = document.getElementById('ctx-add-step-global');
        this.ctxDelBtn = document.getElementById('ctx-del-step');
        this.ctxDelBarBtn = document.getElementById('ctx-del-step-bar');
        this.ctxDelAllBtn = document.getElementById('ctx-del-step-all');
        this.ctxDelGlobalBtn = document.getElementById('ctx-del-step-global');

        this.ctxSelStepBtn = document.getElementById('ctx-sel-step');
        this.ctxSelColBtn = document.getElementById('ctx-sel-col');
        this.ctxSelAllBtn = document.getElementById('ctx-sel-all');
        this.ctxUnselStepBtn = document.getElementById('ctx-unsel-step');
        this.ctxUnselColBtn = document.getElementById('ctx-unsel-col');
        this.ctxUnselAllBtn = document.getElementById('ctx-unsel-all');
        this.ctxSelGlobalStepBtn = document.getElementById('ctx-sel-global');
        this.ctxUnselGlobalStepBtn = document.getElementById('ctx-unsel-global');

        this.viewToggleBtn = document.getElementById('view-toggle-btn');
        this.sequencerView = document.getElementById('sequencer-view');
        this.gameView = document.getElementById('game-view');
        this.gameSpeedSlider = document.getElementById('game-speed-slider');
        this.gameSpeedVal = document.getElementById('game-speed-val');
        this.hitCriteriaSelect = document.getElementById('hit-criteria-select');
        this.playbackModeSelect = document.getElementById('playback-mode-select');
        this.game = new RhythmGame(this.seq);
        this.isGameMode = false;

        this.ctxTarget = { bar: -1, beat: -1, step: -1 };

        this.setupListeners();
        this.setupContextMenu();
        this.renderGrid();
        console.log("UI: Initialized successfully");
    }

    setupListeners() {
        // Controls
        this.playBtn.addEventListener('click', () => this.seq.play());
        document.getElementById('stop-btn').addEventListener('click', () => this.seq.stop());
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.seq.bars.forEach(bar => {
                bar.tracks.forEach(track => {
                    track.pattern.forEach(beat => beat.fill(false));
                });
            });
            this.renderGrid();
        });

        // Settings
        // BPM sync
        const updateBpm = (val) => {
            let num = parseInt(val);
            if (isNaN(num)) return;
            num = Math.max(20, Math.min(999, num));
            this.seq.bpm = num;
            this.seq.updateSettings(num, this.seq.timeSignature);
            this.bpmInput.value = num;
            if (this.bpmNumber) this.bpmNumber.value = num;
        };

        this.bpmInput.addEventListener('input', (e) => updateBpm(e.target.value));
        if (this.bpmNumber) {
            this.bpmNumber.addEventListener('change', (e) => updateBpm(e.target.value));
        }

        // Volume sync
        const updateVol = (val, isSlider) => {
            let v = parseFloat(val);
            if (isNaN(v)) return;

            let sliderVal, numberVal;
            if (isSlider) {
                sliderVal = v;
                numberVal = Math.round(v * 100);
            } else {
                numberVal = Math.max(0, Math.min(500, Math.round(v)));
                sliderVal = numberVal / 100;
            }

            this.masterVol.value = sliderVal;
            if (this.volNumber) this.volNumber.value = numberVal;

            if (this.seq.audio.isInitialized) {
                this.seq.audio.masterGain.gain.setTargetAtTime(sliderVal, this.seq.audio.ctx.currentTime, 0.05);
            }
        };

        if (this.masterVol) {
            this.masterVol.addEventListener('input', (e) => updateVol(e.target.value, true));
        }
        if (this.volNumber) {
            this.volNumber.addEventListener('change', (e) => updateVol(e.target.value, false));
        }

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

        // View Toggle
        this.viewToggleBtn.addEventListener('click', () => {
            console.log("UI: View Toggle Clicked. Current isGameMode:", this.isGameMode);
            this.isGameMode = !this.isGameMode;
            this.viewToggleBtn.innerText = this.isGameMode ? "Sequencer Mode" : "Game Mode";
            this.sequencerView.classList.toggle('hidden', this.isGameMode);
            this.gameView.classList.toggle('hidden', !this.isGameMode);
            this.game.isGameMode = this.isGameMode;

            if (this.isGameMode) {
                console.log("UI: Switching to Game Mode");
                this.game.init();
                this.seq.onNoteTrigger = (bar, track, targetTime) => this.game.spawnNote(track, targetTime);
            } else {
                console.log("UI: Switching to Sequencer Mode");
                this.seq.onNoteTrigger = null;
            }
        });

        // Global Key Input for Game
        window.addEventListener('keydown', (e) => {
            if (this.isGameMode && e.code === 'Space') {
                e.preventDefault();
                this.game.handleInput();
            }
        });

        // Speed Slider
        if (this.gameSpeedSlider) {
            this.gameSpeedSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.seq.noteSpeed = val;
                this.seq.updateScheduleAheadTime();
                if (this.gameSpeedVal) this.gameSpeedVal.innerText = val.toFixed(1);
            });
        }

        // Hit Criteria
        if (this.hitCriteriaSelect) {
            this.hitCriteriaSelect.addEventListener('change', (e) => {
                this.game.hitCriteria = e.target.value;
            });
        }

        // Playback Mode
        if (this.playbackModeSelect) {
            this.playbackModeSelect.addEventListener('change', (e) => {
                this.seq.playbackMode = e.target.value;
            });
        }

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
                let trackIndex = -1;
                let beatIndex = -1;
                let stepIndex = -1;

                if (btn) {
                    barIndex = parseInt(btn.dataset.bar);
                    trackIndex = parseInt(btn.dataset.track);
                    beatIndex = parseInt(btn.dataset.beat);
                    stepIndex = parseInt(btn.dataset.step);

                    this.ctxDelBtn.classList.remove('disabled');
                    this.ctxDelBtn.innerText = `指定のステップ${stepIndex + 1}を削除`;
                    this.ctxAddBtn.innerText = `指定のステップ${stepIndex + 1}の右隣にステップを追加`;
                    this.ctxAddBarBtn.innerText = `Bar${barIndex + 1}全体のステップ${stepIndex + 1}の右隣にステップを追加`;
                    this.ctxDelBarBtn.innerText = `Bar${barIndex + 1}全体のステップ${stepIndex + 1}を削除`;
                    this.ctxDelAllBtn.innerText = `列全体のステップ${stepIndex + 1}を削除`;
                    this.ctxDelGlobalBtn.innerText = `プロジェクト全体のSTEP${stepIndex + 1}を削除`;
                    this.ctxAddGlobalBtn.innerText = `プロジェクト全体のSTEP${stepIndex + 1}の右隣にステップを追加`;
                    this.ctxAddAllBtn.innerText = `列全体のSTEP${stepIndex + 1}の右隣にステップを追加`;

                    this.ctxSelStepBtn.innerText = `指定のステップ${stepIndex + 1}を選択`;
                    this.ctxSelColBtn.innerText = `列全体のステップ${stepIndex + 1}を選択`;
                    this.ctxSelAllBtn.innerText = `Bar${barIndex + 1}全体のステップ${stepIndex + 1}を選択`;
                    this.ctxUnselStepBtn.innerText = `指定のステップ${stepIndex + 1}を選択解除`;
                    this.ctxUnselColBtn.innerText = `列全体のステップ${stepIndex + 1}を選択解除`;
                    this.ctxUnselAllBtn.innerText = `Bar${barIndex + 1}全体のステップ${stepIndex + 1}を選択解除`;
                    this.ctxSelGlobalStepBtn.innerText = `プロジェクト全体のステップ${stepIndex + 1}を選択`;
                    this.ctxUnselGlobalStepBtn.innerText = `プロジェクト全体のステップ${stepIndex + 1}を選択解除`;

                    this.ctxDelAllBtn.classList.remove('disabled');
                    this.ctxDelBarBtn.classList.remove('disabled');
                    this.ctxDelGlobalBtn.classList.remove('disabled');
                    this.ctxAddGlobalBtn.classList.remove('disabled');
                    this.ctxSelStepBtn.classList.remove('disabled');
                    this.ctxSelColBtn.classList.remove('disabled');
                    this.ctxSelAllBtn.classList.remove('disabled');
                    this.ctxUnselStepBtn.classList.remove('disabled');
                    this.ctxUnselColBtn.classList.remove('disabled');
                    this.ctxUnselAllBtn.classList.remove('disabled');
                    this.ctxSelGlobalStepBtn.classList.remove('disabled');
                    this.ctxUnselGlobalStepBtn.classList.remove('disabled');
                } else if (beatCell) {
                    // Try to find first button to get metadata
                    const firstBtn = beatCell.querySelector('.step-btn');
                    if (firstBtn) {
                        barIndex = parseInt(firstBtn.dataset.bar);
                        beatIndex = parseInt(firstBtn.dataset.beat);
                    }
                    stepIndex = -1;
                    trackIndex = -1;
                    this.ctxDelBtn.classList.add('disabled');
                    this.ctxDelBtn.innerText = "選択箇所を削除";
                    this.ctxAddBtn.innerText = "指定のステップの右隣に追加";
                    this.ctxAddBarBtn.innerText = `Bar${barIndex + 1}全体のステップの右隣にステップを追加`;
                    this.ctxDelBarBtn.innerText = `Bar${barIndex + 1}全体のステップを削除`;
                    this.ctxDelAllBtn.innerText = "列全体の指定ステップを削除";
                    this.ctxDelGlobalBtn.innerText = "全ての拍の同位置を削除";
                    this.ctxAddGlobalBtn.innerText = "全ての拍の末尾にステップを追加";
                    this.ctxAddAllBtn.innerText = "列全体にステップを右隣に追加";

                    this.ctxSelStepBtn.innerText = "指定のステップを選択";
                    this.ctxSelColBtn.innerText = "列全体のステップを選択";
                    this.ctxSelAllBtn.innerText = "Bar全体のステップを選択";
                    this.ctxUnselStepBtn.innerText = "指定のステップを選択解除";
                    this.ctxUnselColBtn.innerText = "列全体のステップを選択解除";
                    this.ctxUnselAllBtn.innerText = "Bar全体のステップを選択解除";
                    this.ctxSelGlobalStepBtn.innerText = "プロジェクト全体のステップを選択";
                    this.ctxUnselGlobalStepBtn.innerText = "プロジェクト全体のステップを選択解除";

                    this.ctxDelAllBtn.classList.add('disabled');
                    this.ctxDelBarBtn.classList.add('disabled');
                    this.ctxDelGlobalBtn.classList.add('disabled');
                    this.ctxAddGlobalBtn.classList.remove('disabled');
                    this.ctxSelStepBtn.classList.add('disabled');
                    this.ctxSelColBtn.classList.add('disabled');
                    this.ctxSelAllBtn.classList.add('disabled');
                    this.ctxUnselStepBtn.classList.add('disabled');
                    this.ctxUnselColBtn.classList.add('disabled');
                    this.ctxUnselAllBtn.classList.add('disabled');
                    this.ctxSelGlobalStepBtn.classList.add('disabled');
                    this.ctxUnselGlobalStepBtn.classList.add('disabled');
                }

                this.ctxTarget = { bar: barIndex, track: trackIndex, beat: beatIndex, step: stepIndex };

                // Show first to get dimensions
                this.ctxMenu.classList.remove('hidden');
                const menuWidth = this.ctxMenu.offsetWidth;
                const menuHeight = this.ctxMenu.offsetHeight;

                let posX = e.clientX;
                let posY = e.clientY;

                // Adjust if overflowing viewport
                if (posX + menuWidth > window.innerWidth) {
                    posX = window.innerWidth - menuWidth - 10;
                }
                if (posY + menuHeight > window.innerHeight) {
                    posY = window.innerHeight - menuHeight - 10;
                }

                // Ensure not negative
                posX = Math.max(10, posX);
                posY = Math.max(10, posY);

                this.ctxMenu.style.left = `${posX}px`;
                this.ctxMenu.style.top = `${posY}px`;
            }
        });

        this.ctxAddBtn.addEventListener('click', () => {
            const t = this.ctxTarget;
            console.log("UI: Add Step Clicked", t);
            // Allow stepIndex -1 if we want to support adding to the end of a beatCell click
            if (t.bar !== -1 && t.beat !== -1) {
                this.seq.insertStep(t.bar, t.beat, t.step);
                this.renderGrid();
            }
            this.ctxMenu.classList.add('hidden');
        });

        this.ctxAddBarBtn.addEventListener('click', () => {
            const t = this.ctxTarget;
            console.log("UI: Add Step Bar Clicked", t);
            if (t.bar !== -1) {
                this.seq.insertStepBar(t.bar, t.step);
                this.renderGrid();
            }
            this.ctxMenu.classList.add('hidden');
        });

        this.ctxAddAllBtn.addEventListener('click', () => {
            const t = this.ctxTarget;
            console.log("UI: Add Step All Clicked", t);
            if (t.beat !== -1) {
                this.seq.insertStepAllBars(t.beat, t.step);
                this.renderGrid();
            }
            this.ctxMenu.classList.add('hidden');
        });

        this.ctxAddGlobalBtn.addEventListener('click', () => {
            const t = this.ctxTarget;
            console.log("UI: Add Step Global Clicked", t);
            this.seq.insertStepGlobal(t.step);
            this.renderGrid();
            this.ctxMenu.classList.add('hidden');
        });

        this.ctxDelBtn.addEventListener('click', () => {
            const t = this.ctxTarget;
            console.log("UI: Del Step Clicked", t);
            if (t.bar !== -1 && t.beat !== -1 && t.step !== -1) {
                this.seq.removeStep(t.bar, t.beat, t.step);
                this.renderGrid();
            }
            this.ctxMenu.classList.add('hidden');
        });

        this.ctxDelAllBtn.addEventListener('click', () => {
            const t = this.ctxTarget;
            console.log("UI: Del Step All Clicked", t);
            if (t.beat !== -1 && t.step !== -1) {
                this.seq.removeStepAllBars(t.beat, t.step);
                this.renderGrid();
            }
            this.ctxMenu.classList.add('hidden');
        });

        this.ctxDelBarBtn.addEventListener('click', () => {
            const t = this.ctxTarget;
            console.log("UI: Del Step Bar Clicked", t);
            if (t.bar !== -1 && t.step !== -1) {
                this.seq.removeStepBar(t.bar, t.step);
                this.renderGrid();
            }
            this.ctxMenu.classList.add('hidden');
        });

        this.ctxDelGlobalBtn.addEventListener('click', () => {
            const t = this.ctxTarget;
            console.log("UI: Del Step Global Clicked", t);
            if (t.step !== -1) {
                this.seq.removeStepGlobal(t.step);
                this.renderGrid();
            }
            this.ctxMenu.classList.add('hidden');
        });

        // New Selection Helpers
        const setupSelItem = (id, action, state) => {
            document.getElementById(id).addEventListener('click', () => {
                const t = this.ctxTarget;
                if (action === 'step' && t.bar !== -1 && t.track !== -1 && t.beat !== -1 && t.step !== -1) {
                    this.seq.setStepState(t.bar, t.track, t.beat, t.step, state);
                } else if (action === 'col' && t.beat !== -1 && t.step !== -1) {
                    // "Whole column" selection should be global across bars to match other column actions
                    this.seq.setColumnAllBarsState(t.beat, t.step, state);
                } else if (action === 'all' && t.bar !== -1 && t.step !== -1) {
                    // "Whole Bar Step" selection (locally labeled 'all') should target the current bar's specific step
                    this.seq.setBarStepState(t.bar, t.step, state);
                } else if (action === 'global-step' && t.step !== -1) {
                    this.seq.setGlobalStepState(t.step, state);
                } else if (action === 'all' && t.bar !== -1) {
                    // Fallback to older Bar Selection if for some reason step is -1
                    this.seq.setBarState(t.bar, state);
                }
                this.renderGrid();
                this.ctxMenu.classList.add('hidden');
            });
        };

        setupSelItem('ctx-sel-step', 'step', true);
        setupSelItem('ctx-sel-col', 'col', true);
        setupSelItem('ctx-sel-all', 'all', true);
        setupSelItem('ctx-sel-global', 'global-step', true);
        setupSelItem('ctx-unsel-step', 'step', false);
        setupSelItem('ctx-unsel-col', 'col', false);
        setupSelItem('ctx-unsel-all', 'all', false);
        setupSelItem('ctx-unsel-global', 'global-step', false);
    }

    renderGrid() {
        this.grid.innerHTML = '';
        this.grid.className = 'sequencer-grid';

        // Render each BAR as a system
        this.seq.bars.forEach((bar, barIndex) => {

            // Container for this Bar
            const systemContainer = document.createElement('div');
            systemContainer.className = 'system-container';
            // Added 30px column at the end for the + button
            systemContainer.style.gridTemplateColumns = `170px repeat(${bar.beats.length}, auto) 30px`;

            // Delete Bar Button
            const barDelBtn = document.createElement('button');
            barDelBtn.innerText = '×';
            barDelBtn.className = 'bar-del-btn';
            barDelBtn.title = 'Delete Bar';
            barDelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.seq.removeBar(barIndex);
                this.renderGrid();
            });
            systemContainer.appendChild(barDelBtn);

            // 1. Header (Subdivision)
            const emptyHeader = document.createElement('div');
            emptyHeader.className = 'grid-row-label';
            emptyHeader.style.color = '#8b9bb4';
            emptyHeader.style.fontSize = '0.9rem';
            emptyHeader.style.paddingLeft = '5px';
            emptyHeader.style.display = 'flex';
            emptyHeader.style.alignItems = 'center';
            emptyHeader.style.gap = '5px';

            const labelSpan = document.createElement('span');
            labelSpan.innerText = `Bar ${barIndex + 1}`;
            emptyHeader.appendChild(labelSpan);

            systemContainer.appendChild(emptyHeader);

            bar.beats.forEach((beat, bIndex) => {
                const beatHeader = document.createElement('div');
                beatHeader.className = 'beat-header';

                // DRAG AND DROP
                beatHeader.draggable = true;
                beatHeader.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', JSON.stringify({
                        barIndex: barIndex,
                        beatIndex: bIndex
                    }));
                    e.dataTransfer.effectAllowed = 'move';
                    beatHeader.classList.add('dragging');
                });

                beatHeader.addEventListener('dragend', () => {
                    beatHeader.classList.remove('dragging');
                    document.querySelectorAll('.beat-header').forEach(el => el.classList.remove('drag-over'));
                });

                beatHeader.addEventListener('dragover', (e) => {
                    e.preventDefault(); // Essential to allow drop
                    e.dataTransfer.dropEffect = 'move';
                    beatHeader.classList.add('drag-over');
                });

                beatHeader.addEventListener('dragleave', () => {
                    beatHeader.classList.remove('drag-over');
                });

                beatHeader.addEventListener('drop', (e) => {
                    e.preventDefault();
                    beatHeader.classList.remove('drag-over');
                    const dataStr = e.dataTransfer.getData('text/plain');
                    if (!dataStr) return;

                    try {
                        const data = JSON.parse(dataStr);
                        // Ensure drag is within same bar (simplification)
                        if (data.barIndex === barIndex && data.beatIndex !== bIndex) {
                            this.seq.moveBeat(barIndex, data.beatIndex, bIndex);
                            this.renderGrid();
                        }
                    } catch (err) {
                        console.error("Drop Parse Error", err);
                    }
                });

                // End DnD

                const ctrlContainer = document.createElement('div');
                ctrlContainer.className = 'beat-subdiv-ctrl';

                // Minus Btn
                const minusBtn = document.createElement('button');
                minusBtn.innerText = '-';
                minusBtn.className = 'subdiv-btn';
                minusBtn.addEventListener('click', () => {
                    const newSubdiv = Math.max(1, beat.subdivision - 1);
                    this.seq.updateBeatSubdivision(barIndex, bIndex, newSubdiv);
                    this.renderGrid();
                });

                // Value Display
                const display = document.createElement('span');
                display.innerText = beat.subdivision;
                display.className = 'subdiv-val';

                // Plus Btn
                const plusBtn = document.createElement('button');
                plusBtn.innerText = '+';
                plusBtn.className = 'subdiv-btn';
                plusBtn.addEventListener('click', () => {
                    this.seq.updateBeatSubdivision(barIndex, bIndex, beat.subdivision + 1);
                    this.renderGrid();
                });

                ctrlContainer.appendChild(minusBtn);
                ctrlContainer.appendChild(display);
                ctrlContainer.appendChild(plusBtn);

                beatHeader.appendChild(ctrlContainer);

                // Delete Beat Button (x)
                const delBeatBtn = document.createElement('button');
                delBeatBtn.innerText = '×';
                delBeatBtn.className = 'beat-del-btn';
                delBeatBtn.title = 'Delete Beat';
                delBeatBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.seq.removeBeatAt(barIndex, bIndex);
                    this.renderGrid();
                });
                beatHeader.appendChild(delBeatBtn);
                systemContainer.appendChild(beatHeader);
            });

            // Add Beat Button (Right Column, Header Row)
            const addBeatRightBtn = document.createElement('button');
            addBeatRightBtn.innerText = '+';
            addBeatRightBtn.className = 'add-beat-col-btn';
            addBeatRightBtn.title = 'Add Beat';
            addBeatRightBtn.style.gridRow = `1 / span ${1 + bar.tracks.length}`;
            addBeatRightBtn.style.gridColumn = `${bar.beats.length + 2}`;
            addBeatRightBtn.addEventListener('click', () => {
                this.seq.addBeat(barIndex);
                this.renderGrid();
            });
            systemContainer.appendChild(addBeatRightBtn);

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
                delBtn.innerText = '×';
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
                    beatCell.style.gridTemplateColumns = `repeat(${beat.subdivision}, 48px)`;
                    beatCell.style.gap = '4px';

                    for (let s = 0; s < beat.subdivision; s++) {
                        const btn = document.createElement('div');
                        btn.className = `step-btn ${track.type}`;
                        if (track.pattern[bIndex] && track.pattern[bIndex][s]) {
                            btn.classList.add('active');
                        }

                        // ID for highlighting (Need bar/beat/step)
                        btn.dataset.bar = barIndex;
                        btn.dataset.track = tIndex;
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

            // 3. Footer row: Subdivision Values
            const valLabel = document.createElement('div');
            valLabel.className = 'grid-row-label step-value-label';
            valLabel.innerText = 'Step Value';
            systemContainer.appendChild(valLabel);

            bar.beats.forEach((beat) => {
                const valCell = document.createElement('div');
                valCell.className = 'beat-value-display';

                // Logic: 
                // 1. Show full decimal if it's terminating (only 2 and 5 as factors of denominator)
                // 2. Show 2 decimals + "..." if it's repeating
                const subdiv = beat.subdivision;
                const val = 1 / subdiv;
                let n = subdiv;
                while (n > 0 && n % 2 === 0) n /= 2;
                while (n > 0 && n % 5 === 0) n /= 5;

                if (n === 1) {
                    valCell.innerText = val.toString();
                } else {
                    // Truncate to 2 decimals without rounding (e.g., 0.166... -> 0.16...)
                    const truncated = Math.floor(val * 100) / 100;
                    valCell.innerText = truncated.toFixed(2) + "...";
                }

                systemContainer.appendChild(valCell);
            });

            // 3. Add Track Button INSIDE the Bar (Last Row of Grid or separate?)
            // We can append it to the label column of a new row, or just append a div to the container?
            // If we append to container, it becomes a grid item.
            // We want it to span full width?
            // Grid columns: 1 (170px) + N (beats)
            // Let's make it span 1 (label) and let beats be empty?
            // Or make it span all.
            const addTrackContainer = document.createElement('div');
            addTrackContainer.style.gridColumn = '1 / 2'; // Span only first column (Label column)
            addTrackContainer.style.paddingTop = '5px';
            addTrackContainer.style.display = 'flex';
            addTrackContainer.style.justifyContent = 'flex-start';

            const addTrackBtn = document.createElement('button');
            addTrackBtn.innerText = '+ Track';
            addTrackBtn.className = 'action-btn';
            addTrackBtn.style.fontSize = '0.8rem';
            addTrackBtn.style.padding = '5px 10px';
            addTrackBtn.style.marginTop = '0'; // Override generic
            addTrackBtn.addEventListener('click', () => {
                this.seq.addTrack(barIndex); // Defaults to metronome
                this.renderGrid();
            });

            addTrackContainer.appendChild(addTrackBtn);
            systemContainer.appendChild(addTrackContainer);


            this.grid.appendChild(systemContainer);
        });

        // 4. Global Action (Add Bar)
        const actionContainer = document.createElement('div');
        actionContainer.style.width = '100%';
        actionContainer.style.textAlign = 'center';
        actionContainer.style.padding = '2px 20px';
        actionContainer.style.display = 'flex';
        actionContainer.style.gap = '10px';
        actionContainer.style.justifyContent = 'center';

        const addBarBtn = document.createElement('button');
        addBarBtn.innerText = '+ Bar';
        addBarBtn.className = 'action-btn';
        addBarBtn.style.fontSize = '0.8rem';
        addBarBtn.style.padding = '5px 10px';
        // Removed inline background to use class style
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
        if (isPlaying) {
            this.playBtn.innerHTML = '<span style="font-family: monospace; font-size: 1.2rem; font-weight: 800; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px;">||</span>';
        } else {
            this.playBtn.innerHTML = `
                <svg viewBox="0 0 24 24" class="control-svg">
                    <path d="M8 5v14l11-7z" fill="currentColor" />
                </svg>`;
        }
        this.playBtn.classList.toggle('isPlaying', isPlaying);
    }
}

// Global instances
const audio = new AudioEngine();
const sequencer = new Sequencer(audio);
let ui;

document.addEventListener('DOMContentLoaded', () => {
    ui = new UI(sequencer);
});
