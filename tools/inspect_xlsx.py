"""Cetak daftar sheet sebuah .xlsx sebagai JSON — cepat (hanya membaca xl/workbook.xml), aman untuk file ratusan MB.
Pemakaian: python tools/inspect_xlsx.py file.xlsx"""
import json, re, sys, zipfile
from xml.sax.saxutils import unescape

with zipfile.ZipFile(sys.argv[1]) as z:
    xml = z.read("xl/workbook.xml").decode("utf-8", "replace")
names = [unescape(m, {"&quot;": '"', "&apos;": "'"}) for m in re.findall(r"<(?:\w+:)?sheet\b[^>]*?\bname=\"([^\"]*)\"", xml)]
print(json.dumps({"sheets": names}, ensure_ascii=False))
