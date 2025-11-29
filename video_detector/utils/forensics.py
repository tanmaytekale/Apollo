import cv2
import numpy as np
import os
from glob import glob

def calculate_noise_consistency(img):
    """Calculates variation in noise levels across the image blocks."""
    if img is None: return 0.0
    h, w = img.shape
    if h < 200: return 0.0

    # High pass filter
    blurred = cv2.GaussianBlur(img, (5, 5), 0)
    noise = cv2.absdiff(img, blurred)
    
    block_size = 32
    variances = []
    
    for y in range(0, h - block_size, block_size):
        for x in range(0, w - block_size, block_size):
            chunk = img[y:y+block_size, x:x+block_size]
            chunk_noise = noise[y:y+block_size, x:x+block_size]
            
            # Safeguard: Ignore dark/blown-out areas
            mean_val = np.mean(chunk)
            if mean_val < 20 or mean_val > 235: continue

            # Safeguard: Ignore Edges (using Canny)
            edges = cv2.Canny(chunk, 100, 200)
            if np.sum(edges) > 0: continue
            
            v = np.var(chunk_noise)
            if v > 0: variances.append(v)
    
    if len(variances) < 5: return 0.0
    
    # Use IQR for robustness
    q75, q25 = np.percentile(variances, [75, 25])
    iqr = q75 - q25
    median = np.median(variances)
    
    if median == 0: return 0.0
    return iqr / (median + 1e-5)

def analyze_artifacts(frames_folder, content_type="static_scene"):
    frame_paths = sorted(glob(os.path.join(frames_folder, "*.jpg")))
    if not frame_paths: return 0.5

    scores = []
    for path in frame_paths:
        img = cv2.imread(path, 0)
        scores.append(calculate_noise_consistency(img))

    score = np.median(scores)

    # --- CALIBRATED PROBABILITIES ---
    # Real < 1.0 | Fake > 1.4
    
    fake_prob = 0.0
    
    if content_type == "montage":
        if score > 1.8: fake_prob = 0.95
        elif score > 1.4: fake_prob = 0.75
        else: fake_prob = 0.1
        
    elif content_type == "face":
        # Faces usually clean. High inconsistency = bad AI generation
        if score > 1.5: fake_prob = 0.85
        else: fake_prob = 0.15
        
    else:
        # General
        if score > 1.6: fake_prob = 0.8
        else: fake_prob = 0.1

    return fake_prob