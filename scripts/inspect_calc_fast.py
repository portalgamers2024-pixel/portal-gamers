import openpyxl, warnings
warnings.simplefilter("ignore")

path = r"C:\Users\leand\Downloads\Libro 1.xlsx"
wb = openpyxl.load_workbook(path, data_only=False, read_only=True)
ws = wb["CALCULADORA"]

print("=== CALCULADORA top 60 rows, cols A..N (formulas preserved) ===")
r = 0
for row in ws.iter_rows(min_row=1, max_row=60, max_col=14, values_only=True):
    r += 1
    cells = ["" if v is None else str(v)[:16] for v in row]
    if any(x.strip() for x in cells):
        print(f"R{r:>3}: " + " | ".join(cells))
wb.close()
