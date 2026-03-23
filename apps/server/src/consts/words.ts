export default function pickWordOptions(): string[] {
    const words = [
        'elephant',
        'volcano',
        'skateboard',
        'umbrella',
        'lighthouse',
        'tornado',
        'saxophone',
        'submarine',
        'waterfall',
        'telescope',
        'firefighter',
        'rainbow',
    ];
    return words.sort(() => Math.random() - 0.5).slice(0, 3);
}
