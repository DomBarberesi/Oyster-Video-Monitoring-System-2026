import labels from "./labelsO.json";

/**
 * Render prediction boxes.
 *
 * Line 1: ID | current raw oyster state | detector confidence
 * Line 2: confidence-weighted smoothed state
 *
 * @param {HTMLCanvasElement} canvasRef
 * @param {HTMLVideoElement|HTMLImageElement} source
 * @param {Array} boxesData
 * @param {Array} scoresData
 * @param {Array} classesData
 * @param {Array<number>} ratios
 * @param {number} currentDetectionCount
 * @param {number} confirmedOysterCount
 * @param {Array} trackedIds
 * @param {Array} confirmedFlags
 * @param {Array} smoothedClasses
 * @param {Array} smoothedSupports
 */
export const renderBoxes = (
  canvasRef,
  source,
  boxesData,
  scoresData,
  classesData,
  ratios,
  currentDetectionCount,
  confirmedOysterCount,
  trackedIds = [],
  confirmedFlags = [],
  smoothedClasses = [],
  smoothedSupports = []
) => {
  const ctx = canvasRef.getContext("2d");

  ctx.clearRect(
    0,
    0,
    ctx.canvas.width,
    ctx.canvas.height
  );

  ctx.drawImage(
    source,
    0,
    0,
    ctx.canvas.width,
    ctx.canvas.height
  );

  const colors = new Colors();

  const fontSize = Math.max(
    Math.round(
      Math.max(
        ctx.canvas.width,
        ctx.canvas.height
      ) / 40
    ),
    14
  ) / 1.4;

  const font = `${fontSize}px Arial`;

  ctx.font = font;
  ctx.textBaseline = "top";

  for (let i = 0; i < scoresData.length; i++) {
    // Raw model prediction for the current frame.
    const rawClass = Number(classesData[i]);

    // Confidence-weighted smoothed result.
    const smoothedClass =
      smoothedClasses[i] ?? rawClass;

    const rawLabel =
      labels[rawClass] ??
      `Unknown-${rawClass}`;

    const smoothedLabel =
      labels[smoothedClass] ??
      `Unknown-${smoothedClass}`;

    // Color the box using the smoothed state.
    const color = colors.get(smoothedClass);

    const rawConfidence =
      Number(scoresData[i]) * 100;

    const oysterId = trackedIds[i];

    const isConfirmed =
      confirmedFlags[i];

    let [y1, x1, y2, x2] =
      boxesData.slice(
        i * 4,
        (i + 1) * 4
      );

    x1 *= ratios[0];
    x2 *= ratios[0];
    y1 *= ratios[1];
    y2 *= ratios[1];

    const width = x2 - x1;
    const height = y2 - y1;

    // Keep the question mark for an ID that has not yet
    // reached the minimum confirmation-frame requirement.
    const confirmationMarker =
      isConfirmed ? "" : "?";

    const idText =
      oysterId !== undefined
        ? `#${oysterId}${confirmationMarker}`
        : "N/A";

    const topLine =
      `ID: ${idText} | ${rawLabel} | Conf: ${rawConfidence.toFixed(1)}%`;

    const bottomLine =
      `Smoothed State: ${smoothedLabel}`;

    // Draw translucent bounding-box fill.
    ctx.fillStyle =
      Colors.hexToRgba(color, 0.2);

    ctx.fillRect(
      x1,
      y1,
      width,
      height
    );

    // Draw bounding-box border.
    ctx.strokeStyle = color;

    ctx.lineWidth = Math.max(
      Math.min(
        ctx.canvas.width,
        ctx.canvas.height
      ) / 200,
      2.5
    );

    ctx.strokeRect(
      x1,
      y1,
      width,
      height
    );

    // Draw a two-line label.
    ctx.font = font;

    const paddingX = 4;
    const paddingY = 3;
    const lineGap = 2;
    const textHeight = fontSize;

    const topLineWidth =
      ctx.measureText(topLine).width;

    const bottomLineWidth =
      ctx.measureText(bottomLine).width;

    const labelWidth =
      Math.max(
        topLineWidth,
        bottomLineWidth
      ) +
      paddingX * 2;

    const labelHeight =
      textHeight * 2 +
      lineGap +
      paddingY * 2;

    let labelX = x1 - 1;

    // Prevent the label from extending past the right edge.
    if (
      labelX + labelWidth >
      ctx.canvas.width
    ) {
      labelX = Math.max(
        0,
        ctx.canvas.width - labelWidth
      );
    }

    let labelY =
      y1 -
      labelHeight -
      ctx.lineWidth;

    // Draw the label inside the box when there is not
    // enough room above it.
    if (labelY < 0) {
      labelY = Math.max(0, y1);
    }

    // Draw label background.
    ctx.fillStyle = color;

    ctx.fillRect(
      labelX,
      labelY,
      labelWidth,
      labelHeight
    );

    // Draw first line.
    ctx.fillStyle = "#ffffff";

    ctx.fillText(
      topLine,
      labelX + paddingX,
      labelY + paddingY
    );

    // Draw second line.
    ctx.fillText(
      bottomLine,
      labelX + paddingX,
      labelY +
        paddingY +
        textHeight +
        lineGap
    );
  }

  // Draw overall count information with white background.
  const countBoxX = 5;
  const countBoxY = 10;

  const line1 =
    `Confirmed Oysters: ${confirmedOysterCount}`;

  const line2 =
    `Current Detections: ${currentDetectionCount}`;

  ctx.font = "20px Arial";
  const line1Width =
    ctx.measureText(line1).width;

  ctx.font = "15px Arial";
  const line2Width =
    ctx.measureText(line2).width;

  const boxWidth =
    Math.max(line1Width, line2Width) + 10;

  const boxHeight = 45;

  // White background box.
  ctx.fillStyle =
    "rgba(255, 255, 255, 0.75)";

  ctx.fillRect(
    countBoxX,
    countBoxY,
    boxWidth,
    boxHeight
  );

  // Black border.
  ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
  ctx.lineWidth = 1;

  ctx.strokeRect(
    countBoxX,
    countBoxY,
    boxWidth,
    boxHeight
  );

  // Draw text.
  ctx.fillStyle = "black";

  ctx.font = "20px Arial";

  ctx.fillText(
    line1,
    countBoxX + 5,
    countBoxY + 2
  );

  ctx.font = "15px Arial";

  ctx.fillText(
    line2,
    countBoxX + 5,
    countBoxY + 25
  );
};

class Colors {
  constructor() {
    this.palette = [
      "#0bae24",
      "#c21d3e",
    ];

    this.n = this.palette.length;
  }

  get = (index) =>
    this.palette[
      Math.floor(index) % this.n
    ];

  static hexToRgba = (
    hex,
    alpha
  ) => {
    const result =
      /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(
        hex
      );

    return result
      ? `rgba(${[
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16),
        ].join(", ")}, ${alpha})`
      : null;
  };
}