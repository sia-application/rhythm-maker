/**
 * Rhythm Maker PRO App
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
        const volEl = document.getElementById('config-master-vol');
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
        if (type === 'sine') {
            osc.frequency.exponentialRampToValueAtTime(0.01, time + decay);
        }

        gain.gain.setValueAtTime(0.001, time);
        gain.gain.exponentialRampToValueAtTime(volume, time + 0.002); // Quick fade-in to avoid snap
        gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

        osc.connect(gain);
        gain.connect(this.masterGain);

        const nodeEntry = { source: osc, gain: gain };
        this.activeNodes.add(nodeEntry);
        osc.onended = () => this.activeNodes.delete(nodeEntry);

        osc.start(time);
        osc.stop(time + decay);
    }

    playNoise(time, decay, volume = 1.0) {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * decay;
        const buffer = this.ctx.createBuffer(1, Math.max(1, bufferSize), this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < buffer.length; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1000;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, time);
        gain.gain.exponentialRampToValueAtTime(volume, time + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        const nodeEntry = { source: noise, gain: gain };
        this.activeNodes.add(nodeEntry);
        noise.onended = () => this.activeNodes.delete(nodeEntry);

        noise.start(time);
        noise.stop(time + decay);
    }

    stopAll() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // Copy to array to safely iterate during deletion
        const nodes = Array.from(this.activeNodes);
        nodes.forEach(node => {
            try {
                node.gain.gain.cancelScheduledValues(now);
                node.gain.gain.setValueAtTime(node.gain.gain.value, now);
                // 5ms fast but smooth fade using setTargetAtTime
                node.gain.gain.setTargetAtTime(0, now, 0.0015);
                node.source.stop(now + 0.01);
            } catch (e) { }
        });
        this.activeNodes.clear();

        if (this.masterGain) {
            this.masterGain.gain.cancelScheduledValues(now);
            this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
            this.masterGain.gain.setTargetAtTime(0, now, 0.0015);
        }
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

        // Visual/Audio sync indices (marks the note actually being heard)
        this.playingBarIndex = 0;
        this.playingBeatIndex = 0;
        this.playingStepInBeat = 0;

        this.nextNoteTime = 0;
        this.lookahead = 25.0; // ms
        this.noteSpeed = 1.0; // Default speed
        this.playbackMode = 'stop'; // 'loop' or 'stop'
        this.updateScheduleAheadTime();
        this.timerID = null;
        this.scheduledTimeouts = []; // Track UI and note timeouts
        this.isEndOfProject = false; // Internal flag for 'stop' mode

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
        if (barIndex < 0 || barIndex >= this.bars.length) return;
        this.bars.splice(barIndex, 1);

        // Adjust current Bar index if needed
        if (this.currentBarIndex >= this.bars.length) {
            this.currentBarIndex = Math.max(0, this.bars.length - 1);
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

            // Auto-delete Bar if no tracks left
            if (bar.tracks.length === 0) {
                this.removeBar(barIndex);
            }
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

    toggleStepNoGame(barIndex, trackIndex, beatIndex, stepIndex) {
        if (this.bars[barIndex] && this.bars[barIndex].tracks[trackIndex]) {
            const pattern = this.bars[barIndex].tracks[trackIndex].pattern;
            if (pattern[beatIndex]) {
                const current = pattern[beatIndex][stepIndex];
                // Toggle between false and 'nogame'
                if (current === 'nogame') {
                    pattern[beatIndex][stepIndex] = false;
                } else {
                    pattern[beatIndex][stepIndex] = 'nogame';
                }
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

    // Track-specific selection methods
    // These methods only affect the specified track (by trackIndex within the bar)

    /**
     * Set state for all steps in a column for a specific track across all bars
     * Column > Track: Selects/unselects the track's column in all bars
     */
    setColumnTrackState(barIndex, trackIndex, beatIndex, stepIndex, state) {
        console.log(`[Sequencer] setColumnTrackState: Bar ${barIndex}, Track ${trackIndex}, Beat ${beatIndex}, Step ${stepIndex}, State ${state}`);
        const sourceTrack = this.bars[barIndex]?.tracks[trackIndex];
        if (!sourceTrack) return;

        // Apply to the same track index across all bars
        this.bars.forEach(bar => {
            const track = bar.tracks[trackIndex];
            if (track && beatIndex < bar.beats.length) {
                if (track.pattern[beatIndex] && stepIndex < track.pattern[beatIndex].length) {
                    track.pattern[beatIndex][stepIndex] = state;
                }
            }
        });
    }

    /**
     * Set state for all steps of a specific track within a bar
     * Bar > Track: Selects/unselects all steps of the track in the current bar
     */
    setBarTrackState(barIndex, trackIndex, stepIndex, state) {
        console.log(`[Sequencer] setBarTrackState: Bar ${barIndex}, Track ${trackIndex}, Step ${stepIndex}, State ${state}`);
        const bar = this.bars[barIndex];
        if (!bar) return;

        const track = bar.tracks[trackIndex];
        if (!track) return;

        bar.beats.forEach((beat, beatIndex) => {
            if (track.pattern[beatIndex] && stepIndex < track.pattern[beatIndex].length) {
                track.pattern[beatIndex][stepIndex] = state;
            }
        });
    }

    /**
     * Set state for all steps of a specific track across the entire project
     * Project > Track: Selects/unselects all steps of the track in all bars
     */
    setProjectTrackState(barIndex, trackIndex, stepIndex, state) {
        console.log(`[Sequencer] setProjectTrackState: Source Bar ${barIndex}, Track ${trackIndex}, Step ${stepIndex}, State ${state}`);

        // Apply to the same track index across all bars
        this.bars.forEach(bar => {
            const track = bar.tracks[trackIndex];
            if (track) {
                bar.beats.forEach((beat, beatIndex) => {
                    if (track.pattern[beatIndex] && stepIndex < track.pattern[beatIndex].length) {
                        track.pattern[beatIndex][stepIndex] = state;
                    }
                });
            }
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

        // Fail-safe: if bar or beat doesn't exist, reset and advance time to avoid infinite loop
        if (!currentBar || !currentBar.beats[this.currentBeatIndex]) {
            this.currentBarIndex = 0;
            this.currentBeatIndex = 0;
            this.currentStepInBeat = 0;
            this.nextNoteTime += secondsPerBeat; // Advance by 1 beat
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
                    // End of Project reached
                    if (this.playbackMode === 'stop') {
                        this.isEndOfProject = true; // Stop scheduling new bars

                        // CLEAR HIGHLIGHTS: Schedule visual cleanup for the exact end of the last step
                        const now = this.audio.ctx.currentTime;
                        const clearTime = (this.nextNoteTime - now) * 1000;
                        const clearTid = setTimeout(() => {
                            if (typeof ui !== 'undefined' && ui && this.isEndOfProject && this.isPlaying) {
                                ui.clearHighlights();
                            }
                        }, Math.max(0, clearTime));
                        this.scheduledTimeouts.push(clearTid);

                        // FINAL STOP: Trigger the UI reset and real STOP shortly after the last note ends
                        const finalStopDelay = ((this.nextNoteTime - now) + 0.1) * 1000;
                        const finalStopId = setTimeout(() => {
                            if (this.isEndOfProject && this.isPlaying) {
                                this.stop();
                            }
                        }, Math.max(0, finalStopDelay));
                        this.scheduledTimeouts.push(finalStopId);

                        // Position will be reset when stop() is called
                        return;
                    }
                    // Loop Sequence
                    this.currentBarIndex = 0;
                    this.currentBeatIndex = 0;
                    this.currentStepInBeat = 0;
                }
            }
        }

        // --- ADAPTIVE INDEX GUARD ---
        // Ensure indices are strictly within bounds of the target bar
        const targetBar = this.bars[this.currentBarIndex];
        if (targetBar) {
            if (this.currentBeatIndex >= targetBar.beats.length) {
                this.currentBeatIndex = 0;
                this.currentStepInBeat = 0;
            }
            const targetBeat = targetBar.beats[this.currentBeatIndex];
            if (targetBeat && this.currentStepInBeat >= targetBeat.subdivision) {
                this.currentStepInBeat = 0;
            }
        }
    }

    scheduleNote(barIndex, beatIndex, stepInBeat, time) {
        const bar = this.bars[barIndex];
        if (!bar) return;

        const now = this.audio.ctx.currentTime;

        bar.tracks.forEach((track, tIndex) => {
            if (track.pattern[beatIndex] && track.pattern[beatIndex][stepInBeat]) {
                // DEFERRED SCHEDULING: 
                // Don't create AudioNodes until 150ms before playback.
                // This keeps the AudioContext resource light and prevents memory noise.
                const audioDelay = (time - 0.15 - now) * 1000;
                const aid = setTimeout(() => {
                    if (this.isPlaying) {
                        this.audio.playInstrument(track.type, time);
                    }
                }, Math.max(0, audioDelay));
                this.scheduledTimeouts.push(aid);

                // Trigger Game Note (Lead-time unchanged so visuals work)
                // SPEC: 'nogame' notes play sound but don't show up in game mode
                if (track.pattern[beatIndex][stepInBeat] !== 'nogame' && this.onNoteTrigger) {
                    const travelTime = 2.0 / this.noteSpeed;
                    const spawnDelay = (time - travelTime - now) * 1000;
                    const tid = setTimeout(() => {
                        if (this.isPlaying) {
                            this.onNoteTrigger(barIndex, tIndex, time);
                        }
                    }, spawnDelay);
                    this.scheduledTimeouts.push(tid);
                }
            }
        });

        // Update UI
        const drawTime = (time - now) * 1000;
        const tid2 = setTimeout(() => {
            if (this.isPlaying) {
                ui.highlightStep(barIndex, beatIndex, stepInBeat);
                this.playingBarIndex = barIndex;
                this.playingBeatIndex = beatIndex;
                this.playingStepInBeat = stepInBeat;
            }
        }, Math.max(0, drawTime));
        this.scheduledTimeouts.push(tid2);
    }

    clearScheduledTimeouts() {
        this.scheduledTimeouts.forEach(tid => clearTimeout(tid));
        this.scheduledTimeouts = [];
    }

    scheduler() {
        if (!this.isPlaying) return;
        // Only schedule if we haven't reached the end in stop mode
        while (!this.isEndOfProject && this.nextNoteTime < this.audio.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.currentBarIndex, this.currentBeatIndex, this.currentStepInBeat, this.nextNoteTime);
            this.nextNote();
            if (!this.isPlaying) return;
        }
        this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
    }

    play() {
        if (!this.audio.isInitialized) this.audio.init();

        if (this.isPlaying) {
            // PAUSE
            this.isPlaying = false;
            this.isEndOfProject = false; // Ensure we don't accidentally treat this as "finished"
            clearTimeout(this.timerID);
            this.clearScheduledTimeouts();

            // Fade out audio smoothly
            this.audio.stopAll();

            if (typeof ui !== 'undefined' && ui) {
                ui.clearHighlights();
                if (ui.game) ui.game.clearActiveNotes();
                ui.updatePlayButton(false);
            }

            // RESTORE VOLUME for ad-hoc clicks
            const targetVol = (typeof ui !== 'undefined' && ui && ui.configMasterVol) ? parseFloat(ui.configMasterVol.value) : 0.5;
            this.audio.masterGain.gain.setTargetAtTime(targetVol, this.audio.ctx.currentTime + 0.05, 0.02);
        } else {
            // PLAY or RESUME

            // Detect if we are at the very last step of the project
            const lastBarIndex = this.bars.length - 1;
            const lastBar = this.bars[lastBarIndex];
            const lastBeatIndex = lastBar ? lastBar.beats.length - 1 : 0;
            const lastBeat = lastBar ? lastBar.beats[lastBeatIndex] : null;
            const lastStepIndex = lastBeat ? lastBeat.subdivision - 1 : 0;
            const isAtVeryEnd = (this.playingBarIndex >= lastBarIndex &&
                this.playingBeatIndex >= lastBeatIndex &&
                this.playingStepInBeat >= lastStepIndex);

            // If we finished a song or are at the last tile, reset to beginning first
            if (this.isEndOfProject || isAtVeryEnd) {
                this.stop();
            }

            // Resume from last heard position
            this.currentBarIndex = this.playingBarIndex;
            this.currentBeatIndex = this.playingBeatIndex;
            this.currentStepInBeat = this.playingStepInBeat;
            this.isEndOfProject = false;

            if (typeof ui !== 'undefined' && ui && ui.isGameMode) {
                const countdownDuration = (60 / this.bpm) * 4;
                const startTime = this.audio.ctx.currentTime + 0.1;

                if (this.currentBarIndex === 0 && this.currentBeatIndex === 0 && this.currentStepInBeat === 0) {
                    ui.game.resetStats();
                }
                this.startPlayback(countdownDuration, startTime);
                ui.startCountdown(this.bpm, startTime);
            } else {
                this.startPlayback(0);
            }
        }
    }

    startPlayback(delay = 0, baseTime = null) {
        if (this.isPlaying) return; // Guard
        this.isPlaying = true;
        const now = this.audio.ctx.currentTime;
        const refTime = baseTime !== null ? baseTime : now;

        // If delay is 0 (direct play) and no baseTime, add a tiny 0.1s buffer
        const startTime = (delay === 0 && baseTime === null) ? (now + 0.1) : (refTime + delay);

        // Re-activate master gain if it was ramped down
        this.audio.masterGain.gain.cancelScheduledValues(now);
        const targetVol = ui.configMasterVol ? parseFloat(ui.configMasterVol.value) : 0.5;

        if (delay > 0) {
            // Ensure volume is UP immediately so we can hear the countdown blips
            this.audio.masterGain.gain.setValueAtTime(0.001, now);
            this.audio.masterGain.gain.exponentialRampToValueAtTime(targetVol, now + 0.05);
        } else {
            this.audio.masterGain.gain.setValueAtTime(0.001, now);
            this.audio.masterGain.gain.exponentialRampToValueAtTime(targetVol, now + 0.01);
        }

        this.nextNoteTime = startTime;
        this.isEndOfProject = false; // Reset for new play session

        // --- RESUME INDEX GUARD ---
        // If in stop mode and we reached the end previously, reset to start
        if (this.playbackMode === 'stop' && (this.currentBarIndex >= this.bars.length || this.currentBarIndex < 0)) {
            this.currentBarIndex = 0;
            this.currentBeatIndex = 0;
            this.currentStepInBeat = 0;
        }
        // Handles both -1 (from removeBar) and out of bounds
        else if (this.currentBarIndex < 0 || this.currentBarIndex >= this.bars.length) {
            this.currentBarIndex = 0;
            this.currentBeatIndex = 0;
            this.currentStepInBeat = 0;
        } else {
            const bar = this.bars[this.currentBarIndex];
            if (this.currentBeatIndex >= bar.beats.length) {
                this.currentBeatIndex = 0;
                this.currentStepInBeat = 0;
            } else {
                const beat = bar.beats[this.currentBeatIndex];
                if (this.currentStepInBeat >= beat.subdivision) {
                    this.currentStepInBeat = 0;
                }
            }
        }

        this.scheduler();
        ui.updatePlayButton(true);
    }

    stop() {
        this.isPlaying = false;
        this.isEndOfProject = false;
        clearTimeout(this.timerID);
        this.clearScheduledTimeouts();
        this.audio.stopAll();

        if (typeof ui !== 'undefined' && ui) {
            ui.clearHighlights();
            if (ui.game) ui.game.clearActiveNotes();
            ui.updatePlayButton(false);
        }

        // RESTORE VOLUME for ad-hoc clicks
        const targetVol = (typeof ui !== 'undefined' && ui && ui.configMasterVol) ? parseFloat(ui.configMasterVol.value) : 0.5;
        this.audio.masterGain.gain.setTargetAtTime(targetVol, this.audio.ctx.currentTime + 0.05, 0.02);

        // Hard reset all indices
        this.currentBarIndex = 0;
        this.currentBeatIndex = 0;
        this.currentStepInBeat = 0;
        this.playingBarIndex = 0;
        this.playingBeatIndex = 0;
        this.playingStepInBeat = 0;
    }

    updateSettings(bpm, timeSig) {
        this.bpm = bpm;

        if (this.timeSignature !== timeSig) {
            this.timeSignature = timeSig;
            // How to handle existing bars?
            // Resize all existing bars to new timeSig?
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

    // Serialize current state to JSON object
    serialize() {
        return {
            bpm: this.bpm,
            timeSignature: this.timeSignature,
            playbackMode: this.playbackMode,
            lastSelectedInstrument: this.lastSelectedInstrument,
            bars: this.bars.map(bar => ({
                beats: bar.beats.map(b => ({ subdivision: b.subdivision })),
                tracks: bar.tracks.map(track => ({
                    type: track.type,
                    volume: track.volume,
                    pattern: track.pattern.map(beatPattern => [...beatPattern])
                }))
            }))
        };
    }

    // Deserialize from JSON object
    deserialize(data) {
        if (!data) return;

        this.bpm = data.bpm || 120;
        this.timeSignature = data.timeSignature || 4;
        this.playbackMode = data.playbackMode || 'stop';
        this.lastSelectedInstrument = data.lastSelectedInstrument || 'metronome';

        this.bars = [];
        if (data.bars && Array.isArray(data.bars)) {
            data.bars.forEach((barData, barIndex) => {
                const bar = {
                    id: barIndex,
                    beats: barData.beats.map(b => ({ subdivision: b.subdivision })),
                    tracks: barData.tracks.map(trackData => ({
                        id: this.nextTrackId++,
                        type: trackData.type,
                        volume: trackData.volume || 1.0,
                        pattern: trackData.pattern.map(bp => [...bp])
                    }))
                };
                this.bars.push(bar);
            });
        }

        // Reset playback state
        this.currentBarIndex = 0;
        this.currentBeatIndex = 0;
        this.currentStepInBeat = 0;
    }
}

// Preset Manager for saving/loading rhythms
class PresetManager {
    constructor() {
        this.PRESETS_KEY = 'rhythmmaker_presets';
        this.FOLDERS_KEY = 'rhythmmaker_folders';
    }

    // Get all folders
    getFolders() {
        try {
            const data = localStorage.getItem(this.FOLDERS_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error loading folders:', e);
            return [];
        }
    }

    // Save folders
    saveFolders(folders) {
        try {
            localStorage.setItem(this.FOLDERS_KEY, JSON.stringify(folders));
        } catch (e) {
            console.error('Error saving folders:', e);
        }
    }

    // Create folder
    createFolder(name) {
        const folders = this.getFolders();
        const folder = {
            id: 'folder_' + Date.now(),
            name: name,
            createdAt: new Date().toISOString()
        };
        folders.push(folder);
        this.saveFolders(folders);
        return folder;
    }

    // Rename folder
    renameFolder(folderId, newName) {
        const folders = this.getFolders();
        const folder = folders.find(f => f.id === folderId);
        if (folder) {
            folder.name = newName;
            this.saveFolders(folders);
        }
    }

    // Delete folder (moves presets to root)
    deleteFolder(folderId) {
        const folders = this.getFolders();
        const index = folders.findIndex(f => f.id === folderId);
        if (index !== -1) {
            folders.splice(index, 1);
            this.saveFolders(folders);

            // Move presets in this folder to root
            const presets = this.getPresets();
            presets.forEach(p => {
                if (p.folderId === folderId) {
                    p.folderId = null;
                }
            });
            this.savePresets(presets);
        }
    }

    // Get all presets
    getPresets() {
        try {
            const data = localStorage.getItem(this.PRESETS_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error loading presets:', e);
            return [];
        }
    }

    // Save presets array
    savePresets(presets) {
        try {
            localStorage.setItem(this.PRESETS_KEY, JSON.stringify(presets));
        } catch (e) {
            console.error('Error saving presets:', e);
        }
    }

    // Save a new preset
    savePreset(name, folderId, sequencerData) {
        const presets = this.getPresets();
        const preset = {
            id: 'preset_' + Date.now(),
            name: name,
            folderId: folderId || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            data: sequencerData
        };
        presets.push(preset);
        this.savePresets(presets);
        return preset;
    }

    // Update an existing preset
    updatePreset(presetId, sequencerData) {
        const presets = this.getPresets();
        const preset = presets.find(p => p.id === presetId);
        if (preset) {
            preset.data = sequencerData;
            preset.updatedAt = new Date().toISOString();
            this.savePresets(presets);
        }
    }

    // Rename preset
    renamePreset(presetId, newName) {
        const presets = this.getPresets();
        const preset = presets.find(p => p.id === presetId);
        if (preset) {
            preset.name = newName;
            preset.updatedAt = new Date().toISOString();
            this.savePresets(presets);
        }
    }

    // Move preset to folder
    movePreset(presetId, folderId) {
        const presets = this.getPresets();
        const preset = presets.find(p => p.id === presetId);
        if (preset) {
            preset.folderId = folderId || null;
            preset.updatedAt = new Date().toISOString();
            this.savePresets(presets);
        }
    }

    // Delete preset
    deletePreset(presetId) {
        const presets = this.getPresets();
        const index = presets.findIndex(p => p.id === presetId);
        if (index !== -1) {
            presets.splice(index, 1);
            this.savePresets(presets);
        }
    }

    // Get preset by ID
    getPreset(presetId) {
        const presets = this.getPresets();
        return presets.find(p => p.id === presetId);
    }

    // Get presets by folder
    getPresetsByFolder(folderId) {
        const presets = this.getPresets();
        return presets.filter(p => p.folderId === folderId);
    }
}

class RhythmGame {
    constructor(sequencer) {
        this.seq = sequencer;
        this.score = 0;
        this.combo = 0;
        this.hitCount = 0;
        this.totalNotes = 0;
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
        this.hitCriteria = 'great'; // 'nice', 'great', or 'excellent'
        this.lastNoteTime = 0;
    }

    init() {
        this.container.innerHTML = '';
        this.lanes = [];
        this.score = 0;
        this.combo = 0;
        this.totalNotes = this.calculateTotalNotes();
        console.log("RhythmGame: Initializing...", this.seq.bars);
        this.updateUI();

        // Find maximum number of tracks across all bars
        let maxTracks = 0;
        this.seq.bars.forEach(bar => {
            if (bar.tracks.length > maxTracks) {
                maxTracks = bar.tracks.length;
            }
        });

        if (maxTracks === 0) {
            console.warn("RhythmGame: No tracks found in any bars");
        }

        // Create lanes based on maximum tracks
        for (let i = 0; i < maxTracks; i++) {
            const lane = document.createElement('div');
            lane.className = 'game-lane';
            lane.dataset.laneIndex = i;

            const flash = document.createElement('div');
            flash.className = 'lane-hit-flash';
            lane.appendChild(flash);

            this.container.appendChild(lane);
            this.lanes.push({ el: lane, flash: flash });
            this.laneMap[i] = i;
        }

        // Robust multi-touch handling on the container
        const handleTouch = (e) => {
            e.preventDefault();
            // Process ALL touches that started/moved/ended in this frame
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                // Find lane under touch
                const element = document.elementFromPoint(touch.clientX, touch.clientY);
                const laneEl = element?.closest('.game-lane');
                const laneIdx = laneEl ? parseInt(laneEl.dataset.laneIndex) : -1;
                this.handleInput(laneIdx, e.timeStamp);
            }
        };

        const handleMouse = (e) => {
            e.preventDefault();
            const laneEl = e.target.closest('.game-lane');
            const laneIdx = laneEl ? parseInt(laneEl.dataset.laneIndex) : -1;
            this.handleInput(laneIdx, performance.now());
        };

        this.container.addEventListener('touchstart', handleTouch, { passive: false });
        this.container.addEventListener('mousedown', handleMouse);

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
                        if (step === true) count++;
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
        if (!lane) return;

        const note = document.createElement('div');
        note.className = 'game-note';
        lane.el.appendChild(note);

        const travelTimeToLine = (2.0 / this.seq.noteSpeed) * 1000; // ms
        const now = performance.now();
        const audioNow = this.seq.audio.ctx.currentTime;

        // Calculate the total animation duration to make it hit the line at travelTimeToLine
        // Start: -20px, Line: laneHeight - 40px, End: 110% (1.1 * laneHeight)
        const laneHeight = this.container.offsetHeight || 500;
        const startPos = -20;
        const linePos = laneHeight - 40;
        const endPos = 1.1 * laneHeight;

        const distToLine = linePos - startPos;
        const totalDist = endPos - startPos;

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

    handleInput(laneIndex = -1, inputTime = null) {
        if (!this.isGameMode) return;

        const now = inputTime || performance.now();

        if (laneIndex !== -1) {
            // Specific lane hit
            let targetNote = null;
            let minDiff = Infinity;

            this.activeNotes.forEach(note => {
                if (note.judged || note.lane !== laneIndex) return;
                const diff = Math.abs(now - note.targetTime);
                if (diff < minDiff) {
                    minDiff = diff;
                    targetNote = note;
                }
            });

            if (targetNote && minDiff < 350) {
                this.judgeNote(targetNote, minDiff);
            }

            // Flash this lane
            const flash = this.lanes[laneIndex].flash;
            flash.classList.add('active');
            setTimeout(() => flash.classList.remove('active'), 100);
        } else {
            // Global hit (Space or generic tap)
            // Can hit multiple notes in different lanes if they are within time window
            let notesHit = 0;
            const handledLanes = new Set();

            // First, prioritize notes very close to the timing (chords)
            this.activeNotes.forEach(note => {
                if (note.judged) return;
                const diff = Math.abs(now - note.targetTime);
                if (diff < 150) { // Tight window for direct chord hits
                    if (!handledLanes.has(note.lane)) {
                        this.judgeNote(note, diff);
                        handledLanes.add(note.lane);
                        notesHit++;
                    }
                }
            });

            // If no notes hit in tight window, find the single closest one in wider window
            if (notesHit === 0) {
                let targetNote = null;
                let minDiff = Infinity;
                this.activeNotes.forEach(note => {
                    if (note.judged) return;
                    const diff = Math.abs(now - note.targetTime);
                    if (diff < minDiff) {
                        minDiff = diff;
                        targetNote = note;
                    }
                });
                if (targetNote && minDiff < 350) {
                    this.judgeNote(targetNote, minDiff);
                }
            }

            // Flash all lanes
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
            isHit = true;
        } else if (diff <= 100) {
            rating = 'GREAT';
            scoreAdd = 50;
            ratingClass = 'note-great';
            if (this.hitCriteria === 'nice' || this.hitCriteria === 'great') {
                isHit = true;
            }
        } else if (diff <= 150) {
            rating = 'NICE';
            scoreAdd = 20;
            ratingClass = 'note-nice';
            if (this.hitCriteria === 'nice') {
                isHit = true;
            }
        } else {
            rating = 'MISS';
            ratingClass = 'note-miss';
        }

        if (isHit) {
            this.hitCount++;
            this.combo++;
            if (this.totalNotes > 0 && this.hitCount > this.totalNotes) {
                this.hitCount = 0; // Reset to 0 as requested by user
            }
        } else {
            this.combo = 0;
        }

        this.score += scoreAdd;
        this.showJudgment(rating, ratingClass);
        this.updateUI();

        if (note.el && diff !== Infinity) {
            note.el.style.display = 'none';
            note.el.style.visibility = 'hidden';
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

        // Also clear any floating judgments
        const floats = this.container.querySelectorAll('.judgment-float');
        floats.forEach(el => el.remove());
        if (this.statusEl) {
            this.statusEl.innerText = '';
            this.statusEl.className = 'game-status';
        }
    }

    resetStats() {
        this.score = 0;
        this.combo = 0;
        this.hitCount = 0;
        this.updateUI();
        if (this.statusEl) {
            this.statusEl.innerText = '';
            this.statusEl.className = 'game-status';
        }
    }

    showJudgment(text, className) {
        const el = document.createElement('div');
        el.className = `judgment-float ${className}`;
        el.innerText = text;
        this.container.appendChild(el);
        setTimeout(() => el.remove(), 500);

        // Header status display is removed as per user request
        if (this.statusEl) {
            this.statusEl.innerText = text;
            this.statusEl.className = `game-status ${className}`;
        }
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
        this.playBtn = document.getElementById('play-btn');
        this.stepActionSelect = document.getElementById('step-action-select');

        this.longPressTimer = null;
        this.isLongPress = false;

        this.viewToggleBtn = document.getElementById('view-toggle-btn');
        this.sequencerView = document.getElementById('sequencer-view');
        this.gameView = document.getElementById('game-view');
        this.countdownOverlay = document.getElementById('countdown-overlay');
        this.countdownNumber = this.countdownOverlay.querySelector('.countdown-number');

        // Config Elements
        this.configBtn = document.getElementById('config-btn');
        this.configPanel = document.getElementById('config-panel');
        this.configOverlay = document.getElementById('config-overlay');
        this.configPanelClose = document.getElementById('config-panel-close');

        // Rhythm Config Linked Elements
        this.configBpmNumber = document.getElementById('config-bpm-number');
        this.configBpmInput = document.getElementById('config-bpm-input');
        this.configVolNumber = document.getElementById('config-vol-number');
        this.configMasterVol = document.getElementById('config-master-vol');

        // Config Selects
        this.configTimeSigSelect = document.getElementById('config-time-sig-select');
        this.configSubdivSelect = document.getElementById('config-subdiv-select');
        this.configPlaybackModeSelect = document.getElementById('config-playback-mode-select');
        this.configStepSoundSelect = document.getElementById('config-step-sound-select');
        this.configHitCriteriaSelect = document.getElementById('config-hit-criteria-select');

        // Config Buttons
        this.configResetBtn = document.getElementById('config-reset-btn');
        this.configResultResetBtn = document.getElementById('config-result-reset-btn');

        // Game Config Elements
        this.configGameSpeedSlider = document.getElementById('config-game-speed-slider');
        this.configGameSpeedVal = document.getElementById('config-game-speed-val');

        this.game = new RhythmGame(this.seq);
        this.isGameMode = false;
        this.stepSoundEnabled = true;

        this.ctxTarget = { bar: -1, beat: -1, step: -1 };

        // Preset Manager
        this.presetManager = new PresetManager();
        this.presetPanel = document.getElementById('preset-panel');
        this.presetOverlay = document.getElementById('preset-overlay');
        this.presetBtn = document.getElementById('preset-btn');
        this.presetPanelClose = document.getElementById('preset-panel-close');
        this.saveNewBtn = document.getElementById('save-new-btn');
        this.addFolderBtn = document.getElementById('add-folder-btn');
        this.folderForm = document.getElementById('folder-form');
        this.folderNameInput = document.getElementById('folder-name-input');
        this.folderCreateBtn = document.getElementById('folder-create-btn');
        this.folderCancelBtn = document.getElementById('folder-cancel-btn');
        this.folderList = document.getElementById('folder-list');
        this.presetList = document.getElementById('preset-list');
        this.saveDialog = document.getElementById('save-dialog');
        this.presetNameInput = document.getElementById('preset-name-input');
        this.presetFolderSelect = document.getElementById('preset-folder-select');
        this.saveCancelBtn = document.getElementById('save-cancel-btn');
        this.saveConfirmBtn = document.getElementById('save-confirm-btn');
        this.selectedFolderId = null; // Currently selected folder filter

        // Current Preset Info
        this.currentProjectDisplay = document.getElementById('current-project-name');
        this.currentPresetDisplay = document.getElementById('current-preset-name');

        // Share URL Elements
        this.generateUrlBtn = document.getElementById('generate-url-btn');
        this.shareUrlDisplay = document.getElementById('share-url-display');
        this.shareUrlInput = document.getElementById('share-url-input');
        this.copyUrlBtn = document.getElementById('copy-url-btn');

        this.setupListeners();
        this.setupPresetListeners();
        this.setupConfigListeners();
        this.setupShareUrlListeners();
        this.initializeConfigContents();
        this.loadFromUrlParams(); // Load from URL if params exist
        this.renderGrid();
        console.log("UI: Initialized successfully");
    }

    initializeConfigContents() {
        // Populate lists from Sequencer defaults or existing options
        this.configTimeSigSelect.innerHTML = `
            <option value="4">4/4</option>
            <option value="3">3/4</option>
        `;
        this.configSubdivSelect.innerHTML = `
            <option value="1">4分音符</option>
            <option value="2">8分音符</option>
            <option value="4" selected>16分音符</option>
            <option value="8">32分音符</option>
            <option value="16">64分音符</option>
            <option value="3">3連符</option>
            <option value="6">6連符</option>
            <option value="9">9連符</option>
            <option value="12">12連符</option>
        `;
        this.configPlaybackModeSelect.innerHTML = `
            <option value="stop" selected>Stop at End</option>
            <option value="loop">Loop</option>
        `;
        this.configStepSoundSelect.innerHTML = `
            <option value="sound" selected>Sound</option>
            <option value="mute">Mute</option>
        `;
        this.configHitCriteriaSelect.innerHTML = `
            <option value="nice">EXCELLENT+GREAT+NICE</option>
            <option value="great" selected>EXCELLENT+GREAT</option>
            <option value="excellent">EXCELLENT ONLY</option>
        `;

        // Set initial values
        this.configTimeSigSelect.value = this.seq.timeSignature;
        this.configPlaybackModeSelect.value = this.seq.playbackMode;
        this.configHitCriteriaSelect.value = this.game.hitCriteria;
    }

    startCountdown(bpm, baseTime = null) {
        if (!this.isGameMode) return;

        console.log("UI: Starting countdown at BPM:", bpm);
        this.countdownOverlay.classList.remove('hidden');
        const beatTime = 60 / bpm;
        this.countdownNumber.style.setProperty('--beat-time', `${beatTime}s`);

        const startTime = baseTime !== null ? baseTime : this.seq.audio.ctx.currentTime;
        const labels = ["3", "2", "1", "GO!"];
        let lastBeatIndex = -1;

        // Schedule countdown audio blips precisely
        for (let i = 0; i < 4; i++) {
            const isGo = (i === 3);
            this.seq.audio.playInstrument('metronome', startTime + i * beatTime, isGo ? 1.5 : 1.0);
        }

        const syncUI = () => {
            if (!this.seq || !this.seq.isPlaying) {
                this.countdownOverlay.classList.add('hidden');
                return;
            }

            const contextTime = this.seq.audio.ctx.currentTime;
            const elapsed = contextTime - startTime;

            // Refined epsilon: 20ms fixed offset for better "predetermined" appearance
            const currentBeatIndex = Math.floor((elapsed + 0.02) / beatTime);

            if (currentBeatIndex !== lastBeatIndex) {
                if (currentBeatIndex >= 0 && currentBeatIndex < 4) {
                    this.countdownNumber.innerText = labels[currentBeatIndex];
                    // Retrigger animation
                    this.countdownNumber.classList.remove('countdown-pulse');
                    void this.countdownNumber.offsetHeight; // force reflow
                    this.countdownNumber.classList.add('countdown-pulse');
                } else if (currentBeatIndex >= 4) {
                    // Hide when music starts 
                    this.countdownOverlay.classList.add('hidden');
                    return; // End of countdown
                }
                lastBeatIndex = currentBeatIndex;
            }
            requestAnimationFrame(syncUI);
        };

        syncUI();
    }

    setupListeners() {
        // Controls
        this.playBtn.addEventListener('click', () => this.seq.play());
        document.getElementById('stop-btn').addEventListener('click', () => this.seq.stop());

        // Settings
        // BPM sync
        const updateBpm = (val, source) => {
            let num = parseInt(val);
            if (isNaN(num)) return;
            num = Math.max(20, Math.min(999, num));
            this.seq.bpm = num;
            this.seq.updateSettings(num, this.seq.timeSignature);

            // Sync all BPM inputs
            const targets = [this.bpmInput, this.bpmNumber, this.configBpmInput, this.configBpmNumber];
            targets.forEach(t => {
                if (t && t !== source) t.value = num;
            });
        };

        this.bpmInput.addEventListener('input', (e) => updateBpm(e.target.value, e.target));
        if (this.bpmNumber) {
            this.bpmNumber.addEventListener('change', (e) => updateBpm(e.target.value, e.target));
        }

        // View Toggle
        this.viewToggleBtn.addEventListener('click', () => {
            console.log("UI: View Toggle Clicked. Current isGameMode:", this.isGameMode);
            this.isGameMode = !this.isGameMode;
            this.viewToggleBtn.innerText = this.isGameMode ? "Make Mode" : "Game Mode";
            this.sequencerView.classList.toggle('hidden', this.isGameMode);
            this.gameView.classList.toggle('hidden', !this.isGameMode);
            this.game.isGameMode = this.isGameMode;

            if (this.isGameMode) {
                console.log("UI: Switching to Game Mode");
                this.game.init();
                this.seq.onNoteTrigger = (bar, track, targetTime) => this.game.spawnNote(track, targetTime);
            } else {
                console.log("UI: Switching to Make Mode");
                this.seq.onNoteTrigger = null;
            }
        });

        // Global Key Input for Game
        window.addEventListener('keydown', (e) => {
            if (this.isGameMode && e.code === 'Space') {
                e.preventDefault();
                this.game.handleInput(-1, e.timeStamp);
            }
        });
    }

    setupConfigListeners() {
        const addTapListener = (element, handler) => {
            if (!element) return;
            element.addEventListener('click', handler);
            element.addEventListener('touchend', (e) => {
                e.preventDefault();
                handler(e);
            });
        };

        // Open/Close
        addTapListener(this.configBtn, () => {
            this.configPanel.classList.remove('hidden');
            this.configOverlay.classList.remove('hidden');
            requestAnimationFrame(() => {
                this.configPanel.classList.add('active');
                this.configOverlay.classList.add('active');
            });
        });

        const closeConfig = () => {
            this.configPanel.classList.remove('active');
            this.configOverlay.classList.remove('active');
            setTimeout(() => {
                this.configPanel.classList.add('hidden');
                this.configOverlay.classList.add('hidden');
            }, 300);
        };

        addTapListener(this.configPanelClose, closeConfig);
        addTapListener(this.configOverlay, closeConfig);

        // BPM Sync (Reuse updateBpm logic)
        const updateBpm = (val, source) => {
            let num = parseInt(val);
            if (isNaN(num)) return;
            num = Math.max(20, Math.min(999, num));
            this.seq.bpm = num;
            this.seq.updateSettings(num, this.seq.timeSignature);

            const targets = [this.bpmInput, this.bpmNumber, this.configBpmInput, this.configBpmNumber];
            targets.forEach(t => {
                if (t && t !== source) t.value = num;
            });
        };

        this.configBpmInput.addEventListener('input', (e) => updateBpm(e.target.value, e.target));
        this.configBpmNumber.addEventListener('change', (e) => updateBpm(e.target.value, e.target));

        // Volume sync
        const updateVol = (val, source, isSlider) => {
            let v = parseFloat(val);
            if (isNaN(v)) return;

            const sliderVal = isSlider ? v : Math.max(0, Math.min(500, Math.round(v))) / 100;
            const numberVal = isSlider ? Math.round(v * 100) : Math.max(0, Math.min(500, Math.round(v)));

            if (this.configMasterVol) this.configMasterVol.value = sliderVal;
            if (this.configVolNumber) this.configVolNumber.value = numberVal;

            if (this.seq.audio.isInitialized) {
                this.seq.audio.masterGain.gain.setTargetAtTime(sliderVal, this.seq.audio.ctx.currentTime, 0.05);
            }
        };

        this.configMasterVol.addEventListener('input', (e) => updateVol(e.target.value, e.target, true));
        this.configVolNumber.addEventListener('change', (e) => updateVol(e.target.value, e.target, false));

        // Time Sig
        this.configTimeSigSelect.addEventListener('change', (e) => {
            this.seq.updateSettings(this.seq.bpm, parseInt(e.target.value));
        });

        // Subdivision
        this.configSubdivSelect.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            this.seq.bars.forEach((bar, barIndex) => {
                for (let i = 0; i < bar.beats.length; i++) {
                    this.seq.updateBeatSubdivision(barIndex, i, val);
                }
            });
            this.renderGrid();
        });

        // Playback Mode
        this.configPlaybackModeSelect.addEventListener('change', (e) => {
            this.seq.playbackMode = e.target.value;
        });

        // Step Sound Mode
        this.configStepSoundSelect.addEventListener('change', (e) => {
            this.stepSoundEnabled = (e.target.value === 'sound');
        });

        // Notes Reset
        addTapListener(this.configResetBtn, () => {
            this.seq.bars.forEach(bar => {
                bar.tracks.forEach(track => {
                    track.pattern.forEach(beat => beat.fill(false));
                });
            });
            this.renderGrid();
        });

        // Game Speed
        this.configGameSpeedSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.seq.noteSpeed = val;
            this.seq.updateScheduleAheadTime();
            this.configGameSpeedVal.innerText = val.toFixed(1);
        });

        // Hit Criteria
        this.configHitCriteriaSelect.addEventListener('change', (e) => {
            this.game.hitCriteria = e.target.value;
        });

        // Result Reset
        addTapListener(this.configResultResetBtn, () => {
            this.game.resetStats();
        });
    }

    /**
     * Execute the selected step action based on the dropdown value
     */
    executeStepAction(barIndex, trackIndex, beatIndex, stepIndex) {
        const action = this.stepActionSelect.value;
        const track = this.seq.bars[barIndex].tracks[trackIndex];

        switch (action) {
            case 'toggle':
                this.seq.toggleStep(barIndex, trackIndex, beatIndex, stepIndex);
                console.log(`Debug: Toggled Step [${barIndex},${trackIndex},${beatIndex},${stepIndex}] to ${track.pattern[beatIndex][stepIndex]}`);
                break;
            case 'toggle-nogame':
                this.seq.toggleStepNoGame(barIndex, trackIndex, beatIndex, stepIndex);
                console.log(`Debug: Toggled NoGame Step [${barIndex},${trackIndex},${beatIndex},${stepIndex}] to ${track.pattern[beatIndex][stepIndex]}`);
                break;

            // SELECT actions
            case 'sel-step':
                this.seq.setStepState(barIndex, trackIndex, beatIndex, stepIndex, true);
                break;
            case 'sel-col':
                this.seq.setColumnAllBarsState(beatIndex, stepIndex, true);
                break;
            case 'sel-col-track':
                this.seq.setColumnTrackState(barIndex, trackIndex, beatIndex, stepIndex, true);
                break;
            case 'sel-bar':
                this.seq.setBarStepState(barIndex, stepIndex, true);
                break;
            case 'sel-bar-track':
                this.seq.setBarTrackState(barIndex, trackIndex, stepIndex, true);
                break;
            case 'sel-global':
                this.seq.setGlobalStepState(stepIndex, true);
                break;
            case 'sel-global-track':
                this.seq.setProjectTrackState(barIndex, trackIndex, stepIndex, true);
                break;

            // SELECT No Game actions
            case 'sel-nogame-step':
                this.seq.setStepState(barIndex, trackIndex, beatIndex, stepIndex, 'nogame');
                break;
            case 'sel-nogame-col':
                this.seq.setColumnAllBarsState(beatIndex, stepIndex, 'nogame');
                break;
            case 'sel-nogame-col-track':
                this.seq.setColumnTrackState(barIndex, trackIndex, beatIndex, stepIndex, 'nogame');
                break;
            case 'sel-nogame-bar':
                this.seq.setBarStepState(barIndex, stepIndex, 'nogame');
                break;
            case 'sel-nogame-bar-track':
                this.seq.setBarTrackState(barIndex, trackIndex, stepIndex, 'nogame');
                break;
            case 'sel-nogame-global':
                this.seq.setGlobalStepState(stepIndex, 'nogame');
                break;
            case 'sel-nogame-global-track':
                this.seq.setProjectTrackState(barIndex, trackIndex, stepIndex, 'nogame');
                break;

            // UNSELECT actions
            case 'unsel-step':
                this.seq.setStepState(barIndex, trackIndex, beatIndex, stepIndex, false);
                break;
            case 'unsel-col':
                this.seq.setColumnAllBarsState(beatIndex, stepIndex, false);
                break;
            case 'unsel-col-track':
                this.seq.setColumnTrackState(barIndex, trackIndex, beatIndex, stepIndex, false);
                break;
            case 'unsel-bar':
                this.seq.setBarStepState(barIndex, stepIndex, false);
                break;
            case 'unsel-bar-track':
                this.seq.setBarTrackState(barIndex, trackIndex, stepIndex, false);
                break;
            case 'unsel-global':
                this.seq.setGlobalStepState(stepIndex, false);
                break;
            case 'unsel-global-track':
                this.seq.setProjectTrackState(barIndex, trackIndex, stepIndex, false);
                break;

            // ADD STEP actions
            case 'add-step':
                this.seq.insertStep(barIndex, beatIndex, stepIndex);
                break;
            case 'add-col':
                this.seq.insertStepAllBars(beatIndex, stepIndex);
                break;
            case 'add-bar':
                this.seq.insertStepBar(barIndex, stepIndex);
                break;
            case 'add-global':
                this.seq.insertStepGlobal(stepIndex);
                break;

            // DELETE STEP actions
            case 'del-step':
                this.seq.removeStep(barIndex, beatIndex, stepIndex);
                break;
            case 'del-col':
                this.seq.removeStepAllBars(beatIndex, stepIndex);
                break;
            case 'del-bar':
                this.seq.removeStepBar(barIndex, stepIndex);
                break;
            case 'del-global':
                this.seq.removeStepGlobal(stepIndex);
                break;
        }

        // Determine if action requires full grid re-render
        // Actions that affect multiple cells or grid structure need re-render
        const needsRerender = action.startsWith('add-') ||
            action.startsWith('del-') ||
            action.includes('-col') ||
            action.includes('-bar') ||
            action.includes('-global');

        if (needsRerender) {
            this.renderGrid();
            return null;
        } else {
            // For single-step toggle/select actions, just update UI without full re-render
            const updatedState = track.pattern[beatIndex] ? track.pattern[beatIndex][stepIndex] : false;
            return updatedState;
        }
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
                display.innerText = `1/${beat.subdivision}`;
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

            // 2. Step Value Row (Formerly 3. Footer row)
            const valLabel = document.createElement('div');
            valLabel.className = 'grid-row-label step-value-label';
            valLabel.innerText = 'Step Value';
            valLabel.style.fontSize = '0.9rem';
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

            // Add Beat Button (Right Column, Header Row)
            const addBeatRightBtn = document.createElement('button');
            addBeatRightBtn.innerText = '+';
            addBeatRightBtn.className = 'add-beat-col-btn';
            addBeatRightBtn.title = 'Add Beat';
            addBeatRightBtn.style.gridRow = `1 / span ${3 + bar.tracks.length}`;
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
                labelCell.style.flexDirection = 'column';
                labelCell.style.alignItems = 'flex-start';
                labelCell.style.gap = '2px';
                labelCell.style.padding = '4px 0';

                const trackNameLabel = document.createElement('span');
                trackNameLabel.innerText = `Track ${tIndex + 1}`;
                trackNameLabel.className = 'track-number-label';

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

                // Row for selector and delete btn
                const actionRow = document.createElement('div');
                actionRow.style.display = 'flex';
                actionRow.style.width = '100%';
                actionRow.style.alignItems = 'center';
                actionRow.style.gap = '5px';

                actionRow.appendChild(instSelect);
                actionRow.appendChild(delBtn);

                labelCell.appendChild(trackNameLabel);
                labelCell.appendChild(actionRow);
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
                            const noteState = track.pattern[bIndex][s];
                            if (noteState === 'nogame') {
                                btn.classList.add('nogame');
                            } else {
                                btn.classList.add('active');
                            }
                        }

                        // ID for highlighting (Need bar/beat/step)
                        btn.dataset.bar = barIndex;
                        btn.dataset.track = tIndex;
                        btn.dataset.beat = bIndex;
                        btn.dataset.step = s;

                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (this.isLongPress) return;

                            if (!this.seq.audio.isInitialized) this.seq.audio.init();

                            // Execute the selected action from dropdown
                            const result = this.executeStepAction(barIndex, tIndex, bIndex, s);

                            // If action didn't cause re-render, update button state
                            if (result !== null) {
                                const updatedState = track.pattern[bIndex][s];
                                btn.classList.remove('active', 'nogame');
                                if (updatedState === 'nogame') {
                                    btn.classList.add('nogame');
                                } else if (updatedState === true) {
                                    btn.classList.add('active');
                                }
                            }

                            // Play sound for all selection actions (not just toggle)
                            if (!this.seq.isPlaying && this.stepSoundEnabled) {
                                this.seq.audio.playInstrument(track.type);
                            }
                        });
                        beatCell.appendChild(btn);
                    }
                    systemContainer.appendChild(beatCell);
                });
            });

            // 3. Add Track Button INSIDE the Bar (Last Row of Grid or separate?)
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

    // ==================== PRESET MANAGEMENT ====================

    setupPresetListeners() {
        // Helper to add both click and touch events
        const addTapListener = (element, handler) => {
            element.addEventListener('click', handler);
            element.addEventListener('touchend', (e) => {
                e.preventDefault();
                handler(e);
            });
        };

        // Open panel
        addTapListener(this.presetBtn, () => this.openPresetPanel());

        // Close panel
        addTapListener(this.presetPanelClose, () => this.closePresetPanel());
        addTapListener(this.presetOverlay, () => this.closePresetPanel());

        // Save new preset
        addTapListener(this.saveNewBtn, () => this.openSaveDialog());

        // Add folder - show form
        addTapListener(this.addFolderBtn, () => this.showFolderForm());

        // Folder form - create
        addTapListener(this.folderCreateBtn, () => this.createNewFolder());

        // Folder form - cancel
        addTapListener(this.folderCancelBtn, () => this.hideFolderForm());

        // Folder input - Enter key to create
        this.folderNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (e.isComposing) return; // Add this line to handle IME
                e.preventDefault();
                this.createNewFolder();
            } else if (e.key === 'Escape') {
                this.hideFolderForm();
            }
        });

        // Save dialog buttons
        addTapListener(this.saveCancelBtn, () => this.closeSaveDialog());
        addTapListener(this.saveConfirmBtn, () => this.confirmSavePreset());

        // Close dialog on overlay click/touch
        this.saveDialog.addEventListener('click', (e) => {
            if (e.target === this.saveDialog) {
                this.closeSaveDialog();
            }
        });
        this.saveDialog.addEventListener('touchend', (e) => {
            if (e.target === this.saveDialog) {
                e.preventDefault();
                this.closeSaveDialog();
            }
        });
    }

    showFolderForm() {
        this.folderForm.classList.remove('hidden');
        this.addFolderBtn.classList.add('hidden');
        this.folderNameInput.value = '';
        this.folderNameInput.focus();
    }

    hideFolderForm() {
        this.folderForm.classList.add('hidden');
        this.addFolderBtn.classList.remove('hidden');
        this.folderNameInput.value = '';
    }

    openPresetPanel() {
        this.presetPanel.classList.remove('hidden');
        this.presetOverlay.classList.remove('hidden');
        // Trigger animation
        requestAnimationFrame(() => {
            this.presetPanel.classList.add('active');
            this.presetOverlay.classList.add('active');
        });
        this.renderFolderList();
        this.renderPresetList();
    }

    closePresetPanel() {
        this.presetPanel.classList.remove('active');
        this.presetOverlay.classList.remove('active');
        setTimeout(() => {
            this.presetPanel.classList.add('hidden');
            this.presetOverlay.classList.add('hidden');
        }, 300);
    }

    openSaveDialog() {
        this.presetNameInput.value = '';
        this.updateFolderSelect();

        // If a specific project is selected in the sidebar, pre-select it in the dialog
        if (this.selectedFolderId && this.selectedFolderId !== 'root') {
            this.presetFolderSelect.value = this.selectedFolderId;
        } else {
            this.presetFolderSelect.value = ''; // Default to Root
        }

        this.saveDialog.classList.remove('hidden');
        requestAnimationFrame(() => {
            this.saveDialog.classList.add('active');
            this.presetNameInput.focus();
        });
    }

    closeSaveDialog() {
        this.saveDialog.classList.remove('active');
        setTimeout(() => {
            this.saveDialog.classList.add('hidden');
        }, 200);
    }

    updateFolderSelect() {
        const folders = this.presetManager.getFolders();
        this.presetFolderSelect.innerHTML = '<option value="">Root（No Project）</option>';
        folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.id;
            option.textContent = folder.name;
            this.presetFolderSelect.appendChild(option);
        });
    }

    confirmSavePreset() {
        const name = this.presetNameInput.value.trim();
        if (!name) {
            alert('Please enter a preset name');
            return;
        }

        const folderId = this.presetFolderSelect.value || null;
        const data = this.seq.serialize();

        this.presetManager.savePreset(name, folderId, data);
        this.closeSaveDialog();
        this.renderPresetList();
        this.updateCurrentInfo(name, folderId);
    }

    updateCurrentInfo(presetName, folderId) {
        if (this.currentPresetDisplay) {
            this.currentPresetDisplay.textContent = presetName || 'None';
        }
        if (this.currentProjectDisplay) {
            if (folderId) {
                const folders = this.presetManager.getFolders();
                const folder = folders.find(f => f.id === folderId);
                this.currentProjectDisplay.textContent = folder ? folder.name : 'None';
            } else {
                this.currentProjectDisplay.textContent = 'None';
            }
        }
    }

    createNewFolder() {
        const name = this.folderNameInput.value.trim();
        if (!name) {
            this.folderNameInput.focus();
            return;
        }
        this.presetManager.createFolder(name);
        this.hideFolderForm();
        this.renderFolderList();
    }

    renderFolderList() {
        const folders = this.presetManager.getFolders();
        this.folderList.innerHTML = '';

        // "All" option
        const allItem = document.createElement('div');
        allItem.className = 'folder-item' + (this.selectedFolderId === null ? ' active' : '');
        allItem.innerHTML = `
            <span class="folder-item-name">📂 All</span>
        `;
        const selectAll = () => {
            this.selectedFolderId = null;
            this.renderFolderList();
            this.renderPresetList();
        };
        allItem.addEventListener('click', selectAll);
        allItem.addEventListener('touchend', (e) => { e.preventDefault(); selectAll(); });
        this.folderList.appendChild(allItem);

        // Root (No Project) Item
        const rootItem = document.createElement('div');
        rootItem.className = 'folder-item' + (this.selectedFolderId === 'root' ? ' active' : '');
        rootItem.innerHTML = `
            <span class="folder-item-name">📁 Root (No Project)</span>
        `;
        const selectRoot = () => {
            this.selectedFolderId = 'root';
            this.renderFolderList();
            this.renderPresetList();
        };
        rootItem.addEventListener('click', selectRoot);
        rootItem.addEventListener('touchend', (e) => { e.preventDefault(); selectRoot(); });
        this.folderList.appendChild(rootItem);

        folders.forEach(folder => {
            const item = document.createElement('div');
            item.className = 'folder-item' + (this.selectedFolderId === folder.id ? ' active' : '');
            item.innerHTML = `
                <span class="folder-item-name">📁 ${this.escapeHtml(folder.name)}</span>
                <div class="folder-item-actions">
                    <button class="folder-action-btn rename" title="名前変更">✏️</button>
                    <button class="folder-action-btn delete" title="削除">🗑️</button>
                </div>
            `;

            // Click/Touch to filter
            const selectFolder = (e) => {
                if (e.target.classList.contains('folder-action-btn')) return;
                this.selectedFolderId = folder.id;
                this.renderFolderList();
                this.renderPresetList();
            };
            item.addEventListener('click', selectFolder);
            item.addEventListener('touchend', (e) => { e.preventDefault(); selectFolder(e); });

            // Rename
            const renameBtn = item.querySelector('.rename');
            const handleRename = (e) => {
                e.stopPropagation();
                const newName = prompt('New Project Name:', folder.name);
                if (newName && newName.trim()) {
                    this.presetManager.renameFolder(folder.id, newName.trim());
                    this.renderFolderList();
                    // If the renamed folder is the current project, update the display
                    if (this.currentProjectDisplay.textContent === folder.name) {
                        this.currentProjectDisplay.textContent = newName.trim();
                    }
                }
            };
            renameBtn.addEventListener('click', handleRename);
            renameBtn.addEventListener('touchend', (e) => { e.preventDefault(); handleRename(e); });

            // Delete
            const deleteBtn = item.querySelector('.delete');
            const handleDelete = (e) => {
                e.stopPropagation();
                if (confirm(`Delete Project「${folder.name}」?\n（Presets in this project will be moved to the root）`)) {
                    this.presetManager.deleteFolder(folder.id);
                    if (this.selectedFolderId === folder.id) {
                        this.selectedFolderId = null;
                    }
                    this.renderFolderList();
                    this.renderPresetList();
                }
            };
            deleteBtn.addEventListener('click', handleDelete);
            deleteBtn.addEventListener('touchend', (e) => { e.preventDefault(); handleDelete(e); });

            this.folderList.appendChild(item);
        });
    }

    renderPresetList() {
        const allPresets = this.presetManager.getPresets();
        const folders = this.presetManager.getFolders();

        // Filter by selected folder
        let presets;
        if (this.selectedFolderId === null) {
            presets = allPresets;
        } else if (this.selectedFolderId === 'root') {
            presets = allPresets.filter(p => !p.folderId);
        } else {
            presets = allPresets.filter(p => p.folderId === this.selectedFolderId);
        }

        this.presetList.innerHTML = '';

        if (presets.length === 0) {
            this.presetList.innerHTML = '<div class="preset-empty">No Presets</div>';
            return;
        }

        presets.forEach(preset => {
            const folder = folders.find(f => f.id === preset.folderId);
            const item = document.createElement('div');
            item.className = 'preset-item';
            item.innerHTML = `
                <div class="preset-item-header">
                    <span class="preset-item-name">${this.escapeHtml(preset.name)}</span>
                    <div class="preset-item-actions">
                        <button class="folder-action-btn rename" title="名前変更">✏️</button>
                        <button class="folder-action-btn delete" title="削除">🗑️</button>
                    </div>
                </div>
                <div class="preset-item-meta">
                    <span>BPM: ${preset.data.bpm}</span>
                    <span>${preset.data.bars ? preset.data.bars.length : 0} bars</span>
                </div>
                ${folder ? `<div class="preset-item-folder">📁 ${this.escapeHtml(folder.name)}</div>` : ''}
            `;

            // Load preset on click/touch
            const handleLoad = (e) => {
                if (e.target.classList.contains('folder-action-btn')) return;
                this.loadPreset(preset);
            };
            item.addEventListener('click', handleLoad);
            item.addEventListener('touchend', (e) => { e.preventDefault(); handleLoad(e); });

            // Rename
            const renameBtn = item.querySelector('.rename');
            const handleRename = (e) => {
                e.stopPropagation();
                const newName = prompt('New Preset Name:', preset.name);
                if (newName && newName.trim()) {
                    this.presetManager.renamePreset(preset.id, newName.trim());
                    this.renderPresetList();
                }
            };
            renameBtn.addEventListener('click', handleRename);
            renameBtn.addEventListener('touchend', (e) => { e.preventDefault(); handleRename(e); });

            // Delete
            const deleteBtn = item.querySelector('.delete');
            const handleDelete = (e) => {
                e.stopPropagation();
                if (confirm(`Delete preset "${preset.name}"?`)) {
                    this.presetManager.deletePreset(preset.id);
                    this.renderPresetList();
                }
            };
            deleteBtn.addEventListener('click', handleDelete);
            deleteBtn.addEventListener('touchend', (e) => { e.preventDefault(); handleDelete(e); });

            this.presetList.appendChild(item);
        });
    }

    loadPreset(preset) {
        if (!preset || !preset.data) return;

        // Deserialize data
        this.seq.deserialize(preset.data);

        // Update UI controls
        this.bpmInput.value = this.seq.bpm;
        if (this.bpmNumber) this.bpmNumber.value = this.seq.bpm;
        if (this.configBpmInput) this.configBpmInput.value = this.seq.bpm;
        if (this.configBpmNumber) this.configBpmNumber.value = this.seq.bpm;

        if (this.configTimeSigSelect) this.configTimeSigSelect.value = this.seq.timeSignature;
        if (this.configPlaybackModeSelect) this.configPlaybackModeSelect.value = this.seq.playbackMode;

        // Re-render grid
        this.renderGrid();

        // Close panel
        this.closePresetPanel();

        // Update current info display
        this.updateCurrentInfo(preset.name, preset.folderId);

        console.log(`Loaded preset: ${preset.name}`);
    }

    // ==================== SHARE URL FEATURE ====================

    setupShareUrlListeners() {
        if (this.generateUrlBtn) {
            this.generateUrlBtn.addEventListener('click', () => this.generateShareUrl());
        }
        if (this.copyUrlBtn) {
            this.copyUrlBtn.addEventListener('click', () => this.copyShareUrl());
        }
    }

    generateShareUrl() {
        try {
            // Create compact data format with short keys
            const data = this.seq.serialize();
            const compact = {
                b: data.bpm,
                t: data.timeSignature,
                p: data.playbackMode === 'loop' ? 1 : 0,
                r: data.bars.map(bar => ({
                    e: bar.beats.map(b => b.subdivision),
                    k: bar.tracks.map(track => ({
                        y: track.type,
                        v: Math.round(track.volume * 10) / 10,
                        n: track.pattern.map(bp =>
                            bp.map(s => s === true ? 1 : s === 'nogame' ? 2 : 0).join('')
                        ).join(',')
                    }))
                }))
            };

            const jsonStr = JSON.stringify(compact);
            console.log('Generating URL with compact data:', compact);
            console.log('JSON Length:', jsonStr.length);

            // Encode to Base64 (handling Unicode)
            const base64 = btoa(unescape(encodeURIComponent(jsonStr)));

            // Build URL
            const url = new URL(window.location.href);
            url.search = ''; // Clear existing params
            url.searchParams.set('d', base64);  // Use shorter param name

            // Display URL
            if (this.shareUrlInput) {
                this.shareUrlInput.value = url.toString();
            }

            console.log('Share URL generated (compact format)');
        } catch (error) {
            console.error('Error generating share URL:', error);
            alert('Failed to generate share URL');
        }
    }

    copyShareUrl() {
        if (!this.shareUrlInput || !this.shareUrlInput.value) return;

        const url = this.shareUrlInput.value;

        // Try modern Clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                this.showCopySuccess();
            }).catch(() => {
                this.fallbackCopy(url);
            });
        } else {
            this.fallbackCopy(url);
        }
    }

    fallbackCopy(text) {
        // Fallback for older browsers
        this.shareUrlInput.select();
        this.shareUrlInput.setSelectionRange(0, 99999);

        try {
            document.execCommand('copy');
            this.showCopySuccess();
        } catch (err) {
            console.error('Copy failed:', err);
            alert('Copy failed. Please copy manually.');
        }
    }

    showCopySuccess() {
        if (this.copyUrlBtn) {
            this.copyUrlBtn.classList.add('copied');
            setTimeout(() => {
                this.copyUrlBtn.classList.remove('copied');
            }, 1500);
        }
    }

    loadFromUrlParams() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            let dataParam = urlParams.get('d');  // New short param
            let isCompact = true;

            // Fallback to old format
            if (!dataParam) {
                dataParam = urlParams.get('data');
                isCompact = false;
            }

            if (!dataParam) {
                this.updatePresetPanelVisibility(false);
                return;
            }

            // Decode Base64 (handling Unicode)
            const decoded = decodeURIComponent(escape(atob(dataParam)));

            let data;
            if (isCompact) {
                // Parse compact format
                const compact = JSON.parse(decoded);
                data = {
                    bpm: compact.b,
                    timeSignature: compact.t,
                    playbackMode: compact.p === 1 ? 'loop' : 'stop',
                    lastSelectedInstrument: 'metronome',
                    bars: compact.r.map(bar => ({
                        beats: bar.e.map(subdiv => ({ subdivision: subdiv })),
                        tracks: bar.k.map(track => ({
                            type: track.y,
                            volume: track.v,
                            pattern: track.n.split(',').map(bp =>
                                bp.split('').map(s => s === '1' ? true : s === '2' ? 'nogame' : false)
                            )
                        }))
                    }))
                };
            } else {
                // Old format
                data = JSON.parse(decoded);
            }

            // Load into sequencer
            this.seq.deserialize(data);

            // Update UI controls
            this.bpmInput.value = this.seq.bpm;
            if (this.bpmNumber) this.bpmNumber.value = this.seq.bpm;
            if (this.configBpmInput) this.configBpmInput.value = this.seq.bpm;
            if (this.configBpmNumber) this.configBpmNumber.value = this.seq.bpm;
            if (this.configTimeSigSelect) this.configTimeSigSelect.value = this.seq.timeSignature;
            if (this.configPlaybackModeSelect) this.configPlaybackModeSelect.value = this.seq.playbackMode;

            console.log('Loaded from URL parameters');
            this.updatePresetPanelVisibility(true); // Parameter exists -> Shared Mode
        } catch (error) {
            console.error('Error loading from URL params:', error);
            this.updatePresetPanelVisibility(false); // Parameter absent -> Standard Mode
        }
    }

    updatePresetPanelVisibility(isSharedMode) {
        const presetActions = this.presetPanel.querySelector('.preset-actions');
        const presetFolders = this.presetPanel.querySelector('.preset-folders');
        const presetListSection = this.presetPanel.querySelector('.preset-list-section');
        const shareUrlSection = this.presetPanel.querySelector('.share-url-section');
        const panelTitle = this.presetPanel.querySelector('.preset-panel-header h2');

        if (isSharedMode) {
            // Parameter exists: Show Preset functions, Hide Share URL
            this.presetBtn.innerText = 'Preset';
            if (panelTitle) panelTitle.innerText = 'PRESET';

            if (presetActions) presetActions.classList.remove('hidden');
            if (presetFolders) presetFolders.classList.remove('hidden');
            if (presetListSection) presetListSection.classList.remove('hidden');
            if (shareUrlSection) shareUrlSection.classList.add('hidden');
        } else {
            // No Parameter: Change to Share URL mode
            this.presetBtn.innerText = 'Share URL';
            if (panelTitle) panelTitle.innerText = 'SHARE URL';

            if (presetActions) presetActions.classList.add('hidden');
            if (presetFolders) presetFolders.classList.add('hidden');
            if (presetListSection) presetListSection.classList.add('hidden');
            if (shareUrlSection) shareUrlSection.classList.remove('hidden');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}


// Global instances
const audio = new AudioEngine();
const sequencer = new Sequencer(audio);
let ui;

document.addEventListener('DOMContentLoaded', () => {
    ui = new UI(sequencer);

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('PWA: ServiceWorker registration successful with scope: ', reg.scope))
                .catch(err => console.error('PWA: ServiceWorker registration failed: ', err));
        });
    }

    // Disable right-click context menu
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    }, false);
});
