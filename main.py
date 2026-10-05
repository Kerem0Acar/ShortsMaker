import os
import sys
import json
import time
import uuid
import shutil
import asyncio
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Request
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
DOWNLOADS_DIR = BASE_DIR / "downloads"
UPLOADS_DIR = BASE_DIR / "uploads"
EXPORTS_DIR = BASE_DIR / "exports"
STATIC_DIR = BASE_DIR / "static"

for folder in [DOWNLOADS_DIR, UPLOADS_DIR, EXPORTS_DIR, STATIC_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="ShortsMaker Pro", description="YouTube & Local Video to Vertical Shorts/Reels/TikTok Converter")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active jobs tracking (for download & export progress)
active_jobs: Dict[str, Dict[str, Any]] = {}

class YouTubeInfoRequest(BaseModel):
    url: str

class YouTubeDownloadRequest(BaseModel):
    url: str
    quality: Optional[str] = "best"
    start_time: Optional[float] = None
    end_time: Optional[float] = None

class FaceDetectRequest(BaseModel):
    video_path: str
    timestamp: Optional[float] = 1.0

class ExportRequest(BaseModel):
    video_path: str
    start_time: float
    end_time: float
    face_box: Dict[str, float]  # {x, y, width, height} in pixels or normalized
    game_box: Dict[str, float]  # {x, y, width, height}
    split_ratio: float = 0.45   # ratio of top facecam height (e.g. 0.45 = 45% face, 55% game)
    output_width: int = 1080
    output_height: int = 1920
    fps: int = 60
    divider_thickness: int = 4
    divider_color: str = "#06b6d4"  # neon cyan, or 'none'
    use_gpu: bool = True
    output_title: Optional[str] = "short"

def get_video_metadata(filepath: str) -> Dict[str, Any]:
    """Uses ffprobe to extract video width, height, duration, fps, and codecs."""
    try:
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            filepath
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        data = json.loads(res.stdout)
        
        video_stream = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), None)
        audio_stream = next((s for s in data.get("streams", []) if s.get("codec_type") == "audio"), None)
        
        if not video_stream:
            raise ValueError("No video stream found in file.")
        
        # Calculate fps
        fps_str = video_stream.get("r_frame_rate", "30/1")
        if "/" in fps_str:
            num, den = fps_str.split("/")
            fps = round(float(num) / float(den)) if float(den) != 0 else 30
        else:
            fps = int(float(fps_str))
            
        duration = float(data.get("format", {}).get("duration", 0))
        if duration == 0 and "duration" in video_stream:
            duration = float(video_stream["duration"])
            
        return {
            "width": int(video_stream.get("width", 1920)),
            "height": int(video_stream.get("height", 1080)),
            "duration": duration,
            "fps": fps,
            "codec_video": video_stream.get("codec_name", "unknown"),
            "codec_audio": audio_stream.get("codec_name", "unknown") if audio_stream else "none",
            "size_bytes": int(data.get("format", {}).get("size", 0)),
        }
    except Exception as e:
        return {"error": str(e), "width": 1920, "height": 1080, "duration": 0, "fps": 30}


@app.post("/api/youtube/info")
async def get_youtube_info(req: YouTubeInfoRequest):
    """Fetches video information and thumbnails without downloading."""
    try:
        import yt_dlp
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(req.url, download=False)
            
        return {
            "id": info.get("id"),
            "title": info.get("title"),
            "duration": info.get("duration", 0),
            "thumbnail": info.get("thumbnail"),
            "uploader": info.get("uploader"),
            "view_count": info.get("view_count"),
            "is_live": info.get("is_live", False),
            "formats": [
                {
                    "format_id": f.get("format_id"),
                    "resolution": f.get("resolution"),
                    "ext": f.get("ext"),
                    "filesize_approx": f.get("filesize_approx")
                }
                for f in info.get("formats", []) if f.get("vcodec") != "none"
            ][-5:]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"YouTube bilgisi alınamadı: {str(e)}")


def run_yt_download(job_id: str, url: str, start_time: Optional[float], end_time: Optional[float]):
    """Background task to download video or clip using yt-dlp."""
    try:
        import yt_dlp
        active_jobs[job_id]["status"] = "downloading"
        active_jobs[job_id]["progress"] = 0

        output_filename = f"yt_{int(time.time())}_{uuid.uuid4().hex[:6]}.mp4"
        output_path = str(DOWNLOADS_DIR / output_filename)

        def progress_hook(d):
            if d['status'] == 'downloading':
                total_bytes = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
                downloaded_bytes = d.get('downloaded_bytes', 0)
                if total_bytes > 0:
                    pct = round((downloaded_bytes / total_bytes) * 100, 1)
                    active_jobs[job_id]["progress"] = pct
                speed = d.get('speed')
                if speed:
                    active_jobs[job_id]["speed"] = f"{round(speed / (1024*1024), 2)} MB/s"
                eta = d.get('eta')
                if eta:
                    active_jobs[job_id]["eta"] = f"{eta}s"
            elif d['status'] == 'finished':
                active_jobs[job_id]["progress"] = 99

        ydl_opts = {
            'format': 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': output_path,
            'progress_hooks': [progress_hook],
            'quiet': True,
            'no_warnings': True,
            'merge_output_format': 'mp4'
        }

        # If user specified start/end times directly for download to save bandwidth
        if start_time is not None and end_time is not None and end_time > start_time:
            ydl_opts['download_ranges'] = yt_dlp.utils.download_range_func(
                None, [(start_time, end_time)]
            )
            ydl_opts['force_keyframes_at_cuts'] = True

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        meta = get_video_metadata(output_path)
        active_jobs[job_id]["status"] = "completed"
        active_jobs[job_id]["progress"] = 100
        active_jobs[job_id]["file_path"] = output_path
        active_jobs[job_id]["file_name"] = output_filename
        active_jobs[job_id]["metadata"] = meta

    except Exception as e:
        active_jobs[job_id]["status"] = "error"
        active_jobs[job_id]["error"] = str(e)


@app.post("/api/youtube/download")
async def start_youtube_download(req: YouTubeDownloadRequest, bg_tasks: BackgroundTasks):
    """Starts downloading the YouTube video in background and returns job ID."""
    job_id = str(uuid.uuid4())
    active_jobs[job_id] = {
        "type": "download",
        "status": "pending",
        "progress": 0,
        "speed": "0 MB/s",
        "eta": "--",
        "file_path": None,
        "error": None
    }
    bg_tasks.add_task(run_yt_download, job_id, req.url, req.start_time, req.end_time)
    return {"job_id": job_id}


@app.post("/api/upload")
async def upload_local_video(file: UploadFile = File(...)):
    """Uploads a video from local PC."""
    try:
        clean_name = f"{int(time.time())}_{file.filename.replace(' ', '_')}"
        save_path = UPLOADS_DIR / clean_name
        
        with open(save_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        meta = get_video_metadata(str(save_path))
        return {
            "file_path": str(save_path),
            "file_name": clean_name,
            "metadata": meta
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dosya yüklenemedi: {str(e)}")


@app.post("/api/select-local-path")
async def select_local_path(body: Dict[str, str]):
    """Directly select a video path from user's hard drive without copying."""
    path_str = body.get("path", "").strip('\"\'')
    p = Path(path_str)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail="Belirtilen dosya yolu bulunamadı.")
    
    meta = get_video_metadata(str(p))
    return {
        "file_path": str(p),
        "file_name": p.name,
        "metadata": meta
    }


@app.get("/api/video-info")
async def get_info(path: str):
    """Retrieve metadata for any video path."""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Dosya bulunamadı.")
    return get_video_metadata(path)


@app.get("/api/video-stream")
async def stream_video(request: Request, path: str):
    """Stream video with HTTP 206 Partial Content support for smooth seeking."""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Video bulunamadı.")
        
    file_size = os.path.getsize(path)
    range_header = request.headers.get("range")
    
    if not range_header:
        return FileResponse(path, media_type="video/mp4")
        
    # Parse Range: bytes=start-end
    range_match = range_header.replace("bytes=", "").split("-")
    start = int(range_match[0]) if range_match[0] else 0
    end = int(range_match[1]) if len(range_match) > 1 and range_match[1] else file_size - 1
    end = min(end, file_size - 1)
    chunk_size = (end - start) + 1
    
    def iterfile():
        with open(path, "rb") as f:
            f.seek(start)
            remaining = chunk_size
            while remaining > 0:
                read_bytes = min(remaining, 1024 * 1024)
                data = f.read(read_bytes)
                if not data:
                    break
                remaining -= len(data)
                yield data
                
    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(chunk_size),
        "Content-Type": "video/mp4",
    }
    return StreamingResponse(iterfile(), status_code=206, headers=headers)


@app.post("/api/detect-face")
async def detect_face(req: FaceDetectRequest):
    """
    Grabs a frame at the specified timestamp and uses OpenCV Haar cascade
    to detect face position (ideal for webcam detection).
    """
    try:
        import cv2
        cap = cv2.VideoCapture(req.video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        cap.set(cv2.CAP_PROP_POS_MSEC, req.timestamp * 1000)
        ret, frame = cap.read()
        cap.release()
        
        if not ret or frame is None:
            raise ValueError("Kare okunamadı.")
            
        h, w, _ = frame.shape
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Load OpenCV default haarcascade for face
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        face_cascade = cv2.CascadeClassifier(cascade_path)
        
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(int(w * 0.05), int(h * 0.05))
        )
        
        if len(faces) == 0:
            # Fallback suggestion: top-right webcam area (e.g. 25% width, 25% height)
            return {
                "detected": False,
                "box": {
                    "x": int(w * 0.72),
                    "y": int(h * 0.05),
                    "width": int(w * 0.25),
                    "height": int(h * 0.35)
                },
                "frame_width": w,
                "frame_height": h,
                "message": "Otomatik yüz bulunamadı, varsayılan sağ üst alan seçildi."
            }
            
        # Pick the most prominent/largest face
        best_face = max(faces, key=lambda f: f[2] * f[3])
        fx, fy, fw, fh = best_face
        
        # Expand box around face to capture shoulders/webcam border comfortably
        pad_x = int(fw * 0.8)
        pad_y = int(fh * 0.8)
        
        bx = max(0, fx - pad_x)
        by = max(0, fy - int(pad_y * 0.6))
        bw = min(w - bx, fw + 2 * pad_x)
        bh = min(h - by, fh + int(pad_y * 1.6))
        
        return {
            "detected": True,
            "box": {
                "x": int(bx),
                "y": int(by),
                "width": int(bw),
                "height": int(bh)
            },
            "frame_width": w,
            "frame_height": h,
            "message": "Yüz / Kamera başarıyla tespit edildi!"
        }
    except Exception as e:
        return {
            "detected": False,
            "error": str(e),
            "box": {"x": 0, "y": 0, "width": 400, "height": 300}
        }


def run_export_ffmpeg(job_id: str, req: ExportRequest):
    """Runs FFmpeg filtergraph to produce the vertical split short."""
    try:
        import threading
        active_jobs[job_id]["status"] = "processing"
        active_jobs[job_id]["progress"] = 0
        
        # Clean title
        safe_title = "".join(c for c in req.output_title if c.isalnum() or c in (' ', '_', '-')).strip()
        if not safe_title:
            safe_title = "short"
        out_name = f"{safe_title}_{int(time.time())}.mp4"
        out_path = str(EXPORTS_DIR / out_name)
        
        duration = max(0.1, req.end_time - req.start_time)
        active_jobs[job_id]["duration"] = duration
        
        # Split layout heights (Output is req.output_width (1080) x req.output_height (1920))
        out_w = req.output_width
        out_h = req.output_height
        
        top_h = int(round(out_h * req.split_ratio))
        top_h = top_h if top_h % 2 == 0 else top_h + 1
        bot_h = out_h - top_h
        
        # Validate boxes
        fb = req.face_box
        gb = req.game_box
        
        fx, fy, fw, fh = int(fb["x"]), int(fb["y"]), int(fb["width"]), int(fb["height"])
        gx, gy, gw, gh = int(gb["x"]), int(gb["y"]), int(gb["width"]), int(gb["height"])
        
        fw = max(10, fw)
        fh = max(10, fh)
        gw = max(10, gw)
        gh = max(10, gh)
        
        filter_parts = [
            f"[0:v]crop={fw}:{fh}:{fx}:{fy},scale={out_w}:{top_h}:force_original_aspect_ratio=increase,crop={out_w}:{top_h}[top]",
            f"[0:v]crop={gw}:{gh}:{gx}:{gy},scale={out_w}:{bot_h}:force_original_aspect_ratio=increase,crop={out_w}:{bot_h}[bot]",
            "[top][bot]vstack=inputs=2[stacked]"
        ]
        
        last_node = "[stacked]"
        
        if req.divider_thickness > 0 and req.divider_color.lower() != 'none':
            div_color = req.divider_color
            if div_color.startswith('#'):
                div_color = "0x" + div_color.lstrip('#')
                
            div_y = top_h - (req.divider_thickness // 2)
            div_filter = f"{last_node}drawbox=x=0:y={div_y}:w={out_w}:h={req.divider_thickness}:color={div_color}:t=fill[v_final]"
            filter_parts.append(div_filter)
            last_node = "[v_final]"
        else:
            filter_parts.append(f"{last_node}copy[v_final]")
            last_node = "[v_final]"
            
        filter_str = ";".join(filter_parts)
        
        # Determine encoder (NVENC GPU or CPU)
        video_encoder = ["-c:v", "h264_nvenc", "-preset", "p5", "-b:v", "10M"] if req.use_gpu else ["-c:v", "libx264", "-preset", "fast", "-crf", "19"]
        
        cmd = [
            "ffmpeg",
            "-y",
            "-loglevel", "warning",
            "-nostats",
            "-ss", str(req.start_time),
            "-t", str(duration),
            "-i", req.video_path,
            "-filter_complex", filter_str,
            "-map", last_node,
            "-map", "0:a?",
            *video_encoder,
            "-c:a", "aac",
            "-b:a", "192k",
            "-r", str(req.fps),
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            "-progress", "pipe:1",
            out_path
        ]
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        stderr_lines = []
        def read_stderr():
            try:
                for s_line in process.stderr:
                    stderr_lines.append(s_line)
            except Exception:
                pass
                
        err_thread = threading.Thread(target=read_stderr, daemon=True)
        err_thread.start()
        
        for line in process.stdout:
            line = line.strip()
            if "=" in line:
                key, val = line.split("=", 1)
                if key == "out_time_ms":
                    try:
                        ms = int(val)
                        curr_sec = ms / 1_000_000
                        pct = min(99.0, max(0.0, round((curr_sec / duration) * 100, 1)))
                        active_jobs[job_id]["progress"] = pct
                    except Exception:
                        pass
                elif key == "fps":
                    active_jobs[job_id]["fps"] = val
                elif key == "speed":
                    active_jobs[job_id]["speed"] = val
                    
        process.wait()
        err_thread.join(timeout=1.0)
        
        if process.returncode == 0 and os.path.exists(out_path):
            active_jobs[job_id]["status"] = "completed"
            active_jobs[job_id]["progress"] = 100
            active_jobs[job_id]["output_file"] = out_name
            active_jobs[job_id]["output_path"] = out_path
            active_jobs[job_id]["file_size"] = os.path.getsize(out_path)
        else:
            err_msg = "".join(stderr_lines)
            active_jobs[job_id]["status"] = "error"
            active_jobs[job_id]["error"] = f"FFmpeg Error (Exit {process.returncode}): {err_msg}"
            
    except Exception as e:
        active_jobs[job_id]["status"] = "error"
        active_jobs[job_id]["error"] = str(e)


@app.post("/api/export")
async def start_export(req: ExportRequest, bg_tasks: BackgroundTasks):
    """Starts exporting the short in the background."""
    if not os.path.exists(req.video_path):
        raise HTTPException(status_code=404, detail="Kaynak video dosyası bulunamadı.")
        
    job_id = str(uuid.uuid4())
    active_jobs[job_id] = {
        "type": "export",
        "status": "pending",
        "progress": 0,
        "speed": "--",
        "fps": "--",
        "output_file": None,
        "error": None
    }
    bg_tasks.add_task(run_export_ffmpeg, job_id, req)
    return {"job_id": job_id}


@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Returns the real-time status of a download or export job."""
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail="İşlem bulunamadı.")
    return active_jobs[job_id]


@app.get("/api/exports")
async def list_exports():
    """Lists all previously exported shorts."""
    files = []
    for item in EXPORTS_DIR.glob("*.mp4"):
        try:
            stat = item.stat()
            files.append({
                "filename": item.name,
                "path": str(item),
                "size_mb": round(stat.st_size / (1024 * 1024), 2),
                "created_at": stat.st_mtime
            })
        except Exception:
            continue
    files.sort(key=lambda x: x["created_at"], reverse=True)
    return files


@app.get("/api/download-export/{filename}")
async def download_export(filename: str):
    """Download an exported video directly in browser."""
    path = EXPORTS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Dosya bulunamadı.")
    return FileResponse(str(path), media_type="video/mp4", filename=filename)


@app.post("/api/open-folder")
async def open_folder(body: Dict[str, str]):
    """Opens Windows Explorer with the specified file selected."""
    path_str = body.get("path")
    if not path_str or not os.path.exists(path_str):
        path_str = str(EXPORTS_DIR)
        
    try:
        # Select file in Windows Explorer
        if os.path.isfile(path_str):
            subprocess.run(["explorer", f"/select,{path_str}"])
        else:
            subprocess.run(["explorer", path_str])
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


# Mount static files
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    print("🚀 ShortsMaker Başlatılıyor: http://127.0.0.1:8000")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
