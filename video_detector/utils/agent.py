import cv2
import numpy as np
import os

def check_montage_cuts(cap):
    """Detects rapid scene cuts using MSE."""
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if frame_count < 5: return False
    
    cuts = 0
    prev_gray = None
    
    # Check every 4th frame
    for i in range(0, frame_count, 4):
        cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ret, frame = cap.read()
        if not ret: break
        
        gray = cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (64, 64))
        
        if prev_gray is not None:
            err = np.sum((gray.astype("float") - prev_gray.astype("float")) ** 2)
            err /= float(gray.shape[0] * gray.shape[1])
            if err > 2200: cuts += 1 # Threshold for scene change
        prev_gray = gray
        
    return cuts >= 1

def classify_video_content(video_path):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened(): return "static_scene"

    # 1. Montage Check
    if check_montage_cuts(cap):
        cap.release()
        return "montage"

    # 2. Face Check (Aggressive)
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames <= 0: total_frames = 30
    
    face_hits = 0
    # Scan 15 equidistant frames
    indices = [int(i * total_frames / 15) for i in range(15)]
    
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if not ret: continue
        
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        # Low neighbors = high sensitivity
        faces = face_cascade.detectMultiScale(gray, 1.05, 3)
        
        if len(faces) > 0:
            for (x, y, w, h) in faces:
                # Face must be > 1% of frame
                if (w*h) > (frame.shape[0]*frame.shape[1]) * 0.01:
                    face_hits += 1
                    break

    # 3. Motion/Physics Check (if not a face)
    motion_score = 0.0
    if face_hits < 3:
        # Check optical flow on middle frames
        cap.set(cv2.CAP_PROP_POS_FRAMES, total_frames // 2)
        ret1, f1 = cap.read()
        ret2, f2 = cap.read()
        if ret1 and ret2:
            g1 = cv2.cvtColor(f1, cv2.COLOR_BGR2GRAY)
            g2 = cv2.cvtColor(f2, cv2.COLOR_BGR2GRAY)
            flow = cv2.calcOpticalFlowFarneback(g1, g2, None, 0.5, 3, 15, 3, 5, 1.2, 0)
            mag, _ = cv2.cartToPolar(flow[..., 0], flow[..., 1])
            motion_score = np.mean(mag)

    cap.release()

    if face_hits >= 3: return "face"
    if motion_score > 4.0: return "high_action"
    return "static_scene"