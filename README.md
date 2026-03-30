# Dithered Camera (DITHER CAM)

A real-time bitmap processor that applies an old-school ordered dithering effect to your live webcam feed using an 8x8 Bayer matrix. It is built natively with WebGL for high performance and bundled with Vite.

## Features

- **Live WebGL Processing:** Fast, real-time image manipulation directly in the browser via custom fragment shaders.
- **Adjustable Resolution:** Pixelate up your feed dynamically by adjusting the block size.
- **Adjustable Contrast:** Tweak the contrast multiplier to achieve the perfect dithered spread.
- **Multiple Palettes:**
  - **B&W:** Classic 1-bit style monochromatic dithering.
  - **Gameboy:** Nostalgic 4-shade green tint simulation.
  - **Retro:** High-contrast multi-color retro scheme (Black, Purple, Cyan, Yellow, White).
- **Capture Functionality:** Take a snapshot of your currently dithered view and automatically download it as a PNG.

## Technologies Used

- [Vite](https://vitejs.dev/) - Frontend Tooling
- **WebGL** - Custom Vertex and Fragment Shaders via the WebGL API
- **Vanilla JavaScript** - Core logic and state management
- **HTML/CSS** - Structure and retro-styled UI layout

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) installed on your machine.
- A functional webcam connected to your device.

### Installation

1. Clone or download this project.
2. Navigate to the project directory:

```bash
cd dithered-camera
```

3. Install the required development dependencies:

```bash
npm install
```

### Running Locally

To start the Vite development server and view the project:

```bash
npm run dev
```

Open the local URL provided by Vite (typically `http://localhost:5173`) in your web browser. 

> **Note:** The browser will request permission to access your camera. You **must grant camera permissions** for the dithering effect to work.

## Project Structure

- `index.html` — The main HTML structure, overlay text, controls panel, and canvas wrapper.
- `src/main.js` — Core application logic. It handles camera permissions, video streaming, WebGL context and buffer initialization, shader compilation, and the main requestAnimationFrame rendering loop. The 8x8 Bayer Matrix, contrast adjustment, and color mappings are mathematically calculated directly within the WebGL fragment shader script.
- `src/style.css` — Modern yet retro-themed CSS styling for the interface, including responsive absolute positioning for the camera and floating control panels.

## How it Works

1. **Video Feed:** The app captures your realtime webcam feed using the `navigator.mediaDevices.getUserMedia` API.
2. **WebGL Texture:** The video frames are streamed directly and continuously into a 2D WebGL texture.
3. **Fragment Shader:** A custom fragment shader processes each frame pixel-by-pixel:
   - It downscales the resolution by flooring UV coordinates if a resolution `> 1` is selected.
   - It applies a contrast adjustment to the sampled pixel colors.
   - It calculates the perceived luma (grayscale) value.
   - It performs thresholding against an 8x8 Bayer matrix to decide whether a pixel should be considered "on" or "off", creating the uniform pattern known as ordered dithering.
   - Finally, it applies the selected color palette map based on the active state.
