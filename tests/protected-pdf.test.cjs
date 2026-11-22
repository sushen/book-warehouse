const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
test("preview contains only first ten percent and preserves page size", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bw-pdf-test-")),
    source = path.join(dir, "source.pdf"),
    preview = path.join(dir, "preview.pdf");
  try {
    execFileSync(
      "python",
      [
        "-c",
        "import pymupdf,sys; d=pymupdf.open(); [(lambda p,i: p.insert_text((40,80),'FICTIONAL PAGE '+str(i)))(d.new_page(width=420,height=595),i) for i in range(1,21)]; d.save(sys.argv[1])",
        source,
      ],
      { windowsHide: true },
    );
    const info = JSON.parse(
      execFileSync(
        "python",
        [
          path.resolve(__dirname, "../protected/process_pdf.py"),
          source,
          preview,
          "10",
        ],
        { encoding: "utf8", windowsHide: true },
      ),
    );
    assert.equal(info.pageCount, 20);
    assert.equal(info.previewPages, 2);
    const result = JSON.parse(
      execFileSync(
        "python",
        [
          "-c",
          "import pymupdf,sys,json;d=pymupdf.open(sys.argv[1]);print(json.dumps({'pages':len(d),'width':d[0].rect.width,'text':''.join(p.get_text() for p in d)}))",
          preview,
        ],
        { encoding: "utf8", windowsHide: true },
      ),
    );
    assert.equal(result.pages, 2);
    assert.equal(result.width, 420);
    assert.match(result.text, /PAGE 2/);
    assert.doesNotMatch(result.text, /PAGE 3/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("a one-page book is not exposed as a minimum one-page preview", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bw-short-pdf-")),
    source = path.join(dir, "one.pdf"),
    preview = path.join(dir, "preview.pdf");
  try {
    execFileSync(
      "python",
      [
        "-c",
        "import pymupdf,sys;d=pymupdf.open();d.new_page();d.save(sys.argv[1])",
        source,
      ],
      { windowsHide: true },
    );
    const result = JSON.parse(
      execFileSync(
        "python",
        [
          path.resolve(__dirname, "../protected/process_pdf.py"),
          source,
          preview,
          "10",
        ],
        { encoding: "utf8", windowsHide: true },
      ),
    );
    assert.equal(result.previewPages, 0);
    assert.equal(fs.existsSync(preview), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
