"""Exercise first-run registration and a saved case across a real Windows restart."""

import ctypes
from http.cookiejar import CookieJar
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tempfile
import time
from urllib.request import HTTPCookieProcessor, ProxyHandler, Request, build_opener


def interrupt_private_console(process_id):
    # A separate helper attaches only to the console created below. A Ctrl+C
    # event targets every process in that console, just as typing Ctrl+C does.
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.FreeConsole()
    if not kernel.AttachConsole(process_id):
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        if not kernel.SetConsoleCtrlHandler(None, True):
            raise ctypes.WinError(ctypes.get_last_error())
        if not kernel.GenerateConsoleCtrlEvent(0, 0):
            raise ctypes.WinError(ctypes.get_last_error())
        time.sleep(0.25)
    finally:
        kernel.FreeConsole()


def wait_for_start(process, log):
    deadline = time.monotonic() + 540
    while time.monotonic() < deadline:
        output = log.read_text(errors="replace")
        if process.poll() is not None:
            raise RuntimeError(f"npm run dev exited during startup.\n{output}")
        match = re.search(r"Local:\s*(http://127\.0\.0\.1:\d+/)", re.sub(r"\x1b\[[\d;]*m", "", output))
        if match:
            return match.group(1)
        time.sleep(0.4)
    raise TimeoutError(f"Waiting for the local application timed out.\n{output}")


def run_once(profile, log, credentials, existing_case=None):
    environment = dict(os.environ, FORENSIQ_LOCAL_DIR=str(profile), CI="1", NO_COLOR="1")
    command = [os.environ["ComSpec"], "/d", "/c", "npm.cmd run dev"]
    opener = build_opener(ProxyHandler({}), HTTPCookieProcessor(CookieJar()))
    with log.open("wb") as output:
        launcher = subprocess.Popen(
            command, env=environment, stdin=subprocess.DEVNULL, stdout=output,
            stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NEW_CONSOLE,
        )
    try:
        url = wait_for_start(launcher, log)

        def api(route, body=None):
            request = Request(url + 'api/' + route,
                              data=json.dumps(body).encode() if body is not None else None,
                              headers={'Content-Type': 'application/json', 'X-Forensiq-Request': '1'})
            with opener.open(request, timeout=10) as response:
                return json.load(response)

        assert api('health')['status'] == 'ok'
        with opener.open(url, timeout=10) as response:
            assert b'FORENSIQ' in response.read()
        if existing_case is None:
            assert api('auth/register', {'name': 'CI operator', **credentials})['role'] == 'admin'
            existing_case = api('cases', {'title': 'CI persistence', 'priority': 'medium'})['id']
        else:
            assert api('auth/login', credentials)['role'] == 'admin'
            assert api('cases/' + existing_case)['title'] == 'CI persistence'
        api('auth/logout', {})
        with (profile / 'forensiq.sqlite3').open('rb') as database:
            assert database.read(16) == b'SQLite format 3\x00'
        return existing_case
    finally:
        if launcher.poll() is None:
            subprocess.run([sys.executable, __file__, "--interrupt", str(launcher.pid)], check=True)
            launcher.wait(timeout=90)


if __name__ == "__main__":
    if sys.platform != "win32" or os.getenv("GITHUB_ACTIONS") != "true":
        raise SystemExit("Run this test on a disposable Windows GitHub Actions runner.")
    if sys.argv[1:2] == ["--interrupt"]:
        interrupt_private_console(int(sys.argv[2]))
    else:
        with tempfile.TemporaryDirectory(prefix="FORENSIQ Windows check ", dir=os.environ["RUNNER_TEMP"]) as temp:
            root = Path(temp).resolve()
            profile = root / "Persistent profile"
            credentials = {'email': 'ci@example.test', 'password': secrets.token_urlsafe(22)}
            case_id = run_once(profile, root / "first.log", credentials)
            subprocess.run([os.environ["ComSpec"], "/d", "/c", "npm.cmd ci"], check=True)
            run_once(profile, root / "restart.log", credentials, case_id)
            print("SQLite registration, case creation, reinstall and restart passed.")
