/** Frontend API adapter; no book, payment or permission rules live here. */
export class ProtectedBooksClient {
  constructor({ origin, getUser, fetcher = fetch }) {
    this.origin = origin;
    this.getUser = getUser;
    this.fetcher = fetcher.bind(globalThis);
  }
  async request(
    route,
    { body, method = "GET", raw = false, binary = false } = {},
  ) {
    const headers = {},
      user = this.getUser(),
      uid = user?.uid;
    if (user) headers.Authorization = "Bearer " + (await user.getIdToken());
    if (this.getUser()?.uid !== uid) throw new Error("identity-changed");
    if (body)
      headers["Content-Type"] = raw ? "application/pdf" : "application/json";
    const response = await this.fetcher(this.origin + "/api" + route, {
      method,
      headers,
      body: body ? (raw ? body : JSON.stringify(body)) : undefined,
      cache: "no-store",
    });
    if (this.getUser()?.uid !== uid) throw new Error("identity-changed");
    if (!response.ok) {
      const result = await response
        .json()
        .catch(() => ({ error: "request-failed" }));
      throw new Error(result.error || "request-failed");
    }
    const result = await (binary ? response.blob() : response.json());
    if (this.getUser()?.uid !== uid) throw new Error("identity-changed");
    return result;
  }
}
