export const auth = {
  async handler(req) {
    return new Response(JSON.stringify({ ok: true, path: new URL(req.url).pathname }), {
      headers: { "content-type": "application/json" },
    });
  },
  api: {
    async getSession() {
      return null;
    },
  },
};
