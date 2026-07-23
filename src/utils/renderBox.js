import labels from "./labelsO.json";

/**
 * Render prediction boxes
 * @param {HTMLCanvasElement} canvasRef canvas tag reference
 * @param {HTMLVideoElement|HTMLImageElement} source source image/video frame
 * @param {Array} boxes_data boxes array
 * @param {Array} scores_data scores array
 * @param {Array} classes_data class array
 * @param {Array[Number]} ratios boxes ratio [xRatio, yRatio]
 * @param {Number} currentDetectionCount number of oysters detected in current frame
 * @param {Number} confirmedOysterCount number of confirmed unique oysters
 * @param {Array} trackedIds persistent oyster IDs for current frame
 * @param {Array} confirmedFlags whether each detected oyster is confirmed
 */
export const renderBoxes = (
  canvasRef,
  source,
  boxes_data,
  scores_data,
  classes_data,
  ratios,
  currentDetectionCount,
  confirmedOysterCount,
  trackedIds = [],
  confirmedFlags = []
) => {
  const ctx = canvasRef.getContext("2d");

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(source, 0, 0, ctx.canvas.width, ctx.canvas.height);

  const colors = new Colors();

  const font = `${Math.max(
    Math.round(Math.max(ctx.canvas.width, ctx.canvas.height) / 40),
    14
  )}px Arial`;

  ctx.font = font;
  ctx.textBaseline = "top";

  for (let i = 0; i < scores_data.length; ++i) {
    const klass = labels[classes_data[i]];
    const color = colors.get(classes_data[i]);
    const score = (scores_data[i] * 100).toFixed(1);
    const oysterId = trackedIds[i];
    const isConfirmed = confirmedFlags[i];

    let [y1, x1, y2, x2] = boxes_data.slice(i * 4, (i + 1) * 4);

    x1 *= ratios[0];
    x2 *= ratios[0];
    y1 *= ratios[1];
    y2 *= ratios[1];

    const width = x2 - x1;
    const height = y2 - y1;

    const labelText =
      oysterId !== undefined
        ? isConfirmed
          ? `${klass} ID:#${oysterId} - ${score}%`
          : `${klass} ID:#${oysterId}? - ${score}%`
        : `${klass} - ${score}%`;

    ctx.fillStyle = Colors.hexToRgba(color, 0.2);
    ctx.fillRect(x1, y1, width, height);

    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(
      Math.min(ctx.canvas.width, ctx.canvas.height) / 200,
      2.5
    );
    ctx.strokeRect(x1, y1, width, height);
  

    ctx.fillStyle = color;
    const textWidth = ctx.measureText(labelText).width;
    const textHeight = parseInt(font, 10);
    const yText = y1 - (textHeight + ctx.lineWidth);

    ctx.fillRect(
      x1 - 1,
      yText < 0 ? 0 : yText,
      textWidth + ctx.lineWidth,
      textHeight + ctx.lineWidth
    );

    ctx.fillStyle = "#ffffff";
    ctx.fillText(labelText, x1 - 1, yText < 0 ? 0 : yText);
  }

  ctx.font = "28px Arial";
  ctx.fillStyle = "red";
  ctx.fillText(`Confirmed Oysters: ${confirmedOysterCount}`, 20, 20);

  ctx.font = "22px Arial";
  ctx.fillStyle = "red";
  ctx.fillText(`Current Detections: ${currentDetectionCount}`, 20, 55);
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

  get = (i) => this.palette[Math.floor(i) % this.n];

  static hexToRgba = (hex, alpha) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

    return result
      ? `rgba(${[
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16),
        ].join(", ")}, ${alpha})`
      : null;
  };
}