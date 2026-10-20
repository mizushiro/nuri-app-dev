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
} from "./component/allmenu.js";
import { initRadarPlayer } from "./component/radarPlayer.js";

export {
  WeatherMainManager,
  uiForecastExe,
  dailyForecastExe,
  sunMoonExe,
  airQualityExe,
  livingIndicesExe,
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
    UX.initFooterNav();
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
      themeSwitch.checked = isLight;
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
        const isLight = themeSwitch.checked;
        UX.applyTheme(isLight ? "light" : "dark", true);
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
      const changePoint = isLargeFont ? 460 : (window.innerHeight - 260);

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
    handleScroll();
  },
  initFooterNav: () => {
    const footerBtns = document.querySelectorAll(".nr__footer-btn");
    const header = document.querySelector(".nr__header");
    if (!footerBtns.length) return;

    let isClickScrolling = false;
    let scrollTimer = null;

    footerBtns.forEach((btn, btnIdx) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const targetSelector = btn.getAttribute("data-target");
        const targetSection = targetSelector
          ? document.querySelector(targetSelector)
          : null;
        if (!targetSection) return;

        footerBtns.forEach((b, idx) => {
          const isActive = idx === btnIdx;
          b.classList.toggle("is-active", isActive);
          if (isActive) {
            b.setAttribute("aria-current", "page");
          } else {
            b.removeAttribute("aria-current");
          }
        });

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

    const sections = Array.from(footerBtns)
      .map((btn) => {
        const selector = btn.getAttribute("data-target");
        return selector ? document.querySelector(selector) : null;
      })
      .filter(Boolean);

    let ticking = false;
    const updateActiveNav = () => {
      const headerHeight =
        header && header.offsetHeight > 0 ? header.offsetHeight : 74;
      const triggerPoint = headerHeight + 110 + 12 + 40;
      const isBottom =
        window.innerHeight + window.pageYOffset >=
        document.documentElement.scrollHeight - 60;

      let currentActiveIdx = -1;

      if (isBottom) {
        currentActiveIdx = sections.length - 1;
      } else {
        sections.forEach((sec, idx) => {
          const rect = sec.getBoundingClientRect();
          if (rect.top <= triggerPoint) {
            currentActiveIdx = idx;
          }
        });
      }

      footerBtns.forEach((b, idx) => {
        const isActive = idx === currentActiveIdx;
        b.classList.toggle("is-active", isActive);
        if (isActive) {
          b.setAttribute("aria-current", "page");
        } else {
          b.removeAttribute("aria-current");
        }
      });
    };

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
