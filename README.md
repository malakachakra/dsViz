# dsViz

A music visualizer that runs in the browser. It listens to whatever is playing and drives 22 scenes with it: feedback warps in the Milkdrop tradition, real fluid and ripple simulation, and 3D spaces the camera flies through.

Everything is one file, `index.html`. There is nothing to install.

| | |
|---|---|
| ![Moon Pool](docs/moon-pool.png) | ![Oil Slick](docs/oil-slick.png) |
| ![Ridgeline](docs/ridgeline.png) | ![Velvet Smoke](docs/velvet-smoke.png) |

## Running it

Open `index.html` in Chrome or Edge on a computer, then choose where the music comes from:

- **Capture tab or system audio.** Pick the tab or screen that is playing, and switch on "Share audio" in the browser's dialog before confirming. Without that switch the visualizer hears nothing.
- **Play audio files.** Choose files, or drop them anywhere on the page.
- **Microphone.** Listens to the room. Pick which microphone under Settings.
- **Demo beat.** A built-in loop, to see how it reacts.

It needs a browser with WebGL2, and is built for desktop Chrome and Edge.

## Controls

The control strip appears when you move the mouse and fades when you stop.

| Key | Does |
|---|---|
| Space or → | Next scene |
| ← | Previous scene |
| 1–9, 0 | Jump to scenes 1–10 |
| F, or double-click | Fullscreen |
| L or A | Change scenes automatically, on or off |
| D | Open or close Settings |
| C | Camera movement, on or off |
| V | Move the current scene into its next 3D space |
| Q | Next Detail level |
| S | Change the audio source |
| Esc | Close Settings or the source card |

## Settings

The Settings drawer (D) holds everything adjustable. Settings are saved in the browser, per address.

- **Sound in:** a live input meter, and the microphone picker.
- **Music:** Intensity, Speed, Beat punch, and separate Bass, Mids and Treble.
- **Picture:** Brightness, Trails, Glow, Saturation, Colour shift.
- **Camera:** how far it moves, and whether scenes may wrap into 3D spaces (tunnel, dome, floor).
- **Scenes:** time per scene, crossfade length, and Fav and Hide for each scene.
- **Detail:** how sharply the picture is rendered. Auto lowers itself if the computer struggles.

## Scenes

1. Plasma Tide
2. Event Horizon
3. Prism Cathedral
4. Aurora Veil
5. Ink Bloom
6. Solar Petals
7. Starforge
8. Neon Horizon
9. Julia Garden
10. Silk Ribbons
11. Velvet Smoke
12. Oil Slick
13. Acrylic Pour
14. Glass Tide
15. Moon Pool
16. Pool Floor
17. Quicksilver
18. Gel Orbit
19. Ridgeline
20. Petri
21. Hall of Mirrors
22. Maelstrom

## How it works

Each scene is three things:

- a **warp shader**, which bends the previous frame before the new one is drawn on it;
- a **draw step**, which adds what the music is doing this frame (waveforms, shapes, particles);
- a **composite shader**, which turns that buffer into the picture, seen from a camera.

Some scenes lean on a simulation that runs alongside: a fluid solver whose velocity carries the picture, or a low-resolution buffer running the wave equation or reaction-diffusion.

Sound is analysed into bass, mids and treble, each measured against its own recent average, so a quiet source and a loud one drive the picture equally hard. Kicks and beats are detected from sudden rises in the spectrum.

## Changing it

`index.html` is built from the files in `src/`. Edit those, then rebuild:

```
python3 build.py
```

| File | Holds |
|---|---|
| `shell.html` | Page title, styles and markup |
| `00-config.js` | Settings and their defaults |
| `01-gl.js` | WebGL setup and the shader code every scene shares |
| `02-audio.js` | Audio analysis and beat detection |
| `03-sources.js` | Tab capture, microphone, file playback, demo beat |
| `04-draw.js` | Glowing lines and shapes |
| `04b-fluid.js` | Fluid solver and the camera |
| `05-presets-a.js` to `06d-presets-e.js` | The scenes |
| `07-main.js` | Render loop and scene switching |
| `08-ui.js` | Controls and the Settings drawer |

The `.js` files are joined in name order, so the numeric prefixes set the order.
