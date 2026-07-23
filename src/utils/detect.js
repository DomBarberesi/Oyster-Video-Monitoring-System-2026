import * as tf from "@tensorflow/tfjs";
import { renderBoxes } from "./renderBox";
import labels from "./labelsO.json";
import { logFrame } from "../frameLogger";

const numClass = labels.length;

// ---------- Simple Oyster Tracker: Stage 2.5 ----------
// Keeps IDs stable and only counts "confirmed" oysters.
// A track becomes confirmed only after being detected several times.

let trackedOysters = [];
let nextOysterId = 1;

// Higher = easier to reconnect oysters after small detection jumps.
// Lower = stricter, but IDs may reset more often.
const MAX_TRACK_DISTANCE = 80;

//Minimum iou for an oyster to be considered the same across frames
const MIN_IOU = 0.5;

// How many processed detection frames an oyster can disappear
// before we forget its ID.
const MAX_MISSED_FRAMES = 15;

// How many times an oyster must be detected before it counts
// as a real/confirmed oyster.
const MIN_CONFIRMATION_FRAMES = 3;


const resetTracker = () => {
  trackedOysters = [];
  nextOysterId = 1;
};

const distance = (x1, y1, x2, y2) => {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
};

const getBoxCenter = (box, ratios) => {
  let [y1, x1, y2, x2] = box;

  x1 *= ratios[0];
  x2 *= ratios[0];
  y1 *= ratios[1];
  y2 *= ratios[1];

  return {
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2,
  };
};

const getBoxCoords = (box, ratios) => {
  let [y1, x1, y2, x2] = box;

  x1 *= ratios[0];
  x2 *= ratios[0];
  y1 *= ratios[1];
  y2 *= ratios[1];

  return {
    x1 : x1,
    y1 : y1,
    x2 : x2,
    y2 : y2
  };
};

const getIOU = (newB, oldB) => {
  let iou = 0;

  if (newB.x1 < 0) {
    newB.x1 = 0;
  }
  if (oldB.x1 < 0) {
    oldB.x1 = 0;
  }
  const a = Math.max(newB.x1, oldB.x1);
  if (newB.y1 < 0) {
    newB.y1 = 0;
  }
  if (oldB.y1 < 0) {
    oldB.y1 = 0;
  }
  const b = Math.max(newB.y1, oldB.y1);
  const c = Math.min(newB.x2, oldB.x2);
  const d = Math.min(newB.y2, oldB.y2);

  if (c >= a && d >= b) {
    const inter = (c - a) * (d - b);
    const b1 = (newB.x2 - newB.x1) * (newB.y2 - newB.y1);
    const b2 = (oldB.x2 - oldB.x1) * (oldB.y2 - oldB.y1);
    const union = b1 + b2 - inter;
    iou = inter / union;
  }

  return iou;
};

const updateTracker = (boxes_data, ratios) => {
  const updatedTracks = [];
  const trackedIdsForDetections = [];
  const confirmedFlagsForDetections = [];
  const usedOldTrackIndexes = new Set();

  const detectionCount = boxes_data.length / 4;

  for (let i = 0; i < detectionCount; i++) {
    const box = boxes_data.slice(i * 4, (i + 1) * 4);
    const center = getBoxCenter(box, ratios);
    const newB = getBoxCoords(box, ratios);

    let bestTrackIndex1 = -1;
    let bestTrackIndex2 = -1;
    let bestDistance = Infinity;
    let bestIOU = 0;

    for (let j = 0; j < trackedOysters.length; j++) {
      if (usedOldTrackIndexes.has(j)) continue;

      const oldTrack = trackedOysters[j];
      const oldB = {y1:oldTrack.y1, x1:oldTrack.x1, y2:oldTrack.y2, x2:oldTrack.x2};
      const dist = distance(center.x, center.y, oldTrack.x, oldTrack.y);
      const iou = getIOU(newB, oldB);

      if (dist < bestDistance) {
        bestDistance = dist;
        bestTrackIndex2 = j;
      }
      if (iou > bestIOU) {
        bestIOU = iou;
        bestTrackIndex1 = j;
      }

    }

    let assignedId;
    let seenFrames;
    let confirmed;

    if (bestTrackIndex1 !== -1 && bestIOU >= MIN_IOU) {//bestDistance <= MAX_TRACK_DISTANCE) {
      const matchedTrack = trackedOysters[bestTrackIndex1];

      assignedId = matchedTrack.id;
      seenFrames = matchedTrack.seenFrames + 1;
      confirmed = seenFrames >= MIN_CONFIRMATION_FRAMES;

      usedOldTrackIndexes.add(bestTrackIndex1);
    } else if (bestTrackIndex2 !== -1 && bestDistance < MAX_TRACK_DISTANCE) {
      const matchedTrack = trackedOysters[bestTrackIndex2];

      assignedId = matchedTrack.id;
      seenFrames = matchedTrack.seenFrames + 1;
      confirmed = seenFrames >= MIN_CONFIRMATION_FRAMES;

      usedOldTrackIndexes.add(bestTrackIndex2);
    } else {
      assignedId = nextOysterId;
      nextOysterId++;

      seenFrames = 1;
      confirmed = seenFrames >= MIN_CONFIRMATION_FRAMES;
    }

    updatedTracks.push({
      id: assignedId,
      x1: newB.x1,
      x2: newB.x2,
      y1: newB.y1,
      y2: newB.y2,
      x: center.x,
      y: center.y,
      missedFrames: 0,
      seenFrames,
      confirmed,
    });

    trackedIdsForDetections.push(assignedId);
    confirmedFlagsForDetections.push(confirmed);

    console.log("\n-------------\n");
  }

  // Keep old tracks that were not matched this frame.
  // This lets an oyster disappear briefly and still keep its ID.
  for (let j = 0; j < trackedOysters.length; j++) {
    if (usedOldTrackIndexes.has(j)) continue;

    const oldTrack = trackedOysters[j];
    const missedFrames = oldTrack.missedFrames + 1;

    if (missedFrames <= MAX_MISSED_FRAMES) {
      updatedTracks.push({
        ...oldTrack,
        missedFrames,
      });
    }
  }

  trackedOysters = updatedTracks;

  const confirmedOysterCount = trackedOysters.filter(
    (track) => track.confirmed
  ).length;

  return {
    trackedIds: trackedIdsForDetections,
    confirmedFlags: confirmedFlagsForDetections,
    confirmedOysterCount,
  };
};

/**
 * Preprocess image / frame before forwarded into the model
 * @param {HTMLVideoElement|HTMLImageElement} source
 * @param {Number} modelWidth
 * @param {Number} modelHeight
 * @returns input tensor, xRatio and yRatio
 */
const preprocess = (source, modelWidth, modelHeight) => {
  let xRatio, yRatio;

  const input = tf.tidy(() => {
    const img = tf.browser.fromPixels(source);

    const [h, w] = img.shape.slice(0, 2);
    const maxSize = Math.max(w, h);

    const imgPadded = img.pad([
      [0, maxSize - h],
      [0, maxSize - w],
      [0, 0],
    ]);

    xRatio = maxSize / w;
    yRatio = maxSize / h;

    return tf.image
      .resizeBilinear(imgPadded, [modelWidth, modelHeight])
      .div(255.0)
      .expandDims(0);
  });

  return [input, xRatio, yRatio];
};

/**
 * Function run inference and do detection from source.
 * @param {HTMLImageElement|HTMLVideoElement} source
 * @param {tf.GraphModel} model loaded YOLOv8 tensorflow.js model
 * @param {HTMLCanvasElement} canvasRef canvas reference
 * @param {VoidFunction} onComplete function to run after detection process
 */
export const detect = async (source, model, canvasRef, onComplete = () => {}) => {
  const [modelWidth, modelHeight] = model.inputShape.slice(1, 3);

  tf.engine().startScope();

  const [input, xRatio, yRatio] = preprocess(source, modelWidth, modelHeight);

  const res = model.net.execute(input);
  const transRes = res.transpose([0, 2, 1]);

  const boxes = tf.tidy(() => {
    const w = transRes.slice([0, 0, 2], [-1, -1, 1]);
    const h = transRes.slice([0, 0, 3], [-1, -1, 1]);

    const x1 = tf.sub(
      transRes.slice([0, 0, 0], [-1, -1, 1]),
      tf.div(w, 2)
    );

    const y1 = tf.sub(
      transRes.slice([0, 0, 1], [-1, -1, 1]),
      tf.div(h, 2)
    );

    return tf
      .concat(
        [
          y1,
          x1,
          tf.add(y1, h),
          tf.add(x1, w),
        ],
        2
      )
      .squeeze();
  });

  const [scores, classes] = tf.tidy(() => {
    const rawScores = transRes.slice([0, 0, 4], [-1, -1, numClass]).squeeze(0);
    return [rawScores.max(1), rawScores.argMax(1)];
  });

  const nms = await tf.image.nonMaxSuppressionAsync(
    boxes,
    scores,
    500,
    0.5,
    0.40
  );

  const boxes_data = boxes.gather(nms, 0).dataSync();
  const scores_data = scores.gather(nms, 0).dataSync();
  const classes_data = classes.gather(nms, 0).dataSync();

  const currentDetectionCount = boxes_data.length / 4;

  const {
    trackedIds,
    confirmedFlags,
    confirmedOysterCount,
  } = updateTracker(boxes_data, [xRatio, yRatio]);

  logFrame(boxes_data, scores_data, classes_data, labels, source.currentTime ?? 0, source.currentSrc ?? "unknown", trackedIds, confirmedFlags);

  console.log("Current detections:", currentDetectionCount);
  console.log("Confirmed oysters:", confirmedOysterCount);
  console.log("Tracked oyster IDs:", trackedIds);
  console.log("Tracker memory:", trackedOysters);

  renderBoxes(
    canvasRef,
    source,
    boxes_data,
    scores_data,
    classes_data,
    [xRatio, yRatio],
    currentDetectionCount,
    confirmedOysterCount,
    trackedIds,
    confirmedFlags
  );

  tf.dispose([res, transRes, boxes, scores, classes, nms]);

  const baked = canvasRef.toDataURL("image/png");
  onComplete(baked);

  tf.engine().endScope();
};

/**
 * Function to detect video from every source.
 * @param {HTMLVideoElement} vidSource video source
 * @param {tf.GraphModel} model loaded YOLOv8 tensorflow.js model
 * @param {HTMLCanvasElement} canvasRef canvas reference
 */
export const detectVideo = (vidSource, model, canvasRef, setRecordedBlob) => {
  if (vidSource._detecting) return;
  vidSource._detecting = true;

  resetTracker();

  let rafId = null;
  let recorder = null;
  let chunks = [];

  const canvasStream = canvasRef.captureStream();

  try {
    recorder = new MediaRecorder(canvasStream, { mimeType: "video/webm" });
  } catch (e) {
    console.warn("MediaRecorder not supported or mimeType rejected:", e);
    recorder = null;
  }

  if (recorder) {
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const recordedBlob = new Blob(chunks, { type: "video/webm" });

      if (typeof setRecordedBlob === "function") {
        setRecordedBlob(recordedBlob);
      }
    };

    recorder.start();
  }

  let frameCount = 0;

  const stopAll = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    try {
      if (recorder && recorder.state !== "inactive") recorder.stop();
    } catch (err) {
      console.warn("Error stopping recorder:", err);
    }

    vidSource._detecting = false;
  };

  const detectFrame = async () => {
    if (vidSource.ended || vidSource.paused) {
      stopAll();
      return;
    }

    frameCount++;

    if (frameCount % 10 === 0) {
      try {
        await detect(vidSource, model, canvasRef, () => {});
      } catch (err) {
        console.error("Error during detection:", err);
      }
    }

    rafId = requestAnimationFrame(detectFrame);
  };

  detectFrame();
};