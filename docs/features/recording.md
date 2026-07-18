# Recording

Flowtake records your screen and optional camera stream for local editing.

<!-- <img src="../screenshots/recorder.png" alt="Flowtake Recorder" width="600"> -->

## Capture Modes

### Full Screen
Record your entire display. Choose which monitor to capture in multi-display setups.

### Specific Window
Use the **Window Picker** to select any open application window. The capture follows the window even if it moves.

### Custom Region
Use the **Area Picker** to draw a rectangle over any part of your screen. Useful for capturing a specific panel or tool.

## Camera Overlay

Add a webcam feed on top of your screen recording. Configurable layouts:

| Layout | Description |
|--------|-------------|
| **Overlay** | Camera appears as a picture-in-picture bubble |
| **Side by Side** | Camera and screen are shown side by side |
| **Camera Only** | Record camera without the screen |

Camera size, position, and shape (circle/rectangle) are adjustable in the recorder controls.

## Audio

- **Microphone** — Select a connected microphone for supported recording and live workflows
- **System Audio** — Select a loopback or virtual-audio source when one is available

In Flowtake v1.6.0, these audio sources are **not muxed into the final edited MP4**. The edited MP4 export is currently video-only.

## Edited MP4 Export

The PixiJS render worker composites the edited video frames. Mediabunny encodes and muxes those frames as an AVC MP4, and the native app copies that local `output.mp4` to the selected destination. FFmpeg remains part of recording capture and native media utilities; it does not render the final edited MP4.

## Multi-Monitor

All connected displays appear as capture options. Each display can be recorded independently.

## Recording Controls

The **Recorder** window appears as a floating overlay during capture. Controls include:
- Start / pause / stop recording
- Live timer display
- Quick toggle for microphone and camera
- Minimize to tray while recording
