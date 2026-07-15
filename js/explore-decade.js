// ============================================================================
//  TIÅRSVISNING: Samfunn / Teknologi
// ----------------------------------------------------------------------------
//  Tiårsvisningen med klikkbar tidslinje-stripe. Flyttet ut av explore.js
//  (v3.55, runde 2). contextMode/currentDecade er modul-tilstand her.
// ============================================================================
import { modalOpen, renderDecadeRibbon, renderDecadeSections, buildKilderList, formatInfoText } from "./ui.js?v=3.58";
import { DECADES } from "./limits.js?v=3.58";
import { openTechDetail, openTeknologi } from "./explore-tech.js?v=3.58";
import { opts, getState } from "./explore-context.js?v=3.58";

let contextMode = "society";
// Sist viste tiår i Samfunn/Teknologi-visningen — huskes innen økten så
// «lukk og åpne igjen» fortsetter der studenten slapp.
let currentDecade = null;

// Tiårsvelgeren er en klikkbar tidslinje-stripe øverst i selve tiårsvisningen
// (v3.35) — kortet åpner rett inn i et tiår, uten mellomliste. Lærersiden har
// sin egen variant med samme stripe (teacher-content.js: openSingleDecadeModal).
export function openDecadeList(mode) {
  contextMode = mode;
  openDecadeView(currentDecade ?? DECADES[0]);
}

function openDecadeView(decadeId) {
  renderDecadeView(decadeId);
  modalOpen(document.getElementById("modal-decade-view"));
}

function renderDecadeView(decadeId) {
  const modal = document.getElementById("modal-decade-view");
  if (!modal) return;
  const d = Number(decadeId);
  currentDecade = d;
  const s = getState();
  const desc = s.decadeDescs[String(d)] || {};
  const isSociety = contextMode === "society";
  document.getElementById("dv-title").textContent = isSociety ? "Samfunn" : "Teknologi";
  document.getElementById("dv-decade").textContent = `${d}-tallet`;

  // Tidslinje-stripa: alle tiår som klikkbare punkter på én akse, aktivt
  // tiår uthevet. Re-render (ikke modalOpen) ved bytte — modalen står åpen.
  renderDecadeRibbon(document.getElementById("dv-ribbon"), d, renderDecadeView);

  // Teknologi har en ekstra inngang til alle innovasjonskortene (lå før i
  // tiårslista).
  const extra = document.getElementById("dv-extra");
  if (extra) {
    if (isSociety) {
      extra.innerHTML = "";
    } else {
      extra.innerHTML = `<button class="btn ghost" id="dv-btn-innovasjon" style="width:100%;margin:0 0 12px">Vis teknologi-kort</button>`;
      extra.querySelector("#dv-btn-innovasjon").addEventListener("click", () => openTeknologi());
    }
  }

  const societySection = document.getElementById("dv-society-section");
  const techSection = document.getElementById("dv-tech-section");
  if (societySection) societySection.style.display = isSociety ? "" : "none";
  if (techSection) techSection.style.display = isSociety ? "none" : "";

  renderDecadeSections(
    {
      societyEl: document.getElementById("dv-society"),
      techEl: document.getElementById("dv-tech"),
      societyTl: document.getElementById("dv-society-timeline"),
      techTl: document.getElementById("dv-tech-timeline"),
      societyMoreBtn: document.getElementById("dv-society-more"),
      techMoreBtn: document.getElementById("dv-tech-more"),
    },
    desc, d, s.techItems,
    {
      isSociety,
      onTechClick: openTechDetail,
      onMore: (which, text) => openDecadeMore(
        `${d}-tallet — ${which === "society" ? "samfunnsutvikling" : "teknologiutvikling"}`, text),
    }
  );

  const propSociety = document.getElementById("dv-society-propose");
  const propTech = document.getElementById("dv-tech-propose");
  if (propSociety) {
    if (isSociety && opts.onProposeEdit) {
      const locked = opts.hasPendingEdit?.("decade-society", d);
      propSociety.style.display = "";
      propSociety.disabled = !!locked;
      propSociety.textContent = locked ? "Forslag venter" : "Foreslå endring";
      propSociety.onclick = () => opts.onProposeEdit({
        entityType: "decade-society",
        entityId: String(d),
        entityName: `${d}-tallet — samfunn`,
        currentValues: { society: desc.society || "", societyMore: desc.societyMore || "", kilder: desc.kilder || [] },
      });
    } else {
      propSociety.style.display = "none";
    }
  }
  if (propTech) {
    if (!isSociety && opts.onProposeEdit) {
      const locked = opts.hasPendingEdit?.("decade-tech", d);
      propTech.style.display = "";
      propTech.disabled = !!locked;
      propTech.textContent = locked ? "Forslag venter" : "Foreslå endring";
      propTech.onclick = () => opts.onProposeEdit({
        entityType: "decade-tech",
        entityId: String(d),
        entityName: `${d}-tallet — teknologi`,
        currentValues: { tech: desc.tech || "", techMore: desc.techMore || "", kilder: desc.kilder || [] },
      });
    } else {
      propTech.style.display = "none";
    }
  }

  const kilderEl = document.getElementById("dv-kilder");
  if (kilderEl) kilderEl.innerHTML = buildKilderList(desc.kilder, "Kilder");

  // Forrige/neste nederst inviterer til å lese tiårene som én fortelling.
  // visibility (ikke display) i endene, så knappene beholder plassen sin.
  const idx = DECADES.indexOf(d);
  const prevBtn = document.getElementById("dv-prev");
  const nextBtn = document.getElementById("dv-next");
  if (prevBtn) {
    prevBtn.style.visibility = idx > 0 ? "" : "hidden";
    prevBtn.textContent = idx > 0 ? `← ${DECADES[idx - 1]}-tallet` : "";
    prevBtn.onclick = idx > 0 ? () => renderDecadeView(DECADES[idx - 1]) : null;
  }
  if (nextBtn) {
    const more = idx >= 0 && idx < DECADES.length - 1;
    nextBtn.style.visibility = more ? "" : "hidden";
    nextBtn.textContent = more ? `${DECADES[idx + 1]}-tallet →` : "";
    nextBtn.onclick = more ? () => renderDecadeView(DECADES[idx + 1]) : null;
  }
}

function openDecadeMore(title, text) {
  const modal = document.getElementById("modal-decade-more");
  if (!modal) return;
  document.getElementById("dm-title").textContent = title;
  document.getElementById("dm-text").innerHTML = formatInfoText(text);
  modalOpen(modal);
}
