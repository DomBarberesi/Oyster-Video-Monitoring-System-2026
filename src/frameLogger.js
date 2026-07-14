/**
 * Class made to log video frames for debugging and analysis purposes.
 */

let log = [];
let frameNumber = 0;

export function logFrame(boxes_data, scores_data, classes_data, labels, currentTime, clipName = "unknown", trackedIds = null, confirmedFlags = null) {
  frameNumber += 1;
  const count = scores_data.length;
 
  if (count === 0) {
    // Still log empty frames
    log.push({
      clip: clipName,
      frame: frameNumber,
      timestamp: currentTime.toFixed(3),
      count: 0,
      trackedId: "",
      label: "",
      confidence: "",
      y1: "",
      x1: "",
      y2: "",
      x2: "",
    });
    return;
  }
 
  for (let i = 0; i < count; i++) {
    const classIdx = classes_data[i];
    const label = labels[classIdx] ?? `unknown_class_${classIdx}`;
    const confidence = scores_data[i];
    const y1 = boxes_data[i * 4 + 0];
    const x1 = boxes_data[i * 4 + 1];
    const y2 = boxes_data[i * 4 + 2];
    const x2 = boxes_data[i * 4 + 3];
 
    const trackedId = trackedIds ? trackedIds[i] : "";
    const confirmed = confirmedFlags ? confirmedFlags[i] : "";
 
    log.push({
      clip: clipName,
      frame: frameNumber,
      timestamp: currentTime.toFixed(3),
      count,
      trackedId,
      label,
      confidence: confidence.toFixed(4),
      y1: y1.toFixed(1),
      x1: x1.toFixed(1),
      y2: y2.toFixed(1),
      x2: x2.toFixed(1),
    });
  }
}
 
/** Call when starting a new clip so frame numbers reset cleanly. */
export function resetFrameCounter() {
  frameNumber = 0;
}
 
/** Returns the current in-memory log. */
export function getLog() {
  return log;
}
 
/** Clears everything — call before starting a fresh run. */
export function clearLog() {
  log = [];
  frameNumber = 0;
}

/** Converts the log to a CSV string and triggers a browser download.*/
export function downloadLog(filename = "detection_log.csv") {
  if (log.length === 0) {
    console.warn("No log entries yet — run detection on a clip first.");
    return;
  }
 
  const headers = Object.keys(log[0]);
  const rows = log.map((row) =>
    headers.map((h) => row[h]).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
 
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}