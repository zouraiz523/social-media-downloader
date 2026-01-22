from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import tempfile
import instaloader
import yt_dlp
import re
from pathlib import Path

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend communication

# Create downloads directory
DOWNLOAD_DIR = "downloads"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

def extract_instagram_shortcode(url):
    """Extract shortcode from Instagram URL"""
    patterns = [
        r'instagram\.com/p/([A-Za-z0-9_-]+)',
        r'instagram\.com/reel/([A-Za-z0-9_-]+)',
        r'instagram\.com/tv/([A-Za-z0-9_-]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def download_instagram(url):
    """Download Instagram video"""
    try:
        loader = instaloader.Instaloader(
            dirname_pattern=DOWNLOAD_DIR,
            download_pictures=False,
            download_video_thumbnails=False,
            download_comments=False,
            save_metadata=False
        )
        
        shortcode = extract_instagram_shortcode(url)
        if not shortcode:
            return {"success": False, "message": "Invalid Instagram URL"}
        
        post = instaloader.Post.from_shortcode(loader.context, shortcode)
        
        # Get video info
        video_info = {
            "title": post.caption[:50] + "..." if post.caption and len(post.caption) > 50 else "Instagram Video",
            "duration": "Unknown",
            "platform": "instagram"
        }
        
        # Download
        loader.download_post(post, target=DOWNLOAD_DIR)
        
        # Find the downloaded video file
        video_files = list(Path(DOWNLOAD_DIR).glob(f"{shortcode}*.mp4"))
        if video_files:
            video_path = str(video_files[0])
            file_size = os.path.getsize(video_path)
            
            return {
                "success": True,
                "message": "Instagram video downloaded successfully",
                "video": {
                    "title": video_info["title"],
                    "duration": video_info["duration"],
                    "path": video_path,
                    "size": f"{file_size / (1024 * 1024):.2f} MB"
                }
            }
        
        return {"success": False, "message": "Failed to find downloaded video"}
        
    except Exception as e:
        return {"success": False, "message": f"Instagram error: {str(e)}"}

def download_tiktok(url):
    """Download TikTok video"""
    try:
        ydl_opts = {
            'outtmpl': os.path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s'),
            'format': 'best',
            'noplaylist': True,
            'quiet': True
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
            filename = ydl.prepare_filename(info)
            file_size = os.path.getsize(filename)
            
            return {
                "success": True,
                "message": "TikTok video downloaded successfully",
                "video": {
                    "title": info.get('title', 'TikTok Video'),
                    "duration": f"{info.get('duration', 0)}s",
                    "path": filename,
                    "size": f"{file_size / (1024 * 1024):.2f} MB"
                }
            }
    except Exception as e:
        return {"success": False, "message": f"TikTok error: {str(e)}"}

def download_youtube(url):
    """Download YouTube video"""
    try:
        ydl_opts = {
            'outtmpl': os.path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s'),
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'noplaylist': True,
            'quiet': True
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
            filename = ydl.prepare_filename(info)
            file_size = os.path.getsize(filename)
            
            return {
                "success": True,
                "message": "YouTube video downloaded successfully",
                "video": {
                    "title": info.get('title', 'YouTube Video'),
                    "duration": f"{info.get('duration', 0)}s",
                    "path": filename,
                    "size": f"{file_size / (1024 * 1024):.2f} MB"
                }
            }
    except Exception as e:
        return {"success": False, "message": f"YouTube error: {str(e)}"}

@app.route('/api/download', methods=['POST'])
def download_video():
    """Main download endpoint"""
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        platform = data.get('platform', '').lower()
        
        if not url:
            return jsonify({"success": False, "message": "URL is required"}), 400
        
        # Route to appropriate downloader
        if platform == 'instagram':
            result = download_instagram(url)
        elif platform == 'tiktok':
            result = download_tiktok(url)
        elif platform == 'youtube':
            result = download_youtube(url)
        else:
            return jsonify({"success": False, "message": "Invalid platform"}), 400
        
        if result["success"]:
            # Return video info
            return jsonify({
                "success": True,
                "message": result["message"],
                "video": {
                    "title": result["video"]["title"],
                    "duration": result["video"]["duration"],
                    "formats": [
                        {
                            "quality": "Original",
                            "size": result["video"]["size"],
                            "download_url": f"/api/download-file/{os.path.basename(result['video']['path'])}"
                        }
                    ]
                }
            })
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({"success": False, "message": f"Server error: {str(e)}"}), 500

@app.route('/api/download-file/<filename>')
def download_file(filename):
    """Download the actual file"""
    try:
        file_path = os.path.join(DOWNLOAD_DIR, filename)
        if os.path.exists(file_path):
            return send_file(file_path, as_attachment=True)
        return jsonify({"success": False, "message": "File not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "ok", "message": "Server is running"})

if __name__ == '__main__':
    print("🚀 Starting Social Media Downloader Server...")
    print("📁 Download directory:", os.path.abspath(DOWNLOAD_DIR))
    print("🌐 Server running on http://localhost:5000")
    app.run(debug=True, port=5000)