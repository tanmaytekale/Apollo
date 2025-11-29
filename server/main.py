from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
import uvicorn
import requests
import shutil
import os
import json
import uuid
from PIL import Image
import pillow_heif
import torch
import torch.nn as nn
from transformers import AutoTokenizer, AutoConfig, AutoModel, PreTrainedModel
from video_detection_service import process_video

app = FastAPI()

# --- Sightengine Credentials ---
API_USER = '916194335'
API_SECRET = 'odBHoKHJpnQ3496AoFLYc3w9NizcQFBx'

# --- Custom Text Model Definition ---
class DesklibAIDetectionModel(PreTrainedModel):
    config_class = AutoConfig
    def __init__(self, config):
        super().__init__(config)
        # Initialize the base transformer model.
        self.model = AutoModel.from_config(config)
        # Define a classifier head.
        self.classifier = nn.Linear(config.hidden_size, 1)
        # Initialize weights (handled by PreTrainedModel)
        self.init_weights()
        
    def forward(self, input_ids, attention_mask=None, labels=None):
        # Forward pass through the transformer
        outputs = self.model(input_ids, attention_mask=attention_mask)
        last_hidden_state = outputs[0]
        # Mean pooling
        input_mask_expanded = attention_mask.unsqueeze(-1).expand(last_hidden_state.size()).float()
        sum_embeddings = torch.sum(last_hidden_state * input_mask_expanded, dim=1)
        sum_mask = torch.clamp(input_mask_expanded.sum(dim=1), min=1e-9)
        pooled_output = sum_embeddings / sum_mask
        # Classifier
        logits = self.classifier(pooled_output)
        loss = None
        if labels is not None:
            loss_fct = nn.BCEWithLogitsLoss()
            loss = loss_fct(logits.view(-1), labels.float())
        output = {"logits": logits}
        if loss is not None:
            output["loss"] = loss
        return output

def predict_single_text(text, model, tokenizer, device, max_len=768, threshold=0.5):
    encoded = tokenizer(
        text,
        padding='max_length',
        truncation=True,
        max_length=max_len,
        return_tensors='pt'
    )
    input_ids = encoded['input_ids'].to(device)
    attention_mask = encoded['attention_mask'].to(device)
    model.eval()
    with torch.no_grad():
        outputs = model(input_ids=input_ids, attention_mask=attention_mask)
        logits = outputs["logits"]
        probability = torch.sigmoid(logits).item()
    label = 1 if probability >= threshold else 0
    return probability, label

# --- Initialize Text Model ---
print("Loading Text Detection Model...")
try:
    model_directory = "desklib/ai-text-detector-v1.01"
    tokenizer = AutoTokenizer.from_pretrained(model_directory)
    text_model = DesklibAIDetectionModel.from_pretrained(model_directory)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    text_model.to(device)
    print(f"Text Detection Model loaded on {device}")
except Exception as e:
    print(f"Error loading text model: {e}")
    text_model = None
    tokenizer = None
    device = None

class TextRequest(BaseModel):
    text: str

@app.get("/")
def read_root():
    return {"status": "Server is running"}

@app.post("/detect")
async def detect_text(request: TextRequest):
    if not text_model or not tokenizer:
        raise HTTPException(status_code=500, detail="Text detection model not loaded")
    
    try:
        probability, label = predict_single_text(request.text, text_model, tokenizer, device)
        
        result_label = "AI Generated" if label == 1 else "Not AI Generated"
        # Return format compatible with app
        # result: [Label, Detailed Text]
        return {"result": [result_label, f"{probability:.2%} Probability of AI"]}
        
    except Exception as e:
        print(f"Error during text detection: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect-image")
async def detect_image(file: UploadFile = File(...)):
    # Register HEIC opener
    pillow_heif.register_heif_opener()
    
    file_extension = os.path.splitext(file.filename)[1] or ".jpg"
    temp_filename = f"temp_{uuid.uuid4()}{file_extension}"
    jpg_filename = f"{temp_filename}.jpg"
    
    try:
        # Read file content
        content = await file.read()
        
        # Save uploaded file temporarily
        with open(temp_filename, "wb") as buffer:
            buffer.write(content)
            
        file_size = len(content)
        print(f"Received file size: {file_size} bytes")
        
        if file_size == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        # Convert to JPEG using Pillow (supports HEIC via pillow-heif)
        try:
            with Image.open(temp_filename) as img:
                # Convert to RGB to ensure compatibility (JPEG doesn't support RGBA)
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                # Save as JPEG with optimization
                img.save(jpg_filename, format="JPEG", quality=85, optimize=True)
            
            new_size = os.path.getsize(jpg_filename)
            print(f"Converted image to JPEG: {jpg_filename} (Size: {new_size} bytes)")
        except Exception as e:
            print(f"Error converting image: {e}")
            print(f"First 20 bytes: {content[:20]}")
            raise HTTPException(status_code=400, detail=f"Invalid image format: {e}")

        # Call Sightengine API using the JPEG file
        params = {
            'models': 'genai',
            'api_user': API_USER,
            'api_secret': API_SECRET
        }
        
        # Explicitly provide filename and content_type
        files = {
            'media': ('image.jpg', open(jpg_filename, 'rb'), 'image/jpeg')
        }
        
        print(f"Sending file to Sightengine: {jpg_filename}")
        response = requests.post('https://api.sightengine.com/1.0/check.json', files=files, data=params)
        data = response.json()
        
        # Parse result
        # Sightengine returns: { "type": { "ai_generated": 0.02 }, ... }
        if 'type' in data and 'ai_generated' in data['type']:
             ai_score = data['type']['ai_generated']
             
             if ai_score > 0.5:
                 label = "AI Generated"
                 confidence = ai_score
             else:
                 label = "Real Image"
                 confidence = 1.0 - ai_score
             
             # Format result to match what the app expects
             result = [label, f"{confidence:.1%} Confidence"]
             return {"result": result}
        elif 'type' in data and 'classes' in data['type']:
             # Fallback for other models if structure differs
             classes = data['type']['classes']
             generated_score = classes.get('generated', 0)
             
             if generated_score > 0.5:
                 label = "AI Generated"
                 confidence = generated_score
             else:
                 label = "Real Image"
                 confidence = 1.0 - generated_score
                 
             result = [label, f"{confidence:.1%} Confidence"]
             return {"result": result}
        else:
             # Fallback or error from API
             return {"result": ["Unknown", f"API Response: {json.dumps(data)}"]}
        
    except Exception as e:
        print(f"Error during detection: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temp files
        if os.path.exists(temp_filename):
            try:
                os.remove(temp_filename)
            except: pass
        if os.path.exists(jpg_filename):
            try:
                os.remove(jpg_filename)
            except: pass

@app.post("/detect-video")
async def detect_video(file: UploadFile = File(...)):
    # Use a unique filename
    file_extension = os.path.splitext(file.filename)[1] or ".mp4"
    temp_filename = f"temp_{uuid.uuid4()}{file_extension}"
    
    try:
        # Read file content
        content = await file.read()
        
        # Save uploaded file temporarily
        with open(temp_filename, "wb") as buffer:
            buffer.write(content)
            
        file_size = len(content)
        print(f"Received video size: {file_size} bytes")
        
        if file_size == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        # Process the video using the detection service
        print(f"Processing video: {temp_filename}")
        detection_result = process_video(temp_filename)
        
        if "error" in detection_result:
             print(f"Detection failed: {detection_result['error']}")
             raise HTTPException(status_code=500, detail=detection_result["error"])
             
        verdict = detection_result.get("verdict", "Unknown")
        confidence = detection_result.get("confidence", "0%")
        reasoning = detection_result.get("reasoning", [])
        
        # Map verdict to label
        # Detector returns "AI-GENERATED (FAKE)" or "REAL VIDEO"
        if "FAKE" in verdict:
            label = "AI Generated"
        else:
            label = "Real Video"
            
        result = [label, confidence]
        
        return {
            "result": result,
            "reasoning": reasoning
        }
        
    except Exception as e:
        print(f"Error during video detection: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temp files
        if os.path.exists(temp_filename):
            try:
                os.remove(temp_filename)
            except: pass

if __name__ == "__main__":
    try:
        from pyngrok import ngrok
        # Open a ngrok tunnel to the dev server
        public_url = ngrok.connect(8000).public_url
        print(f"Public URL: {public_url}")
    except ImportError:
        print("pyngrok not installed. Install it with `pip install pyngrok` to see a public URL.")
    except Exception as e:
        print(f"Error starting ngrok: {e}")
        if "authentication failed" in str(e) or "ERR_NGROK_4018" in str(e):
            print("\n\n!!! NGROK AUTHENTICATION REQUIRED !!!")
            print("1. Sign up at https://dashboard.ngrok.com/signup")
            print("2. Get your authtoken at https://dashboard.ngrok.com/get-started/your-authtoken")
            print("3. Run this command in a new terminal:")
            print("   python -c \"import pyngrok.ngrok; pyngrok.ngrok.set_auth_token('YOUR_TOKEN_HERE')\"")
            print("   (Replace YOUR_TOKEN_HERE with your actual token)\n")

    uvicorn.run(app, host="0.0.0.0", port=8000)
