import os
import subprocess
import shutil
import re
import sys

# Configuration
# Assuming this file is in server/ directory, so .. goes to Apollo root, then video_detector
VIDEO_DETECTOR_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "video_detector"))
USER_DATA_DIR = os.path.join(VIDEO_DETECTOR_DIR, "user_data")

def convert_to_mp4(input_path, output_path):
    """Converts a video file to MP4 using ffmpeg."""
    try:
        # ffmpeg -i input -c:v libx264 -c:a aac -strict experimental output.mp4
        command = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-c:v", "libx264",
            "-c:a", "aac",
            "-strict", "experimental",
            output_path
        ]
        # Run ffmpeg
        subprocess.check_output(command, stderr=subprocess.STDOUT)
        return True
    except subprocess.CalledProcessError as e:
        print(f"FFmpeg conversion failed: {e.output.decode() if e.output else 'No output'}")
        return False
    except FileNotFoundError:
        print("FFmpeg not found in system path.")
        return False

def parse_detector_output(output):
    """Parses the stdout from the video detector script."""
    verdict = "Unknown"
    confidence = "0.0%"
    reasoning = []
    
    # Remove ANSI color codes
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    clean_output = ansi_escape.sub('', output)
    
    lines = clean_output.split('\n')
    capture_reasoning = False
    
    for line in lines:
        line = line.strip()
        if line.startswith("VERDICT:"):
            verdict = line.split("VERDICT:")[1].strip()
        elif line.startswith("Confidence:"):
            confidence = line.split("Confidence:")[1].strip()
        elif line.startswith("Reasoning:"):
            capture_reasoning = True
        elif capture_reasoning:
            if line.startswith("-"):
                reasoning.append(line.lstrip("- ").strip())
            elif "=====" in line:
                capture_reasoning = False
            
    return verdict, confidence, reasoning

def process_video(file_path):
    """
    Processes the video:
    1. Clears user_data in video_detector.
    2. Converts/Moves video to user_data/input.mp4.
    3. Runs video_detector/main.py.
    4. Returns parsed result.
    """
    
    if not os.path.exists(VIDEO_DETECTOR_DIR):
        return {"error": f"Video detector directory not found at {VIDEO_DETECTOR_DIR}"}

    # Ensure user_data exists
    if not os.path.exists(USER_DATA_DIR):
        os.makedirs(USER_DATA_DIR)
        
    # Clear existing files in user_data
    for f in os.listdir(USER_DATA_DIR):
        try:
            os.remove(os.path.join(USER_DATA_DIR, f))
        except Exception as e:
            print(f"Failed to remove {f}: {e}")
        
    # Target path in user_data
    target_filename = "input.mp4"
    target_path = os.path.join(USER_DATA_DIR, target_filename)
    
    print(f"Processing video: {file_path} -> {target_path}")
    
    # Convert to mp4
    if not convert_to_mp4(file_path, target_path):
        print("Conversion failed, attempting direct copy if format allows...")
        # If conversion fails, try copying if it's already an mp4 or compatible
        if file_path.lower().endswith('.mp4'):
             shutil.copy(file_path, target_path)
        else:
             return {"error": "Video conversion failed and file is not MP4"}
        
    # Run the detector
    try:
        cmd = ["python", "main.py"]
        
        print(f"Running detector in {VIDEO_DETECTOR_DIR}")
        # We use shell=True if on Windows sometimes for python, but list args is safer.
        # However, the detector script uses os.system('cls') which might clutter output but shouldn't break it.
        
        result = subprocess.run(
            cmd,
            cwd=VIDEO_DETECTOR_DIR,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        
        if result.returncode != 0:
            print(f"Detector failed with code {result.returncode}")
            print("Stderr:", result.stderr)
            # Even if it fails, it might have printed the verdict before crashing? Unlikely.
            return {"error": "Detector script failed", "details": result.stderr}
            
        # Parse output
        verdict, confidence, reasoning = parse_detector_output(result.stdout)
        
        return {
            "verdict": verdict,
            "confidence": confidence,
            "reasoning": reasoning,
            "raw_output": result.stdout
        }
        
    except Exception as e:
        print(f"Error running detector: {e}")
        return {"error": str(e)}
