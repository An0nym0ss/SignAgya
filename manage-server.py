#!/usr/bin/env python3
"""
SignAgya Server Manager
========================
Start, stop, and restart the backend (FastAPI) and frontend (Vite) servers.

Usage:
    python manage-server.py start       # Start both servers
    python manage-server.py stop        # Stop both servers
    python manage-server.py restart     # Restart both servers
    python manage-server.py status      # Show server status
"""

import subprocess
import sys
import os
import signal
import time
import platform
import tempfile

IS_WINDOWS = platform.system() == "Windows"

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

# OS-specific paths
if IS_WINDOWS:
    VENV_PYTHON = os.path.join(PROJECT_DIR, ".venv", "Scripts", "python.exe")
else:
    VENV_PYTHON = os.path.join(PROJECT_DIR, ".venv", "bin", "python")

BACKEND_CMD = [VENV_PYTHON, "backend/src/server.py"]
FRONTEND_CMD = ["node", "node_modules/vite/bin/vite.js", "--host", "0.0.0.0", "--port", "5173"]

# Store logs and PID files in temp dir (cross-platform)
_TMPDIR = tempfile.gettempdir()
BACKEND_LOG = os.path.join(_TMPDIR, "signagya_backend.log")
FRONTEND_LOG = os.path.join(_TMPDIR, "signagya_frontend.log")
BACKEND_PID_FILE = os.path.join(_TMPDIR, "signagya_backend.pid")
FRONTEND_PID_FILE = os.path.join(_TMPDIR, "signagya_frontend.pid")


def find_process(name_pattern):
    """Find PIDs matching a pattern (cross-platform)."""
    try:
        if IS_WINDOWS:
            result = subprocess.run(
                ["wmic", "process", "where",
                 f"CommandLine like '%{name_pattern}%'",
                 "get", "ProcessId"],
                capture_output=True, text=True, creationflags=0x08000000  # CREATE_NO_WINDOW
            )
            if result.returncode == 0:
                pids = []
                for line in result.stdout.strip().split("\n"):
                    line = line.strip()
                    if line.isdigit():
                        pids.append(int(line))
                return pids
        else:
            result = subprocess.run(
                ["pgrep", "-f", name_pattern],
                capture_output=True, text=True
            )
            if result.returncode == 0:
                return [int(p) for p in result.stdout.strip().split("\n") if p]
    except Exception:
        pass
    return []


def is_running(pid_file, pattern):
    """Check if a server is running."""
    # Check PID file first
    if os.path.exists(pid_file):
        try:
            pid = int(open(pid_file).read().strip())
            os.kill(pid, 0)  # Check if process exists
            return pid
        except (ValueError, ProcessLookupError, PermissionError):
            os.remove(pid_file)

    # Fallback: search by pattern
    pids = find_process(pattern)
    if pids:
        return pids[0]
    return None


def start_backend():
    """Start the backend server."""
    pid = is_running(BACKEND_PID_FILE, "backend/src/server.py")
    if pid:
        print(f"  Backend already running (PID {pid})")
        return pid

    print("  Starting backend (FastAPI on :8000)...")
    log = open(BACKEND_LOG, "w")
    popen_kwargs = dict(cwd=PROJECT_DIR, stdout=log, stderr=subprocess.STDOUT)
    if IS_WINDOWS:
        popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        popen_kwargs["start_new_session"] = True
    proc = subprocess.Popen(BACKEND_CMD, **popen_kwargs)
    with open(BACKEND_PID_FILE, "w") as f:
        f.write(str(proc.pid))

    # Wait for it to be ready
    for i in range(30):
        time.sleep(1)
        try:
            import urllib.request
            resp = urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=2)
            if resp.status == 200:
                print(f"  ✅ Backend started (PID {proc.pid})")
                return proc.pid
        except Exception:
            pass
        if proc.poll() is not None:
            print(f"  ❌ Backend failed to start. Check {BACKEND_LOG}")
            return None

    print(f"  ⏳ Backend started (PID {proc.pid}) but health check timed out")
    return proc.pid


def start_frontend():
    """Start the frontend dev server."""
    pid = is_running(FRONTEND_PID_FILE, "vite.js.*--port.*5173")
    if pid:
        print(f"  Frontend already running (PID {pid})")
        return pid

    print("  Starting frontend (Vite on :5173)...")
    log = open(FRONTEND_LOG, "w")
    popen_kwargs = dict(
        cwd=PROJECT_DIR, stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL
    )
    if IS_WINDOWS:
        popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        popen_kwargs["start_new_session"] = True
    proc = subprocess.Popen(FRONTEND_CMD, **popen_kwargs)
    with open(FRONTEND_PID_FILE, "w") as f:
        f.write(str(proc.pid))

    # Wait for it to be ready
    for i in range(15):
        time.sleep(1)
        if proc.poll() is not None:
            print(f"  ❌ Frontend failed to start. Check {FRONTEND_LOG}")
            return None
        try:
            import urllib.request, ssl
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            urllib.request.urlopen("https://127.0.0.1:5173/", timeout=2, context=ctx)
            print(f"  ✅ Frontend started (PID {proc.pid})")
            return proc.pid
        except Exception:
            pass

    if proc.poll() is None:
        print(f"  ✅ Frontend started (PID {proc.pid})")
        return proc.pid
    print(f"  ❌ Frontend failed. Check {FRONTEND_LOG}")
    return None


def stop_server(name, pid_file, pattern):
    """Stop a server by PID file or pattern (cross-platform)."""
    pid = is_running(pid_file, pattern)
    if not pid:
        print(f"  {name} is not running")
        return

    print(f"  Stopping {name} (PID {pid})...")

    def _kill_pid(p, force=False):
        """Kill a single PID, cross-platform."""
        if IS_WINDOWS:
            # taskkill /F always force-kills on Windows; /T kills child processes
            flag = "/F" if force else ""
            subprocess.run(
                f"taskkill /PID {p} /T {flag}".split(),
                capture_output=True, creationflags=0x08000000
            )
        else:
            sig = signal.SIGKILL if force else signal.SIGTERM
            try:
                os.killpg(os.getpgid(p), sig)
            except (ProcessLookupError, PermissionError, OSError):
                try:
                    os.kill(p, sig)
                except (ProcessLookupError, PermissionError):
                    pass

    _kill_pid(pid, force=False)

    # Wait for it to die
    for _ in range(10):
        try:
            os.kill(pid, 0)
            time.sleep(0.5)
        except (ProcessLookupError, OSError):
            break
    else:
        _kill_pid(pid, force=True)

    if os.path.exists(pid_file):
        os.remove(pid_file)
    print(f"  ✅ {name} stopped")


def cmd_start():
    print("Starting SignAgya servers...")
    start_backend()
    start_frontend()
    print("\nDone! Backend: http://127.0.0.1:8000  Frontend: https://127.0.0.1:5173")


def cmd_stop():
    print("Stopping SignAgya servers...")
    stop_server("Backend", BACKEND_PID_FILE, "backend/src/server.py")
    stop_server("Frontend", FRONTEND_PID_FILE, "vite.js.*--port.*5173")
    print("\nDone!")


def cmd_restart():
    cmd_stop()
    print()
    cmd_start()


def cmd_status():
    print("SignAgya Server Status")
    print("-" * 40)

    be_pid = is_running(BACKEND_PID_FILE, "backend/src/server.py")
    if be_pid:
        # Health check
        healthy = False
        try:
            import urllib.request
            resp = urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=2)
            if resp.status == 200:
                import json
                data = json.loads(resp.read())
                healthy = True
                print(f"  Backend:  ✅ Running (PID {be_pid})")
                print(f"            ASL model: {'✅' if data.get('asl_model_loaded') else '❌'}")
                print(f"            NSL model: {'✅' if data.get('vnsl_model_loaded') else '❌'}")
        except Exception:
            pass
        if not healthy:
            print(f"  Backend:  ⚠️  Process running (PID {be_pid}) but not responding")
    else:
        print("  Backend:  ❌ Not running")

    fe_pid = is_running(FRONTEND_PID_FILE, "vite.js.*--port.*5173")
    if fe_pid:
        print(f"  Frontend: ✅ Running (PID {fe_pid})")
    else:
        print("  Frontend: ❌ Not running")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1].lower()
    if cmd == "start":
        cmd_start()
    elif cmd == "stop":
        cmd_stop()
    elif cmd == "restart":
        cmd_restart()
    elif cmd == "status":
        cmd_status()
    else:
        print(f"Unknown command: {cmd}")
        print("Usage: python manage-server.py [start|stop|restart|status]")
        sys.exit(1)
