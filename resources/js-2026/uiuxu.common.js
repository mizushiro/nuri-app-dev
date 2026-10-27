import { loadContent } from "./utils/utils.js";
import {
  uiForecastExe,
  dailyForecastExe,
  sunMoonExe,
  airQualityExe,
  livingIndicesExe,
} from "./component/ui-forecast.js";
import { WeatherMainManager } from "./component/weatherMainManager.js";
import {
  initDropdown,
  initNoticeDropdown,
  initSpecialReportTabs,
  initAllDropdowns,
  initNoticeHelpTooltips,
} from "./component/ui-dropdown.js";
import { initAccordion, initAllAccordions } from "./component/ui-accordion.js";
import { initAllDialogs } from "./component/ui-dialog.js";
import {
  initAllMenu,
  setMapChangeCallback,
  getMapSelectionData,
  setLanguage,
  applyLanguage,
  updateSwitchLabels,
  updateFooterNav,
  updateAlarmMenuVisibility,
} from "./component/allmenu.js";
import { initRadarPlayer } from "./component/radarPlayer.js";

export {
  WeatherMainManager,
  uiForecastExe,
  dailyForecastExe,
  sunMoonExe,
  airQualityExe,
  livingIndicesExe,
  setLanguage,
  applyLanguage,
  updateSwitchLabels,
  updateFooterNav,
  updateAlarmMenuVisibility,
};

export const UX = {
  init: (name, options = {}) => {
    const type = name ? name : "main";
    const global = "UI";
    if (!window[global]) {
      window[global] = {};
    }
    const Global = window[global];
    const nrHeader = document.querySelector(".nr__header");
    console.log(nrHeader);
    if (nrHeader) {
      loadContent({
        area: nrHeader,
        src: "./inc/header.html",
        insert: true,
      })
        .then(async () => {
          console.log("header load");
          initAllMenu();
          setMapChangeCallback((data) => {
            console.log("[지도형 선택 콜백]", data.path, data);
          });
        })
        .catch((err) => console.error("Error loading header content:", err));
    } else {
      initAllMenu();
      setMapChangeCallback((data) => {
        console.log("[지도형 선택 콜백]", data.path, data);
      });
    }

    UX.initBodyScroll();
    const nrFooter = document.querySelector(".nr__footer");
    if (nrFooter && !nrFooter.children.length) {
      loadContent({
        area: nrFooter,
        src: "./inc/footer.html",
        insert: true,
      })
        .then(() => {
          UX.initFooterNav();
        })
        .catch((err) => {
          console.error("Error loading footer content:", err);
          UX.initFooterNav();
        });
    } else {
      UX.initFooterNav();
    }
    if (!options.skipForecast) {
      UX.initForecastData(options.forecastOptions);
    }
    UX.initThemeToggle();
    initAllDropdowns();
    initAllAccordions();
    initAllDialogs();
    initNoticeDropdown();
    initSpecialReportTabs();
    initNoticeHelpTooltips();
    initRadarPlayer();
  },
  WeatherMain: WeatherMainManager,
  initRadarPlayer,
  setMapChangeCallback,
  getMapSelectionData,
  setLanguage,
  applyLanguage,
  updateSwitchLabels,
  updateFooterNav,
  getTimeBasedTheme: (date = new Date()) => {
    const hour = date.getHours();
    // 저녁 6시(18시)부터 익일 아침 6시(06시)까지 나이트모드, 그 외는 라이트모드
    return hour >= 18 || hour < 6 ? "night" : "light";
  },
  applyTheme: (theme, isManual = false) => {
    document.body.classList.remove("light-theme", "night-theme", "dark-theme");
    document.body.classList.add(`${theme}-theme`);
    if (theme === "night") {
      document.body.setAttribute("data-time", "night");
      document.body.setAttribute("data-bg", "night-01");
    } else if (theme === "light") {
      document.body.setAttribute("data-time", "day");
      document.body.setAttribute("data-bg", "light-01");
    } else {
      document.body.removeAttribute("data-bg");
    }
    if (isManual) {
      try {
        sessionStorage.setItem("nr_theme", theme);
      } catch (e) {}
    }
    UX.syncThemeControls();
  },
  setWeatherState: ({ season, time, weather } = {}) => {
    if (season) document.body.dataset.season = season;
    if (time) document.body.dataset.time = time;
    if (weather) document.body.dataset.weather = weather;
  },
  syncThemeControls: () => {
    const select = document.querySelector(".nr__theme-select");
    const themeSwitch = document.querySelector("#setting_sw_9");
    const isNight = document.body.classList.contains("night-theme");
    const isDark = document.body.classList.contains("dark-theme");
    const isLight =
      document.body.classList.contains("light-theme") || (!isNight && !isDark);

    if (select) {
      if (isNight) {
        select.value = "night";
      } else if (isDark) {
        select.value = "dark";
      } else {
        select.value = "light";
      }
    }

    if (themeSwitch) {
      themeSwitch.checked = (isNight || isDark);
    }
  },
  initThemeToggle: () => {
    // 현재 시간(18:00~06:00) 기준 나이트모드 자동 적용
    const timeTheme = UX.getTimeBasedTheme();
    UX.applyTheme(timeTheme, false);

    // 주기적 시간 체크 (1분마다: 시간에 따라 나이트/라이트 모드 자동 전환)
    setInterval(() => {
      let userTheme = null;
      try {
        userTheme = sessionStorage.getItem("nr_theme");
      } catch (e) {}
      if (userTheme !== "dark") {
        const expectedTheme = UX.getTimeBasedTheme();
        const currentTheme = document.body.classList.contains("night-theme")
          ? "night"
          : document.body.classList.contains("dark-theme")
            ? "dark"
            : "light";
        if (currentTheme !== expectedTheme) {
          UX.applyTheme(expectedTheme, false);
        }
      }
    }, 60000);

    // 셀렉트 및 스위치 수동 변경 시 body class 및 sessionStorage 저장
    document.addEventListener("change", (e) => {
      const select = e.target.closest(".nr__theme-select");
      if (select) {
        const theme = select.value; // 'light' | 'night' | 'dark'
        UX.applyTheme(theme, true);
        return;
      }

      const themeSwitch = e.target.closest("#setting_sw_9");
      if (themeSwitch) {
        const isDark = themeSwitch.checked;
        UX.applyTheme(isDark ? "dark" : "light", true);
        return;
      }
    });

    // 헤더 비동기 삽입 후 셀렉트 및 스위치 초기값 동기화
    const observer = new MutationObserver(() => {
      const select = document.querySelector(".nr__theme-select");
      const themeSwitch = document.querySelector("#setting_sw_9");
      if (select || themeSwitch) {
        UX.syncThemeControls();
      }
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
      UX.syncThemeControls();
    }
  },
  initBodyScroll: () => {
    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      const isLargeFont = document.body.dataset.zoom === "2";
      const rem =
        parseFloat(getComputedStyle(document.documentElement).fontSize) ||
        (isLargeFont ? 12 : 10);
      const changeOffset = isLargeFont ? Math.round(25 * rem) : 260;
      const changePoint = window.innerHeight - changeOffset;

      if (scrollY > 20) {
        document.body.classList.add("is-scrolled");
      } else {
        document.body.classList.remove("is-scrolled");
      }
      if (scrollY > changePoint) {
        document.body.classList.add("is-simple");
      } else {
        document.body.classList.remove("is-simple");
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });

    if (window.MutationObserver && document.body) {
      const zoomObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.attributeName === "data-zoom") {
            handleScroll();
          }
        }
      });
      zoomObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["data-zoom"],
      });
    }

    handleScroll();
  },
  initFooterNav: () => {
    const footerBtns = document.querySelectorAll(".nr__footer-btn");
    const header = document.querySelector(".nr__header");
    if (!footerBtns.length) return;

    let isClickScrolling = false;
    let scrollTimer = null;

    // 수집된 섹션 목록
    const targetMap = new Map();
    footerBtns.forEach((btn) => {
      const selector = btn.getAttribute("data-target");
      if (selector && !targetMap.has(selector)) {
        const el = document.querySelector(selector);
        if (el) targetMap.set(selector, el);
      }
    });

    let ticking = false;
    const updateActiveNav = () => {
      const headerHeight =
        header && header.offsetHeight > 0 ? header.offsetHeight : 74;
      const triggerPoint = headerHeight + 110 + 12 + 40;
      const isBottom =
        window.innerHeight + window.pageYOffset >=
        document.documentElement.scrollHeight - 60;

      let activeSelector = null;
      const entries = Array.from(targetMap.entries());

      if (isBottom && entries.length > 0) {
        activeSelector = entries[entries.length - 1][0];
      } else {
        entries.forEach(([selector, sec]) => {
          const rect = sec.getBoundingClientRect();
          if (rect.top <= triggerPoint) {
            activeSelector = selector;
          }
        });
      }

      // 레이더/위성 라디오 활성화 상태 체크
      const picture2 = document.getElementById("picture2");
      const isSatActive = picture2 ? picture2.checked : false;

      footerBtns.forEach((btn) => {
        const selector = btn.getAttribute("data-target");
        // 새창 링크(특보 등)이거나 타겟 섹션이 없는 경우 활성화 대상에서 제외
        if (
          !selector ||
          (btn.tagName === "A" && btn.getAttribute("target") === "_blank")
        ) {
          btn.classList.remove("is-active");
          btn.removeAttribute("aria-current");
          return;
        }

        let isActive = false;
        if (selector === activeSelector) {
          if (selector === "#section-radar") {
            const radarTab = btn.getAttribute("data-radar-tab");
            const btnText = btn.querySelector(".nr__footer-text")?.textContent.trim();
            if (isSatActive) {
              isActive = radarTab === "picture2" || btnText === "위성";
            } else {
              isActive =
                radarTab === "picture1" ||
                btnText === "레이더" ||
                (!radarTab && btnText !== "위성");
            }
          } else {
            isActive = true;
          }
        }

        btn.classList.toggle("is-active", isActive);
        if (isActive) {
          btn.setAttribute("aria-current", "page");
        } else {
          btn.removeAttribute("aria-current");
        }
      });
    };

    window.updateFooterActiveNav = updateActiveNav;

    // 영상 탭(레이더/위성) 라디오 변경 시 푸터 활성화 상태 동기화
    const pictureRadios = document.querySelectorAll('input[name="picture"]');
    pictureRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        updateActiveNav();
      });
    });

    footerBtns.forEach((btn) => {
      // 새창 링크(특보 등)는 기본 브라우저 새창 링크 동작 유지
      if (btn.tagName === "A" && btn.getAttribute("target") === "_blank") {
        return;
      }

      btn.addEventListener("click", (e) => {
        const targetSelector = btn.getAttribute("data-target");
        if (!targetSelector) return;

        const targetSection = document.querySelector(targetSelector);
        if (!targetSection) return;

        e.preventDefault();

        // 1. 레이더 / 위성 탭 활성화 처리
        const radarTab = btn.getAttribute("data-radar-tab");
        const btnText = btn.querySelector(".nr__footer-text")?.textContent.trim();

        if (radarTab === "picture1" || btnText === "레이더") {
          const pic1 = document.getElementById("picture1");
          if (pic1) {
            pic1.checked = true;
            pic1.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } else if (radarTab === "picture2" || btnText === "위성") {
          const pic2 = document.getElementById("picture2");
          if (pic2) {
            pic2.checked = true;
            pic2.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }

        // 2. 푸터 버튼 활성화 즉시 반영
        footerBtns.forEach((b) => {
          const isActive = b === btn;
          b.classList.toggle("is-active", isActive);
          if (isActive) {
            b.setAttribute("aria-current", "page");
          } else {
            b.removeAttribute("aria-current");
          }
        });

        // 3. 부드러운 스크롤 이동
        isClickScrolling = true;
        clearTimeout(scrollTimer);

        const headerHeight =
          header && header.offsetHeight > 0 ? header.offsetHeight : 74;
        const targetTop =
          targetSection.getBoundingClientRect().top +
          window.pageYOffset -
          headerHeight -
          100;

        window.scrollTo({
          top: Math.max(0, targetTop),
          behavior: "smooth",
        });

        const unlockScroll = () => {
          isClickScrolling = false;
          window.removeEventListener("scrollend", unlockScroll);
        };
        if ("onscrollend" in window) {
          window.addEventListener("scrollend", unlockScroll, { once: true });
        }
        scrollTimer = setTimeout(unlockScroll, 800);
      });
    });

    window.addEventListener(
      "scroll",
      () => {
        if (isClickScrolling || ticking) return;

        ticking = true;
        window.requestAnimationFrame(() => {
          updateActiveNav();
          ticking = false;
        });
      },
      { passive: true },
    );

    updateActiveNav();
  },
  initForecastData: (chartOptions = {}) => {
    return fetch("../resources/json/weather.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const days = Array.isArray(data)
          ? data
          : data.weekly?.days || data.locations?.[0]?.weekly?.days || [];
        uiForecastExe("hourly-forecast-day", days, chartOptions);
        return data;
      })
      .catch((err) => {
        console.error("날씨 예보 데이터 로드 오류:", err);
      });
  },
};
