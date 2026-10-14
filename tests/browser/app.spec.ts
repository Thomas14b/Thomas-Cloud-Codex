import { test, expect } from "@playwright/test";
const uid = "11111111-1111-4111-8111-111111111111";
const profile = {
  id: uid,
  display_name: "測試同學",
  email: "test@example.test",
  credits: 100,
  is_admin: true,
  created_at: "2026-10-14T10:00:00Z",
};
const missions = [
  {
    id: "HK027",
    title: "茶記怪菜單",
    family: "歪歪貓",
    description: "三分鐘內設計一款荒誕茶記菜式，保留第一稿。",
    question: "你最想修改哪一部分？",
    rarity: "Common",
    duo: false,
    supply: null,
    active: true,
  },
];
// Transport fixtures exercise UI states only. SQL behavior is verified separately by database.test.mjs.
async function login(page: any) {
  const token =
    "test." +
    Buffer.from(
      JSON.stringify({ sub: uid, exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString("base64url") +
    ".fixture";
  await page
    .context()
    .addCookies([
      { name: "nf_jwt", value: token, url: "http://127.0.0.1:4174" },
    ]);
  await page.route("**/.netlify/identity/**", async (route: any) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: uid,
        email: profile.email,
        user_metadata: { full_name: profile.display_name },
        app_metadata: { roles: ["admin"] },
      }),
    }),
  );
  let attempt: any = null;
  await page.route("**/api/**", async (route: any) => {
    const u = new URL(route.request().url()),
      path =
        u.pathname === "/api/game"
          ? "/" +
            (route.request().postDataJSON().name ||
              route.request().postDataJSON().table)
          : u.pathname;
    let data: any = [];
    if (path === "/auth/v1/user") data = { id: uid, email: profile.email };
    else if (path.endsWith("/profiles")) data = [profile];
    else if (path.endsWith("/missions")) data = missions;
    else if (path.endsWith("/attempts")) data = attempt ? [attempt] : [];
    else if (path.endsWith("/reserve_mission")) {
      attempt = {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        player_id: uid,
        mission_id: "HK027",
        state: "reserved",
        invite: "invite",
        expires_at: "2099-01-01",
        created_at: "2026-10-14",
        completed_at: null,
      };
      data = attempt.id;
    } else if (path.endsWith("/submit_attempt")) {
      attempt.state = "completed";
      data = null;
    } else if (path.endsWith("/admin_overview"))
      data = {
        players: 1,
        completed: 1,
        pending: 0,
        feedback: 1,
        reflections: 1,
        redemptions: 0,
        families: [{ family: "歪歪貓", completed: 1 }],
        activity: [{ day: "2026-10-14", completed: 1 }],
      };
    else if (path.endsWith("/admin_players"))
      data = {
        total: 1,
        players: [{ ...profile, completed: 1, pending: 0, feedback_count: 1 }],
      };
    else if (path.endsWith("/admin_player_detail"))
      data = {
        profile,
        attempts: [],
        reflections: [],
        feedback: [{ body: "任務好有趣", created_at: "2026-10-14" }],
        cards: [],
        redemptions: [],
      };
    else if (path.endsWith("/admin_inputs"))
      data = {
        total: 1,
        inputs: [
          {
            id: "1",
            player_id: uid,
            display_name: profile.display_name,
            body: "想多試幾個任務",
            created_at: "2026-10-14",
            mission_id: null,
          },
        ],
      };
    else if (path.endsWith("/bobo"))
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "波波的 AI 服務尚未設定，請聯絡管理員",
        }),
      });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
}
test("login page has labelled controls and no horizontal overflow on phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "歡迎返嚟，同學。" }),
  ).toBeVisible();
  await expect(page.getByLabel("電郵", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/login-mobile.png",
    fullPage: true,
  });
});
test("player reserves and submits a mission through API, then sees success", async ({
  page,
}) => {
  await login(page);
  await page.goto("/?mission=HK027");
  await page.getByRole("button", { name: "開始任務", exact: true }).click();
  await page.getByLabel("我的感受與發現").fill("第一稿唔完美，但我肯試。");
  await page.getByRole("button", { name: "記錄今次嘗試" }).click();
  await expect(page.getByText("這次勇敢，已經被記住。")).toBeVisible();
});
test("admin sees player information, details, feedback and usable mobile layout", async ({
  page,
}) => {
  await login(page);
  await page.goto("/");
  await page.getByRole("button", { name: "管理儀表板" }).click();
  await expect(
    page.getByRole("heading", { name: "看見每一位同學的成長。" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell").filter({ hasText: "test@example.test" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "查看", exact: true }).click();
  await expect(page.getByText("任務好有趣")).toBeVisible();
  await page.getByRole("button", { name: "← 返回列表" }).click();
  await page.getByRole("tab", { name: "玩家回饋" }).click();
  await expect(page.getByText("想多試幾個任務")).toBeVisible();
  await page.screenshot({
    path: "test-results/admin-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/admin-mobile.png",
    fullPage: true,
  });
});
test("AI failure is explicit and preserves typed input", async ({ page }) => {
  await login(page);
  await page.goto("/");
  await page.getByRole("button", { name: "波波 AI" }).click();
  await page.getByRole("checkbox").check();
  await page.getByLabel("想同波波講的話").fill("今日試咗一件新事");
  await page.getByRole("button", { name: "送出", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("尚未設定");
  await expect(page.getByLabel("想同波波講的話")).toHaveValue(
    "今日試咗一件新事",
  );
});
test("home is usable at desktop and mobile sizes", async ({ page }) => {
  await login(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "今日，想試啲咩？" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("navigation", { name: "手機導覽" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
