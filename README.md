# Oyster Video Monitoring System 2026

Browser-based oyster detection, tracking, counting, and Open/Closed state monitoring using **YOLOv8**, **TensorFlow.js**, **React**, and **Vite**.

This repository contains the Summer 2026 REU & USDA continuation of Salisbury University's oyster-monitoring research. The project builds on the 2025 browser-based oyster detector by adding cross-frame identity tracking, confirmed oyster counting, confidence-weighted temporal state smoothing, frame-level research logging, video controls, and state-change notifications.

## Project Overview

Oyster aquaculture monitoring is still heavily dependent on manual inspection. This project investigates whether adding **video context** to computer-vision detections can make oyster monitoring more stable than treating every video frame independently.

The current system:

- Detects oysters as **Oyster-Open** or **Oyster-Closed**
- Runs YOLOv8 inference directly in the browser with TensorFlow.js
- Assigns persistent IDs to oysters across frames
- Maintains a more stable confirmed oyster count
- Smooths Open/Closed classifications over time
- Logs frame-level detection and tracking information to CSV
- Supports image, uploaded-video, and webcam input
- Provides playback controls and annotated output downloads
- Can send desktop notifications when a tracked oyster changes state

## Research Results

The 2026 project used a two-state Open/Closed dataset containing **9,615 unique images** and approximately **85,839 labeled oyster instances**.

The deployed YOLOv8s model achieved:

| Metric | Result |
| --- | ---: |
| Precision | 0.625 |
| Recall | 0.512 |
| mAP@0.5 | 0.565 |

Across 18 test videos:

- Confidence-weighted temporal smoothing outperformed raw frame-by-frame state labels at each evaluated IOU threshold.
- At an IOU threshold of 0.5, smoothed state labels were correct for **87.706%** of matched detections compared with **86.588%** for raw labels.
- Average confirmed oyster counts were closer to ground-truth totals than average raw per-frame counts in **66.667%** of the test videos.

These results provide preliminary evidence that cross-frame video context can stabilize oyster monitoring compared with frame-only detection.

## How the System Works

### 1. Oyster Detection

The browser loads the current `yolov8s_2026` TensorFlow.js graph model and performs inference using TensorFlow.js/WebGL.

The detector identifies two classes:

- `Oyster-Closed`
- `Oyster-Open`

For video and webcam input, detection is currently run every **10th animation frame** to reduce the computational cost of continuous inference.

### 2. Cross-Frame Tracking

Each detected oyster is assigned a tracking ID. New detections are matched to oysters from previous frames using an IOU-first approach:

1. If bounding-box **IOU >= 0.5**, the detection is treated as the same oyster.
2. Otherwise, the tracker falls back to center-point distance when the distance is **< 80 px** and the boxes still overlap.
3. An oyster must be detected for at least **3 frames** before it becomes confirmed.
4. A track is retained through short detection gaps and removed after **15 consecutive missed frames**.

This allows IDs to persist through brief missed detections and makes oyster counts more stable than raw per-frame detection counts.

### 3. Confidence-Weighted Temporal State Smoothing

Instead of displaying only the model's newest Open/Closed prediction, the system stores the **7 most recent state predictions and confidence scores** for each oyster ID.

Confidence is summed separately for Open and Closed. After at least 3 observations, the displayed smoothed state changes only when the opposing state receives at least **65% of the total confidence weight**.

Missed detections do not add votes, which helps prevent isolated bad frames or brief occlusions from immediately changing an oyster's displayed state.

Bounding-box color is based on the **smoothed state**, while the label also displays the current raw model prediction and confidence.

## Browser App Features

### Detection Modes

The application supports:

- Image upload
- Video upload
- Webcam detection

Only one input stream is handled at a time.

### Oyster Overlays

For each detection, the browser displays:

- Oyster tracking ID
- Raw Open/Closed prediction
- Raw model confidence
- Smoothed Open/Closed state
- Bounding box colored according to the smoothed state

The display also includes the current detection count and confirmed oyster count.

### Video Controls

Uploaded videos include:

- Play / pause
- Rewind 3 seconds
- Playback speeds of `0.25x`, `0.5x`, `1x`, `1.5x`, and `2x`

### Frame Logging

The application stores detection information in memory while a clip is processed and can export it as `detection_log.csv`.

Logged fields include information such as:

- Clip
- Frame number
- Timestamp
- Current detection count
- Confirmed count
- Tracking ID
- Confirmation status
- Raw state
- Raw confidence
- Smoothed state
- Smoothed-state support
- State-history length
- Bounding-box coordinates

This logging system was added to make tracking, counting, and state-smoothing behavior easier to analyze quantitatively.

### Downloads

The browser can download:

- Annotated images as PNG
- Annotated video output as WebM
- Detection logs as CSV

### Desktop State-Change Alerts

If notification permission is granted, the app can create a desktop notification when a tracked oyster's smoothed state changes between Open and Closed.

## Tech Stack

- **YOLOv8** — oyster object detection and state classification
- **TensorFlow.js** — browser-based model inference
- **WebGL** — TensorFlow.js browser acceleration
- **React** — user interface
- **Vite** — development server and production build tooling
- **JavaScript**
- **HTML5 Canvas** — annotated detection rendering
- **MediaRecorder API** — annotated video recording
- **Python / Jupyter Notebook** — model testing and research analysis

## Getting Started

### Requirements

Install:

- [Node.js](https://nodejs.org/)
- npm

Node.js 18+ is recommended.

### Clone the Repository

```bash
git clone https://github.com/DomBarberesi/Oyster-Video-Monitoring-System-2026.git
cd Oyster-Video-Monitoring-System-2026
```

### Install Dependencies

```bash
npm install
```

### Start the Application

```bash
npm start
```

The Vite development server is configured to run on:

```text
http://localhost:8080
```

Open that address in your browser.

The development server is configured with host `0.0.0.0`, so it can also be reached from another device on the same network using the host computer's local IP address. However, webcam access on non-localhost connections may be blocked unless the page is served through HTTPS.

## Production Build

Create a production build with:

```bash
npm run build
```

Preview the production build locally with:

```bash
npm run preview
```

The generated production files are placed in the `dist/` directory.

## Docker

A multi-stage Dockerfile is included. It builds the Vite application with Node.js and serves the generated `dist/` files with Nginx.

```bash
docker build -t oyster-monitoring-2026 .
docker run -p 8080:80 oyster-monitoring-2026
```

Then open:

```text
http://localhost:8080
```

> **Deployment note:** Browser webcam access generally requires either `localhost` or an HTTPS secure context. Cloud/container deployments should therefore be served through HTTPS. If deploying to a platform such as Google Cloud Run, also ensure that Nginx is configured to listen on the port expected by the platform.



### Important Files

- `src/utils/detect.js` — model preprocessing, inference, tracking, counting, temporal smoothing, and video detection loop
- `src/utils/renderBox.js` — draws oyster boxes, IDs, raw predictions, smoothed states, and count information
- `src/frameLogger.js` — records frame-level research data and exports CSV logs
- `src/App.jsx` — loads the TensorFlow.js model and assembles the browser application
- `src/components/` — upload controls, video controls, download controls, and UI components
- `public/yolov8s_2026_web_model/` — currently deployed TensorFlow.js model
- `analysis/analysis.ipynb` — quantitative analysis of project results
- `YOLO_testing/` — model training/testing and supporting experimental work

## Current Limitations

The system is still a research prototype.

- The current model produces a meaningful number of false positives and can misclassify or miss Open oysters.
- The dataset remains imbalanced, with substantially more Closed oyster annotations than Open oyster annotations.
- Tracking performs best with stationary or slowly moving cameras. Fast or unstable camera motion can reduce bounding-box overlap and cause oysters to receive new IDs.
- Oyster re-identification is based on geometry rather than learned visual appearance, so long occlusions and major camera movement can produce ID switches or duplicate counts.
- Detection is performed every 10th animation frame, which reduces processing load but can make annotated video appear less smooth.
- Webcam access requires a browser secure context when the app is hosted remotely.

## Future Work

A major next step is **per-oyster adaptive state monitoring**. Instead of applying the same temporal-smoothing parameters to every oyster, future work can adapt smoothing behavior to each oyster's prediction reliability and visual clarity.

Other useful directions include:

- Improving Open/Closed model accuracy and dataset balance
- Testing on a larger browser-matched video benchmark
- Improving tracking under rapid camera motion and occlusion
- Reducing oyster ID switches and duplicate counting
- Evaluating stronger motion- or appearance-based tracking methods
- Optimizing browser inference speed and video smoothness
- Expanding deployment testing on lower-powered field devices

## Research Team

**Summer 2026 REU & USDA Project**

- Dom Barberesi — Salisbury University
- Ella Kennedy — Bryn Mawr College
- Myriam Jean — Salisbury University
- Dr. Yuanwei Jin — University of Maryland Eastern Shore
- Dr. Enyue Lu — Salisbury University

This work was supported by **NSF REU and USDA** and builds on prior Salisbury University oyster-detection research.

## Research Goal

> Determine whether cross-frame tracking and temporal state smoothing improve oyster monitoring performance compared with traditional frame-only detection methods.

The project contributes the tracking, counting, temporal-smoothing, and frame-logging infrastructure needed to quantitatively test that question in a browser-based oyster monitoring system.
