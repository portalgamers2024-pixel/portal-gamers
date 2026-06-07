import json, sys
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass

m = json.load(open(r"C:\Users\leand\portal-gamers\data\migration.json", encoding="utf-8"))

def show(src, rmin, rmax, cmax=12):
    t = m["tabs"][src]
    print(f"\n=== {src} -> {t['target']}  (rows={t['rows']}, cols={t['cols']}) ===")
    for i in range(rmin-1, min(rmax, len(t["values"]))):
        row = t["values"][i]
        cells = []
        for j,c in enumerate(row[:cmax]):
            if c is not None and str(c).strip()!="":
                col = chr(65+j) if j<26 else "A"+chr(65+j-26)
                cells.append(f"{col}{i+1}={str(c)[:24]}")
        if cells: print("  " + "  ".join(cells))

# Formulado: check CALCULADORA refs rewritten
show("Formulado", 4, 7, 9)
# STOCKS: header + first rows to confirm ESTADO VENTA column
show("STOCKS", 1, 7, 11)
# CALCULADORA left block sample
show("CALCULADORA", 7, 9, 14)
