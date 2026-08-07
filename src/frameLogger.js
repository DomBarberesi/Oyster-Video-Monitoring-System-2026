/**
 * Logs processed video frames for debugging and analysis.
 */

let log = [];
let frameNumber = 0;

export function logFrame(
  boxesData,
  scoresData,
  classesData,
  confirmedOysterCount,
  labels,
  currentTime,
  clipName = "unknown",
  trackedIds = null,
  confirmedFlags = null,
  smoothedClasses = null,
  smoothedSupports = null,
  stateHistoryLengths = null
) {
  frameNumber += 1;

  const count = scoresData.length;
  const confirmedCount = confirmedOysterCount;

  if (count === 0) {
    log.push({
      clip: clipName,
      frame: frameNumber,
      timestamp:
        Number(currentTime).toFixed(3),
      count: 0,
      confirmedCount: 0,

      trackedId: "",
      confirmed: "",

      rawLabel: "",
      rawConfidence: "",

      smoothedLabel: "",
      smoothedSupport: "",
      stateHistoryLength: "",

      y1: "",
      x1: "",
      y2: "",
      x2: "",
    });

    return;
  }

  for (let i = 0; i < count; i++) {
    const rawClassIndex = Number(
      classesData[i]
    );

    const smoothedClassIndex =
      smoothedClasses &&
      smoothedClasses[i] !== undefined
        ? Number(smoothedClasses[i])
        : rawClassIndex;

    const rawLabel =
      labels[rawClassIndex] ??
      `unknown_class_${rawClassIndex}`;

    const smoothedLabel =
      labels[smoothedClassIndex] ??
      `unknown_class_${smoothedClassIndex}`;

    const confidence = Number(
      scoresData[i]
    );

    const y1 = Number(
      boxesData[i * 4]
    );

    const x1 = Number(
      boxesData[i * 4 + 1]
    );

    const y2 = Number(
      boxesData[i * 4 + 2]
    );

    const x2 = Number(
      boxesData[i * 4 + 3]
    );

    const trackedId =
      trackedIds
        ? trackedIds[i]
        : "";

    const confirmed =
      confirmedFlags
        ? confirmedFlags[i]
        : "";

    const smoothedSupport =
      smoothedSupports
        ? smoothedSupports[i]
        : "";

    const stateHistoryLength =
      stateHistoryLengths
        ? stateHistoryLengths[i]
        : "";

    log.push({
      clip: clipName,
      frame: frameNumber,

      timestamp:
        Number(currentTime).toFixed(3),

      count,
      confirmedCount,

      trackedId,
      confirmed,

      rawLabel,

      rawConfidence:
        confidence.toFixed(4),

      smoothedLabel,

      smoothedSupport:
        typeof smoothedSupport ===
        "number"
          ? smoothedSupport.toFixed(4)
          : "",

      stateHistoryLength,

      y1: y1.toFixed(1),
      x1: x1.toFixed(1),
      y2: y2.toFixed(1),
      x2: x2.toFixed(1),
    });
  }
}

/**
 * Call when starting a new clip so frame numbers reset cleanly.
 */
export function resetFrameCounter() {
  frameNumber = 0;
}

/**
 * Returns the current in-memory log.
 */
export function getLog() {
  return log;
}

/**
 * Clears all logged data before starting a fresh run.
 */
export function clearLog() {
  log = [];
  frameNumber = 0;
}

/**
 * Converts the log into CSV and triggers a browser download.
 */
export function downloadLog(
  filename = "detection_log.csv"
) {
  if (log.length === 0) {
    console.warn(
      "No log entries yet — run detection on a clip first."
    );

    return;
  }

  const headers =
    Object.keys(log[0]);

  const rows = log.map((row) =>
    headers
      .map((header) => {
        const value = String(
          row[header] ?? ""
        );

        return `"${value.replaceAll(
          '"',
          '""'
        )}"`;
      })
      .join(",")
  );

  const csv = [
    headers.join(","),
    ...rows,
  ].join("\n");

  const blob = new Blob(
    [csv],
    {
      type: "text/csv",
    }
  );

  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}