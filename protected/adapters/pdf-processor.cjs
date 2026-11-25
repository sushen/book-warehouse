"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
class PdfProcessor {
  constructor({
    workingDirectory,
    python = "python",
    script = path.resolve(__dirname, "../process_pdf.py"),
  }) {
    this.workingDirectory = workingDirectory;
    this.python = python;
    this.script = script;
  }
  async withSource(data, work) {
    const directory = await fs.mkdtemp(
      path.join(this.workingDirectory, "processing-"),
    );
    try {
      const source = path.join(directory, "source.pdf");
      await fs.writeFile(source, data);
      return await work({ source, directory });
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  }
  async createPreview(data, percentage) {
    return this.withSource(data, async ({ source, directory }) => {
      const output = path.join(directory, "preview.pdf");
      const result = await promisify(execFile)(
        this.python,
        [this.script, source, output, String(percentage)],
        { timeout: 60000, maxBuffer: 65536, windowsHide: true },
      );
      const info = JSON.parse(result.stdout);
      return {
        info,
        preview: info.previewPages ? await fs.readFile(output) : null,
      };
    });
  }
  async renderPage(data, page) {
    return this.withSource(data, async ({ source, directory }) => {
      const output = path.join(directory, "page.png");
      await promisify(execFile)(
        this.python,
        [this.script, source, output, "--page", String(page)],
        { timeout: 30000, maxBuffer: 65536, windowsHide: true },
      );
      return fs.readFile(output);
    });
  }
}
module.exports = { PdfProcessor };
