#!/usr/bin/env python3
# Re-exports every screen (HTML + screenshot), the project theme and DESIGN.md
# from Google Stitch into design/stitch. Usage:
#   STITCH_API_KEY=... python3 scripts/stitch_export.py design/stitch
import json, os, re, sys, urllib.request
PID = "13101509909071158775"
OUT = sys.argv[1]
KEY = os.environ['STITCH_API_KEY']
def mcp(name, args):
    req = urllib.request.Request("https://stitch.googleapis.com/mcp",
        data=json.dumps({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":name,"arguments":args}}).encode(),
        headers={"X-Goog-Api-Key":KEY,"Content-Type":"application/json","Accept":"application/json, text/event-stream"})
    r = json.load(urllib.request.urlopen(req, timeout=120))
    if 'error' in r: raise RuntimeError(r['error'])
    return json.loads(r['result']['content'][0]['text'])
def slug(t):
    t = re.sub(r'^STREAKS\s*-\s*', '', t)
    return re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')
proj = mcp("get_project", {"name": f"projects/{PID}"})
listed = {s['name'].split('/')[-1]: s for s in mcp("list_screens", {"projectId": PID})['screens']}
inst = [i for i in proj['screenInstances'] if 'sourceScreen' in i]
manifest = []
os.makedirs(f"{OUT}/screens", exist_ok=True)
for i in inst:
    sid = i['id']
    s = listed.get(sid)
    if s is None:
        try: s = mcp("get_screen", {"name": f"projects/{PID}/screens/{sid}"})
        except Exception as e:
            manifest.append({"id": sid, "canvasLabel": i.get('label'), "error": str(e)}); continue
    title = s.get('title') or i.get('label') or sid
    sl = slug(title)
    d = f"{OUT}/screens/{sl}"
    if os.path.exists(d): sl = f"{sl}-{sid[:6]}"; d = f"{OUT}/screens/{sl}"
    os.makedirs(d, exist_ok=True)
    files = {}
    for key, fn in (('htmlCode','index.html'),('screenshot','screenshot.png')):
        u = (s.get(key) or {}).get('downloadUrl')
        if not u: continue
        if key == 'screenshot' and 'googleusercontent' in u and '=' not in u.split('/')[-1]: u += '=s0'
        try:
            data = urllib.request.urlopen(u, timeout=120).read()
            open(f"{d}/{fn}", 'wb').write(data); files[key] = fn
        except Exception as e: files[key+'_error'] = str(e)
    manifest.append({"id": sid, "slug": sl, "title": title, "canvasLabel": i.get('label'),
        "inListScreens": sid in listed, "width": s.get('width'), "height": s.get('height'),
        "deviceType": s.get('deviceType'), "canvas": {"x": i.get('x',0), "y": i.get('y',0)}, "files": files})
    print(sl, files, flush=True)
proj_out = {k: v for k, v in proj.items() if k not in ('screenInstances','thumbnailScreenshot')}
json.dump(proj_out, open(f"{OUT}/project.json",'w'), indent=2)
open(f"{OUT}/DESIGN.md",'w').write(proj['designTheme']['designMd'])
manifest.sort(key=lambda m: (m.get('canvas',{}).get('y',0), m.get('canvas',{}).get('x',0)))
json.dump({"projectId": PID, "title": proj['title'], "screenCount": len(manifest), "screens": manifest}, open(f"{OUT}/manifest.json",'w'), indent=2)
print("TOTAL", len(manifest), "listed", len(listed))
