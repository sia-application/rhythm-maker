
class Sequencer {
    constructor() {
        this.bars = [];
        this.nextTrackId = 0;
        this.currentBarIndex = 0;
        this.timeSignature = 4;
        this.addBar();
    }

    addBar() {
        const barId = this.bars.length;
        const newBar = {
            id: barId,
            beats: [],
            tracks: []
        };
        for (let i = 0; i < this.timeSignature; i++) {
            newBar.beats.push({ subdivision: 4 });
        }
        this.bars.push(newBar);
        return newBar;
    }

    updateBeatSubdivision(barIndex, beatIndex, newSubdiv) {
        if (!this.bars[barIndex]) return;
        const bar = this.bars[barIndex];
        if (beatIndex < 0 || beatIndex >= bar.beats.length) return;
        bar.beats[beatIndex].subdivision = newSubdiv;
    }

    updateBeatSubdivisionAllBars(beatIndex, delta) {
        this.bars.forEach((bar, barIndex) => {
            if (beatIndex < bar.beats.length) {
                const currentSubdiv = bar.beats[beatIndex].subdivision;
                const newSubdiv = Math.max(1, currentSubdiv + delta);
                this.updateBeatSubdivision(barIndex, beatIndex, newSubdiv);
            }
        });
    }
}

// Test
const seq = new Sequencer();
seq.addBar(); // Bar 0
seq.addBar(); // Bar 1
seq.addBar(); // Bar 2

console.log("Initial State:");
console.log("Bar 0 Beat 0 Subdiv:", seq.bars[0].beats[0].subdivision);
console.log("Bar 1 Beat 0 Subdiv:", seq.bars[1].beats[0].subdivision);
console.log("Bar 2 Beat 0 Subdiv:", seq.bars[2].beats[0].subdivision);

console.log("\nUpdating Beat 0 Subdivision by +1 for ALL bars...");
seq.updateBeatSubdivisionAllBars(0, 1);

console.log("Post-Update State:");
console.log("Bar 0 Beat 0 Subdiv:", seq.bars[0].beats[0].subdivision);
console.log("Bar 1 Beat 0 Subdiv:", seq.bars[1].beats[0].subdivision);
console.log("Bar 2 Beat 0 Subdiv:", seq.bars[2].beats[0].subdivision);

if (seq.bars[0].beats[0].subdivision === 5 &&
    seq.bars[1].beats[0].subdivision === 5 &&
    seq.bars[2].beats[0].subdivision === 5) {
    console.log("\nPASS: All bars updated.");
} else {
    console.log("\nFAIL: Not all bars updated.");
}
