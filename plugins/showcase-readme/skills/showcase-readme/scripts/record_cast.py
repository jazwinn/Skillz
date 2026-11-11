import argparse
import codecs
import json
import os
import random
import subprocess
import sys
import threading
import time


def main():
    p = argparse.ArgumentParser(description="Record a program's terminal output as an asciinema v2 cast.")
    p.add_argument("--out", required=True)
    p.add_argument("--cwd", default=".")
    p.add_argument("--wait", default="> ", help="text that signals the program is ready for the next --send")
    p.add_argument("--send", action="append", default=[], help="line to type once --wait appears; repeatable")
    p.add_argument("--reply-marker", default=None, help="text that marks the start of a streamed reply")
    p.add_argument("--max-idle", type=float, default=5.0,
                   help="compress gaps longer than this; keep it above the per-token interval")
    p.add_argument("--cols", type=int, default=76)
    p.add_argument("--rows", type=int, default=22)
    p.add_argument("--timeout", type=float, default=900)
    p.add_argument("--type-delay", type=float, default=0.045)
    p.add_argument("cmd", nargs=argparse.REMAINDER)
    a = p.parse_args()
    cmd = a.cmd[1:] if a.cmd and a.cmd[0] == "--" else a.cmd
    if not cmd:
        p.error("program command required after --")

    candidate = os.path.join(a.cwd, cmd[0])
    if os.path.exists(candidate):
        cmd[0] = os.path.abspath(candidate)
    env = dict(os.environ, TERM="xterm-256color", COLUMNS=str(a.cols), LINES=str(a.rows))
    proc = subprocess.Popen(cmd, cwd=a.cwd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, bufsize=0, env=env)
    start = time.perf_counter()
    events = []
    lock = threading.Lock()
    seen = bytearray()

    def reader():
        fd = proc.stdout.fileno()
        while True:
            chunk = os.read(fd, 65536)
            if not chunk:
                break
            t = time.perf_counter() - start
            with lock:
                events.append([t, "o", chunk])
                seen.extend(chunk)

    th = threading.Thread(target=reader, daemon=True)
    th.start()

    wait = a.wait.encode()
    marker = a.reply_marker.encode() if a.reply_marker else None
    stats = []
    search_from = 0
    deadline = start + a.timeout

    def wait_for(token, from_pos):
        while time.perf_counter() < deadline:
            with lock:
                idx = seen.find(token, from_pos)
            if idx >= 0:
                return idx + len(token)
            if proc.poll() is not None and not th.is_alive():
                return -1
            time.sleep(0.01)
        return -1

    for line in a.send:
        pos = wait_for(wait, search_from)
        if pos < 0:
            print("timed out or program exited waiting for prompt marker", file=sys.stderr)
            break
        time.sleep(0.6)
        for ch in line:
            with lock:
                events.append([time.perf_counter() - start, "o", ch.encode()])
            time.sleep(max(0.01, random.gauss(a.type_delay, a.type_delay / 3)))
        with lock:
            events.append([time.perf_counter() - start, "o", b"\r\n"])
            search_from = len(seen)
        sent_at = time.perf_counter() - start
        proc.stdin.write((line + "\n").encode())
        proc.stdin.flush()
        if marker and not line.startswith("/"):
            first = wait_for(marker, search_from)
            if first < 0:
                break
            with lock:
                t_first = next((e[0] for e in events if e[0] >= sent_at and marker in e[2]),
                               events[-1][0])
            done = wait_for(wait, first)
            with lock:
                t_done = events[-1][0]
                chunks = [e for e in events if e[0] > t_first and e[0] <= t_done]
            stats.append({
                "prompt": line,
                "ttft_s": round(t_first - sent_at, 3),
                "stream_s": round(t_done - t_first, 3),
                "chunks": len(chunks),
                "ms_per_chunk": round(1000 * (t_done - t_first) / max(1, len(chunks)), 1),
            })
            search_from = first

    try:
        proc.stdin.close()
    except OSError:
        pass
    try:
        proc.wait(timeout=60)
    except subprocess.TimeoutExpired:
        proc.kill()
    th.join(timeout=5)

    events.sort(key=lambda e: e[0])
    out = []
    shift = 0.0
    prev = 0.0
    compressed = []
    decoder = codecs.getincrementaldecoder("utf-8")("replace")
    for t, kind, data in events:
        gap = t - prev
        if gap > a.max_idle:
            shift += gap - a.max_idle
            compressed.append({"at_s": round(prev, 2), "real_gap_s": round(gap, 2)})
        prev = t
        text = decoder.decode(data)
        if text:
            out.append([round(t - shift, 4), kind, text])

    header = {"version": 2, "width": a.cols, "height": a.rows, "timestamp": int(time.time()),
              "env": {"TERM": "xterm-256color"}, "command": " ".join(cmd),
              "compressed_gaps": compressed, "stats": stats}
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        f.write(json.dumps(header) + "\n")
        for e in out:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")
    print(json.dumps({"events": len(out), "real_duration_s": round(prev, 2),
                      "cast_duration_s": round(prev - shift, 2), "compressed_gaps": compressed[:10],
                      "compressed_gap_count": len(compressed),
                      "stats": stats, "exit_code": proc.returncode}, indent=2))


if __name__ == "__main__":
    main()
