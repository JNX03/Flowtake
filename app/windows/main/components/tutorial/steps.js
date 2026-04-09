export const TUTORIAL_STEPS = [
    {
        id: 'select-source',
        title: 'Choose what to record',
        description: 'Pick a recording source — your full screen, a specific window, or a custom area.',
        targetSelector: '[data-tutorial="source-panel"]',
        placement: 'left',
    },
    {
        id: 'start-recording',
        title: 'Start recording',
        description: 'Hit the Record button to capture your screen. Try it now!',
        targetSelector: '[data-tutorial="record-button"]',
        placement: 'top',
    },
    {
        id: 'stop-recording',
        title: 'Recording in progress',
        description: 'Your screen is being recorded. Press Stop or use the keyboard shortcut when you\'re done.',
        targetSelector: null, // No spotlight — waiting state
        placement: null,
        isWaiting: true,
    },
    {
        id: 'explore-editor',
        title: 'This is your timeline',
        description: 'Here you can trim, add zoom animations, overlays, and arrange your clips. Take a moment to explore!',
        targetSelector: '[data-tutorial="timeline"]',
        placement: 'top',
        autoAdvanceMs: 6000,
    },
    {
        id: 'try-export',
        title: 'Export your video',
        description: 'When you\'re happy with your edit, click Export to render your final video. You\'re all set!',
        targetSelector: '[data-tutorial="export-button"]',
        placement: 'bottom',
        isFinal: true,
    },
]
