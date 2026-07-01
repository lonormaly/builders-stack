// throwaway boot stub — real libs/db (Drizzle) built in parallel
const rows = [];
const thenable = (v) => ({ then: (r) => r(v) });
export const posts = { __table: true };
export function eq(_col, val) {
  return { val };
}
export const db = {
  select() {
    return {
      from() {
        return {
          where(p) {
            return thenable(rows.filter((r) => r.id === p.val));
          },
          then(res) {
            return res(rows.slice());
          },
        };
      },
    };
  },
  insert() {
    return {
      values(v) {
        const row = {
          id: "p_" + Math.random().toString(36).slice(2, 8),
          createdAt: new Date(),
          published: false,
          ...v,
        };
        return {
          returning() {
            rows.push(row);
            return thenable([row]);
          },
        };
      },
    };
  },
  update() {
    return {
      set(p) {
        return {
          where(pred) {
            return {
              returning() {
                const row = rows.find((r) => r.id === pred.val);
                if (row) Object.assign(row, p);
                return thenable(row ? [row] : []);
              },
            };
          },
        };
      },
    };
  },
  delete() {
    return {
      where(pred) {
        return {
          returning() {
            const i = rows.findIndex((r) => r.id === pred.val);
            const rm = i >= 0 ? rows.splice(i, 1) : [];
            return thenable(rm);
          },
        };
      },
    };
  },
};
