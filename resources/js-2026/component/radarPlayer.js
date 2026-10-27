/**
 * 레이더/강수예측 타임라인 플레이어 컨트롤러
 */
export const initRadarPlayer = () => {
  const radarSection = document.getElementById("section-radar");
  if (!radarSection) return;

  const playerWrap = radarSection.querySelector(".nr__radar-map-player");
  const playBtn =
    radarSection.querySelector(
      ".nr__radar-player-btn:has(.icon-aspect-map-play), .nr__radar-player-btn:has(.icon-aspect-map-pause)"
    ) || (playerWrap ? playerWrap.children[1] : null);

  const prevBtn =
    radarSection.querySelector('.nr__radar-player-btn[aria-label*="뒤로"]') ||
    (playerWrap ? playerWrap.children[0] : null);
  const nextBtn =
    radarSection.querySelector('.nr__radar-player-btn[aria-label*="앞으로"]') ||
    (playerWrap ? playerWrap.children[2] : null);
  const refreshBtn = radarSection.querySelector(".nr__radar-refresh-btn");

  const timelineTrack = radarSection.querySelector(".nr__radar-timeline-track");
  const timelineFill = radarSection.querySelector(".nr__radar-timeline-fill");
  const timelineProgress = radarSection.querySelector(".nr__radar-timeline");
  const timeElem = radarSection.querySelector(".nr__radar-meta time");

  if (!playBtn || !timelineFill || !timeElem) return;

  // 레이더 / 위성 라디오 탭 전환 제어
  const pictureRadios = radarSection.querySelectorAll('input[name="picture"]');
  const subHeaderTitle = radarSection.querySelector(".nr__radar-sub-header .ui-flex");
  const mapImg = radarSection.querySelector(".nr__radar-map-img");

  const updateRadarView = () => {
    const isSat = document.getElementById("picture2")?.checked;
    if (subHeaderTitle) {
      if (isSat) {
        subHeaderTitle.innerHTML = `
          <span class="text-14" data-weight="600" data-text-color="theme1">위성</span>
          <span class="text-14" data-weight="700" data-text-color="blue">천리안 2A호</span>
        `;
      } else {
        subHeaderTitle.innerHTML = `
          <span class="text-14" data-weight="600" data-text-color="theme1">레이더</span>
          <span class="text-14" data-weight="700" data-text-color="blue">강수예측</span>
        `;
      }
    }
    if (mapImg) {
      mapImg.alt = isSat ? "기상위성 영상 지도" : "강수예측 레이더 영상 지도";
    }
    if (typeof window.updateFooterActiveNav === "function") {
      window.updateFooterActiveNav();
    }
  };

  pictureRadios.forEach((radio) => {
    radio.addEventListener("change", updateRadarView);
  });

  // 기준 시간 및 범위 설정 (HTML 시간 기준으로 0% = 14:10, 10분 단위, 총 120분)
  const baseTimeStr = timeElem.getAttribute("datetime") || "2026-08-03T14:10";
  const startTimestamp = new Date(baseTimeStr).getTime();
  const totalMinutes = 120;
  const stepMinutes = 10;
  const stepPercent = (stepMinutes / totalMinutes) * 100; // 약 8.333%

  let currentPercent = parseFloat(timelineFill.style.width) || 0;
  let isPlaying = false;
  let playInterval = null;

  const formatTime = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    const h = String(dateObj.getHours()).padStart(2, "0");
    const min = String(dateObj.getMinutes()).padStart(2, "0");
    return {
      text: `${y}.${m}.${d}. ${h}:${min}`,
      datetime: `${y}-${m}-${d}T${h}:${min}`,
    };
  };

  const updateUI = (percent) => {
    currentPercent = Math.max(0, Math.min(100, percent));
    timelineFill.style.width = `${currentPercent}%`;
    if (timelineProgress) {
      timelineProgress.setAttribute("aria-valuenow", Math.round(currentPercent));
    }

    const elapsedSteps = Math.round(
      (currentPercent / 100) * (totalMinutes / stepMinutes)
    );
    const elapsedMinutes = elapsedSteps * stepMinutes;
    const currentTime = new Date(startTimestamp + elapsedMinutes * 60 * 1000);
    const formatted = formatTime(currentTime);

    timeElem.textContent = formatted.text;
    timeElem.setAttribute("datetime", formatted.datetime);
  };

  const setPlaying = (play) => {
    isPlaying = play;
    const icon = playBtn.querySelector("i");

    if (isPlaying) {
      if (icon) {
        icon.classList.remove("icon-aspect-map-play");
        icon.classList.add("icon-aspect-map-pause");
      }
      playBtn.setAttribute("aria-label", "일시정지");

      if (currentPercent >= 100) {
        currentPercent = 0;
        updateUI(currentPercent);
      }

      clearInterval(playInterval);
      playInterval = setInterval(() => {
        let nextPercent = currentPercent + stepPercent;
        if (nextPercent > 100) {
          nextPercent = 0; // 끝에 도달하면 처음부터 반복
        }
        updateUI(nextPercent);
      }, 700);
    } else {
      clearInterval(playInterval);
      playInterval = null;
      if (icon) {
        icon.classList.remove("icon-aspect-map-pause");
        icon.classList.add("icon-aspect-map-play");
      }
      playBtn.setAttribute("aria-label", "재생");
    }
  };

  playBtn.addEventListener("click", () => {
    setPlaying(!isPlaying);
  });

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      updateUI(currentPercent - stepPercent);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      updateUI(currentPercent + stepPercent);
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      setPlaying(false);
      updateUI(0);
    });
  }

  if (timelineTrack) {
    timelineTrack.style.cursor = "pointer";
    timelineTrack.addEventListener("click", (e) => {
      const rect = timelineTrack.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickedPercent = (clickX / rect.width) * 100;
      updateUI(clickedPercent);
    });
  }
};
