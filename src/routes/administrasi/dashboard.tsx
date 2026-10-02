import { Hono } from "hono";
import { authMiddleware, adminMiddleware } from "../../middleware/auth.ts";
import {
  getDashboardSummary,
  getProgressSeries,
  getTeacherActivity,
  parseRange,
} from "../../lib/dashboard.ts";
import { DashboardPage } from "../../views/pages/DashboardPage.tsx";
import type { Env } from "../../types.ts";

const dashboard = new Hono<Env>();

dashboard.use("*", authMiddleware, adminMiddleware);

dashboard.get("/", (c) => {
  const now = new Date();
  const range = parseRange(c.req.query("rentang"));
  const teachers = getTeacherActivity(now);

  return c.html(
    <DashboardPage
      user={c.get("user")}
      range={range}
      series={getProgressSeries(range, now)}
      summary={getDashboardSummary(teachers, now)}
      teachers={teachers}
      now={now}
    />
  );
});

export { dashboard as dashboardRoutes };
