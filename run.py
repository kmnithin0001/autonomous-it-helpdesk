#!/usr/bin/env python3
import os
import sys
import time
import argparse
import subprocess
import webbrowser
import urllib.request
import urllib.error

# Project root path detection
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")

def print_banner(text):
    print("\n" + "=" * 60)
    print(f" {text}")
    print("=" * 60)

def verify_cmd(cmd):
    """Check if a shell command is available."""
    try:
        # Run command with --version or similar
        subprocess.run([cmd, "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, shell=True)
        return True
    except Exception:
        return False

def verify_python_deps():
    """Verify backend python dependencies are installed."""
    try:
        import fastapi
        import uvicorn
        import chromadb
        return True
    except ImportError as e:
        print(f"[-] Missing Python dependency: {e.name}")
        return False

def check_health(url, timeout=30):
    """Wait for a URL to respond with a 200 OK."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            req = urllib.request.Request(
                url, 
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            with urllib.request.urlopen(req) as response:
                if response.status == 200:
                    return True
        except (urllib.error.URLError, ConnectionError):
            pass
        time.sleep(1)
    return False

def run_npm_cmd(cmd_list, cwd):
    """Run an npm command, prioritizing npm.cmd on Windows."""
    if sys.platform == "win32":
        # Check if npm can be run directly, or prepend PATH with common Node locations if needed
        # In this environment, Node path was verified to be C:\Program Files\nodejs
        # Let's ensure environment inherits node path
        env = os.environ.copy()
        node_path = r"C:\Program Files\nodejs"
        if os.path.exists(node_path) and node_path not in env.get("PATH", ""):
            env["PATH"] += os.pathsep + node_path
            
        full_cmd = ["npm.cmd"] + cmd_list[1:] if cmd_list[0] == "npm" else cmd_list
        return subprocess.run(full_cmd, cwd=cwd, shell=True, env=env)
    else:
        return subprocess.run(cmd_list, cwd=cwd)

def kill_process_tree(pid):
    """Windows process tree termination helper."""
    if sys.platform == "win32":
        try:
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except Exception:
            pass
    else:
        import signal
        try:
            os.killpg(os.getpgid(pid), signal.SIGTERM)
        except Exception:
            try:
                os.kill(pid, signal.SIGTERM)
            except Exception:
                pass

def main():
    parser = argparse.ArgumentParser(description="Autonomous IT Helpdesk Launcher")
    parser.add_argument("--dev", action="store_true", help="Launch in development mode (starts FastAPI and Vite Dev Server)")
    parser.add_argument("--build", action="store_true", help="Force rebuild of frontend assets")
    args = parser.parse_args()

    print_banner("AUTONOMOUS IT HELPDESK SYSTEM LAUNCHER")
    print(f"[*] Platform: {sys.platform}")
    print(f"[*] Workspace: {ROOT_DIR}")
    
    # 1. Verify backend dependencies
    if not verify_python_deps():
        print("[-] Error: Python dependencies are missing.")
        print("    Please activate your virtual environment: '.\\venv\\Scripts\\activate'")
        print("    And install requirements: 'pip install -r requirements.txt'")
        sys.exit(1)
    print("[+] Python dependencies verified successfully.")

    # Determine mode
    dev_mode = args.dev
    prod_mode = not dev_mode
    frontend_dist = os.path.join(FRONTEND_DIR, "dist")
    frontend_built = os.path.exists(frontend_dist) and os.path.exists(os.path.join(frontend_dist, "index.html"))

    # 2. Node & npm verification (if needed)
    node_available = verify_cmd("node")
    npm_available = verify_cmd("npm")
    
    print(f"[*] Node.js available: {node_available}")
    print(f"[*] npm available: {npm_available}")

    if dev_mode:
        if not (node_available and npm_available):
            print("[-] Error: Node.js and npm are required for development mode.")
            sys.exit(1)
        
        # Verify node_modules
        if not os.path.exists(os.path.join(FRONTEND_DIR, "node_modules")):
            print("[*] node_modules not found. Running npm install...")
            res = run_npm_cmd(["npm", "install"], cwd=FRONTEND_DIR)
            if res.returncode != 0:
                print("[-] Error: npm install failed.")
                sys.exit(1)
    else:
        # Production Mode
        if args.build or not frontend_built:
            if not (node_available and npm_available):
                if not frontend_built:
                    print("[-] Error: Frontend production build ('frontend/dist') is missing,")
                    print("    and Node.js/npm were not found to compile it automatically.")
                    print("    Please install Node.js or run in development mode with '--dev'.")
                    sys.exit(1)
                else:
                    print("[*] Rebuild requested but Node.js/npm not available. Skipping compilation.")
            else:
                # Compile assets
                print_banner("COMPILING FRONTEND PRODUCTION BUILD")
                
                # Check node_modules
                if not os.path.exists(os.path.join(FRONTEND_DIR, "node_modules")):
                    print("[*] node_modules not found. Running npm install...")
                    res = run_npm_cmd(["npm", "install"], cwd=FRONTEND_DIR)
                    if res.returncode != 0:
                        print("[-] Error: npm install failed.")
                        sys.exit(1)
                
                print("[*] Compiling assets (npm run build)...")
                res = run_npm_cmd(["npm", "run", "build"], cwd=FRONTEND_DIR)
                if res.returncode != 0:
                    print("[-] Error: npm run build failed.")
                    sys.exit(1)
                print("[+] Frontend built successfully.")

    # 3. Launch servers
    processes = []
    env = os.environ.copy()
    
    # Configure path for server.py imports
    python_exe = sys.executable

    try:
        # Start FastAPI backend
        print_banner("STARTING AUTONOMOUS IT HELPDESK BACKEND")
        print("[*] Starting backend FastAPI server on http://localhost:8000...")
        
        # We start server.py
        backend_proc = subprocess.Popen(
            [python_exe, "-u", "server.py"],
            cwd=ROOT_DIR,
            env=env
        )
        processes.append(backend_proc)

        # Print backend console lines in a background-friendly way
        time.sleep(2)  # Give it a second to boot up
        
        # Start Frontend Dev Server if in dev mode
        if dev_mode:
            print_banner("STARTING FRONTEND DEVELOPMENT SERVER")
            print("[*] Starting Vite dev server on http://localhost:5173...")
            
            # Setup path environment for npm
            node_path = r"C:\Program Files\nodejs"
            if sys.platform == "win32" and os.path.exists(node_path) and node_path not in env.get("PATH", ""):
                env["PATH"] += os.pathsep + node_path
                
            frontend_cmd = ["npm.cmd", "run", "dev"] if sys.platform == "win32" else ["npm", "run", "dev"]
            frontend_proc = subprocess.Popen(
                frontend_cmd,
                cwd=FRONTEND_DIR,
                env=env
            )
            processes.append(frontend_proc)
            time.sleep(2)

        # 4. Health Verification
        print_banner("SYSTEM HEALTH VERIFICATION")
        
        print("[*] Verifying backend health (http://localhost:8000/api/health)...")
        if check_health("http://localhost:8000/api/health", timeout=30):
            print("[+] Backend Ready")
        else:
            print("[-] Error: Backend failed to start or respond to health checks.")
            raise Exception("Backend unhealthy")
            
        if dev_mode:
            print("[*] Verifying frontend health (http://localhost:5173)...")
            # Vite dev server responds to HTTP requests
            if check_health("http://localhost:5173", timeout=30):
                print("[+] Frontend Ready")
            else:
                print("[-] Error: Vite dev server failed to respond.")
                raise Exception("Frontend unhealthy")
        else:
            print("[+] Frontend (Production Static Assets) ready to serve via FastAPI.")

        # 5. Open Browser
        target_url = "http://localhost:8000" if prod_mode else "http://localhost:5173"
        print_banner(f"OPENING APPLICATION DASHBOARD: {target_url}")
        webbrowser.open(target_url)

        print("\n[*] Application running. Press Ctrl+C to terminate.")
        
        # Print logs in real-time
        while True:
            # Check if processes died
            for p in processes:
                ret = p.poll()
                if ret is not None:
                    print(f"\n[-] Process {p.pid} terminated with exit code {ret}")
                    raise KeyboardInterrupt
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n[*] Shutting down application gracefully...")
    except Exception as e:
        print(f"\n[-] Error encountered: {e}")
    finally:
        # Terminate all subprocesses
        for p in processes:
            try:
                print(f"[*] Terminating process {p.pid}...")
                kill_process_tree(p.pid)
            except Exception:
                pass
        print("[+] Teardown complete. All processes terminated.")

if __name__ == "__main__":
    main()
