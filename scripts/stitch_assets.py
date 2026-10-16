#!/usr/bin/env python3
# Downloads images referenced by exported Stitch screens into design/stitch/assets.
# Usage: python3 scripts/stitch_assets.py design/stitch
import re, os, json, hashlib, urllib.request, glob, sys
root = sys.argv[1]
out = f"{root}/assets/images"; os.makedirs(out, exist_ok=True)
index = {}
for f in sorted(glob.glob(f"{root}/screens/*/index.html")):
    scr = f.split('/')[-2]
    for u in re.findall(r'https://lh3\.googleusercontent\.com/[^"\'\s)]+', open(f).read()):
        h = hashlib.sha1(u.encode()).hexdigest()[:12]
        e = index.setdefault(u, {"file": None, "screens": []})
        if scr not in e["screens"]: e["screens"].append(scr)
        if e["file"]: continue
        try:
            data = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent":"Mozilla/5.0"}), timeout=120).read()
        except Exception as ex:
            e["error"] = str(ex); e["file"] = "ERROR"; continue
        ext = 'png' if data[:4] == b'\x89PNG' else 'webp' if data[8:12] == b'WEBP' else 'jpg' if data[:2] == b'\xff\xd8' else 'bin'
        e["file"] = f"assets/images/{h}.{ext}"
        open(f"{root}/{e['file']}", 'wb').write(data)
        alt = re.search(r'alt="([^"]*)"[^>]*src="' + re.escape(u) + '|src="' + re.escape(u) + r'"[^>]*alt="([^"]*)"', open(f).read())
        e["alt"] = (alt.group(1) or alt.group(2)) if alt else None
json.dump([{"url": u, **v} for u, v in index.items()], open(f"{root}/assets/images.json", 'w'), indent=2)
print(len(index), "images")
for u, v in index.items(): print(v["file"], v["screens"], (v.get("alt") or "")[:80])
