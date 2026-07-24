import * as tf from "@tensorflow/tfjs";
import { renderBoxes } from "./renderBox";
import labels from "./labelsO.json";
import { logFrame, resetFrameCounter } from "../frameLogger";

const numClass = labels.length;

let trackedOysters = [];
let nextOysterId = 1;

// Tracking settings
const MAX_TRACK_DISTANCE = 80;
const MIN_IOU = 0.5;
const MAX_MISSED_FRAMES = 15;
const MIN_CONFIRMATION_FRAMES = 3;

// Confidence-weighted state smoothing settings
const STATE_HISTORY_SIZE = 7;
const MIN_STATE_HISTORY = 3;
const SWITCH_THRESHOLD = 0.65;

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
    x1,
    y1,
    x2,
    y2,
  };
};

const getIOU = (newBox, oldBox) => {
  const newX1 = Math.max(newBox.x1, 0);
  const newY1 = Math.max(newBox.y1, 0);
  const oldX1 = Math.max(oldBox.x1, 0);
  const oldY1 = Math.max(oldBox.y1, 0);

  const intersectionX1 = Math.max(newX1, oldX1);
  const intersectionY1 = Math.max(newY1, oldY1);
  const intersectionX2 = Math.min(newBox.x2, oldBox.x2);
  const intersectionY2 = Math.min(newBox.y2, oldBox.y2);

  if (
    intersectionX2 < intersectionX1 ||
    intersectionY2 < intersectionY1
  ) {
    return 0;
  }

  const intersectionArea =
    (intersectionX2 - intersectionX1) *
    (intersectionY2 - intersectionY1);

  const newArea =
    (newBox.x2 - newX1) * (newBox.y2 - newY1);

  const oldArea =
    (oldBox.x2 - oldX1) * (oldBox.y2 - oldY1);

  const unionArea = newArea + oldArea - intersectionArea;

  return unionArea > 0 ? intersectionArea / unionArea : 0;
};

/**
 * Uses confidence-weighted voting over one oyster's recent raw states.
 *
 * Class 0 = Oyster-Closed
 * Class 1 = Oyster-Open
 *
 * The state only switches when the opposite class owns at least
 * SWITCH_THRESHOLD of the total confidence weight.
 *
 * Otherwise, the previous smoothed state is preserved.
 */
const smoothState = (
  history,
  previousSmoothedClass,
  fallbackClass
) => {
  let closedWeight = 0;
  let openWeight = 0;

  for (const vote of history) {
    if (vote.classId === 0) {
      closedWeight += vote.confidence;
    } else if (vote.classId === 1) {
      openWeight += vote.confidence;
    }
  }

  const totalWeight = closedWeight + openWeight;

  if (totalWeight <= 0) {
    return {
      smoothedClass:
        previousSmoothedClass ?? fallbackClass,
      smoothedSupport: 0,
    };
  }

  let winningClass;

  if (closedWeight === openWeight) {
    winningClass =
      previousSmoothedClass ?? fallbackClass;
  } else {
    winningClass =
      openWeight > closedWeight ? 1 : 0;
  }

  const winningWeight =
    winningClass === 1 ? openWeight : closedWeight;

  const winningShare = winningWeight / totalWeight;

  let smoothedClass =
    previousSmoothedClass ?? fallbackClass;

  // During the first few observations, preserve the initial state.
  if (history.length < MIN_STATE_HISTORY) {
    smoothedClass =
      previousSmoothedClass ?? winningClass;
  } else if (winningClass === smoothedClass) {
    // The weighted vote agrees with the existing smoothed state.
    smoothedClass = winningClass;
  } else if (winningShare >= SWITCH_THRESHOLD) {
    // Only switch when the opposite state has strong enough support.
    smoothedClass = winningClass;
  }

  const smoothedWeight =
    smoothedClass === 1 ? openWeight : closedWeight;

  return {
    smoothedClass,
    smoothedSupport: smoothedWeight / totalWeight,
  };
};

const updateTracker = (
  boxesData,
  scoresData,
  classesData,
  ratios
) => {
  const updatedTracks = [];

  const trackedIdsForDetections = [];
  const confirmedFlagsForDetections = [];

  const smoothedClassesForDetections = [];
  const smoothedSupportsForDetections = [];
  const stateHistoryLengthsForDetections = [];

  const usedOldTrackIndexes = new Set();

  const detectionCount = boxesData.length / 4;

  for (let i = 0; i < detectionCount; i++) {
    const box = boxesData.slice(i * 4, (i + 1) * 4);

    const center = getBoxCenter(box, ratios);
    const newBox = getBoxCoords(box, ratios);

    const rawClass = Number(classesData[i]);
    const rawConfidence = Number(scoresData[i]);

    let bestIouTrackIndex = -1;
    let bestDistanceTrackIndex = -1;

    let bestDistance = Infinity;
    let bestIOU = 0;

    for (let j = 0; j < trackedOysters.length; j++) {
      if (usedOldTrackIndexes.has(j)) {
        continue;
      }

      const oldTrack = trackedOysters[j];

      const oldBox = {
        x1: oldTrack.x1,
        y1: oldTrack.y1,
        x2: oldTrack.x2,
        y2: oldTrack.y2,
      };

      const dist = distance(
        center.x,
        center.y,
        oldTrack.x,
        oldTrack.y
      );

      const iou = getIOU(newBox, oldBox);

      if (dist < bestDistance) {
        bestDistance = dist;
        bestDistanceTrackIndex = j;
      }

      if (iou > bestIOU) {
        bestIOU = iou;
        bestIouTrackIndex = j;
      }
    }

    let matchedTrackIndex = -1;

    // Prefer IoU matching.
    if (
      bestIouTrackIndex !== -1 &&
      bestIOU >= MIN_IOU
    ) {
      matchedTrackIndex = bestIouTrackIndex;
    } else if (
      bestDistanceTrackIndex !== -1 &&
      bestDistance < MAX_TRACK_DISTANCE
    ) {
      // Fall back to center-point distance.
      matchedTrackIndex = bestDistanceTrackIndex;
    }

    let assignedId;
    let seenFrames;
    let confirmed;

    let previousHistory = [];
    let previousSmoothedClass = rawClass;

    if (matchedTrackIndex !== -1) {
      const matchedTrack =
        trackedOysters[matchedTrackIndex];

      assignedId = matchedTrack.id;
      seenFrames = matchedTrack.seenFrames + 1;

      confirmed =
        seenFrames >= MIN_CONFIRMATION_FRAMES;

      previousHistory =
        matchedTrack.stateHistory ?? [];

      previousSmoothedClass =
        matchedTrack.smoothedClass ?? rawClass;

      usedOldTrackIndexes.add(matchedTrackIndex);
    } else {
      assignedId = nextOysterId;
      nextOysterId += 1;

      seenFrames = 1;
      confirmed = false;
    }

    // Append the newest raw state vote and keep only the most
    // recent STATE_HISTORY_SIZE observations.
    const stateHistory = [
      ...previousHistory,
      {
        classId: rawClass,
        confidence: rawConfidence,
      },
    ].slice(-STATE_HISTORY_SIZE);

    const {
      smoothedClass,
      smoothedSupport,
    } = smoothState(
      stateHistory,
      previousSmoothedClass,
      rawClass
    );

    updatedTracks.push({
      id: assignedId,

      x1: newBox.x1,
      x2: newBox.x2,
      y1: newBox.y1,
      y2: newBox.y2,

      x: center.x,
      y: center.y,

      missedFrames: 0,
      seenFrames,
      confirmed,

      stateHistory,
      smoothedClass,
      smoothedSupport,
    });

    trackedIdsForDetections.push(assignedId);
    confirmedFlagsForDetections.push(confirmed);

    smoothedClassesForDetections.push(
      smoothedClass
    );

    smoothedSupportsForDetections.push(
      smoothedSupport
    );

    stateHistoryLengthsForDetections.push(
      stateHistory.length
    );
  }

  // Preserve tracks that were briefly missed.
  // A missed frame does not add an Open or Closed vote.
  for (let j = 0; j < trackedOysters.length; j++) {
    if (usedOldTrackIndexes.has(j)) {
      continue;
    }

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

  const confirmedOysterCount =
    trackedOysters.filter(
      (track) => track.confirmed
    ).length;

  return {
    trackedIds: trackedIdsForDetections,
    confirmedFlags:
      confirmedFlagsForDetections,

    confirmedOysterCount,

    smoothedClasses:
      smoothedClassesForDetections,

    smoothedSupports:
      smoothedSupportsForDetections,

    stateHistoryLengths:
      stateHistoryLengthsForDetections,
  };
};

/**
 * Preprocess image or video frame before forwarding it
 * into the model.
 */
const preprocess = (
  source,
  modelWidth,
  modelHeight
) => {
  let xRatio;
  let yRatio;

  const input = tf.tidy(() => {
    const image = tf.browser.fromPixels(source);

    const [height, width] =
      image.shape.slice(0, 2);

    const maxSize = Math.max(width, height);

    const paddedImage = image.pad([
      [0, maxSize - height],
      [0, maxSize - width],
      [0, 0],
    ]);

    xRatio = maxSize / width;
    yRatio = maxSize / height;

    return tf.image
      .resizeBilinear(
        paddedImage,
        [modelWidth, modelHeight]
      )
      .div(255.0)
      .expandDims(0);
  });

  return [input, xRatio, yRatio];
};

/**
 * Run inference and detection for an image or video frame.
 */
export const detect = async (
  source,
  model,
  canvasRef,
  onComplete = () => {}
) => {
  const [modelWidth, modelHeight] =
    model.inputShape.slice(1, 3);

  tf.engine().startScope();

  const [input, xRatio, yRatio] = preprocess(
    source,
    modelWidth,
    modelHeight
  );

  const result = model.net.execute(input);

  const transposedResult = result.transpose([
    0,
    2,
    1,
  ]);

  const boxes = tf.tidy(() => {
    const width = transposedResult.slice(
      [0, 0, 2],
      [-1, -1, 1]
    );

    const height = transposedResult.slice(
      [0, 0, 3],
      [-1, -1, 1]
    );

    const x1 = tf.sub(
      transposedResult.slice(
        [0, 0, 0],
        [-1, -1, 1]
      ),
      tf.div(width, 2)
    );

    const y1 = tf.sub(
      transposedResult.slice(
        [0, 0, 1],
        [-1, -1, 1]
      ),
      tf.div(height, 2)
    );

    return tf
      .concat(
        [
          y1,
          x1,
          tf.add(y1, height),
          tf.add(x1, width),
        ],
        2
      )
      .squeeze();
  });

  const [scores, classes] = tf.tidy(() => {
    const rawScores = transposedResult
      .slice(
        [0, 0, 4],
        [-1, -1, numClass]
      )
      .squeeze(0);

    return [
      rawScores.max(1),
      rawScores.argMax(1),
    ];
  });

  const nms =
    await tf.image.nonMaxSuppressionAsync(
      boxes,
      scores,
      500,
      0.5,
      0.4
    );

  const boxesData = boxes
    .gather(nms, 0)
    .dataSync();

  const scoresData = scores
    .gather(nms, 0)
    .dataSync();

  const classesData = classes
    .gather(nms, 0)
    .dataSync();

  const currentDetectionCount =
    boxesData.length / 4;

  const {
    trackedIds,
    confirmedFlags,
    confirmedOysterCount,
    smoothedClasses,
    smoothedSupports,
    stateHistoryLengths,
  } = updateTracker(
    boxesData,
    scoresData,
    classesData,
    [xRatio, yRatio]
  );

  logFrame(
    boxesData,
    scoresData,
    classesData,
    labels,
    source.currentTime ?? 0,
    source.currentSrc ?? "unknown",
    trackedIds,
    confirmedFlags,
    smoothedClasses,
    smoothedSupports,
    stateHistoryLengths
  );

  renderBoxes(
    canvasRef,
    source,
    boxesData,
    scoresData,
    classesData,
    [xRatio, yRatio],
    currentDetectionCount,
    confirmedOysterCount,
    trackedIds,
    confirmedFlags,
    smoothedClasses,
    smoothedSupports
  );

  tf.dispose([
    result,
    transposedResult,
    boxes,
    scores,
    classes,
    nms,
  ]);

  const baked =
    canvasRef.toDataURL("image/png");

  onComplete(baked);

  tf.engine().endScope();
};

/**
 * Detect oysters throughout a video or webcam stream.
 */
export const detectVideo = (
  videoSource,
  model,
  canvasRef,
  setRecordedBlob
) => {
  if (videoSource._detecting) {
    return;
  }

  videoSource._detecting = true;

  resetTracker();
  resetFrameCounter();

  let animationFrameId = null;
  let recorder = null;
  let chunks = [];

  const canvasStream =
    canvasRef.captureStream();

  try {
    recorder = new MediaRecorder(
      canvasStream,
      {
        mimeType: "video/webm",
      }
    );
  } catch (error) {
    console.warn(
      "MediaRecorder not supported or mimeType rejected:",
      error
    );

    recorder = null;
  }

  if (recorder) {
    recorder.ondataavailable = (event) => {
      if (
        event.data &&
        event.data.size > 0
      ) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      const recordedBlob = new Blob(
        chunks,
        {
          type: "video/webm",
        }
      );

      if (
        typeof setRecordedBlob ===
        "function"
      ) {
        setRecordedBlob(recordedBlob);
      }
    };

    recorder.start();
  }

  let frameCount = 0;

  const stopAll = () => {
    if (animationFrameId) {
      cancelAnimationFrame(
        animationFrameId
      );

      animationFrameId = null;
    }

    try {
      if (
        recorder &&
        recorder.state !== "inactive"
      ) {
        recorder.stop();
      }
    } catch (error) {
      console.warn(
        "Error stopping recorder:",
        error
      );
    }

    videoSource._detecting = false;
  };

  const detectFrame = async () => {
    if (
      videoSource.ended ||
      videoSource.paused
    ) {
      stopAll();
      return;
    }

    frameCount += 1;

    // Run detection every tenth animation frame.
    if (frameCount % 10 === 0) {
      try {
        await detect(
          videoSource,
          model,
          canvasRef,
          () => {}
        );
      } catch (error) {
        console.error(
          "Error during detection:",
          error
        );
      }
    }

    animationFrameId =
      requestAnimationFrame(detectFrame);
  };

  detectFrame();
};