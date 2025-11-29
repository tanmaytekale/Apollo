import os
import re
import pandas as pd
import albumentations
import cv2
import torch
import numpy as np
from torch.utils.data import Dataset

def get_number_from_filename(filename):
    match = re.match(r'(\d+)', filename)  
    if match: return int(match.group(1))  
    return float('inf')  

def read_video(folder_path, trans):
    if not os.path.exists(folder_path):
        raise FileNotFoundError(f"Frame folder not found: {folder_path}")

    frames = []
    image_paths = sorted(os.listdir(folder_path), key=get_number_from_filename)
    image_paths = [img for img in image_paths if img.lower().endswith(('.png', '.jpg', '.jpeg'))]
    total_frames = len(image_paths)

    if total_frames == 0: 
        # Fallback for empty folders
        raise ValueError(f"No frames found in {folder_path}")

    # Deterministic padding/cutting to 16 frames
    max_frame = min(16, total_frames)
    
    for i in range(max_frame):
        image_path = os.path.join(folder_path, image_paths[i])
        image = cv2.imread(image_path)
        if image is None: continue
            
        # NOTE: No Center Crop applied (Preserves Scene Context)
        augmented = trans(image=image)
        image = augmented["image"]
        frames.append(image.transpose(2, 0, 1)[np.newaxis, :])

    if not frames:
        raise ValueError(f"Could not process frames in {folder_path}")

    frames = np.concatenate(frames, 0)
    frames = torch.tensor(frames[np.newaxis, :]).squeeze(0)
    return frames

def set_preprocessing(aug_type, aug_quality):
    aug_list = []
    aug_list.append(albumentations.Resize(224, 224))
    aug_list.append(albumentations.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225), max_pixel_value=255.0, p=1.0))
    return albumentations.Compose(aug_list)

class D3_dataset_AP(Dataset):
    def __init__(self, real_csv, fake_csv, max_len=9999999, aug_type=None, aug_quality=None):
        super(D3_dataset_AP, self).__init__()
        
        if real_csv is not None:
            df_real = pd.read_csv(real_csv).head(max_len)
        else:
            df_real = pd.DataFrame({'content_path': [], 'label': []})
            
        df_fake = pd.read_csv(fake_csv).head(max_len)
        
        common_cols = list(set(df_real.columns) & set(df_fake.columns))
        if not common_cols:
             self.df = df_fake
        else:
             self.df = pd.concat([df_real[common_cols], df_fake[common_cols]], axis=0, ignore_index=True)
             
        self.trans = set_preprocessing(aug_type, aug_quality)

    def __len__(self):
        return len(self.df)

    def __getitem__(self, index):
        label = self.df.loc[index]['label']
        frame_path = self.df.loc[index]['content_path']
        frames = read_video(frame_path, trans=self.trans)
        # Returns 3 values: Frames, Label, Path
        return frames, label, frame_path