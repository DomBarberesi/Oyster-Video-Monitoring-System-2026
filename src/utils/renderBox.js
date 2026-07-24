import labels from "./labelsO.json";

/**
 * Render prediction boxes.
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
  );

  const font = `${fontSize}px Arial`;

  ctx.font = font;
  ctx.textBaseline = "top";

  for (let i = 0; i < scoresData.length; i++) {
    const rawClass = Number(classesData[i]);

    const displayedClass =
      smoothedClasses[i] ?? rawClass;

    const rawLabel =
      labels[rawClass] ??
      `Unknown-${rawClass}`;

    const displayedLabel =
      labels[displayedClass] ??
      `Unknown-${displayedClass}`;

    const color = colors.get(displayedClass);

    const rawConfidence =
      Number(scoresData[i]) * 100;

    const recentStateAgreement =
      Number(smoothedSupports[i]) * 100;

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

    const confirmationMarker =
      isConfirmed ? "" : "?";

    let topLine;

    /*
     * When the raw and smoothed classes agree, show the
     * detector confidence normally.
     *
     * When smoothing overrides the current raw prediction,
     * explicitly show what the raw prediction was.
     */
    if (rawClass === displayedClass) {
      topLine =
        oysterId !== undefined
          ? `${displayedLabel} ID:#${oysterId}${confirmationMarker} - Confidence: ${rawConfidence.toFixed(1)}%`
          : `${displayedLabel} - Confidence: ${rawConfidence.toFixed(1)}%`;
    } else {
      topLine =
        oysterId !== undefined
          ? `${displayedLabel} ID:#${oysterId}${confirmationMarker} - Raw ${rawLabel}: ${rawConfidence.toFixed(1)}%`
          : `${displayedLabel} - Raw ${rawLabel}: ${rawConfidence.toFixed(1)}%`;
    }

    const bottomLine =
      Number.isFinite(recentStateAgreement)
        ? `Recent-state agreement: ${recentStateAgreement.toFixed(1)}%`
        : "Recent-state agreement: collecting history";

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

    /*
     * Draw a two-line label.
     */
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

    // Prevent labels from running off the right edge.
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

    // If there is no space above the box, draw inside it.
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

  // Draw overall count information.
  ctx.font = "28px Arial";
  ctx.fillStyle = "red";

  ctx.fillText(
    `Confirmed Oysters: ${confirmedOysterCount}`,
    20,
    20
  );

  ctx.font = "22px Arial";

  ctx.fillText(
    `Current Detections: ${currentDetectionCount}`,
    20,
    55
  );
};

class Colors {
  constructor() {
    this.palette = [
      "#FF3838",
      "#FF9D97",
      "#FF701F",
      "#FFB21D",
      "#CFD231",
      "#48F90A",
      "#92CC17",
      "#3DDB86",
      "#1A9334",
      "#00D4BB",
      "#2C99A8",
      "#00C2FF",
      "#344593",
      "#6473FF",
      "#0018EC",
      "#8438FF",
      "#520085",
      "#CB38FF",
      "#FF95C8",
      "#FF37C7",
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