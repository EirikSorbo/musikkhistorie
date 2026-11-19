// ============================================================================
//  LYTTEEKSEMPLENE I EN KJØREPLAN (v7.49), i emulatoren
// ----------------------------------------------------------------------------
//  ← spiller et lytteeksempel-stopp igjen når læreren går tilbake fra kortet
//  etter (før ble videoen hoppet over), og lerretet følger med når to
//  lytteeksempler kommer rett etter hverandre (Björk-paret i uke 47-timen,
//  det andre med en YouTube-mix på lista).
//
//  YouTube er byttet ut med en liten etterligning av iframe-API-et (YT.Player
//  med onReady, onStateChange, playVideo og resten spilleren bruker), og
//  innbyggingen med en tom side. Ingen trafikk går til YouTube.
// ============================================================================
import { test, expect } from "@playwright/test";
import { såFrø, skrivDok, rydd } from "./frø.mjs";
import { forbered, apne, loggInnSomLaerer, appFeil } from "./hjelp.mjs";

const A = "yt:6CSiU0j_lFA::70";
const B = "yt:Cny3XX2-2Mc:RDCny3XX2-2Mc:260";

const PLANER = {
  pv: {
    tittel: "Uke 47", laget: "2026-11-19T10:00:00.000Z",
    stopp: [{ vis: "artist:muddy" }, { vis: A }, { vis: "artist:bessie" }, { vis: B }],
  },
  pl: {
    tittel: "To på rad", laget: "2026-11-19T11:00:00.000Z",
    stopp: [{ vis: "artist:muddy" }, { vis: A }, { vis: B }, { vis: "artist:bessie" }],
  },
};

// Etterligningen av YouTubes iframe-API. window.__yt logger spillerne som
// lages, startes og fjernes, så testen ser hva lerretet faktisk gjorde.
const FALSK_YT = `(() => {
  window.__yt = { laget: [], spilt: [], fjernet: [] };
  const idFra = (el) => { try { return new URL(el.src).pathname.split("/").pop(); } catch (e) { return null; } };
  class Player {
    constructor(el, o) {
      this.el = typeof el === "string" ? document.getElementById(el) : el;
      this.ev = (o && o.events) || {};
      this.state = -1; this.t0 = null; this.vol = 100; this.muted = false; this.dead = false;
      this.id = idFra(this.el);
      try { this.tid = Number(new URL(this.el.src).searchParams.get("start")) || 0; } catch (e) { this.tid = 0; }
      window.__yt.laget.push(this.id);
      setTimeout(() => { if (!this.dead && this.ev.onReady) this.ev.onReady({ target: this }); }, 40);
    }
    _sett(s) { this.state = s; setTimeout(() => { if (!this.dead && this.ev.onStateChange) this.ev.onStateChange({ data: s, target: this }); }, 0); }
    playVideo() {
      if (this.dead) return;
      window.__yt.spilt.push(this.id);
      this.t0 = performance.now();
      this._sett(3);
      setTimeout(() => { if (!this.dead && this.state === 3) this._sett(1); }, 60);
    }
    pauseVideo() { if (this.state === 1 || this.state === 3) { this.tid = this.getCurrentTime(); this.t0 = null; this._sett(2); } }
    getPlayerState() { return this.state; }
    getCurrentTime() { return this.tid + (this.state === 1 && this.t0 ? (performance.now() - this.t0) / 1000 : 0); }
    getDuration() { return 600; }
    seekTo(s) { this.tid = s; if (this.t0) this.t0 = performance.now(); }
    getVolume() { return this.vol; }
    setVolume(v) { this.vol = v; }
    mute() { this.muted = true; }
    unMute() { this.muted = false; }
    isMuted() { return this.muted; }
    getVideoData() { return { video_id: this.id }; }
    destroy() { this.dead = true; window.__yt.fjernet.push(this.id); }
  }
  window.YT = { Player };
  setTimeout(() => { if (window.onYouTubeIframeAPIReady) window.onYouTubeIframeAPIReady(); }, 0);
})();`;

async function falskYouTube(context) {
  await context.route("https://www.youtube.com/iframe_api", (r) => r.fulfill({ contentType: "text/javascript", body: FALSK_YT }));
  await context.route("https://www.youtube-nocookie.com/**", (r) => r.fulfill({ contentType: "text/html", body: "<!doctype html><body style='background:#000'></body>" }));
}

test.beforeEach(async () => {
  await såFrø();
  await skrivDok("content", "presentasjoner", { planer: PLANER });
});
test.afterAll(async () => { await rydd(); });

const teller = (page) => page.locator("#pres-teller");
const video = (page) => page.locator("#modal-yt");

test("← spiller lytteeksempel-stoppet igjen, også fra oppsummeringen, og går fra en video oppå kortet til kortet", async ({ page }) => {
  await falskYouTube(page.context());
  const feil = await forbered(page, { rolle: "teacher" });
  await loggInnSomLaerer(page);
  await apne(page, "/index.html?presentasjon=pv");
  await expect(teller(page)).toHaveText("Oversikt");

  // Gjennom planen med →: Muddy, video A, Bessie, video B, oppsummeringen.
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#modal-detail")).toContainText("Muddy Waters");
  await page.keyboard.press("ArrowRight");
  await expect(video(page)).toHaveClass(/open/);
  await expect(video(page)).toHaveAttribute("data-vis", A);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#modal-detail")).toContainText("Bessie Smith");
  await expect(video(page)).not.toHaveClass(/open/);
  await page.keyboard.press("ArrowRight");
  await expect(video(page)).toHaveAttribute("data-vis", B);
  await expect(video(page)).toHaveClass(/open/);
  await page.keyboard.press("ArrowRight");
  await expect(teller(page)).toHaveText("Oppsummering");

  // Tilbake med ←: hvert stopp, videoene også.
  await page.keyboard.press("ArrowLeft");
  await expect(video(page)).toHaveClass(/open/);
  await expect(video(page)).toHaveAttribute("data-vis", B);
  await expect(teller(page)).toHaveText("4/4");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#modal-detail")).toContainText("Bessie Smith");
  await expect(video(page)).not.toHaveClass(/open/);
  await page.keyboard.press("ArrowLeft");
  await expect(video(page)).toHaveClass(/open/);
  await expect(video(page)).toHaveAttribute("data-vis", A);
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#modal-detail")).toContainText("Muddy Waters");
  await expect(video(page)).not.toHaveClass(/open/);
  // Og fram igjen.
  await page.keyboard.press("ArrowRight");
  await expect(video(page)).toHaveAttribute("data-vis", A);
  await expect(video(page)).toHaveClass(/open/);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#modal-detail")).toContainText("Bessie Smith");

  // Et lytteeksempel spilt oppå kortet (L): ← går til kortet, ikke til siden før.
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#modal-detail")).toContainText("Muddy Waters");
  await page.keyboard.press("l");
  await expect(video(page)).toHaveClass(/open/);
  await expect(video(page)).toHaveAttribute("data-vis", "yt:abcdefghijk");
  await page.keyboard.press("ArrowLeft");
  await expect(video(page)).not.toHaveClass(/open/);
  await expect(page.locator("#modal-detail")).toHaveClass(/open/);
  await expect(page.locator("#modal-detail")).toContainText("Muddy Waters");
  expect(appFeil(feil)).toEqual([]);
});

test("lerretet: to lytteeksempler rett etter hverandre, det andre med en mix på lista", async ({ page }) => {
  await falskYouTube(page.context());
  const feil = await forbered(page, { rolle: "teacher" });
  await loggInnSomLaerer(page);
  await apne(page, "/index.html?presentasjon=pl");
  await expect(teller(page)).toHaveText("Oversikt");

  const [lerret] = await Promise.all([page.context().waitForEvent("page"), page.locator("#pres-lerret").click()]);
  const lerretFeil = [];
  lerret.on("pageerror", (e) => lerretFeil.push(String(e?.message || e)));
  lerret.on("console", (m) => { if (m.type() === "error") lerretFeil.push(m.text()); });
  await lerret.waitForLoadState();
  await expect(page.locator("#pres-lerret")).toHaveClass(/aktiv/);

  const lerretVideo = video(lerret);
  await page.bringToFront();
  await page.keyboard.press("ArrowRight");
  await expect(lerret.locator("#modal-detail")).toContainText("Muddy Waters");

  // Video A på begge skjermene, og bildet tones inn på lerretet.
  await page.keyboard.press("ArrowRight");
  await expect(video(page)).toHaveAttribute("data-vis", A);
  await expect(lerretVideo).toHaveClass(/open/);
  await expect(lerretVideo).toHaveAttribute("data-vis", A);
  await expect(lerret.locator("#yt-iframe")).toHaveAttribute("src", /6CSiU0j_lFA.*start=70/);
  await expect(lerret.locator("#yt-svart")).toHaveAttribute("style", /opacity: 0/);
  await lerret.waitForTimeout(1200);

  // Rett videre til video B (samme spiller, mix på lista).
  await page.keyboard.press("ArrowRight");
  await expect(video(page)).toHaveAttribute("data-vis", B);
  await expect(lerretVideo).toHaveAttribute("data-vis", B);
  await expect(lerretVideo).toHaveClass(/open/);
  await expect(lerretVideo).not.toHaveClass(/yt-uttoning/);
  await expect(lerret.locator("#yt-iframe")).toHaveAttribute("src", /Cny3XX2-2Mc.*start=260/);
  await expect(lerret.locator("#yt-iframe")).toHaveAttribute("src", /list=RDCny3XX2-2Mc/);
  await expect(lerret.locator("#yt-svart")).toHaveAttribute("style", /opacity: 0/);
  // Bildet står etter at uttoningen av A ville vært ferdig.
  await lerret.waitForTimeout(2500);
  await expect(lerretVideo).toHaveClass(/open/);
  await expect(lerretVideo).toBeVisible();
  await expect(lerret.locator("#yt-iframe")).toHaveAttribute("src", /Cny3XX2-2Mc/);
  await expect(lerret.locator("#yt-svart")).toHaveAttribute("style", /opacity: 0/);
  const logg = await lerret.evaluate(() => window.__yt);
  expect(logg.spilt.at(-1)).toBe("Cny3XX2-2Mc");
  expect(logg.fjernet).not.toContain("Cny3XX2-2Mc");

  // Og tilbake med ←: A igjen på lerretet.
  await page.keyboard.press("ArrowLeft");
  await expect(video(page)).toHaveAttribute("data-vis", A);
  await expect(lerretVideo).toHaveAttribute("data-vis", A);
  await expect(lerret.locator("#yt-iframe")).toHaveAttribute("src", /6CSiU0j_lFA/);
  await expect(lerret.locator("#yt-svart")).toHaveAttribute("style", /opacity: 0/);
  expect(appFeil(feil)).toEqual([]);
  expect(appFeil(lerretFeil)).toEqual([]);
});
