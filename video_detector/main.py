import os
import shutil
import subprocess
import glob
import sys
import time

# Custom Modules
from utils.agent import classify_video_content
from utils.forensics import analyze_artifacts

# --- CONFIG ---
INPUT_DIR = "user_data" 
WORKSPACE_DIR = "pipeline_workspace" 
EXTENSIONS = ('.mp4', '.avi', '.mov', '.mkv', '.webm')

# --- COLORS ---
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"

def log(msg, color=RESET):
    print(f"{color}{msg}{RESET}")

def setup():
    if os.path.exists(WORKSPACE_DIR):
        try: shutil.rmtree(WORKSPACE_DIR)
        except: pass
    if os.path.exists("d3_verdict.txt"): os.remove("d3_verdict.txt")
    
    video_dest = os.path.join(WORKSPACE_DIR, "video", "test_subset")
    os.makedirs(video_dest, exist_ok=True)
    return video_dest

def get_video():
    if not os.path.exists(INPUT_DIR): os.makedirs(INPUT_DIR); sys.exit(0)
    files = os.listdir(INPUT_DIR)
    vids = [f for f in files if f.lower().endswith(EXTENSIONS)]
    if not vids: log(f"No video found in {INPUT_DIR}", RED); sys.exit(1)
    return os.path.join(INPUT_DIR, vids[0])

def run_cmd(cmd):
    subprocess.check_call(cmd, shell=True)

def main():
    os.system('cls' if os.name == 'nt' else 'clear')
    log("===================================================", CYAN)
    log("        VERITAS AI: DEEPFAKE DETECTION ENGINE      ", CYAN)
    log("===================================================", CYAN)

    # 1. Init
    video_dest_dir = setup()
    video_src = get_video()
    video_name = os.path.basename(video_src)
    log(f"[*] Analyzing Target: {video_name}")
    shutil.copy2(video_src, os.path.join(video_dest_dir, video_name))

    # 2. Agent Analysis
    log(f"\n[*] Step 1: Content Classification (Agent)", YELLOW)
    category = classify_video_content(video_src)
    
    # Strategy Logic
    D3_THRESH = 3.6
    if category == "montage":
        log(f"    -> Type: MONTAGE (Rapid Cuts)", RED)
        log(f"    -> Strategy: Pure Forensic Analysis (Higgsfield Detection)")
        D3_THRESH = 0.0 # Disabled
    elif category == "face":
        log(f"    -> Type: TALKING HEAD", CYAN)
        log(f"    -> Strategy: Strict Texture + High Motion Standard")
        D3_THRESH = 3.9 # Strict
    elif category == "high_action":
        log(f"    -> Type: HIGH ACTION", CYAN)
        D3_THRESH = 3.6
    else:
        log(f"    -> Type: GENERAL SCENE", CYAN)
        D3_THRESH = 3.6

    # 3. Processing
    log(f"\n[*] Step 2: Extracting Data", YELLOW)
    run_cmd(f'python utils/video_proc.py --dataset-path "{WORKSPACE_DIR}"')
    run_cmd(f'python utils/data_gen.py --dataset-path "{WORKSPACE_DIR}" --folders test_subset --is-real False')

    # 4. Motion Engine (D3)
    raw_d3 = 0.0
    if category != "montage":
        log(f"\n[*] Step 3: Running Motion Engine (D3)", YELLOW)
        csv = os.path.join(WORKSPACE_DIR, "csv", "test_subset.csv")
        run_cmd(f'python eval.py --gpu-id 0 --encoder XCLIP-16 --loss l2 --real-csv "{csv}" --fake-csv "{csv}" > nul 2>&1')
        
        if os.path.exists("d3_verdict.txt"):
            with open("d3_verdict.txt") as f:
                lines = f.readlines()
                if len(lines) > 1: raw_d3 = float(lines[1].strip())
        
        status = GREEN + "PASS" if raw_d3 > D3_THRESH else RED + "FAIL"
        print(f"    -> Motion Score: {raw_d3:.4f} (Threshold: {D3_THRESH}) [{status}{RESET}]")

    # 5. Forensic Engine (Artifacts)
    log(f"\n[*] Step 4: Running Forensic Engine (Noise Consistency)", YELLOW)
    frames_dir = os.path.join(WORKSPACE_DIR, "frames", "test_subset", os.path.splitext(video_name)[0])
    if not os.path.exists(frames_dir):
        possible = glob(os.path.join(WORKSPACE_DIR, "frames", "test_subset", "*"))
        if possible: frames_dir = possible[0]
        
    artifact_prob = analyze_artifacts(frames_dir, content_type=category)
    a_status = GREEN + "CLEAN" if artifact_prob < 0.6 else RED + "ANOMALY"
    print(f"    -> Noise Anomaly Probability: {artifact_prob:.4f} [{a_status}{RESET}]")

    # 6. Final Verdict
    log("\n===================================================", CYAN)
    log("                  FINAL VERDICT                    ", CYAN)
    log("===================================================", CYAN)
    
    # Scoring
    fake_points = 0
    if category != "montage":
        if raw_d3 < D3_THRESH:
            gap = D3_THRESH - raw_d3
            fake_points += 40 + (gap * 25)
        else:
            fake_points -= 20 # Credit for good motion

    if artifact_prob > 0.6:
        fake_points += 50
    else:
        fake_points -= 10
        
    fake_points = max(0, min(100, fake_points))
    
    if fake_points >= 50:
        log(f"VERDICT: AI-GENERATED (FAKE)", RED)
        log(f"Confidence: {fake_points:.1f}%")
        print("\nReasoning:")
        if category == "montage": print(f" - Rapid cuts detected (Montage).")
        if artifact_prob > 0.6: print(f" - Inconsistent noise patterns detected (Diffusion Artifacts).")
        if category != "montage" and raw_d3 < D3_THRESH: print(f" - Motion physics failed semantic check.")
    else:
        log(f"VERDICT: REAL VIDEO", GREEN)
        log(f"Confidence: {100-fake_points:.1f}%")
        print("\nReasoning:")
        print(" - Motion physics align with real camera footage.")
        print(" - Sensor noise is consistent across the frame.")

    log("===================================================", CYAN)

if __name__ == "__main__":
    main()