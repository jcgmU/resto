import os,re,subprocess,json,time,glob
H=os.environ.get("WATCH_HANDOFFS") or os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","brain","Handoffs")
PANES={"planner":"w3:pF","executor":"w3:pQ","claude":"w3:pE"}
STATE="/tmp/watch-team.state.json"
seen=json.load(open(STATE)) if os.path.exists(STATE) else {}
idle={}
def status(p):
    try:
        o=subprocess.run(["herdr","agent","get",p],capture_output=True,text=True,timeout=15).stdout
        return json.loads(o[o.index("{"):])["result"]["agent"]["agent_status"]
    except Exception: return "?"
def fm(f):
    t=open(f).read(); m=re.match(r"---\n(.*?)\n---",t,re.S)
    d={}
    for l in (m.group(1) if m else "").splitlines():
        if ":" in l and not l.startswith(" "): k,v=l.split(":",1); d[k.strip()]=v.strip()
    return d
def emit(s): print(time.strftime("%H:%M"),s,flush=True)
start=time.time()
while True:
    for role,p in PANES.items():
        st=status(p)
        busy=False
        try:
            tail=subprocess.run(["herdr","pane","read",p,"--source","recent-unwrapped","--lines","6"],capture_output=True,text=True,timeout=15).stdout
            busy=bool(re.search(r"shell[s]? still running|background agent|Waiting for",tail))
        except Exception: pass
        idle[role]=idle.get(role,0)+1 if st in("idle","done") and not busy else 0
    for f in sorted(glob.glob(H+"/2026-*.md")):
        if os.path.getmtime(f)<start-7200 or time.time()-os.path.getmtime(f)<60: continue
        d=fm(f); to=d.get("para"); 
        if to not in PANES or d.get("estado") in("hecho","no-entregado") or d.get("tipo") in("aprobado","informe"): continue
        key=os.path.basename(f)+">"+to
        if seen.get(key) or idle.get(to,0)<3: continue
        seen[key]=time.time(); json.dump(seen,open(STATE,"w"))
        rel="brain/Handoffs/"+os.path.basename(f)
        if to=="claude": emit(f"PENDIENTE PARA CLAUDE (orquestador inactivo): {rel} [{d.get('tipo')}]")
        else:
            subprocess.run(["herdr","agent","prompt",PANES[to],f"Tienes un handoff sin atender: {rel}. Leelo completo y actua segun brain/Equipo/Protocolo.md"],capture_output=True,timeout=30)
            emit(f"EMPUJE a {to}: {rel} [{d.get('tipo')}] (llevaba inactivo >90 s)")
    for role in ("planner","executor"):
        if idle.get(role,0)==40: emit(f"AVISO: {role} lleva ~20 min inactivo sin handoff pendiente")
    time.sleep(30)
