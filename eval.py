import os
import argparse
import torch
import numpy as np
from tqdm import tqdm
from data import D3_dataset_AP
from models import D3_model

# --- D3 CONFIG ---
THRESHOLD = 3.6
LOWER_SCORE_IS_REAL = False # High Score = Real (4.0+), Low Score = Fake (<3.6)
# -----------------

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--gpu-id', type=str, default="0")
    parser.add_argument('--loss', type=str, default='l2')
    parser.add_argument('--encoder', type=str, default='XCLIP-16')
    parser.add_argument('--real-csv', type=str, default=None)
    parser.add_argument('--fake-csv', type=str, default=None)
    args = parser.parse_args()

    # Silent Load
    model = D3_model(encoder_type=args.encoder, loss_type=args.loss).cuda()
    model.eval()
    
    eval_dataset = D3_dataset_AP(real_csv=None, fake_csv=args.fake_csv, max_len=1) 
    eval_loader = torch.utils.data.DataLoader(eval_dataset, batch_size=1, shuffle=False)
    
    score = 0.0
    with torch.no_grad():
        for batch_frames, _, _ in eval_loader: 
            batch_inputs = batch_frames.cuda()
            _, _, batch_dis_std = model(batch_inputs)
            score = batch_dis_std.item()
            break # Single video
            
    # Logic Decision
    if LOWER_SCORE_IS_REAL:
        is_fake = score > THRESHOLD
    else:
        is_fake = score < THRESHOLD

    # Write Result for Main Pipeline
    with open("d3_verdict.txt", "w") as f:
        f.write("FAKE" if is_fake else "REAL")
        f.write(f"\n{score}")