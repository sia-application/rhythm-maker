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

    playTone(time, type, freq, decay, volume = 1.0, pan = 0) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const panner = this.ctx.createStereoPanner();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);
        if (type === 'sine') {
            osc.frequency.exponentialRampToValueAtTime(0.01, time + decay);
        }

        gain.gain.setValueAtTime(0.001, time);
        gain.gain.exponentialRampToValueAtTime(volume, time + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

        panner.pan.setValueAtTime(pan, time);

        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.masterGain);

        const nodeEntry = { source: osc, gain: gain };
        this.activeNodes.add(nodeEntry);
        osc.onended = () => this.activeNodes.delete(nodeEntry);

        osc.start(time);
        osc.stop(time + decay);
    }

    playNoise(time, decay, volume = 1.0, pan = 0) {
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

        const panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(pan, time);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        panner.connect(this.masterGain);

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

    playInstrument(name, time = 0, trackVolume = 1.0, pan = 0) {
        if (!this.isInitialized) return;
        const t = time || this.ctx.currentTime;
        const finalVolume = trackVolume;

        switch (name) {
            case 'kick': this.playTone(t, 'sine', 50, 0.3, finalVolume * 1.5, pan); break;
            case 'bassdrum': this.playTone(t, 'sine', 40, 0.5, finalVolume * 1.8, pan); break;
            case 'snare': this.playNoise(t, 0.15, finalVolume * 1.2, pan); break;
            case 'hihat': this.playTone(t, 'square', 8000, 0.05, finalVolume * 0.4, pan); break;
            case 'openhihat': this.playTone(t, 'square', 8000, 0.3, finalVolume * 0.35, pan); break;
            case 'pedalhat': this.playTone(t, 'square', 6000, 0.03, finalVolume * 0.3, pan); break;
            case 'tomH': this.playTone(t, 'sine', 150, 0.2, finalVolume * 1.3, pan); break;
            case 'tomM': this.playTone(t, 'sine', 120, 0.25, finalVolume * 1.3, pan); break;
            case 'tomL': this.playTone(t, 'sine', 90, 0.3, finalVolume * 1.3, pan); break;
            case 'ride': this.playTone(t, 'sawtooth', 4000, 0.6, finalVolume * 0.2, pan); break;
            case 'crash': this.playNoise(t, 1.5, finalVolume * 0.5, pan); break;
            case 'clap':
                for (let i = 0; i < 3; i++) {
                    this.playNoise(t + (i * 0.01), 0.01, finalVolume * 1.0, pan);
                }
                this.playNoise(t + 0.03, 0.3, finalVolume * 1.0, pan);
                break;
            case 'rim':
                this.playTone(t, 'sine', 2000, 0.05, finalVolume * 0.8, pan);
                break;
            case 'cowbell':
                this.playTone(t, 'sine', 1000, 0.1, finalVolume * 1.2, pan);
                break;
            case 'shaker':
                this.playNoise(t, 0.05, finalVolume * 0.7, pan);
                break;
            case 'metronome':
                this.playTone(t, 'square', 1000, 0.05, finalVolume, pan);
                break;
        }
    }
}

class Sequencer {
    constructor(audioEngine) {
        this.audio = audioEngine;
        this.isPlaying = false;
        this.offBeatMode = false;
        this.bpm = 120;
        this.timeSignature = 4; // Beats per bar
        this.subdivision = 4;   // Global default subdivision

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
        this.soloBarIndex = null;    // If set, only this bar plays

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

    changeTrackVolume(barIndex, trackIndex, vol) {
        if (barIndex < 0 || barIndex >= this.bars.length) return;
        const bar = this.bars[barIndex];
        if (trackIndex >= 0 && trackIndex < bar.tracks.length) {
            bar.tracks[trackIndex].volume = vol;
        }
    }

    syncTrackVolumeAcrossBars(trackIndex, vol) {
        this.bars.forEach(bar => {
            if (trackIndex >= 0 && trackIndex < bar.tracks.length) {
                bar.tracks[trackIndex].volume = vol;
            }
        });
    }

    syncTrackTypeAcrossBars(trackIndex, newType) {
        this.bars.forEach(bar => {
            if (trackIndex >= 0 && trackIndex < bar.tracks.length) {
                bar.tracks[trackIndex].type = newType;
            }
        });
    }

    changeTrackPan(barIndex, trackIndex, pan) {
        if (barIndex < 0 || barIndex >= this.bars.length) return;
        const bar = this.bars[barIndex];
        if (trackIndex >= 0 && trackIndex < bar.tracks.length) {
            bar.tracks[trackIndex].pan = pan;
        }
    }

    syncTrackPanAcrossBars(trackIndex, pan) {
        this.bars.forEach(bar => {
            if (trackIndex >= 0 && trackIndex < bar.tracks.length) {
                bar.tracks[trackIndex].pan = pan;
            }
        });
    }

    changeTrackMute(barIndex, trackIndex, muted) {
        if (barIndex < 0 || barIndex >= this.bars.length) return;
        const bar = this.bars[barIndex];
        if (trackIndex >= 0 && trackIndex < bar.tracks.length) {
            bar.tracks[trackIndex].muted = !!muted;
        }
    }

    syncTrackMuteAcrossBars(trackIndex, muted) {
        const boolMuted = !!muted;
        this.bars.forEach(bar => {
            if (trackIndex >= 0 && trackIndex < bar.tracks.length) {
                bar.tracks[trackIndex].muted = boolMuted;
            }
        });
    }

    addBar() {
        const barId = this.bars.length;
        const bar = {
            id: barId,
            name: ``,
            beats: [],
            tracks: []
        };
        // Default: timeSignature beats, using global subdivision
        for (let i = 0; i < this.timeSignature; i++) {
            bar.beats.push({ subdivision: this.subdivision });
        }
        // Add default tracks or inherit from last bar
        let tracksToCopy = [];
        if (this.bars.length > 0) {
            const lastBar = this.bars[this.bars.length - 1];
            tracksToCopy = lastBar.tracks.map(t => ({
                type: t.type,
                name: t.name || '',
                volume: t.volume,
                pan: t.pan,
                muted: !!t.muted
            }));
        } else {
            // First bar default
            tracksToCopy = [{ type: this.lastSelectedInstrument, volume: 1.0, pan: 0 }];
        }

        tracksToCopy.forEach(tInfo => {
            const track = {
                type: tInfo.type,
                name: tInfo.name || '',
                volume: tInfo.volume !== undefined ? tInfo.volume : 1.0,
                pan: tInfo.pan !== undefined ? tInfo.pan : 0,
                muted: tInfo.muted || false,
                pattern: []
            };
            // Init pattern for each beat
            bar.beats.forEach((beat) => {
                track.pattern.push(new Array(beat.subdivision).fill(false));
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

    moveBar(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.bars.length) return;
        if (toIndex < 0 || toIndex >= this.bars.length) return;
        if (fromIndex === toIndex) return;

        const barToMove = this.bars.splice(fromIndex, 1)[0];
        this.bars.splice(toIndex, 0, barToMove);
    }

    duplicateBar(barIndex) {
        if (barIndex < 0 || barIndex >= this.bars.length) return;
        const originalBar = this.bars[barIndex];

        // Deep copy the bar structure
        const newBar = {
            name: originalBar.name || "",
            beats: originalBar.beats.map(beat => ({
                subdivision: beat.subdivision
            })),
            tracks: originalBar.tracks.map(track => {
                const newTrack = {
                    type: track.type,
                    name: track.name || "",
                    volume: track.volume,
                    pan: track.pan !== undefined ? track.pan : 0,
                    muted: track.muted || false,
                    // Deep copy pattern data
                    pattern: track.pattern.map(beatPattern => [...beatPattern])
                };
                return newTrack;
            })
        };

        this.bars.push(newBar);
        return newBar;
    }

    addTrack(barIndex, type = null) {
        if (barIndex < 0 || barIndex >= this.bars.length) return;

        const useType = type || this.lastSelectedInstrument;
        const bar = this.bars[barIndex];
        const track = {
            id: this.nextTrackId++,
            type: useType,
            name: '',
            volume: 1.0,
            pan: 0,
            muted: false,
            pattern: []
        };

        // Init pattern based on bar's beats
        for (let b = 0; b < bar.beats.length; b++) {
            track.pattern.push(new Array(bar.beats[b].subdivision).fill(false));
        }

        bar.tracks.push(track);
    }

    syncAppendTrackAcrossBars(targetCount, type = null) {
        const useType = type || this.lastSelectedInstrument;
        this.bars.forEach((bar, bIdx) => {
            // Append tracks until the bar has at least targetCount tracks
            while (bar.tracks.length < targetCount) {
                this.addTrack(bIdx, useType);
            }
        });
    }

    syncRemoveTrackAcrossBars(trackIndex) {
        // Iterate backwards through bars and remove the track at trackIndex
        // Backward iteration is safer when elements might be deleted (though bar.tracks is independent per bar)
        for (let i = this.bars.length - 1; i >= 0; i--) {
            this.removeTrack(i, trackIndex);
        }
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

    moveTrack(barIndex, fromIndex, toIndex) {
        if (barIndex < 0 || barIndex >= this.bars.length) return;
        const bar = this.bars[barIndex];
        if (fromIndex < 0 || fromIndex >= bar.tracks.length) return;
        if (toIndex < 0 || toIndex >= bar.tracks.length) return;
        if (fromIndex === toIndex) return;

        const [movedTrack] = bar.tracks.splice(fromIndex, 1);
        bar.tracks.splice(toIndex, 0, movedTrack);
    }

    moveTrackGlobal(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        this.bars.forEach(bar => {
            if (fromIndex < bar.tracks.length && toIndex < bar.tracks.length) {
                const [movedTrack] = bar.tracks.splice(fromIndex, 1);
                bar.tracks.splice(toIndex, 0, movedTrack);
            }
        });
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
        const sub = this.subdivision;
        bar.beats.push({ subdivision: sub });
        // Add beat data to tracks
        bar.tracks.forEach(track => {
            track.pattern.push(new Array(sub).fill(false));
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
     * Set state for ALL steps in a specific track within a bar (entire row)
     */
    setBarTrackRowState(barIndex, trackIndex, state) {
        console.log(`[Sequencer] setBarTrackRowState: Bar ${barIndex}, Track ${trackIndex}, State ${state}`);
        const bar = this.bars[barIndex];
        if (!bar) return;

        const track = bar.tracks[trackIndex];
        if (!track) return;

        track.pattern.forEach(beatPattern => {
            beatPattern.fill(state);
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

                // --- SOLO BAR TRANSITION ---
                if (this.soloBarIndex !== null) {
                    if (this.playbackMode === 'stop') {
                        this.isEndOfProject = true;
                    } else {
                        // Loop solo bar
                        this.currentBarIndex = this.soloBarIndex;
                    }
                }

                if (this.currentBarIndex >= this.bars.length || (this.soloBarIndex !== null && this.isEndOfProject)) {
                    // End of Project reached (or end of solo bar)
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
                    this.currentBarIndex = this.soloBarIndex !== null ? this.soloBarIndex : 0;
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
            const hasStep = track.pattern[beatIndex] && track.pattern[beatIndex][stepInBeat];

            if (hasStep) {
                // SOUND: SCHEDULING
                const audioDelay = (time - 0.15 - now) * 1000;
                const aid = setTimeout(() => {
                    if (this.isPlaying && track.muted !== true) {
                        this.audio.playInstrument(track.type, time, track.volume, track.pan || 0);
                    }
                }, Math.max(0, audioDelay));
                this.scheduledTimeouts.push(aid);
            }

            // GAME NOTE LOGIC
            if (this.onNoteTrigger) {
                let shouldSpawn = false;
                if (this.offBeatMode) {
                    // Off-Beat Mode: Spawn if NO step exists
                    shouldSpawn = !hasStep;
                } else {
                    // Normal Mode: Spawn if step exists and is NOT nogame
                    shouldSpawn = hasStep && track.pattern[beatIndex][stepInBeat] !== 'nogame';
                }

                if (shouldSpawn) {
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
        this.soloBarIndex = null; // Regular play resets solo mode

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

    /**
     * Ad-hoc playback of a single bar
     */
    playBar(barIndex) {
        if (!this.audio.isInitialized) this.audio.init();
        if (barIndex < 0 || barIndex >= this.bars.length) return;

        // --- TOGGLE BEHAVIOR ---
        if (this.isPlaying && this.soloBarIndex === barIndex) {
            this.stop();
            return;
        }

        // Stop any current playback
        this.stop();

        // Set solo mode
        this.soloBarIndex = barIndex;

        // Set starting positions
        this.currentBarIndex = barIndex;
        this.currentBeatIndex = 0;
        this.currentStepInBeat = 0;
        this.playingBarIndex = barIndex;
        this.playingBeatIndex = 0;
        this.playingStepInBeat = 0;

        // Start
        this.startPlayback(0);
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
        this.soloBarIndex = null; // Clear solo mode
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
    serialize(extraData = {}) {
        return {
            bpm: this.bpm,
            timeSignature: this.timeSignature,
            playbackMode: this.playbackMode,
            lastSelectedInstrument: this.lastSelectedInstrument,
            config: {
                bpm: this.bpm,
                vol: this.audio.masterGain ? this.audio.masterGain.gain.value : 0.5,
                ts: this.timeSignature,
                sd: extraData.subdivision || 4,
                pb: this.playbackMode,
                sse: extraData.stepSoundEnabled !== undefined ? extraData.stepSoundEnabled : 1,
                gs: extraData.gameSpeed || 1.0,
                ob: this.offBeatMode ? 1 : 0,
                hc: extraData.hitCriteria || 'great',
                hse: extraData.hitSoundEnabled !== undefined ? extraData.hitSoundEnabled : 1,
                hst: extraData.hitSoundType || 'metronome'
            },
            uiState: {
                stepAction: extraData.stepAction || 'toggle'
            },
            gameResults: {
                score: extraData.score || 0,
                hits: extraData.hits || 0,
                totalNotes: extraData.totalNotes || 0,
                combo: extraData.combo || 0
            },
            bars: this.bars.map(bar => ({
                name: bar.name || '',
                beats: bar.beats.map(b => ({ subdivision: b.subdivision })),
                tracks: bar.tracks.map(track => ({
                    type: track.type,
                    name: track.name || '',
                    volume: track.volume,
                    pan: track.pan,
                    muted: !!track.muted,
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

        // Load extended config if available
        if (data.config) {
            if (data.config.masterVolume !== undefined) {
                try {
                    if (this.audio && this.audio.isInitialized && this.audio.masterGain) {
                        this.audio.masterGain.gain.value = data.config.masterVolume;
                    }
                } catch (e) {
                    console.warn("Failed to set master volume during deserialize:", e);
                }
            }
            if (data.config.playbackMode) this.playbackMode = data.config.playbackMode;
        }

        this.bars = [];
        if (data.bars && Array.isArray(data.bars)) {
            data.bars.forEach((barData, barIndex) => {
                const bar = {
                    id: barIndex,
                    name: barData.name || '',
                    beats: barData.beats.map(b => ({ subdivision: b.subdivision })),
                    tracks: barData.tracks.map(trackData => ({
                        id: this.nextTrackId++,
                        type: trackData.type,
                        name: trackData.name || '',
                        volume: trackData.volume !== undefined ? trackData.volume : 1.0,
                        pan: trackData.pan !== undefined ? trackData.pan : 0,
                        muted: !!trackData.muted,
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

        // Note: UI-specific restoration (score, make tools) should be handled in UI.loadPreset
    }
}

// Preset Manager for saving/loading rhythms
class PresetManager {
    constructor() {
        // Firestore references
        this.presetsRef = db.collection('presets');
        this.foldersRef = db.collection('folders');
        this.userConfigsRef = db.collection('userConfigs');

        // User ID for ownership tracking
        this.userId = null;

        // Local cache for faster UI updates (keyed by shareId)
        this._presetsCache = {}; // { shareId: presets[] }
        this._foldersCache = {}; // { shareId: folders[] }

        // Caching metadata (keyed by shareId)
        this._lastPresetsFetch = {}; // { shareId: timestamp }
        this._lastFoldersFetch = {}; // { shareId: timestamp }
        this._cacheTTL = 5000; // 5 seconds cache
    }

    setUserId(uid) {
        this.userId = uid;
    }

    // ==================== FOLDERS ====================

    // Get all folders (optimized with shareId filter and cache)
    async getFolders(shareId = null) {
        const key = shareId || 'root';
        const now = Date.now();
        if (this._foldersCache[key] && (now - (this._lastFoldersFetch[key] || 0) < this._cacheTTL)) {
            console.log(`DEBUG: Returning folders from cache for key: ${key}`);
            return this._foldersCache[key];
        }

        try {
            console.log(`DEBUG: Fetching folders from Firestore for key: ${key}`);
            let query = this.foldersRef;

            // PERFORMANCE: If we have a shareId, filter by it directly
            if (shareId) {
                query = query.where('shareId', '==', shareId);
            }
            // NOTE: If shareId is null, we don't query for null because Firestore
            // might skip documents missing the field entirely. We'll filter in memory.

            const snapshot = await query.get();
            const rawFolders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Filter in memory to handle missing fields and nulls consistently
            const folders = rawFolders.filter(f => (f.shareId || null) === shareId);

            folders.sort((a, b) => {
                const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
                const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
                return timeA - timeB; // Ascending
            });

            this._foldersCache[key] = folders;
            this._lastFoldersFetch[key] = now;
            console.log(`DEBUG: Successfully fetched ${folders.length} folders for key: ${key}`);
            return folders;
        } catch (e) {
            console.error('Error loading folders from Firestore:', e);
            return this._foldersCache[key] || [];
        }
    }

    // Explicitly clear cache (for force reloads)
    clearCache() {
        this._lastPresetsFetch = {};
        this._lastFoldersFetch = {};
        this._presetsCache = {};
        this._foldersCache = {};
    }

    // Create folder
    async createFolder(name, shareId = null) {
        try {
            const folder = {
                name: name,
                shareId: shareId || null, // Associate with URL parameter for isolation
                ownerId: this.userId,     // Track ownership
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            const docRef = await this.foldersRef.add(folder);
            const created = { id: docRef.id, ...folder, createdAt: new Date().toISOString() };
            const key = shareId || 'root';
            if (this._foldersCache[key]) this._foldersCache[key].push(created);
            this.clearCache();
            return created;
        } catch (e) {
            console.error('Error creating folder:', e);
            return null;
        }
    }

    // Rename folder
    async renameFolder(folderId, newName) {
        try {
            await this.foldersRef.doc(folderId).update({ name: newName });
            this.clearCache();
        } catch (e) {
            console.error('Error renaming folder:', e);
        }
    }

    // Delete folder (moves presets to root)
    async deleteFolder(folderId) {
        try {
            await this.foldersRef.doc(folderId).delete();
            this.clearCache();
            // Move presets in this folder to root
            const presetsInFolder = await this.presetsRef.where('folderId', '==', folderId).get();
            const batch = db.batch();
            presetsInFolder.docs.forEach(doc => {
                batch.update(doc.ref, { folderId: null });
            });
            await batch.commit();
        } catch (e) {
            console.error('Error deleting folder:', e);
        }
    }

    // ==================== PRESETS ====================

    // Get all presets (optimized with shareId filter and cache)
    async getPresets(shareId = null) {
        const key = shareId || 'root';
        const now = Date.now();
        if (this._presetsCache[key] && (now - (this._lastPresetsFetch[key] || 0) < this._cacheTTL)) {
            return this._presetsCache[key];
        }

        try {
            let query = this.presetsRef;

            // Filter by shareId directly in Firestore for performance
            if (shareId) {
                query = query.where('shareId', '==', shareId);
            } else {
                // If not in shared mode, explicitly look for null shareId
                query = query.where('shareId', '==', null);
            }

            const snapshot = await query.get();
            // Sort in memory to avoid index requirements
            const presets = snapshot.docs.map(doc => {
                const docData = doc.data();
                // Parse dataJson back to object for use in the app
                const data = docData.dataJson ? JSON.parse(docData.dataJson) : docData.data;
                return { id: doc.id, ...docData, data };
            });
            presets.sort((a, b) => {
                const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
                const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
                return timeB - timeA; // Descending
            });

            this._presetsCache[key] = presets;
            this._lastPresetsFetch[key] = now;
            return presets;
        } catch (e) {
            console.error('Error loading presets from Firestore:', e);
            return this._presetsCache[key] || [];
        }
    }

    // Save a new preset
    async savePreset(name, folderId, sequencerData, shareId = null) {
        console.log('DEBUG: savePreset called with:', { name, folderId, shareId, dataKeys: Object.keys(sequencerData) });
        try {
            const preset = {
                name: name,
                folderId: folderId || null,
                shareId: shareId || null, // Associate with URL parameter for isolation
                ownerId: this.userId,     // Track ownership
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                dataJson: JSON.stringify(sequencerData) // Store as JSON string to avoid nested array limitation
            };
            console.log('DEBUG: Adding preset to Firestore...');
            const docRef = await this.presetsRef.add(preset);
            console.log('DEBUG: Preset saved successfully with ID:', docRef.id);
            const created = { id: docRef.id, name, folderId: folderId || null, shareId: shareId || null, data: sequencerData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            // Invalidate cache on mutations
            this.clearCache();
            return created;
        } catch (e) {
            console.error('ERROR: Failed to save preset to Firestore:', e);
            return null;
        }
    }

    // Update an existing preset
    async updatePreset(presetId, sequencerData) {
        try {
            await this.presetsRef.doc(presetId).update({
                dataJson: JSON.stringify(sequencerData),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            this.clearCache();
            return true;
        } catch (e) {
            console.error('Error updating preset:', e);
        }
    }

    // Rename preset
    async renamePreset(presetId, newName) {
        try {
            await this.presetsRef.doc(presetId).update({
                name: newName,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            if (this._presetsCache) {
                const p = this._presetsCache.find(p => p.id === presetId);
                if (p) {
                    p.name = newName;
                    p.updatedAt = new Date().toISOString();
                }
            }
            this.clearCache();
        } catch (e) {
            console.error('Error renaming preset:', e);
        }
    }

    // Move preset to folder
    async movePreset(presetId, folderId) {
        try {
            await this.presetsRef.doc(presetId).update({
                folderId: folderId || null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            if (this._presetsCache) {
                const p = this._presetsCache.find(p => p.id === presetId);
                if (p) {
                    p.folderId = folderId || null;
                    p.updatedAt = new Date().toISOString();
                }
            }
            this.clearCache();
        } catch (e) {
            console.error('Error moving preset:', e);
        }
    }

    // Delete preset
    async deletePreset(presetId) {
        try {
            await this.presetsRef.doc(presetId).delete();
            this.clearCache();
        } catch (e) {
            console.error('Error deleting preset:', e);
        }
    }

    // Get preset by ID
    async getPreset(presetId) {
        try {
            const doc = await this.presetsRef.doc(presetId).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (e) {
            console.error('Error getting preset:', e);
            return null;
        }
    }

    // Get presets by folder (uses cache for performance)
    getPresetsByFolder(folderId) {
        if (!this._presetsCache) return [];
        return this._presetsCache.filter(p => p.folderId === folderId);
    }

    // ==================== USER CONFIG ====================
    async saveUserConfig(configData, contextId = null) {
        if (!this.userId) return;
        try {
            const data = {
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (contextId) {
                // Save as an override for a specific share
                data[`overrides.${contextId}`] = configData;
            } else {
                // Save as the main default config
                data.config = configData;
            }

            await this.userConfigsRef.doc(this.userId).update(data).catch(async (err) => {
                // If document doesn't exist, create it with set
                if (err.code === 'not-found') {
                    const initialData = contextId
                        ? { overrides: { [contextId]: configData } }
                        : { config: configData };
                    await this.userConfigsRef.doc(this.userId).set(initialData);
                } else {
                    throw err;
                }
            });
        } catch (e) {
            console.error('Error saving user config:', e);
        }
    }

    async getUserConfig(contextId = null) {
        if (!this.userId) return null;
        try {
            const doc = await this.userConfigsRef.doc(this.userId).get();
            if (doc.exists) {
                const data = doc.data();
                if (contextId) {
                    return (data.overrides && data.overrides[contextId]) ? data.overrides[contextId] : null;
                }
                return data.config;
            }
        } catch (e) {
            console.error('Error getting user config:', e);
        }
        return null;
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
        this.hitSoundEnabled = false;
        this.hitSoundType = 'metronome';
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
            if (this.hitCriteria === 'nice' || this.hitCriteria === 'great' || this.hitCriteria === 'excellent') {
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

        // Play hit sound if enabled
        if (isHit && this.hitSoundEnabled) {
            this.seq.audio.playInstrument(this.hitSoundType);
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

        // Initialize step size from CSS to respect media queries (e.g. 30px on mobile, 48px on PC)
        const initialCSSSize = getComputedStyle(this.grid).getPropertyValue('--step-size');
        this.currentStepSize = parseFloat(initialCSSSize) || 48;
        this.sequencerContainer = document.querySelector('.sequencer-container');

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
        this.configOffBeatModeSelect = document.getElementById('config-offbeat-mode-select');
        this.configHitSoundSelect = document.getElementById('config-hit-sound-select');
        this.configHitSoundTypeSelect = document.getElementById('config-hit-sound-type-select');

        this.touchDraggedBarIndex = null;

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
        this.headerNewProjectBtn = document.getElementById('header-new-project-btn');
        this.presetPanelClose = document.getElementById('preset-panel-close');

        this.userId = null;
        this.currentShareId = null; // Track current share context
        this.hasUnsavedChanges = false;
        this.isInitializing = true; // Block auto-save during initialization

        // Track Settings Elements
        this.trackSettingsPanel = document.getElementById('track-settings-panel');
        this.trackSettingsOverlay = document.getElementById('track-settings-overlay');
        this.trackSettingsCloseBtn = document.getElementById('track-settings-panel-close');
        this.trackSettingsTitle = document.getElementById('track-settings-title');
        this.trackInstPanelSelect = document.getElementById('track-inst-panel-select');
        this.trackVolNumber = document.getElementById('track-vol-number');
        this.trackVolRange = document.getElementById('track-vol-range');
        this.trackDeleteBtn = document.getElementById('track-delete-btn');
        this.syncInstAllBtn = document.getElementById('sync-inst-all-btn');
        this.syncVolAllBtn = document.getElementById('sync-vol-all-btn');
        this.trackPanNumber = document.getElementById('track-pan-number');
        this.trackPanRange = document.getElementById('track-pan-range');
        this.syncPanAllBtn = document.getElementById('sync-pan-all-btn');
        this.trackMuteBtn = document.getElementById('track-mute-btn');
        this.syncMuteAllBtn = document.getElementById('sync-mute-all-btn');

        // Track Management (Add/Delete)
        this.trackAddAfterBtn = document.getElementById('track-add-after-btn');
        this.syncAddAfterAllBtn = document.getElementById('sync-add-after-all-btn');
        this.syncDeleteAllBtn = document.getElementById('sync-delete-all-btn');
        this.trackAddAfterLabel = document.getElementById('track-add-after-label');
        this.trackDeleteLabel = document.getElementById('track-delete-label');
        this.trackNameInput = document.getElementById('track-name-input');
        this.syncNameAllBtn = document.getElementById('sync-name-all-btn');

        this.currentSettingsTrack = null; // { barIndex, trackIndex }

        // Browser-level unsaved changes warning
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                // For modern browsers
                e.preventDefault();
                // Some browsers require a return value to be set.
                // Note: The actual string is usually ignored by modern browsers.
                const msg = '変更が保存されていません。終了しますか？';
                e.returnValue = msg;
                return msg;
            }
        });
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

        // Track current share ID from URL (for isolating presets/projects by URL)
        const urlParams = new URLSearchParams(window.location.search);
        this.currentShareId = urlParams.get('s') || null;

        // Current Preset Info
        this.currentProjectDisplay = document.getElementById('current-project-name');
        this.currentPresetDisplay = document.getElementById('current-preset-name');

        // Debounce timer for Firebase config sync
        this.configSyncTimeout = null;

        // Initial UI Visibility State
        const hasParams = !!(this.currentShareId || urlParams.get('d') || urlParams.get('data'));
        this.updatePresetPanelVisibility(hasParams);

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

        this.setupPinchZoom();

        // Immediate initial render (ensures app works while Auth/Presets load)
        this.renderGrid();
    }

    async init() {
        console.log("UI: Starting async data loading...");
        try {
            const urlParams = new URLSearchParams(window.location.search);
            this.currentShareId = urlParams.get('s');

            const hasShare = await this.loadFromUrlParams(); // Load share data from URL
            this.renderGrid();

            // Handle Context-Aware Persistence
            if (this.currentShareId) {
                console.log(`UI: Share detected (${this.currentShareId}), loading user override`);
                const shareOverride = await this.presetManager.getUserConfig(this.currentShareId);
                if (shareOverride) {
                    this.applyConfig(shareOverride);
                    this.renderGrid(); // Force re-render after config
                }
            } else {
                console.log("UI: No share detected, using factory defaults for main page");
                // Reset Project/Preset display to None
                if (this.currentProjectDisplay) this.currentProjectDisplay.innerText = 'None';
                if (this.currentPresetDisplay) this.currentPresetDisplay.innerText = 'None';
            }
        } catch (e) {
            console.error("UI: Error during init loading:", e);
        }

        try {
            await this.renderPresetList();
            await this.renderFolderList();
        } catch (e) {
            console.error("UI: Error loading presets/folders:", e);
        }

        this.isInitializing = false; // Enable auto-save
        this.clearUrlParams(); // Clean the URL
        console.log("UI: Async data loading complete for UserID:", this.userId);
    }

    clearUrlParams() {
        const url = new URL(window.location.href);
        const s = url.searchParams.get('s');
        const d = url.searchParams.get('d');
        const data = url.searchParams.get('data');

        // Update current share context (should already be set in init, but for safety)
        if (s) this.currentShareId = s;

        if (url.search) {
            const newUrl = new URL(url.pathname, url.origin);
            if (s) newUrl.searchParams.set('s', s);
            if (d) newUrl.searchParams.set('d', d);
            if (data) newUrl.searchParams.set('data', data);

            // Only update if the URL actually changed (i.e. we removed some params)
            if (url.search !== newUrl.search) {
                console.log("UI: Cleaning URL parameters (preserving share IDs)");
                window.history.replaceState({}, document.title, newUrl.pathname + newUrl.search);
            }
        }
    }

    applyConfig(config) {
        if (!config) return;

        if (config.bpm) {
            this.seq.bpm = config.bpm;
            if (this.bpmInput) this.bpmInput.value = config.bpm;
            if (this.bpmNumber) this.bpmNumber.value = config.bpm;
            if (this.configBpmInput) this.configBpmInput.value = config.bpm;
            if (this.configBpmNumber) this.configBpmNumber.value = config.bpm;
        }

        if (config.vol !== undefined) {
            const vol = parseFloat(config.vol);
            if (this.configMasterVol) this.configMasterVol.value = vol;
            if (this.configVolNumber) this.configVolNumber.value = Math.round(vol * 100);
            if (this.seq.audio.isInitialized) {
                this.seq.audio.masterGain.gain.value = vol;
            }
        }

        if (config.ts) {
            this.seq.timeSignature = config.ts;
            if (this.configTimeSigSelect) this.configTimeSigSelect.value = config.ts;
        }

        if (config.sd) {
            const sdVal = parseInt(config.sd);
            if (this.configSubdivSelect) this.configSubdivSelect.value = sdVal;
            this.seq.subdivision = sdVal; // Sync global setting
            this.seq.bars.forEach((bar, barIndex) => {
                for (let i = 0; i < bar.beats.length; i++) {
                    this.seq.updateBeatSubdivision(barIndex, i, sdVal);
                }
            });
        }

        if (config.pb) {
            this.seq.playbackMode = config.pb;
            if (this.configPlaybackModeSelect) this.configPlaybackModeSelect.value = config.pb;
        }

        if (config.sse !== undefined) {
            this.stepSoundEnabled = config.sse === '1' || config.sse === 1;
            console.log("UI: Applying Step Sound Enabled:", this.stepSoundEnabled);
            if (this.configStepSoundSelect) this.configStepSoundSelect.value = this.stepSoundEnabled ? 'sound' : 'mute';
        }

        if (config.gs) {
            this.seq.noteSpeed = parseFloat(config.gs);
            if (this.configGameSpeedSlider) this.configGameSpeedSlider.value = config.gs;
            if (this.configGameSpeedVal) this.configGameSpeedVal.innerText = parseFloat(config.gs).toFixed(1);
            this.seq.updateScheduleAheadTime();
        }

        if (config.ob !== undefined) {
            this.seq.offBeatMode = config.ob === '1' || config.ob === 1;
            if (this.configOffBeatModeSelect) this.configOffBeatModeSelect.value = this.seq.offBeatMode ? 'on' : 'off';
        }

        if (config.hc) {
            this.game.hitCriteria = config.hc;
            if (this.configHitCriteriaSelect) this.configHitCriteriaSelect.value = config.hc;
        }

        if (config.hse !== undefined) {
            this.game.hitSoundEnabled = config.hse === '1' || config.hse === 1;
            if (this.configHitSoundSelect) this.configHitSoundSelect.value = this.game.hitSoundEnabled ? 'sound' : 'mute';
        }

        if (config.hst) {
            console.log("UI: Applying Hit Sound Type:", config.hst);
            this.game.hitSoundType = config.hst;
            if (this.configHitSoundTypeSelect) this.configHitSoundTypeSelect.value = config.hst;
        }
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

        // Populate Hit Sound Type select
        this.configHitSoundTypeSelect.innerHTML = '';
        Object.keys(this.seq.audio.instruments).forEach(inst => {
            const opt = document.createElement('option');
            opt.value = inst;
            opt.innerText = inst.charAt(0).toUpperCase() + inst.slice(1);
            this.configHitSoundTypeSelect.appendChild(opt);
        });

        // Set initial values
        this.configTimeSigSelect.value = this.seq.timeSignature;
        this.configPlaybackModeSelect.value = this.seq.playbackMode;
        this.configHitCriteriaSelect.value = this.game.hitCriteria;
        this.configOffBeatModeSelect.value = this.seq.offBeatMode ? 'on' : 'off';
        this.configHitSoundSelect.value = this.game.hitSoundEnabled ? 'sound' : 'mute';
        this.configHitSoundTypeSelect.value = this.game.hitSoundType;
        if (this.stepActionSelect) this.stepActionSelect.value = 'sel-step';
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
            this.markDirty();

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

        // Track Name Listeners
        if (this.trackNameInput) {
            this.trackNameInput.addEventListener('input', (e) => {
                const { barIndex, trackIndex } = this.currentSettingsTrack;
                const track = this.seq.bars[barIndex].tracks[trackIndex];
                track.name = e.target.value;
                this.markDirty();
                this.renderGrid();
            });
        }

        if (this.syncNameAllBtn) {
            this.syncNameAllBtn.addEventListener('click', () => {
                const { barIndex, trackIndex } = this.currentSettingsTrack;
                const sourceTrack = this.seq.bars[barIndex].tracks[trackIndex];
                const newName = sourceTrack.name;

                this.seq.bars.forEach(bar => {
                    if (bar.tracks[trackIndex]) {
                        bar.tracks[trackIndex].name = newName;
                    }
                });

                this.markDirty();
                this.renderGrid();
                this.showToast(`Sync naming "${newName}" to all bars`);
            });
        }
    }

    setupPinchZoom() {
        if (!this.grid) return;

        let initialDist = 0;
        let baseStepSize = this.currentStepSize;

        const getDistance = (touches) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        this.grid.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                initialDist = getDistance(e.touches);
                baseStepSize = this.currentStepSize;
            }
        }, { passive: true });

        this.grid.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                if (e.cancelable) e.preventDefault();

                const currentDist = getDistance(e.touches);
                if (initialDist > 0) {
                    const ratio = currentDist / initialDist;
                    let newSize = baseStepSize * ratio;

                    // Clamp step size between 8px and 120px
                    newSize = Math.max(8, Math.min(120, newSize));

                    this.currentStepSize = newSize;
                    this.grid.style.setProperty('--step-size', `${this.currentStepSize}px`);
                }
            }
        }, { passive: false });

        this.grid.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                initialDist = 0;
            }
        }, { passive: true });
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
            this.markDirty();
            this.saveConfigToFirebase();

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
            this.markDirty();
            this.saveConfigToFirebase();
        };

        this.configMasterVol.addEventListener('input', (e) => updateVol(e.target.value, e.target, true));
        this.configVolNumber.addEventListener('change', (e) => updateVol(e.target.value, e.target, false));

        // Time Sig
        this.configTimeSigSelect.addEventListener('change', (e) => {
            this.seq.updateSettings(this.seq.bpm, parseInt(e.target.value));
            this.markDirty();
            this.saveConfigToFirebase();
        });

        // Subdivision
        this.configSubdivSelect.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            this.seq.subdivision = val; // Store globally
            this.seq.bars.forEach((bar, barIndex) => {
                for (let i = 0; i < bar.beats.length; i++) {
                    this.seq.updateBeatSubdivision(barIndex, i, val);
                }
            });
            this.markDirty();
            this.renderGrid();
            this.saveConfigToFirebase();
        });

        // Playback Mode
        this.configPlaybackModeSelect.addEventListener('change', (e) => {
            this.seq.playbackMode = e.target.value;
            this.markDirty();
            this.saveConfigToFirebase();
        });

        // Step Sound Mode
        this.configOffBeatModeSelect.addEventListener('change', (e) => {
            this.seq.offBeatMode = (e.target.value === 'on');
            this.markDirty();
            this.saveConfigToFirebase();
        });

        this.configHitSoundSelect.addEventListener('change', (e) => {
            this.game.hitSoundEnabled = (e.target.value === 'sound');
            this.markDirty();
            this.saveConfigToFirebase();
        });

        // Track Settings Panel Listeners
        addTapListener(this.trackSettingsCloseBtn, () => this.closeTrackSettings());
        addTapListener(this.trackSettingsOverlay, () => this.closeTrackSettings());

        this.trackInstPanelSelect.addEventListener('change', (e) => {
            if (!this.currentSettingsTrack) return;
            const { barIndex, trackIndex } = this.currentSettingsTrack;
            this.seq.changeTrackType(barIndex, trackIndex, e.target.value);
            this.markDirty();
            this.renderGrid();
            this.saveConfigToFirebase();
        });

        const updateTrackVol = (val, isSlider) => {
            if (!this.currentSettingsTrack) return;
            const { barIndex, trackIndex } = this.currentSettingsTrack;

            let v = parseFloat(val);
            if (isNaN(v)) return;

            const sliderVal = isSlider ? v : Math.max(0, Math.min(100, Math.round(v))) / 100;
            const numberVal = isSlider ? Math.round(v * 100) : Math.max(0, Math.min(100, Math.round(v)));

            this.trackVolRange.value = sliderVal;
            this.trackVolNumber.value = numberVal;

            this.seq.changeTrackVolume(barIndex, trackIndex, sliderVal);
            this.markDirty();
            this.saveConfigToFirebase();
        };

        this.trackVolRange.addEventListener('input', (e) => updateTrackVol(e.target.value, true));
        this.trackVolNumber.addEventListener('change', (e) => updateTrackVol(e.target.value, false));

        addTapListener(this.syncInstAllBtn, () => {
            if (!this.currentSettingsTrack) return;
            const { trackIndex } = this.currentSettingsTrack;
            const newType = this.trackInstPanelSelect.value;
            this.seq.syncTrackTypeAcrossBars(trackIndex, newType);
            this.markDirty();
            this.renderGrid();
            this.saveConfigToFirebase();
        });

        addTapListener(this.syncVolAllBtn, () => {
            if (!this.currentSettingsTrack) return;
            const { trackIndex } = this.currentSettingsTrack;
            const vol = parseFloat(this.trackVolRange.value);
            this.seq.syncTrackVolumeAcrossBars(trackIndex, vol);
            this.markDirty();
            this.renderGrid();
            this.saveConfigToFirebase();
        });

        const updateTrackPan = (val, isSlider) => {
            if (!this.currentSettingsTrack) return;
            const { barIndex, trackIndex } = this.currentSettingsTrack;

            let v = parseFloat(val);
            if (isNaN(v)) return;

            const sliderVal = isSlider ? v : Math.max(-100, Math.min(100, Math.round(v))) / 100;
            const numberVal = isSlider ? Math.round(v * 100) : Math.max(-100, Math.min(100, Math.round(v)));

            this.trackPanRange.value = sliderVal;
            this.trackPanNumber.value = numberVal;

            this.seq.changeTrackPan(barIndex, trackIndex, sliderVal);
            this.markDirty();
            this.saveConfigToFirebase();
        };

        this.trackPanRange.addEventListener('input', (e) => updateTrackPan(e.target.value, true));
        this.trackPanNumber.addEventListener('change', (e) => updateTrackPan(e.target.value, false));

        addTapListener(this.syncPanAllBtn, () => {
            if (!this.currentSettingsTrack) return;
            const { trackIndex } = this.currentSettingsTrack;
            const pan = parseFloat(this.trackPanRange.value);
            this.seq.syncTrackPanAcrossBars(trackIndex, pan);
            this.markDirty();
            this.renderGrid();
            this.saveConfigToFirebase();
        });

        addTapListener(this.trackDeleteBtn, () => {
            if (!this.currentSettingsTrack) return;
            const { barIndex, trackIndex } = this.currentSettingsTrack;
            this.seq.removeTrack(barIndex, trackIndex);
            this.markDirty();
            this.renderGrid();
            this.closeTrackSettings();
            this.saveConfigToFirebase();
        });

        addTapListener(this.syncDeleteAllBtn, () => {
            if (!this.currentSettingsTrack) return;
            const { trackIndex } = this.currentSettingsTrack;
            if (confirm(`Delete Track ${trackIndex + 1} from ALL bars?`)) {
                this.seq.syncRemoveTrackAcrossBars(trackIndex);
                this.markDirty();
                this.renderGrid();
                this.closeTrackSettings();
                this.saveConfigToFirebase();
            }
        });

        addTapListener(this.trackAddAfterBtn, () => {
            if (!this.currentSettingsTrack) return;
            const { barIndex } = this.currentSettingsTrack;
            const type = this.trackInstPanelSelect.value;
            this.seq.addTrack(barIndex, type);
            this.markDirty();
            this.renderGrid();
            this.closeTrackSettings();
            this.saveConfigToFirebase();
        });

        addTapListener(this.syncAddAfterAllBtn, () => {
            if (!this.currentSettingsTrack) return;
            const { barIndex } = this.currentSettingsTrack;
            const currentBar = this.seq.bars[barIndex];
            if (!currentBar) return;
            const targetCount = currentBar.tracks.length + 1;
            const type = this.trackInstPanelSelect.value;
            this.seq.syncAppendTrackAcrossBars(targetCount, type);
            this.markDirty();
            this.renderGrid();
            this.closeTrackSettings();
            this.saveConfigToFirebase();
        });

        this.configHitSoundTypeSelect.addEventListener('change', (e) => {
            this.game.hitSoundType = e.target.value;
            this.markDirty();
            this.saveConfigToFirebase();
        });

        const toggleMute = () => {
            console.log("UI: Toggle Mute Clicked");
            if (!this.currentSettingsTrack) return;
            const { barIndex, trackIndex } = this.currentSettingsTrack;
            const track = this.seq.bars[barIndex].tracks[trackIndex];
            const newMuted = !track.muted;

            this.seq.changeTrackMute(barIndex, trackIndex, newMuted);

            this.trackMuteBtn.innerText = newMuted ? "Mute: ON" : "Mute: OFF";
            this.trackMuteBtn.classList.toggle('active', newMuted);

            this.markDirty();
            this.renderGrid();
            this.saveConfigToFirebase();
        };

        addTapListener(this.trackMuteBtn, toggleMute);

        addTapListener(this.syncMuteAllBtn, () => {
            if (!this.currentSettingsTrack) return;
            const { barIndex, trackIndex } = this.currentSettingsTrack;
            const track = this.seq.bars[barIndex].tracks[trackIndex];
            this.seq.syncTrackMuteAcrossBars(trackIndex, !!track.muted);
            this.markDirty();
            this.renderGrid();
            this.saveConfigToFirebase();
        });

        this.configStepSoundSelect.addEventListener('change', (e) => {
            this.stepSoundEnabled = (e.target.value === 'sound');
            this.saveConfigToFirebase();
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
            this.markDirty();
            this.saveConfigToFirebase();
        });

        // Hit Criteria
        this.configHitCriteriaSelect.addEventListener('change', (e) => {
            this.game.hitCriteria = e.target.value;
            this.markDirty();
            this.saveConfigToFirebase();
        });

        // Result Reset
        addTapListener(this.configResultResetBtn, () => {
            this.game.resetStats();
        });
    }

    saveConfigToFirebase() {
        if (this.isInitializing) return; // Don't save while loading
        if (this.configSyncTimeout) clearTimeout(this.configSyncTimeout);

        this.configSyncTimeout = setTimeout(() => {
            const configData = {
                bpm: parseInt(this.configBpmNumber ? this.configBpmNumber.value : 120),
                vol: this.configMasterVol ? parseFloat(this.configMasterVol.value) : 0.5,
                ts: parseInt(this.configTimeSigSelect ? this.configTimeSigSelect.value : 4),
                sd: parseInt(this.configSubdivSelect ? this.configSubdivSelect.value : 4),
                pb: this.configPlaybackModeSelect ? this.configPlaybackModeSelect.value : 'stop',
                sse: this.stepSoundEnabled ? 1 : 0,
                gs: parseFloat(this.configGameSpeedSlider ? this.configGameSpeedSlider.value : 1.0),
                ob: this.seq.offBeatMode ? 1 : 0,
                hc: this.game.hitCriteria,
                hse: this.game.hitSoundEnabled ? 1 : 0,
                hst: this.game.hitSoundType
            };
            console.log("UI: Syncing config to Firebase (Context:", this.currentShareId || "Default", "):", configData);
            this.presetManager.saveUserConfig(configData, this.currentShareId);
        }, 1000); // 1 second debounce (reduced from 2s for better persistence)
    }

    markDirty() {
        if (!this.hasUnsavedChanges) {
            console.log('UI: Unsaved changes detected');
            this.hasUnsavedChanges = true;
        }
    }

    markClean() {
        if (this.hasUnsavedChanges) {
            console.log('UI: Changes saved or reset');
            this.hasUnsavedChanges = false;
        }
    }

    /**
     * Execute the selected step action based on the dropdown value
     */
    executeStepAction(barIndex, trackIndex, beatIndex, stepIndex) {
        this.markDirty();
        const action = this.stepActionSelect.value;
        const track = this.seq.bars[barIndex].tracks[trackIndex];

        const currentState = track.pattern[beatIndex][stepIndex];
        let targetState = true;
        if (action.includes('nogame')) targetState = 'nogame';
        const actualState = (currentState === targetState) ? false : targetState;

        switch (action) {
            case 'toggle':
                this.seq.toggleStep(barIndex, trackIndex, beatIndex, stepIndex);
                console.log(`Debug: Toggled Step [${barIndex},${trackIndex},${beatIndex},${stepIndex}] to ${track.pattern[beatIndex][stepIndex]}`);
                break;
            case 'toggle-nogame':
                this.seq.toggleStepNoGame(barIndex, trackIndex, beatIndex, stepIndex);
                console.log(`Debug: Toggled NoGame Step [${barIndex},${trackIndex},${beatIndex},${stepIndex}] to ${track.pattern[beatIndex][stepIndex]}`);
                break;

            // SELECT/TOGGLE actions
            case 'sel-step':
            case 'sel-nogame-step':
                this.seq.setStepState(barIndex, trackIndex, beatIndex, stepIndex, actualState);
                break;
            case 'sel-col':
            case 'sel-nogame-col':
                this.seq.setColumnAllBarsState(beatIndex, stepIndex, actualState);
                break;
            case 'sel-col-track':
            case 'sel-nogame-col-track':
                this.seq.setColumnTrackState(barIndex, trackIndex, beatIndex, stepIndex, actualState);
                break;
            case 'sel-bar':
            case 'sel-nogame-bar':
                this.seq.setBarStepState(barIndex, stepIndex, actualState);
                break;
            case 'sel-bar-track':
            case 'sel-nogame-bar-track':
                this.seq.setBarTrackState(barIndex, trackIndex, stepIndex, actualState);
                break;
            case 'sel-global':
            case 'sel-nogame-global':
                this.seq.setGlobalStepState(stepIndex, actualState);
                break;
            case 'sel-global-track':
            case 'sel-nogame-global-track':
                this.seq.setProjectTrackState(barIndex, trackIndex, stepIndex, actualState);
                break;
            case 'sel-bar-col':
            case 'sel-nogame-bar-col':
                this.seq.setColumnState(barIndex, beatIndex, stepIndex, actualState);
                break;
            case 'sel-bar-all':
            case 'sel-nogame-bar-all':
                this.seq.setBarState(barIndex, actualState);
                break;
            case 'sel-bar-row':
            case 'sel-nogame-bar-row':
                this.seq.setBarTrackRowState(barIndex, trackIndex, actualState);
                break;
            case 'sel-global-all':
            case 'sel-nogame-global-all':
                this.seq.setGlobalState(actualState);
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
            systemContainer.dataset.barIndex = barIndex;
            // Added 30px column at the end for the + button
            // Increased label column from 170px to 200px to accommodate drag handle
            systemContainer.style.gridTemplateColumns = `200px repeat(${bar.beats.length}, auto) 30px`;

            // Bar Drag and Drop
            systemContainer.draggable = true;
            systemContainer.addEventListener('dragstart', (e) => {
                // If dragging from an input or something that shouldn't start a bar drag, prevent it
                if (e.target.tagName === 'INPUT' || e.target.closest('.subdiv-btn') || e.target.closest('.beat-header')) {
                    // e.preventDefault(); // This might break beat dragging if they are nested
                    // Actually beatHeader has its own dragstart.
                    // If e.target is beatHeader, let it bubble? 
                    // No, we want to distinguish.
                }

                // Check if we are dragging by the handle (optional but better)
                // For now, let's allow dragging the whole container unless it's a specific element
                if (e.target.closest('.beat-header')) return; // Let beat dragging handle it

                e.dataTransfer.setData('application/x-bar-index', barIndex);
                e.dataTransfer.effectAllowed = 'move';
                systemContainer.classList.add('dragging-bar');

                // Set drag image if needed, or just let it be
            });

            systemContainer.addEventListener('dragend', () => {
                systemContainer.classList.remove('dragging-bar');
                document.querySelectorAll('.system-container').forEach(el => el.classList.remove('drag-over-bar'));
            });

            systemContainer.addEventListener('dragover', (e) => {
                if (!e.dataTransfer.types.includes('application/x-bar-index')) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                systemContainer.classList.add('drag-over-bar');
            });

            systemContainer.addEventListener('dragleave', () => {
                systemContainer.classList.remove('drag-over-bar');
            });

            systemContainer.addEventListener('drop', (e) => {
                const fromIndexStr = e.dataTransfer.getData('application/x-bar-index');
                if (!fromIndexStr) return;
                e.preventDefault();
                systemContainer.classList.remove('drag-over-bar');

                const fromIndex = parseInt(fromIndexStr);
                const toIndex = barIndex;

                if (fromIndex !== toIndex) {
                    this.seq.moveBar(fromIndex, toIndex);
                    this.markDirty();
                    this.renderGrid();
                }
            });

            // Delete Bar Button
            const barDelBtn = document.createElement('button');
            barDelBtn.innerText = '×';
            barDelBtn.className = 'bar-del-btn';
            barDelBtn.title = 'Delete Bar';
            barDelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.seq.removeBar(barIndex);
                this.markDirty();
                this.renderGrid();
            });
            systemContainer.appendChild(barDelBtn);

            // 1. Header (Subdivision)
            const emptyHeader = document.createElement('div');
            emptyHeader.className = 'grid-row-label bar-header-label';
            emptyHeader.style.color = '#8b9bb4';
            emptyHeader.style.fontSize = '0.9rem';
            emptyHeader.style.paddingLeft = '5px';
            emptyHeader.style.display = 'flex';
            emptyHeader.style.alignItems = 'center';
            emptyHeader.style.gap = '5px';
            emptyHeader.style.whiteSpace = 'nowrap';
            emptyHeader.style.overflow = 'hidden';
            emptyHeader.style.minWidth = '0';

            // Drag Handle
            const dragHandle = document.createElement('div');
            dragHandle.className = 'bar-drag-handle';
            dragHandle.innerHTML = '&#8942;&#8942;'; // Vertically stacked dots (⋮⋮)
            dragHandle.title = 'Drag to reorder';

            // Touch Support for Bar Reordering
            dragHandle.addEventListener('touchstart', (e) => {
                // e.preventDefault(); // Don't prevent default on start to allow potential taps
                e.stopPropagation();
                this.touchDraggedBarIndex = barIndex;
                systemContainer.classList.add('dragging-bar');
            }, { passive: true });

            dragHandle.addEventListener('touchmove', (e) => {
                if (this.touchDraggedBarIndex === null) return;

                // Prevent scrolling while dragging the handle
                if (e.cancelable) e.preventDefault();

                const touch = e.touches[0];
                const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
                const targetContainer = targetEl?.closest('.system-container');

                // Clear previous drop highlights for Bars
                document.querySelectorAll('.system-container').forEach(el => el.classList.remove('drag-over-bar'));

                if (targetContainer && targetContainer !== systemContainer) {
                    targetContainer.classList.add('drag-over-bar');
                }
            }, { passive: false });

            dragHandle.addEventListener('touchend', (e) => {
                if (this.touchDraggedBarIndex === null) return;

                const touch = e.changedTouches[0];
                const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
                const targetContainer = targetEl?.closest('.system-container');

                const fromIndex = this.touchDraggedBarIndex;
                this.touchDraggedBarIndex = null;

                systemContainer.classList.remove('dragging-bar');
                document.querySelectorAll('.system-container').forEach(el => el.classList.remove('drag-over-bar'));

                if (targetContainer) {
                    const toIndex = parseInt(targetContainer.dataset.barIndex);
                    if (fromIndex !== toIndex) {
                        this.seq.moveBar(fromIndex, toIndex);
                        this.renderGrid();
                    }
                }
            });

            emptyHeader.appendChild(dragHandle);

            const labelSpan = document.createElement('span');
            labelSpan.innerText = `Bar ${barIndex + 1}`;
            labelSpan.style.cursor = 'pointer';
            labelSpan.style.padding = '2px 6px';
            labelSpan.style.borderRadius = '4px';
            labelSpan.style.transition = 'all 0.2s';
            labelSpan.title = 'Click to play this bar only';

            labelSpan.addEventListener('mouseenter', () => {
                labelSpan.style.background = 'rgba(255, 255, 255, 0.1)';
                labelSpan.style.color = '#fff';
            });
            labelSpan.addEventListener('mouseleave', () => {
                labelSpan.style.background = 'transparent';
                labelSpan.style.color = '#8b9bb4';
            });

            labelSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                this.seq.playBar(barIndex);
            });
            emptyHeader.appendChild(labelSpan);

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'bar-name-input';
            nameInput.value = bar.name || '';
            nameInput.placeholder = 'Bar Name';
            nameInput.addEventListener('change', (e) => {
                bar.name = e.target.value;
            });
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.isComposing) {
                    nameInput.blur();
                }
            });
            emptyHeader.appendChild(nameInput);

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
            valLabel.className = 'grid-row-label bar-header-label step-value-label';
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
            bar.tracks.forEach((track, tIndex) => {
                // Label
                const labelCell = document.createElement('div');
                labelCell.className = 'grid-row-label clickable' + (track.muted ? ' muted' : '');
                labelCell.title = 'Click to open track settings | Drag label to reorder locally | Drag handle to reorder globally';

                // Track Drag and Drop (Local & Global)
                labelCell.draggable = true;

                let isGlobalGrab = false;

                labelCell.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('application/x-track-reorder', JSON.stringify({
                        barIndex: barIndex,
                        trackIndex: tIndex,
                        isGlobal: isGlobalGrab
                    }));
                    e.dataTransfer.effectAllowed = 'move';
                    labelCell.classList.add('dragging-track');
                });

                labelCell.addEventListener('dragend', () => {
                    labelCell.classList.remove('dragging-track');
                    document.querySelectorAll('.grid-row-label').forEach(el => el.classList.remove('drag-over-track'));
                });

                labelCell.addEventListener('dragover', (e) => {
                    if (!e.dataTransfer.types.includes('application/x-track-reorder')) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    labelCell.classList.add('drag-over-track');
                });

                labelCell.addEventListener('dragleave', () => {
                    labelCell.classList.remove('drag-over-track');
                });

                labelCell.addEventListener('drop', (e) => {
                    const dataStr = e.dataTransfer.getData('application/x-track-reorder');
                    if (!dataStr) return;
                    e.preventDefault();
                    labelCell.classList.remove('drag-over-track');

                    try {
                        const data = JSON.parse(dataStr);
                        const fromTrackIndex = data.trackIndex;
                        const toTrackIndex = tIndex;

                        if (fromTrackIndex === toTrackIndex) return;

                        if (data.isGlobal) {
                            // Global Move
                            this.seq.moveTrackGlobal(fromTrackIndex, toTrackIndex);
                        } else {
                            // Local Move (Only if in the same bar)
                            if (data.barIndex === barIndex) {
                                this.seq.moveTrack(barIndex, fromTrackIndex, toTrackIndex);
                            } else {
                                // Optional: Allow moving across bars? The user said "そのBarのTRACKだけ"
                                // This might mean move from one bar to another, but let's stick to intra-bar local move for now.
                                return;
                            }
                        }

                        this.markDirty();
                        this.renderGrid();
                    } catch (err) {
                        console.error("Track Drop Error", err);
                    }
                });

                // Global Drag Handle (6 dots ::)
                const globalHandle = document.createElement('div');
                globalHandle.className = 'track-drag-handle';
                globalHandle.innerHTML = '&#8942;&#8942;'; // ⋮⋮
                globalHandle.title = 'Drag to reorder across all bars';

                globalHandle.addEventListener('mousedown', () => {
                    isGlobalGrab = true;
                });
                labelCell.addEventListener('mousedown', (e) => {
                    if (!e.target.closest('.track-drag-handle')) {
                        isGlobalGrab = false;
                    }
                });

                labelCell.appendChild(globalHandle);

                // Track Label Delete Button
                const delTrackBtn = document.createElement('button');
                delTrackBtn.className = 'track-label-delete';
                delTrackBtn.innerText = '×';
                delTrackBtn.title = 'Delete Track';
                delTrackBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.seq.removeTrack(barIndex, tIndex);
                    this.renderGrid();
                    this.markDirty();
                    this.saveConfigToFirebase();
                });
                labelCell.appendChild(delTrackBtn);

                const trackNameLabel = document.createElement('span');
                trackNameLabel.className = 'track-number-label';
                labelCell.classList.toggle('has-custom-name', !!track.name);

                const trackPrefix = document.createElement('span');
                trackPrefix.className = 'track-prefix';
                trackPrefix.innerText = `TRACK ${tIndex + 1}`;

                const trackSeparator = document.createElement('span');
                trackSeparator.className = 'track-separator';
                trackSeparator.innerText = ': ';

                trackNameLabel.appendChild(trackPrefix);
                trackNameLabel.appendChild(trackSeparator);
                trackNameLabel.appendChild(document.createTextNode(track.name || ''));
                if (track.muted) {
                    const muteBadge = document.createElement('span');
                    muteBadge.innerText = ' [MUTE]';
                    muteBadge.style.fontSize = '0.6rem';
                    muteBadge.style.color = '#ef4444';
                    trackNameLabel.appendChild(muteBadge);
                }
                labelCell.appendChild(trackNameLabel);

                const instNameSub = document.createElement('span');
                instNameSub.innerText = track.type.toUpperCase();
                instNameSub.className = 'track-instrument-label';
                instNameSub.style.fontSize = '0.65rem';
                instNameSub.style.color = 'var(--primary-color)';
                instNameSub.style.opacity = '0.8';
                labelCell.appendChild(instNameSub);

                labelCell.addEventListener('click', (e) => {
                    if (e.target.closest('.track-label-delete') || e.target.closest('.track-drag-handle')) return;
                    this.openTrackSettings(barIndex, tIndex);
                });

                systemContainer.appendChild(labelCell);

                // Steps
                bar.beats.forEach((beat, bIndex) => {
                    const beatCell = document.createElement('div');
                    beatCell.className = 'beat-cell';
                    beatCell.style.display = 'grid';
                    beatCell.style.gridTemplateColumns = `repeat(${beat.subdivision}, var(--step-size))`;
                    beatCell.style.gap = 'var(--step-gap)';

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
                            if (!this.seq.isPlaying && this.stepSoundEnabled && track.muted !== true) {
                                if (!this.seq.audio.isInitialized) this.seq.audio.init();
                                this.seq.audio.playInstrument(track.type, 0, track.volume);
                            }
                        });
                        beatCell.appendChild(btn);
                    }
                    systemContainer.appendChild(beatCell);
                });
            });

            // 3. Add Track Button INSIDE the Bar
            const addTrackContainer = document.createElement('div');
            addTrackContainer.className = 'add-track-container';
            addTrackContainer.style.gridColumn = '1 / 2';
            addTrackContainer.style.paddingTop = '5px';
            addTrackContainer.style.display = 'flex';
            addTrackContainer.style.justifyContent = 'flex-start';
            addTrackContainer.style.gap = '10px';

            const addTrackBtn = document.createElement('button');
            addTrackBtn.innerText = '+ Track';
            addTrackBtn.className = 'action-btn track-add-btn';
            addTrackBtn.style.fontSize = '0.8rem';
            addTrackBtn.style.padding = '5px 10px';
            addTrackBtn.style.marginTop = '0'; // Override generic
            addTrackBtn.addEventListener('click', () => {
                this.seq.addTrack(barIndex); // Defaults to metronome
                this.markDirty();
                this.renderGrid();
            });

            const copyBarBtn = document.createElement('button');
            copyBarBtn.innerText = 'Copy';
            copyBarBtn.className = 'action-btn bar-copy-btn';
            copyBarBtn.style.fontSize = '0.8rem';
            copyBarBtn.style.padding = '5px 10px';
            copyBarBtn.style.marginTop = '0';
            copyBarBtn.title = 'Duplicate this bar to the end';
            copyBarBtn.addEventListener('click', () => {
                this.seq.duplicateBar(barIndex);
                this.markDirty();
                this.renderGrid();
                // Scroll to the bottom to see the new bar
                setTimeout(() => {
                    this.grid.scrollTop = this.grid.scrollHeight;
                }, 100);
            });

            addTrackContainer.appendChild(addTrackBtn);
            addTrackContainer.appendChild(copyBarBtn);
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
        addBarBtn.className = 'action-btn bar-add-footer-btn';
        // Removed inline font-size and padding to use class style
        // Removed inline background to use class style
        addBarBtn.addEventListener('click', () => {
            this.seq.addBar();
            this.markDirty();
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

        // Header New Project
        if (this.headerNewProjectBtn) {
            addTapListener(this.headerNewProjectBtn, () => this.newProject());
        }
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

    async openPresetPanel() {
        this.presetPanel.classList.remove('hidden');
        this.presetOverlay.classList.remove('hidden');
        // Trigger animation
        requestAnimationFrame(() => {
            this.presetPanel.classList.add('active');
            this.presetOverlay.classList.add('active');
        });
        await this.renderFolderList();
        await this.renderPresetList();
    }

    closePresetPanel() {
        this.presetPanel.classList.remove('active');
        this.presetOverlay.classList.remove('active');
        setTimeout(() => {
            this.presetPanel.classList.add('hidden');
            this.presetOverlay.classList.add('hidden');
        }, 300);
    }

    async openSaveDialog() {
        console.log("DEBUG: Opening Save Dialog. currentShareId:", this.currentShareId);
        this.presetNameInput.value = '';
        this.presetManager.clearCache(); // Force fresh fetch
        await this.updateFolderSelect();

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

    async updateFolderSelect() {
        console.log("DEBUG: updateFolderSelect started. currentShareId:", this.currentShareId);
        const targetShareId = this.currentShareId || null;
        const allFolders = await this.presetManager.getFolders(targetShareId);
        console.log("DEBUG: allFolders received in updateFolderSelect:", allFolders);

        // Filter folders by current shareId (double check)
        const folders = allFolders.filter(f => (f.shareId || null) === targetShareId);
        console.log("DEBUG: Filtered folders for dropdown:", folders);

        this.presetFolderSelect.innerHTML = '<option value="">Root（No Project）</option>';
        folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.id;
            option.textContent = folder.name;
            this.presetFolderSelect.appendChild(option);
        });
    }

    async confirmSavePreset() {
        const name = this.presetNameInput.value.trim();
        if (!name) {
            alert('Please enter a preset name');
            return;
        }

        const folderId = this.presetFolderSelect.value || null;

        // Check for duplicate name within the same folder
        const existingPresets = await this.presetManager.getPresets(this.currentShareId);
        const existingPreset = existingPresets.find(p =>
            p.name.toLowerCase() === name.toLowerCase() &&
            (p.folderId || null) === folderId
        );

        const extraData = {
            hitCriteria: this.game.hitCriteria,
            gameSpeed: this.configGameSpeedVal ? parseFloat(this.configGameSpeedVal.textContent) : 1.0,
            stepAction: this.stepActionSelect ? this.stepActionSelect.value : 'sel-step',
            score: this.game.scoreEl ? parseInt(this.game.scoreEl.textContent) : 0,
            hits: this.game.hitEl ? parseInt(this.game.hitEl.textContent) : 0,
            totalNotes: this.game.totalNotesEl ? parseInt(this.game.totalNotesEl.textContent) : 0,
            combo: this.game.comboEl ? parseInt(this.game.comboEl.textContent) : 0
        };

        const data = this.seq.serialize(extraData);

        if (existingPreset) {
            const confirmed = confirm('同じ名前のPresetがこのフォルダ内に既に存在します。上書きしますか？');
            if (confirmed) {
                await this.presetManager.updatePreset(existingPreset.id, data);
                this.markClean();
                this.closeSaveDialog();
                await this.renderPresetList();
                await this.updateCurrentInfo(name, folderId);
            } else {
                this.presetNameInput.focus();
            }
            return;
        }

        await this.presetManager.savePreset(name, folderId, data, this.currentShareId);
        this.markClean();
        this.closeSaveDialog();
        await this.renderPresetList();
        await this.updateCurrentInfo(name, folderId);
    }

    async newProject() {
        const confirmed = confirm('現在の内容を破棄して新規プロジェクトを開始しますか？');
        if (!confirmed) return;

        this.markClean();

        // Reset Metadata
        this.currentProjectName = 'None';
        this.currentPresetName = 'None';
        this.currentFolderId = null;
        this.currentPresetId = null;

        // Clear Sequencer
        this.seq.bars = [];
        this.seq.addBar();
        this.seq.bpm = 120;

        // Reset UI Elements
        if (this.bpmNumber) this.bpmNumber.value = 120;
        if (this.bpmInput) this.bpmInput.value = 120;
        if (this.configBpmNumber) this.configBpmNumber.value = 120;
        if (this.configBpmInput) this.configBpmInput.value = 120;

        // Reset Game
        this.game.score = 0;
        this.game.hitCount = 0;
        this.game.totalNotes = 0;
        this.game.combo = 0;
        if (this.game.scoreEl) this.game.scoreEl.textContent = '0';
        if (this.game.hitEl) this.game.hitEl.textContent = '0';
        if (this.game.totalNotesEl) this.game.totalNotesEl.textContent = '0';
        if (this.game.comboEl) this.game.comboEl.textContent = '0';

        // Refresh UI
        await this.updateCurrentInfo('None', null);
        this.renderGrid();
    }

    async updateCurrentInfo(presetName, folderId) {
        if (this.currentPresetDisplay) {
            this.currentPresetDisplay.textContent = presetName || 'None';
        }
        if (this.currentProjectDisplay) {
            if (folderId) {
                const folders = await this.presetManager.getFolders(this.currentShareId);
                const folder = folders.find(f => f.id === folderId);
                this.currentProjectDisplay.textContent = folder ? folder.name : 'None';
            } else {
                this.currentProjectDisplay.textContent = 'None';
            }
        }

        // Handle header info visibility
        const urlParams = new URLSearchParams(window.location.search);
        const hasParams = urlParams.has('s') || urlParams.has('d') || urlParams.has('data');
        const currentPresetInfo = document.getElementById('current-preset-info');
        if (currentPresetInfo) {
            if (hasParams || (presetName && presetName !== 'None')) {
                currentPresetInfo.classList.remove('hidden');
            } else {
                currentPresetInfo.classList.add('hidden');
            }
        }
    }

    async createNewFolder() {
        const name = this.folderNameInput.value.trim();
        if (!name) {
            this.folderNameInput.focus();
            return;
        }

        // Check for duplicate name within the same shareId context
        const existingFolders = await this.presetManager.getFolders(this.currentShareId);
        const isDuplicate = existingFolders.some(f =>
            f.name.toLowerCase() === name.toLowerCase() &&
            (f.shareId || null) === this.currentShareId
        );
        if (isDuplicate) {
            alert('同じ名前のProjectは既に存在します');
            this.folderNameInput.focus();
            return;
        }

        await this.presetManager.createFolder(name, this.currentShareId);
        this.hideFolderForm();
        await this.renderFolderList();
    }

    async renderFolderList() {
        const allFolders = await this.presetManager.getFolders(this.currentShareId);
        const folders = allFolders; // Already filtered by shareId in Firestore
        this.folderList.innerHTML = '';

        // "All" option
        const allItem = document.createElement('div');
        allItem.className = 'folder-item' + (this.selectedFolderId === null ? ' active' : '');
        allItem.innerHTML = `
            <span class="folder-item-name">📂 All</span>
        `;
        const selectAll = async () => {
            this.selectedFolderId = null;
            await this.renderFolderList();
            await this.renderPresetList();
        };
        // Helper for scroll-safe tap (All)
        let touchStartAll = { x: 0, y: 0, time: 0 };
        let isScrollingAll = false;

        allItem.addEventListener('click', selectAll);

        allItem.addEventListener('touchstart', (e) => {
            touchStartAll = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: new Date().getTime() };
            isScrollingAll = false;
        });

        allItem.addEventListener('touchmove', (e) => {
            if (Math.abs(e.touches[0].clientX - touchStartAll.x) > 10 ||
                Math.abs(e.touches[0].clientY - touchStartAll.y) > 10) {
                isScrollingAll = true;
            }
        });

        allItem.addEventListener('touchend', (e) => {
            const timeDiff = new Date().getTime() - touchStartAll.time;
            if (!isScrollingAll && timeDiff < 500) {
                e.preventDefault();
                selectAll();
            }
        });
        this.folderList.appendChild(allItem);

        // Root (No Project) Item
        const rootItem = document.createElement('div');
        rootItem.className = 'folder-item' + (this.selectedFolderId === 'root' ? ' active' : '');
        rootItem.innerHTML = `
            <span class="folder-item-name">📁 Root (No Project)</span>
        `;
        const selectRoot = async () => {
            this.selectedFolderId = 'root';
            await this.renderFolderList();
            await this.renderPresetList();
        };
        // Helper for scroll-safe tap (Root)
        let touchStartRoot = { x: 0, y: 0, time: 0 };
        let isScrollingRoot = false;

        rootItem.addEventListener('click', selectRoot);

        rootItem.addEventListener('touchstart', (e) => {
            touchStartRoot = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: new Date().getTime() };
            isScrollingRoot = false;
        });

        rootItem.addEventListener('touchmove', (e) => {
            if (Math.abs(e.touches[0].clientX - touchStartRoot.x) > 10 ||
                Math.abs(e.touches[0].clientY - touchStartRoot.y) > 10) {
                isScrollingRoot = true;
            }
        });

        rootItem.addEventListener('touchend', (e) => {
            const timeDiff = new Date().getTime() - touchStartRoot.time;
            if (!isScrollingRoot && timeDiff < 500) {
                e.preventDefault();
                selectRoot();
            }
        });
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
            const selectFolder = async (e) => {
                if (e.target.classList.contains('folder-action-btn')) return;
                this.selectedFolderId = folder.id;
                await this.renderFolderList();
                await this.renderPresetList();
            };
            let touchStartFolder = { x: 0, y: 0, time: 0 };
            let isScrollingFolder = false;

            item.addEventListener('click', selectFolder);

            item.addEventListener('touchstart', (e) => {
                if (e.target.classList.contains('folder-action-btn')) return;
                touchStartFolder = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: new Date().getTime() };
                isScrollingFolder = false;
            });

            item.addEventListener('touchmove', (e) => {
                if (isScrollingFolder) return;
                if (Math.abs(e.touches[0].clientX - touchStartFolder.x) > 10 ||
                    Math.abs(e.touches[0].clientY - touchStartFolder.y) > 10) {
                    isScrollingFolder = true;
                }
            });

            item.addEventListener('touchend', (e) => {
                if (e.target.classList.contains('folder-action-btn')) return;
                const timeDiff = new Date().getTime() - touchStartFolder.time;
                if (!isScrollingFolder && timeDiff < 500) {
                    e.preventDefault();
                    selectFolder(e);
                }
            });

            // Rename
            const renameBtn = item.querySelector('.rename');
            const handleRename = async (e) => {
                e.stopPropagation();
                const newName = prompt('New Project Name:', folder.name);
                if (newName && newName.trim()) {
                    await this.presetManager.renameFolder(folder.id, newName.trim());
                    await this.renderFolderList();
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
            const handleDelete = async (e) => {
                e.stopPropagation();
                if (confirm(`Delete Project「${folder.name}」?\n（Presets in this project will be moved to the root）`)) {
                    await this.presetManager.deleteFolder(folder.id);
                    if (this.selectedFolderId === folder.id) {
                        this.selectedFolderId = null;
                    }
                    await this.renderFolderList();
                    await this.renderPresetList();
                }
            };
            deleteBtn.addEventListener('click', handleDelete);
            deleteBtn.addEventListener('touchend', (e) => { e.preventDefault(); handleDelete(e); });

            this.folderList.appendChild(item);
        });
    }

    async renderPresetList() {
        const allPresets = await this.presetManager.getPresets(this.currentShareId);
        const allFolders = await this.presetManager.getFolders(this.currentShareId);

        const folders = allFolders; // Already filtered by shareId in Firestore

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
            let touchStartPreset = { x: 0, y: 0, time: 0 };
            let isScrollingPreset = false;

            item.addEventListener('click', handleLoad);

            item.addEventListener('touchstart', (e) => {
                if (e.target.classList.contains('folder-action-btn')) return;
                touchStartPreset = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: new Date().getTime() };
                isScrollingPreset = false;
            });

            item.addEventListener('touchmove', (e) => {
                if (isScrollingPreset) return;
                if (Math.abs(e.touches[0].clientX - touchStartPreset.x) > 10 ||
                    Math.abs(e.touches[0].clientY - touchStartPreset.y) > 10) {
                    isScrollingPreset = true;
                }
            });

            item.addEventListener('touchend', (e) => {
                if (e.target.classList.contains('folder-action-btn')) return;
                const timeDiff = new Date().getTime() - touchStartPreset.time;
                if (!isScrollingPreset && timeDiff < 500) {
                    e.preventDefault();
                    handleLoad(e);
                }
            });

            // Rename
            const renameBtn = item.querySelector('.rename');
            const handleRename = async (e) => {
                e.stopPropagation();
                const newName = prompt('New Preset Name:', preset.name);
                if (newName && newName.trim()) {
                    await this.presetManager.renamePreset(preset.id, newName.trim());
                    await this.renderPresetList();
                }
            };
            renameBtn.addEventListener('click', handleRename);
            renameBtn.addEventListener('touchend', (e) => { e.preventDefault(); handleRename(e); });

            // Delete
            const deleteBtn = item.querySelector('.delete');
            const handleDelete = async (e) => {
                e.stopPropagation();
                if (confirm(`Delete preset "${preset.name}"?`)) {
                    await this.presetManager.deletePreset(preset.id);
                    await this.renderPresetList();
                }
            };
            deleteBtn.addEventListener('click', handleDelete);
            deleteBtn.addEventListener('touchend', (e) => { e.preventDefault(); handleDelete(e); });

            this.presetList.appendChild(item);
        });
    }

    loadPreset(preset) {
        if (!preset || !preset.data) return;

        const data = preset.data;

        // Deserialize data
        this.seq.deserialize(data);

        // Update UI controls
        this.bpmInput.value = this.seq.bpm;
        if (this.bpmNumber) this.bpmNumber.value = this.seq.bpm;
        if (this.configBpmInput) this.configBpmInput.value = this.seq.bpm;
        if (this.configBpmNumber) this.configBpmNumber.value = this.seq.bpm;

        if (this.configTimeSigSelect) this.configTimeSigSelect.value = this.seq.timeSignature;
        if (this.configPlaybackModeSelect) this.configPlaybackModeSelect.value = this.seq.playbackMode;

        // Restore Config extended data
        if (data.config) {
            if (data.config.masterVolume !== undefined) {
                const volPercent = Math.round(data.config.masterVolume * 100);
                if (this.configVolNumber) this.configVolNumber.value = volPercent;
                if (this.configMasterVol) this.configMasterVol.value = data.config.masterVolume;
            }
            if (data.config.hitCriteria && this.configHitCriteriaSelect) {
                this.configHitCriteriaSelect.value = data.config.hitCriteria;
                this.game.hitCriteria = data.config.hitCriteria;
            }
            if (data.config.gameSpeed && this.configGameSpeedSlider) {
                this.configGameSpeedSlider.value = data.config.gameSpeed;
                this.configGameSpeedVal.textContent = data.config.gameSpeed.toFixed(1);
            }
        }

        // Restore UI state
        if (this.stepActionSelect) {
            this.stepActionSelect.value = (data.uiState && data.uiState.stepAction && data.uiState.stepAction !== 'toggle')
                ? data.uiState.stepAction
                : 'sel-step';
        }

        // Restore Game results
        if (data.gameResults) {
            this.game.score = data.gameResults.score || 0;
            this.game.hitCount = data.gameResults.hits || 0;
            this.game.totalNotes = data.gameResults.totalNotes || 0;
            this.game.combo = data.gameResults.combo || 0;

            if (this.game.scoreEl) this.game.scoreEl.textContent = this.game.score;
            if (this.game.hitEl) this.game.hitEl.textContent = this.game.hitCount;
            if (this.game.totalNotesEl) this.game.totalNotesEl.textContent = this.game.totalNotes;
            if (this.game.comboEl) this.game.comboEl.textContent = this.game.combo;
        }

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

    async generateShareUrl() {
        // Prevent multiple clicks
        if (this.generateUrlBtn) {
            this.generateUrlBtn.disabled = true;
            this.generateUrlBtn.classList.add('loading');
        }

        try {
            // Show loading state
            if (this.shareUrlInput) {
                this.shareUrlInput.value = 'Generating...';
            }

            // Get sequencer data with UI state
            const extraData = {
                subdivision: this.configSubdivSelect ? parseInt(this.configSubdivSelect.value) : 4,
                stepSoundEnabled: this.stepSoundEnabled ? 1 : 0,
                hitCriteria: this.game.hitCriteria,
                gameSpeed: this.seq.noteSpeed,
                hitSoundEnabled: this.game.hitSoundEnabled ? 1 : 0,
                hitSoundType: this.game.hitSoundType,
                stepAction: this.stepActionSelect ? this.stepActionSelect.value : 'sel-step',
                score: this.game.scoreEl ? parseInt(this.game.scoreEl.textContent) : 0,
                hits: this.game.hitEl ? parseInt(this.game.hitEl.textContent) : 0,
                totalNotes: this.game.totalNotesEl ? parseInt(this.game.totalNotesEl.textContent) : 0,
                combo: this.game.comboEl ? parseInt(this.game.comboEl.textContent) : 0
            };

            const data = this.seq.serialize(extraData);

            // Generate a short unique ID (8 characters)
            const generateShortId = () => {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                let result = '';
                for (let i = 0; i < 8; i++) {
                    result += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return result;
            };

            const shareId = generateShortId();

            // Save to Firestore (convert to JSON string to avoid nested array limitation)
            if (typeof db === 'undefined') {
                throw new Error("Firestore 'db' is not defined. Check firebase-config.js.");
            }

            await db.collection('shares').doc(shareId).set({
                dataJson: JSON.stringify(data),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Build short URL
            const url = new URL(window.location.href);
            url.search = ''; // Clear existing params
            url.searchParams.set('s', shareId);  // Use 's' for share ID

            // Update current context
            this.currentShareId = shareId;

            // Update URL in address bar so reload works with the same ID
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('s', shareId);
            window.history.replaceState({}, document.title, newUrl.pathname + newUrl.search);

            // Display URL
            if (this.shareUrlInput) {
                this.shareUrlInput.value = url.toString();
            }

            console.log('Share URL generated with Firebase ID:', shareId);
        } catch (error) {
            console.error('Error generating share URL:', error);
            if (this.shareUrlInput) {
                this.shareUrlInput.value = 'Error: Failed to generate URL';
            }
            alert('Failed to generate share URL: ' + error.message);
            // Re-enable only on error so they can try again if it failed
            if (this.generateUrlBtn) {
                this.generateUrlBtn.disabled = false;
                this.generateUrlBtn.classList.remove('loading');
            }
        } finally {
            if (this.generateUrlBtn) {
                this.generateUrlBtn.classList.remove('loading');
            }
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

    async loadFromUrlParams() {
        try {
            const urlParams = new URLSearchParams(window.location.search);

            // Check for new Firebase share ID format first
            const shareId = urlParams.get('s');
            if (shareId) {
                console.log('Loading from Firebase share ID:', shareId);
                const doc = await db.collection('shares').doc(shareId).get();
                if (doc.exists) {
                    const shareData = doc.data();
                    // Parse JSON string (stored this way to avoid Firestore nested array limitation)
                    const parsedData = JSON.parse(shareData.dataJson);
                    this.seq.deserialize(parsedData);

                    // Apply full config from share
                    if (parsedData.config) {
                        this.applyConfig(parsedData.config);
                    }

                    // Restore Game results
                    if (this.stepActionSelect) {
                        this.stepActionSelect.value = (parsedData.uiState && parsedData.uiState.stepAction && parsedData.uiState.stepAction !== 'toggle')
                            ? parsedData.uiState.stepAction
                            : 'sel-step';
                    }

                    // Restore Game results
                    if (parsedData.gameResults) {
                        this.game.score = parsedData.gameResults.score || 0;
                        this.game.hitCount = parsedData.gameResults.hits || 0;
                        this.game.totalNotes = parsedData.gameResults.totalNotes || 0;
                        this.game.combo = parsedData.gameResults.combo || 0;

                        if (this.game.scoreEl) this.game.scoreEl.textContent = this.game.score;
                        if (this.game.hitEl) this.game.hitEl.textContent = this.game.hitCount;
                        if (this.game.totalNotesEl) this.game.totalNotesEl.textContent = this.game.totalNotes;
                        if (this.game.comboEl) this.game.comboEl.textContent = this.game.combo;
                    }

                    console.log('Loading from Firebase share');
                    this.updatePresetPanelVisibility(true);
                    return true;
                } else {
                    console.error('Share not found:', shareId);
                    this.updatePresetPanelVisibility(false);
                    return false;
                }
            }

            // Fallback to legacy Base64 formats
            let dataParam = urlParams.get('d');  // New short param
            let isCompact = true;

            // Fallback to old format
            if (!dataParam) {
                dataParam = urlParams.get('data');
                isCompact = false;
            }

            if (!dataParam) {
                this.updatePresetPanelVisibility(false);
                return false;
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

            console.log('Loaded from URL parameters (legacy format)');
            this.updatePresetPanelVisibility(true); // Parameter exists -> Shared Mode
            return true;
        } catch (error) {
            console.error('Error loading from URL params:', error);
            this.updatePresetPanelVisibility(false); // Parameter absent -> Standard Mode
            return false;
        }
    }

    updatePresetPanelVisibility(isSharedMode) {
        const presetActions = this.presetPanel.querySelector('.preset-actions');
        const presetFolders = this.presetPanel.querySelector('.preset-folders');
        const presetListSection = this.presetPanel.querySelector('.preset-list-section');
        const shareUrlSection = this.presetPanel.querySelector('.share-url-section');
        const panelTitle = this.presetPanel.querySelector('.preset-panel-header h2');
        const currentPresetInfo = document.getElementById('current-preset-info');

        if (isSharedMode) {
            // Parameter exists: Show Preset functions, Hide Share URL
            this.presetBtn.innerText = 'Preset';
            if (panelTitle) panelTitle.innerText = 'PRESET';
            if (currentPresetInfo) currentPresetInfo.classList.remove('hidden');

            if (presetActions) presetActions.classList.remove('hidden');
            if (presetFolders) presetFolders.classList.remove('hidden');
            if (presetListSection) presetListSection.classList.remove('hidden');
            if (shareUrlSection) shareUrlSection.classList.add('hidden');
        } else {
            // No Parameter: Change to Share URL mode
            this.presetBtn.innerText = 'Share URL';
            if (panelTitle) panelTitle.innerText = 'SHARE URL';

            // Always show header info in Standard Mode as requested
            if (currentPresetInfo) {
                currentPresetInfo.classList.remove('hidden');
                // If no preset name, ensure it says None
                if (!this.currentPresetName || this.currentPresetName === 'None') {
                    if (this.currentProjectDisplay) this.currentProjectDisplay.innerText = 'None';
                    if (this.currentPresetDisplay) this.currentPresetDisplay.innerText = 'None';
                }
            }

            if (presetActions) presetActions.classList.add('hidden');
            if (presetFolders) presetFolders.classList.add('hidden');
            if (presetListSection) presetListSection.classList.add('hidden');
            if (shareUrlSection) shareUrlSection.classList.remove('hidden');
        }
    }

    openTrackSettings(barIndex, trackIndex) {
        if (!this.seq.bars[barIndex]) return;
        const bar = this.seq.bars[barIndex];
        const track = bar.tracks[trackIndex];
        if (!track) return;

        this.currentSettingsTrack = { barIndex, trackIndex };
        this.trackSettingsTitle.innerText = `TRACK ${trackIndex + 1} SETTINGS`;

        // Populate Instrument Options
        this.trackInstPanelSelect.innerHTML = '';
        const instrumentOptions = Object.keys(this.seq.audio.instruments);
        const drumInstruments = ['kick', 'bassdrum', 'snare', 'hihat', 'openhihat', 'pedalhat', 'tomH', 'tomM', 'tomL', 'ride', 'crash', 'clap', 'rim', 'cowbell', 'shaker'];

        instrumentOptions.forEach(optVal => {
            const opt = document.createElement('option');
            opt.value = optVal;
            const isDrum = drumInstruments.includes(optVal);
            opt.innerText = isDrum ? `DRUMS - ${optVal.toUpperCase()}` : optVal.toUpperCase();
            if (track.type === optVal) opt.selected = true;
            this.trackInstPanelSelect.appendChild(opt);
        });

        // Set Volume
        const volPercent = Math.round(track.volume * 100);
        this.trackVolNumber.value = volPercent;
        this.trackVolRange.value = track.volume;

        // Set Panning
        const panVal = track.pan !== undefined ? track.pan : 0;
        this.trackPanRange.value = panVal;
        this.trackPanNumber.value = Math.round(panVal * 100);

        // Set Mute
        const isMuted = !!track.muted;
        this.trackMuteBtn.innerText = isMuted ? "Mute: ON" : "Mute: OFF";
        this.trackMuteBtn.classList.toggle('active', isMuted);

        // Set Track Name
        if (this.trackNameInput) {
            this.trackNameInput.value = track.name || '';
        }

        // Update Track Management Labels
        const trackCount = bar ? bar.tracks.length : 0;
        const nextTrackNum = trackCount + 1;

        if (this.trackAddAfterBtn) this.trackAddAfterBtn.innerText = `Add Track ${nextTrackNum}`;
        if (this.trackAddAfterLabel) this.trackAddAfterLabel.innerText = `Add New Track (Track ${nextTrackNum})`;
        if (this.trackDeleteBtn) this.trackDeleteBtn.innerText = `Delete Track ${trackIndex + 1}`;
        if (this.trackDeleteLabel) this.trackDeleteLabel.innerText = `Delete Track ${trackIndex + 1}`;

        // Show Panel
        this.trackSettingsPanel.classList.remove('hidden');
        this.trackSettingsOverlay.classList.remove('hidden');

        requestAnimationFrame(() => {
            this.trackSettingsPanel.classList.add('active');
            this.trackSettingsOverlay.classList.add('active');
        });
    }

    closeTrackSettings() {
        this.trackSettingsPanel.classList.remove('active');
        this.trackSettingsOverlay.classList.remove('active');

        setTimeout(() => {
            this.trackSettingsPanel.classList.add('hidden');
            this.trackSettingsOverlay.classList.add('hidden');
            this.currentSettingsTrack = null;
        }, 300);
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
    // Initialize UI immediately so buttons and grid work right away
    ui = new UI(sequencer);

    // Handle Auth state changes separately
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            console.log('PWA: Authenticated as', user.uid);
            ui.userId = user.uid;
            ui.presetManager.setUserId(user.uid);
            await ui.init();
        } else {
            console.log('PWA: Not authenticated, signing in anonymously...');
            firebase.auth().signInAnonymously().catch(err => {
                console.error('PWA: Anonymous sign-in failed', err);
            });
        }
    });

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        // Reload the page when a new service worker takes control
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                console.log("PWA: Controller changed, reloading...");
                refreshing = true;
                window.location.reload();
            }
        });

        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
                .then(reg => {
                    console.log('PWA: ServiceWorker registration successful with scope: ', reg.scope);

                    // Logic to handle updates if the worker is already waiting
                    if (reg.waiting) {
                        console.log("PWA: ServiceWorker waiting, skipping...");
                        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }

                    // Listen for updates
                    reg.onupdatefound = () => {
                        const newWorker = reg.installing;
                        newWorker.onstatechange = () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log("PWA: New version available, skipping waiting...");
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                            }
                        };
                    };

                    // Proactively check for updates on every load
                    reg.update();

                    // Aggressive Update: Check for updates when the app is focused/resumed
                    window.addEventListener('focus', () => {
                        console.log("PWA: App focused, checking for updates...");
                        reg.update();
                    });
                })
                .catch(err => console.error('PWA: ServiceWorker registration failed: ', err));
        });
    }

    // Disable right-click context menu
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    }, false);
});
