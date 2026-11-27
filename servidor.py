#!/usr/bin/env python3
"""
Servidor local para Conversorium (yt-dlp + ffmpeg).

- Solo escucha en 127.0.0.1 (tu propio ordenador).
- Sirve index.html en http://localhost:8765
- Solo acepta peticiones de la propia web (o de index.html abierto como archivo).

Requisitos:  Python 3.8+,  pip install -U yt-dlp,  ffmpeg instalado.
Uso:         python servidor.py
"""
import atexit
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, unquote, urlparse

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

PORT = int(os.environ.get("PORT", "8765"))
HOST = "127.0.0.1"
BASE = os.path.dirname(os.path.abspath(__file__))
TMP = tempfile.mkdtemp(prefix="conversorium_")
atexit.register(lambda: shutil.rmtree(TMP, ignore_errors=True))

ALLOWED_ORIGINS = {"http://localhost:%d" % PORT, "http://127.0.0.1:%d" % PORT, "null"}
# Webs publicadas que pueden usar este servidor (añade otras con CONVERSORIUM_ORIGINS=https://a.com,https://b.com)
ALLOWED_ORIGINS |= {"https://conversorium.vercel.app"}
# Versiones de prueba de Vercel del propio proyecto (conversorium-xxxx-mbp21.vercel.app)
PREVIEW_ORIGIN = re.compile(r"^https://conversorium(-[a-z0-9-]+)?-mbp21\.vercel\.app$")


def allowed_origin(o):
    return o in ALLOWED_ORIGINS or bool(PREVIEW_ORIGIN.match(o or ""))


ALLOWED_ORIGINS |= {o.strip().rstrip("/") for o in os.environ.get("CONVERSORIUM_ORIGINS", "").split(",") if o.strip()}
JOBS = {}
JOBS_LOCK = threading.Lock()
FFMPEG = shutil.which("ffmpeg")
FFPROBE = shutil.which("ffprobe")
MAX_UPLOAD = 4 * 1024 * 1024 * 1024  # 4 GB


def find_ytdlp():
    try:
        r = subprocess.run([sys.executable, "-m", "yt_dlp", "--version"],
                           capture_output=True, text=True, timeout=30)
        if r.returncode == 0:
            return [sys.executable, "-m", "yt_dlp"], r.stdout.strip()
    except Exception:
        pass
    exe = shutil.which("yt-dlp")
    if exe:
        try:
            r = subprocess.run([exe, "--version"], capture_output=True, text=True, timeout=30)
            if r.returncode == 0:
                return [exe], r.stdout.strip()
        except Exception:
            pass
    return None, None


YTDLP, YTDLP_VERSION = find_ytdlp()


# ------------------------------------------------------------------ trabajos
def new_job(kind):
    now = time.time()
    with JOBS_LOCK:
        for jid in [k for k, v in JOBS.items() if now - v["created"] > 2 * 3600]:
            shutil.rmtree(JOBS[jid]["dir"], ignore_errors=True)
            del JOBS[jid]
        jid = uuid.uuid4().hex[:12]
        d = os.path.join(TMP, jid)
        os.makedirs(d, exist_ok=True)
        JOBS[jid] = {"id": jid, "kind": kind, "status": "queued", "percent": 0, "message": "En cola…",
                     "dir": d, "file": None, "name": None, "error": None, "created": now}
        return JOBS[jid]


def public(job):
    return {k: job[k] for k in ("id", "status", "percent", "message", "name", "error")}


def last_error(text):
    lines = [l.strip() for l in (text or "").splitlines() if l.strip()]
    for l in reversed(lines):
        if "ERROR" in l:
            return re.sub(r"^.*?ERROR:\s*", "", l)
    return lines[-1] if lines else "Error desconocido"


def num(x):
    try:
        return float(x)
    except Exception:
        return None


# ------------------------------------------------------------------ yt-dlp
def api_info(url):
    p = subprocess.run(YTDLP + ["-J", "--no-playlist", "--no-warnings", "--", url],
                       capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120)
    if p.returncode != 0:
        raise RuntimeError(last_error(p.stderr))
    d = json.loads(p.stdout)
    heights = sorted({f["height"] for f in d.get("formats", [])
                      if f.get("height") and f.get("vcodec") not in (None, "none")}, reverse=True)
    return {"title": d.get("title"), "uploader": d.get("uploader") or d.get("channel"),
            "duration": d.get("duration"), "thumbnail": d.get("thumbnail"), "heights": heights}


def run_download(job, url, mode, quality, fmt):
    try:
        job["status"] = "running"
        job["message"] = "Iniciando…"
        a = YTDLP + ["--no-playlist", "--no-warnings", "--no-colors", "--newline", "--windows-filenames",
                     "--trim-filenames", "150",
                     "--progress-template",
                     "download:PROG %(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s",
                     "-o", os.path.join(job["dir"], "%(title)s.%(ext)s")]
        if mode == "audio":
            a += ["-f", "ba/b", "-x", "--audio-format", fmt, "--audio-quality", "0"]
        else:
            if quality == "best":
                sel = "bv*+ba/b"
            else:
                sel = "bv*[height<=%s]+ba/b[height<=%s]/b" % (quality, quality)
            a += ["-f", sel]
            if fmt == "mp4":
                a += ["-S", "res,vcodec:h264,acodec:m4a", "--merge-output-format", "mp4"]
            else:
                a += ["-S", "res,vcodec:vp9,acodec:opus", "--merge-output-format", "webm"]
        a += ["--", url]

        proc = subprocess.Popen(a, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                                encoding="utf-8", errors="replace", bufsize=1)
        stage, total, tail = 0, (1 if mode == "audio" else 2), []
        for line in proc.stdout:
            line = line.strip()
            if not line:
                continue
            tail = (tail + [line])[-15:]
            if line.startswith("PROG "):
                parts = (line[5:].split("|") + ["", "", ""])[:3]
                done, tot, est = num(parts[0]), num(parts[1]), num(parts[2])
                size = tot or est
                if done is not None and size:
                    frac = min(1.0, done / size)
                    s = max(stage, 1)
                    job["percent"] = min(95, int(((s - 1) + frac) / max(total, s) * 100))
                job["message"] = "Descargando…"
            elif "[download] Destination:" in line:
                stage += 1
            elif line.startswith(("[Merger]", "[ExtractAudio]", "[VideoConvertor]", "[Fixup")):
                job["percent"], job["message"] = 96, "Procesando con ffmpeg…"
        proc.wait()
        if proc.returncode != 0:
            raise RuntimeError(last_error("\n".join(tail)))

        files = [os.path.join(job["dir"], f) for f in os.listdir(job["dir"])
                 if not f.endswith((".part", ".ytdl", ".json", ".temp"))]
        if not files:
            raise RuntimeError("yt-dlp no generó ningún archivo.")
        best = max(files, key=os.path.getsize)
        ext = os.path.splitext(best)[1][1:].lower()
        if mode == "video" and ext != fmt:
            # la fuente solo tenía un formato distinto al pedido: se convierte con ffmpeg
            job["percent"], job["message"] = 96, "Convirtiendo a %s…" % fmt.upper()
            out = os.path.splitext(best)[0] + "." + fmt
            r = subprocess.run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-i", best]
                               + CONVERT[fmt] + [out], capture_output=True, text=True,
                               encoding="utf-8", errors="replace")
            if r.returncode != 0 or not os.path.exists(out):
                raise RuntimeError("ffmpeg falló: " + last_error(r.stderr))
            best = out
        job["file"], job["name"] = best, os.path.basename(best)
        job["percent"], job["message"], job["status"] = 100, "Listo", "done"
    except Exception as e:
        job["status"], job["error"] = "error", str(e)


# ------------------------------------------------------------------ ffmpeg
CONVERT = {
    "mp4":  ["-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"],
    "webm": ["-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-c:a", "libopus"],
    "mp3":  ["-vn", "-c:a", "libmp3lame", "-q:a", "2"],
    "m4a":  ["-vn", "-c:a", "aac", "-b:a", "192k"],
    "wav":  ["-vn", "-c:a", "pcm_s16le"],
}


def run_convert(job, src, target, orig_name):
    try:
        job["status"], job["message"] = "running", "Convirtiendo con ffmpeg…"
        dur = None
        if FFPROBE:
            try:
                r = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
                                    "-of", "csv=p=0", src], capture_output=True, text=True, timeout=60)
                dur = num(r.stdout.strip())
            except Exception:
                pass
        out = os.path.join(job["dir"], "out." + target)
        a = [FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1",
             "-i", src] + CONVERT[target] + [out]
        proc = subprocess.Popen(a, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                                encoding="utf-8", errors="replace", bufsize=1)
        tail = []
        for line in proc.stdout:
            line = line.strip()
            if line.startswith("out_time_ms="):
                us = num(line.split("=", 1)[1])
                if us is not None and dur:
                    job["percent"] = max(0, min(99, int(us / 1e6 / dur * 100)))
            elif "=" not in line:
                tail = (tail + [line])[-10:]
        proc.wait()
        if proc.returncode != 0 or not os.path.exists(out):
            raise RuntimeError("ffmpeg falló: " + (" ".join(tail) or "error desconocido"))
        base = os.path.splitext(os.path.basename(orig_name))[0] or "archivo"
        job["file"], job["name"] = out, base + "." + target
        job["percent"], job["message"], job["status"] = 100, "Listo", "done"
    except Exception as e:
        job["status"], job["error"] = "error", str(e)


# ------------------------------------------------------------------ HTTP
class Handler(BaseHTTPRequestHandler):
    server_version = "Conversorium/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    # --- utilidades
    def origin_ok(self):
        o = self.headers.get("Origin")
        return o is None or allowed_origin(o)

    def cors(self):
        o = self.headers.get("Origin")
        if o and allowed_origin(o):
            self.send_header("Access-Control-Allow-Origin", o)
            self.send_header("Vary", "Origin")

    def send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.cors()
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 1_000_000:
            raise ValueError("Petición demasiado grande")
        return json.loads(self.rfile.read(n) or b"{}")

    # --- métodos
    def do_OPTIONS(self):
        if not self.origin_ok():
            return self.send_json({"error": "Origen no permitido"}, 403)
        self.send_response(204)
        self.cors()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        if self.headers.get("Access-Control-Request-Private-Network") == "true":
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if not self.origin_ok():
            return self.send_json({"error": "Origen no permitido"}, 403)
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            f = os.path.join(BASE, "index.html")
            if not os.path.exists(f):
                return self.send_json({"error": "Coloca index.html junto a servidor.py"}, 404)
            data = open(f, "rb").read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if path == "/api/status":
            return self.send_json({"ok": True, "ytdlp": YTDLP_VERSION, "ffmpeg": bool(FFMPEG)})
        m = re.fullmatch(r"/api/job/([0-9a-f]+)", path)
        if m:
            job = JOBS.get(m.group(1))
            return self.send_json(public(job)) if job else self.send_json({"error": "No existe"}, 404)
        m = re.fullmatch(r"/api/file/([0-9a-f]+)", path)
        if m:
            job = JOBS.get(m.group(1))
            if not job or job["status"] != "done" or not job["file"]:
                return self.send_json({"error": "Archivo no disponible"}, 404)
            return self.send_file(job)
        self.send_json({"error": "No encontrado"}, 404)

    def send_file(self, job):
        f, name = job["file"], job["name"]
        size = os.path.getsize(f)
        ascii_name = re.sub(r"[^A-Za-z0-9._-]+", "_", name) or "archivo"
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(size))
        self.send_header("Content-Disposition",
                         "attachment; filename=\"%s\"; filename*=UTF-8''%s" % (ascii_name, quote(name)))
        self.cors()
        self.end_headers()
        with open(f, "rb") as fh:
            while True:
                chunk = fh.read(1 << 20)
                if not chunk:
                    break
                self.wfile.write(chunk)

    def do_POST(self):
        if not self.origin_ok():
            return self.send_json({"error": "Origen no permitido"}, 403)
        u = urlparse(self.path)
        try:
            if u.path == "/api/info":
                return self.post_info()
            if u.path == "/api/download":
                return self.post_download()
            if u.path == "/api/convert":
                return self.post_convert(parse_qs(u.query))
        except Exception as e:
            return self.send_json({"error": str(e)}, 500)
        self.send_json({"error": "No encontrado"}, 404)

    def need_ytdlp(self):
        if not YTDLP:
            self.send_json({"error": "yt-dlp no está instalado. Ejecuta: pip install -U yt-dlp"}, 503)
            return False
        return True

    def post_info(self):
        if not self.need_ytdlp():
            return
        url = str(self.read_json().get("url", "")).strip()
        if not re.match(r"^https?://", url, re.I):
            return self.send_json({"error": "URL no válida"}, 400)
        try:
            self.send_json(api_info(url))
        except Exception as e:
            self.send_json({"error": str(e)}, 502)

    def post_download(self):
        if not self.need_ytdlp():
            return
        if not FFMPEG:
            return self.send_json({"error": "ffmpeg no está instalado (hace falta para unir y convertir)."}, 503)
        d = self.read_json()
        url = str(d.get("url", "")).strip()
        mode = d.get("mode", "video")
        quality = str(d.get("quality", "best"))
        fmt = d.get("format", "mp4")
        if not re.match(r"^https?://", url, re.I):
            return self.send_json({"error": "URL no válida"}, 400)
        if mode not in ("video", "audio"):
            return self.send_json({"error": "Modo no válido"}, 400)
        if quality != "best" and quality not in ("2160", "1440", "1080", "720", "480", "360", "240"):
            return self.send_json({"error": "Calidad no válida"}, 400)
        if fmt not in (("mp4", "webm") if mode == "video" else ("mp3", "m4a", "wav", "opus")):
            return self.send_json({"error": "Formato no válido"}, 400)
        job = new_job("download")
        threading.Thread(target=run_download, args=(job, url, mode, quality, fmt), daemon=True).start()
        self.send_json({"id": job["id"]})

    def post_convert(self, q):
        if not FFMPEG:
            return self.send_json({"error": "ffmpeg no está instalado en el servidor."}, 503)
        target = (q.get("target") or [""])[0]
        name = unquote((q.get("name") or ["archivo"])[0])
        if target not in CONVERT:
            return self.send_json({"error": "Formato de destino no válido"}, 400)
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > MAX_UPLOAD:
            return self.send_json({"error": "Archivo vacío o demasiado grande"}, 400)
        job = new_job("convert")
        src = os.path.join(job["dir"], "in" + (os.path.splitext(name)[1][:8] or ".bin"))
        with open(src, "wb") as fh:
            left = n
            while left > 0:
                chunk = self.rfile.read(min(1 << 20, left))
                if not chunk:
                    break
                fh.write(chunk)
                left -= len(chunk)
        threading.Thread(target=run_convert, args=(job, src, target, name), daemon=True).start()
        self.send_json({"id": job["id"]})


class Server(ThreadingHTTPServer):
    daemon_threads = True


def main():
    print("=" * 56)
    print(" Conversorium - servidor local")
    print("=" * 56)
    print(" yt-dlp : %s" % (YTDLP_VERSION or "NO ENCONTRADO  ->  pip install -U yt-dlp"))
    print(" ffmpeg : %s" % ("OK" if FFMPEG else "NO ENCONTRADO  ->  instala ffmpeg"))
    print(" Web    : http://localhost:%d" % PORT)
    print(" (Ctrl+C para parar)")
    print("-" * 56)
    try:
        Server((HOST, PORT), Handler).serve_forever()
    except OSError as e:
        print("No se pudo abrir el puerto %d: %s" % (PORT, e))
        print("Prueba con otro:  PORT=9000 python servidor.py")
    except KeyboardInterrupt:
        print("\nAdiós.")


if __name__ == "__main__":
    main()
