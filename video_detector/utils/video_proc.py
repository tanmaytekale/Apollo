import os
import cv2
import numpy as np
import argparse
import shutil
from glob import glob

def extract_frames_deterministic(video_path, dataset_path):
    video_name = os.path.splitext(os.path.basename(video_path))[0]
    
    # Robust path calculation
    video_dir = os.path.dirname(video_path)
    try:
        relative_video_dir = os.path.relpath(video_dir, os.path.join(dataset_path, 'video'))
    except ValueError:
        relative_video_dir = "test_subset"

    output_dir = os.path.join(dataset_path, 'frames', relative_video_dir, video_name)
    
    # Clean refresh
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"   [Proc] Extracting: {video_name}", end='\r')
    
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened(): return

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0: return

        # Extract exactly 16 frames uniformly distributed
        num_frames_target = 16
        if total_frames > num_frames_target:
            frame_indices = np.linspace(0, total_frames - 1, num_frames_target, dtype=int)
        else:
            frame_indices = np.arange(total_frames)

        saved_count = 0
        for i, idx in enumerate(frame_indices):
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if ret:
                cv2.imwrite(os.path.join(output_dir, f"{saved_count:04d}.jpg"), frame)
                saved_count += 1
        
        cap.release()
        print(f"   [Proc] Extracted {saved_count} frames from {video_name}")
        
    except Exception as e:
        print(f"\n   [Error] Frame extraction failed: {e}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset-path', type=str, default='datasets')
    args = parser.parse_args()
    
    # Find videos recursively
    search_path = os.path.join(args.dataset_path, 'video', '**', '*')
    videos = glob(search_path, recursive=True)
    videos = [v for v in videos if v.lower().endswith(('.mp4', '.avi', '.mov', '.mkv'))]
    
    for vid in videos:
        extract_frames_deterministic(vid, args.dataset_path)