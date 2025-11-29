import os
import pandas as pd
from pandas import Series
import argparse

def str2bool(v):
    return v.lower() in ('true', '1', 'yes') if isinstance(v, str) else v

def scan_and_generate_csv(is_real, dataset_path, folder_paths):
    frames_root = os.path.join(dataset_path, 'frames')
    csv_root = os.path.join(dataset_path, 'csv')
    os.makedirs(csv_root, exist_ok=True)

    for folder in folder_paths:
        search_root = os.path.join(frames_root, folder)
        csv_path = os.path.join(csv_root, folder + '.csv')
        
        data_entries = {
            'content_path': [], 'image_path': [], 'type_id': [],
            'label': [], 'frame_len': [], 'frame_seq': []
        }

        if not os.path.exists(search_root):
            # Create empty CSV to prevent crashes
            pd.DataFrame(data_entries).to_csv(csv_path, index=False)
            continue

        for root, dirs, files in os.walk(search_root):
            images = [f for f in files if f.lower().endswith(('.jpg', '.png'))]
            
            if images:
                abs_path = os.path.abspath(root)
                count = len(images)
                
                data_entries['content_path'].append(abs_path)
                data_entries['image_path'].append(abs_path)
                data_entries['type_id'].append('Real' if is_real else 'Fake')
                data_entries['label'].append('0' if is_real else '1')
                data_entries['frame_len'].append(count)
                data_entries['frame_seq'].append([]) # Placeholder

        df = pd.DataFrame(data_entries)
        df.to_csv(csv_path, index=False)
        print(f"   [Data] CSV Generated: {len(df)} entries.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--is-real', type=str2bool, required=True)
    parser.add_argument('--dataset-path', type=str, default='GenVideo')
    parser.add_argument('--folders', nargs='+')
    args = parser.parse_args()
    scan_and_generate_csv(args.is_real, args.dataset_path, args.folders)