import cv2
from ultralytics import YOLO
from ultralytics.utils.plotting import Annotator

vidNum = 1
capture = cv2.VideoCapture("oyster_videos/oyster_video_" + str(vidNum) + ".mp4")
isFrame, frame = capture.read()

# model path will need to be changed
model = YOLO("/home/reuekennedy/Oyster-Video-Monitoring-System-2026/YOLO_testing/2026_model/runs/detect/models/yolov8m_v3_2026/weights/best.pt")

while isFrame:

    results = model.predict(frame, verbose=False)

    for result in results:
        annotator = Annotator(frame)

        boxes = result.boxes
        count = len(boxes)

        print(f"Oysters detected: {count}")  # Optional: prints to terminal

        for box in boxes:
            coords = box.xyxy[0]
            cls = box.cls
            annotator.box_label(coords, model.names[int(cls)])

        # Get the annotated frame
        annotated = annotator.result()

        # Add oyster count text
        cv2.putText(
            annotated,
            f"Oysters: {count}",
            (50, 80),
            cv2.FONT_HERSHEY_SIMPLEX,
            2,
            (0, 0, 255),   # Bright red (BGR)
            5
        )

    cv2.imshow("YOLO V8 Detection", annotated)
    key = cv2.waitKey(0)

    if key == ord('n'):
        vidNum += 1
        if vidNum > 18:
            vidNum = 1
        capture = cv2.VideoCapture("oyster_videos/oyster_video_" + str(vidNum) + ".mp4")
    elif key == ord('p'):
        vidNum -= 1
        if vidNum < 1:
            vidNum = 18
        capture = cv2.VideoCapture("oyster_videos/oyster_video_" + str(vidNum) + ".mp4")
    elif key == 27:
        break

    isFrame, frame = capture.read()

capture.release()
cv2.destroyAllWindows()