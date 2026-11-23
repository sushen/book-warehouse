"""Prepare an owner-supplied PDF for a rule-protected Firestore upload.

This is local publishing automation, not a web backend or application database.
Keep output outside the website and upload through the signed-in admin form.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path

import pymupdf

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--book-id', required=True)
parser.add_argument('--sha256', required=True)
parser.add_argument('--price', type=int, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
raw = args.source.read_bytes()
sha = hashlib.sha256(raw).hexdigest()
if sha != args.sha256 or not 1 <= args.price <= 1000000:
    raise SystemExit('Source fingerprint or price is invalid.')
if Path(__file__).resolve().parent.parent in args.output.resolve().parents:
    raise SystemExit('Keep the protected package outside the website tree.')
pdf = pymupdf.open(args.source)
if not 1 <= len(pdf) <= 1500 or pdf.is_encrypted:
    raise SystemExit('Unsupported page count or encrypted input.')
pages = []
for page in pdf:
    scale = 1.35
    while True:
        pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
        data = pix.tobytes('jpeg', jpg_quality=88)
        if len(data) < 600000:
            break
        scale *= .8
    pages.append({'mimeType': 'image/jpeg', 'base64': base64.b64encode(data).decode()})
package = {'format': 'bw-firestore-pdf-v1', 'bookId': args.book_id, 'sha256': sha,
           'priceCredits': args.price, 'pages': pages,
           'chunks': [base64.b64encode(raw[i:i+450000]).decode()
                      for i in range(0, len(raw), 450000)]}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(package), encoding='utf-8')
print(f'Prepared {len(pages)} pages. Free preview: {len(pages) // 10}.')
