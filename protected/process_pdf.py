"""Local publishing automation: preserve pages, extract only preview pages.

Never called on an untrusted remote path. The Node service supplies private temporary files.
"""
import json, math, sys
import pymupdf

source, target = sys.argv[1], sys.argv[2]
with pymupdf.open(source) as book:
    if book.needs_pass or len(book) < 1 or len(book) > 1500:
        raise ValueError('Unsupported, encrypted, empty or oversized PDF')
    if any(p.rect.width*p.rect.height > 4_000_000 for p in book):
        raise ValueError('Page dimensions exceed the local rendering limit')
    if sys.argv[3] == '--page':
        page_number = int(sys.argv[4])
        if page_number < 1 or page_number > len(book):
            raise ValueError('Invalid page')
        book[page_number-1].get_pixmap(matrix=pymupdf.Matrix(1.5,1.5), alpha=False).save(target)
        print(json.dumps({'page':page_number}))
        sys.exit(0)
    percent = int(sys.argv[3])
    # Round down so preview never exceeds the chosen percentage. A very short
    # book can have no preview pages; the UI must say so instead of leaking it.
    count = min(len(book)-1, math.floor(len(book)*percent/100))
    if count:
        preview = pymupdf.open()
        preview.insert_pdf(book, from_page=0, to_page=count-1, links=False, annots=False)
        preview.set_metadata({})
        preview.save(target, garbage=4, deflate=True)
        preview.close()
    print(json.dumps({'pageCount':len(book),'previewPages':count}))
