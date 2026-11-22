"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path");
const {
  randomBytes,
  createCipheriv,
  createDecipheriv,
} = require("node:crypto");
class EncryptedFileStore {
  constructor(root, key) {
    if (!Buffer.isBuffer(key) || key.length !== 32)
      throw new Error("A 256-bit server key is required");
    this.root = path.resolve(root);
    this.key = key;
  }
  static async local(root) {
    await fs.mkdir(root, { recursive: true });
    const filename = path.join(root, "local-master.key");
    let key;
    try {
      key = await fs.readFile(filename);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      key = randomBytes(32);
      await fs.writeFile(filename, key, { flag: "wx", mode: 0o600 });
    }
    return new EncryptedFileStore(root, key);
  }
  path(id, version, part) {
    if (
      !/^[A-Za-z0-9_-]{1,128}$/.test(id) ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(version) ||
      !["encrypted", "preview.pdf"].includes(part)
    )
      throw new Error("Invalid private file reference");
    return path.join(this.root, id, `${version}.${part}`);
  }
  async writeOriginal(id, version, data) {
    const nonce = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, nonce);
    cipher.setAAD(Buffer.from(`${id}:${version}`));
    const sealed = Buffer.concat([
      nonce,
      cipher.update(data),
      cipher.final(),
      cipher.getAuthTag(),
    ]);
    await fs.mkdir(path.join(this.root, id), { recursive: true });
    await fs.writeFile(this.path(id, version, "encrypted"), sealed);
  }
  async readOriginal(id, version) {
    const data = await fs.readFile(this.path(id, version, "encrypted")),
      decipher = createDecipheriv(
        "aes-256-gcm",
        this.key,
        data.subarray(0, 12),
      );
    decipher.setAAD(Buffer.from(`${id}:${version}`));
    decipher.setAuthTag(data.subarray(-16));
    return Buffer.concat([
      decipher.update(data.subarray(12, -16)),
      decipher.final(),
    ]);
  }
  async writePreview(id, version, data) {
    await fs.writeFile(this.path(id, version, "preview.pdf"), data);
  }
  async readPreview(id, version) {
    return fs.readFile(this.path(id, version, "preview.pdf"));
  }
}
module.exports = { EncryptedFileStore };
