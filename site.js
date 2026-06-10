(function () {
  "use strict";

  const PAGE_CONFIGS = {
    piping: {
      title: "ISO DWG Viewer",
      subTitle: "LAST REV 기준 도면 조회",
      dataFile: "pipingdata.txt",
      placeholder: "예: 0001 0002 또는 ISO 번호",
      columns: [
        { key: "index", label: "INDEX", className: "col-index" },
        { key: "iso", label: "ISO 도면번호" },
        { key: "rev", label: "Rev", className: "col-rev" },
        { key: "date", label: "Date", className: "col-date" }
      ],
      modes: [
        { value: "index", label: "INDEX", fields: ["index"], multi: true },
        { value: "iso", label: "ISO", fields: ["iso"] },
        { value: "date", label: "DATE", fields: ["date"] }
      ],
      parse: parseIsoRows
    },
    rev: {
      title: "ISO DWG Revision History",
      subTitle: "전체 Revision 이력 조회",
      dataFile: "rev.txt",
      placeholder: "예: 0001 또는 ISO 번호",
      columns: [
        { key: "index", label: "INDEX", className: "col-index" },
        { key: "iso", label: "ISO 도면번호" },
        { key: "rev", label: "Rev", className: "col-rev" },
        { key: "date", label: "Date", className: "col-date" }
      ],
      modes: [
        { value: "index", label: "INDEX", fields: ["index"], multi: true },
        { value: "iso", label: "ISO", fields: ["iso"] },
        { value: "date", label: "DATE", fields: ["date"] }
      ],
      parse: parseIsoRows
    },
    barcode: {
      title: "Spool Location",
      subTitle: "스풀 위치와 Barcode 조회",
      dataFile: "barcode.txt",
      placeholder: "예: 0001, SPOOL 번호, Barcode",
      columns: [
        { key: "index", label: "INDEX", className: "col-index" },
        { key: "iso", label: "SPOOL No." },
        { key: "barcode", label: "Barcode", className: "col-short" },
        { key: "location", label: "Location", className: "col-short" }
      ],
      modes: [
        { value: "index", label: "INDEX", fields: ["index"], multi: true },
        { value: "iso", label: "SPOOL No.", fields: ["iso"] },
        { value: "barcode", label: "BARCODE", fields: ["barcode"] },
        { value: "location", label: "Location", fields: ["location"] }
      ],
      parse: parseBarcodeRows,
      rowClass: function (row) {
        const loc = String(row.location || "").trim().toLowerCase();
        return loc === "arrival" || loc === "install" ? "state-ok" : "";
      }
    },
    remain: {
      title: "Incomplete Joint",
      subTitle: "미완료 Joint 현황",
      dataFile: "remain.txt",
      placeholder: "예: 0335, ISO 번호, Joint",
      columns: [
        { key: "index", label: "INDEX", className: "col-index" },
        { key: "iso", label: "ISO 도면번호" },
        { key: "joint", label: "Joint", className: "col-joint" }
      ],
      modes: [
        { value: "index", label: "INDEX", fields: ["index"], multi: true },
        { value: "all", label: "통합", fields: ["index", "iso", "joint"] }
      ],
      parse: parseRemainRows
    },
    wir: {
      title: "Welding Information",
      subTitle: "Welding Date 및 Joint 조회",
      dataFile: "wir.txt",
      placeholder: "예: 0001, Joint, W/D No, Date",
      columns: [
        { key: "index", label: "INDEX", className: "col-index" },
        { key: "iso", label: "ISO 도면번호" },
        { key: "joint", label: "Joint", className: "col-joint" },
        { key: "wdNo", label: "W/D No", className: "col-short" },
        { key: "date", label: "Date", className: "col-date" }
      ],
      modes: [
        { value: "index", label: "INDEX", fields: ["index"], multi: true },
        { value: "all", label: "통합", fields: ["index", "iso", "joint", "wdNo", "date"] }
      ],
      parse: parseWirRows,
      rowClass: function (row) {
        const date = String(row.date || "").trim().toUpperCase();
        if (date === "CREDIT") return "state-credit";
        if (date && date !== "-") return "state-ok";
        return "";
      }
    },
    supt1: {
      title: "Piping Support 정보",
      subTitle: "ISO 기준 Support TAG / TYPE 조회",
      dataFile: "suptdata.txt",
      placeholder: "예: 0001, ISO 번호, TAG, TYPE",
      columns: [
        { key: "index", label: "INDEX", className: "col-index" },
        { key: "iso", label: "ISO 도면번호" },
        { key: "tag", label: "TAG", className: "col-short" },
        { key: "type", label: "TYPE", className: "col-short" }
      ],
      modes: [
        { value: "index", label: "INDEX", fields: ["index"], multi: true },
        { value: "iso", label: "ISO", fields: ["iso"] },
        { value: "tag", label: "TAG", fields: ["tag"] },
        { value: "type", label: "TYPE", fields: ["type"] }
      ],
      parse: parseSupportInfoRows
    },
    supt: {
      title: "PKG By Support",
      subTitle: "Support Drawing별 ISO 패키지 조회",
      dataFile: "supt.txt",
      placeholder: "예: DK3-AG, 2152-SS-005, BG3",
      selectable: true,
      columns: [
        { key: "iso", label: "ISO / Package" },
        { key: "support", label: "Support Drawing", className: "col-short" }
      ],
      modes: [
        { value: "iso", label: "ISO / Package", fields: ["iso"] },
        { value: "support", label: "Support", fields: ["support"] },
        { value: "all", label: "통합", fields: ["iso", "support"] }
      ],
      parse: parseSupportPackageRows
    }
  };

  const state = {
    config: null,
    rows: [],
    filtered: [],
    selected: new Set(),
    renderLimit: 500
  };

  const app = document.getElementById("app");
  const pageKey = window.KDY_PAGE;
  const config = PAGE_CONFIGS[pageKey];

  if (!app || !config) {
    return;
  }

  state.config = config;
  document.title = "PKG3 | " + config.title;

  app.innerHTML = buildAppShell(config);

  const els = {
    loading: document.getElementById("loadingOverlay"),
    searchInput: document.getElementById("searchInput"),
    clearBtn: document.getElementById("clearBtn"),
    resultBody: document.getElementById("resultBody"),
    tableHead: document.getElementById("tableHead"),
    dataCount: document.getElementById("dataCount"),
    viewCount: document.getElementById("viewCount"),
    selectedCount: document.getElementById("selectedCount"),
    emptyState: document.getElementById("emptyState"),
    selectAllBtn: document.getElementById("selectAllBtn"),
    clearSelectBtn: document.getElementById("clearSelectBtn"),
    printSelectedBtn: document.getElementById("printSelectedBtn"),
    printVisibleBtn: document.getElementById("printVisibleBtn")
  };

  wireEvents();
  loadData();

  function buildAppShell(cfg) {
    return `
      <div id="loadingOverlay" class="loading-overlay" aria-live="polite">
        <div class="loading-inner">
          <div class="spinner"></div>
          <div>데이터 로딩 중</div>
        </div>
      </div>
      <main class="app-shell">
        <section class="top-bar">
          <div class="title-row">
            <div>
              <p class="kicker">SHAHEEN PKG3</p>
              <h1>${escapeHtml(cfg.title)}</h1>
              <div class="sub-title">${escapeHtml(cfg.subTitle || "")}</div>
            </div>
            <div class="nav-actions">
              <a class="btn outline" href="index.html" aria-label="메인으로 이동">← Main</a>
              <button class="btn outline" type="button" onclick="location.reload()">↻ Reload</button>
            </div>
          </div>
          <div class="controls">
            <div class="search-input-wrapper">
              <input id="searchInput" type="search" autocomplete="off" placeholder="${escapeHtml(cfg.placeholder || "검색어 입력")}" />
              <button id="clearBtn" class="clear-btn" type="button" aria-label="검색어 지우기">×</button>
            </div>
            <div class="search-modes">
              ${cfg.modes.map((mode, idx) => `
                <label>
                  <input type="radio" name="mode" value="${escapeHtml(mode.value)}" ${idx === 0 ? "checked" : ""}>
                  <span>${escapeHtml(mode.label)}</span>
                </label>
              `).join("")}
            </div>
          </div>
        </section>
        <div class="tool-row">
          <div class="status-pills">
            <span class="pill" id="dataCount">전체 0</span>
            <span class="pill" id="viewCount">표시 0</span>
            ${cfg.selectable ? '<span class="pill" id="selectedCount">선택 0</span>' : ""}
          </div>
          ${cfg.selectable ? `
            <div class="print-actions">
              <button class="btn outline" id="selectAllBtn" type="button">전체선택</button>
              <button class="btn outline" id="clearSelectBtn" type="button">선택해제</button>
              <button class="btn primary" id="printSelectedBtn" type="button">선택 출력</button>
              <button class="btn green" id="printVisibleBtn" type="button">검색결과 출력</button>
            </div>
          ` : ""}
        </div>
        <div class="table-wrap">
          <table>
            <thead id="tableHead">${buildTableHead(cfg)}</thead>
            <tbody id="resultBody"></tbody>
          </table>
        </div>
        <div id="emptyState" class="empty-state" hidden>검색 결과가 없습니다.</div>
      </main>
    `;
  }

  function buildTableHead(cfg) {
    const selectHead = cfg.selectable ? '<th class="col-select select-cell">선택</th>' : "";
    return `
      <tr>
        ${selectHead}
        ${cfg.columns.map(col => `<th class="${escapeHtml(col.className || "")}">${escapeHtml(col.label)}</th>`).join("")}
      </tr>
    `;
  }

  function wireEvents() {
    let timer = null;

    els.searchInput.addEventListener("input", function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(applyFilter, 150);
    });

    els.clearBtn.addEventListener("click", function () {
      els.searchInput.value = "";
      els.searchInput.focus();
      applyFilter();
    });

    document.querySelectorAll('input[name="mode"]').forEach(function (input) {
      input.addEventListener("change", applyFilter);
    });

    if (state.config.selectable) {
      els.selectAllBtn.addEventListener("click", function () {
        state.filtered.slice(0, state.renderLimit).forEach(row => state.selected.add(row._key));
        renderRows();
      });

      els.clearSelectBtn.addEventListener("click", function () {
        state.selected.clear();
        renderRows();
      });

      els.printSelectedBtn.addEventListener("click", function () {
        const rows = state.rows.filter(row => state.selected.has(row._key));
        printRows(rows, "선택 항목");
      });

      els.printVisibleBtn.addEventListener("click", function () {
        printRows(state.filtered, "검색 결과");
      });
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const response = await fetch(state.config.dataFile + "?_=" + Date.now(), { cache: "no-store" });
      if (!response.ok) {
        throw new Error(response.status + " " + response.statusText);
      }
      const text = await response.text();
      state.rows = state.config.parse(text).map(function (row, index) {
        row._key = String(index) + ":" + Object.values(row).join("|");
        row._search = buildSearchIndex(row);
        return row;
      });
      applyFilter();
    } catch (error) {
      els.emptyState.hidden = false;
      els.emptyState.textContent = "데이터 파일을 불러오지 못했습니다.";
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  function applyFilter() {
    const modeValue = getModeValue();
    const mode = state.config.modes.find(item => item.value === modeValue) || state.config.modes[0];
    const keyword = els.searchInput.value.trim();

    if (!keyword) {
      state.filtered = state.rows;
      renderRows();
      return;
    }

    state.filtered = state.rows.filter(function (row) {
      if (mode.multi) {
        return keyword.split(/\s+/g).filter(Boolean).some(function (word) {
          return mode.fields.some(field => matches(row[field], word));
        });
      }

      return mode.fields.some(function (field) {
        return matches(row[field], keyword);
      });
    });

    renderRows();
  }

  function renderRows() {
    const cfg = state.config;
    const rows = state.filtered.slice(0, state.renderLimit);
    const fragment = document.createDocumentFragment();

    els.resultBody.innerHTML = "";

    rows.forEach(function (row) {
      const tr = document.createElement("tr");
      const customClass = cfg.rowClass ? cfg.rowClass(row) : "";
      if (customClass) tr.classList.add(customClass);
      if (state.selected.has(row._key)) tr.classList.add("selected-row");

      if (cfg.selectable) {
        const td = document.createElement("td");
        td.className = "select-cell";
        td.setAttribute("data-label", "선택");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = state.selected.has(row._key);
        checkbox.addEventListener("click", function (event) {
          event.stopPropagation();
          toggleSelected(row);
        });
        td.appendChild(checkbox);
        tr.appendChild(td);
      }

      cfg.columns.forEach(function (col) {
        const td = document.createElement("td");
        td.setAttribute("data-label", col.label);
        td.textContent = formatCell(row[col.key]);
        tr.appendChild(td);
      });

      tr.addEventListener("click", function () {
        if (cfg.selectable && !row.link) {
          toggleSelected(row);
          return;
        }
        openRowLink(row);
      });

      fragment.appendChild(tr);
    });

    els.resultBody.appendChild(fragment);
    updateStatus(rows.length);
  }

  function toggleSelected(row) {
    if (state.selected.has(row._key)) {
      state.selected.delete(row._key);
    } else {
      state.selected.add(row._key);
    }
    renderRows();
  }

  function openRowLink(row) {
    if (!row.link) {
      alert("이 행에는 도면 링크가 등록되어 있지 않습니다.");
      return;
    }

    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      window.location.href = row.link;
      return;
    }

    const popup = window.open(row.link, "_blank");
    if (!popup) {
      window.location.href = row.link;
    }
  }

  function updateStatus(renderedCount) {
    const total = state.rows.length;
    const filtered = state.filtered.length;
    els.dataCount.textContent = "전체 " + total.toLocaleString("ko-KR");
    els.viewCount.textContent = "표시 " + renderedCount.toLocaleString("ko-KR") + " / " + filtered.toLocaleString("ko-KR");
    els.emptyState.hidden = filtered !== 0;
    if (els.selectedCount) {
      els.selectedCount.textContent = "선택 " + state.selected.size.toLocaleString("ko-KR");
    }
  }

  function printRows(rows, title) {
    if (!rows.length) {
      alert("출력할 항목이 없습니다.");
      return;
    }

    const cfg = state.config;
    const printableRows = rows.map(function (row) {
      return cfg.columns.map(col => `<td>${escapeHtml(formatCell(row[col.key]))}</td>`).join("");
    }).join("");

    const popup = window.open("", "printWindow", "width=1100,height=800,resizable=yes,scrollbars=yes");
    if (!popup) {
      alert("팝업 차단을 해제한 뒤 다시 시도해 주세요.");
      return;
    }

    popup.document.write(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <title>${escapeHtml(cfg.title)} ${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, "Noto Sans KR", sans-serif; margin: 24px; color: #111827; }
          h1 { font-size: 20px; margin: 0 0 12px; }
          .meta { color: #667085; font-size: 12px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #d9dee7; padding: 7px 8px; text-align: left; white-space: nowrap; }
          th { background: #eef2f6; }
          .actions { margin-bottom: 14px; }
          button { padding: 8px 12px; border: 1px solid #b8c2d1; border-radius: 6px; background: #fff; cursor: pointer; }
          @media print { .actions { display: none; } body { margin: 10mm; } }
        </style>
      </head>
      <body>
        <div class="actions">
          <button onclick="window.print()">인쇄</button>
          <button onclick="window.close()">닫기</button>
        </div>
        <h1>${escapeHtml(cfg.title)} - ${escapeHtml(title)}</h1>
        <div class="meta">${rows.length.toLocaleString("ko-KR")}건</div>
        <table>
          <thead><tr>${cfg.columns.map(col => `<th>${escapeHtml(col.label)}</th>`).join("")}</tr></thead>
          <tbody>${printableRows}</tbody>
        </table>
      </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
  }

  function setLoading(show) {
    els.loading.classList.toggle("show", show);
  }

  function getModeValue() {
    const checked = document.querySelector('input[name="mode"]:checked');
    return checked ? checked.value : state.config.modes[0].value;
  }

  function buildSearchIndex(row) {
    return Object.keys(row)
      .filter(key => key.charAt(0) !== "_")
      .map(key => normalize(row[key]))
      .join(" ");
  }

  function matches(value, keyword) {
    const normalizedValue = normalize(value);
    const normalizedKeyword = normalize(keyword);
    if (!normalizedKeyword) return true;
    return normalizedValue.includes(normalizedKeyword);
  }

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/[-_\s]/g, "");
  }

  function formatCell(value) {
    const text = String(value || "").trim();
    return text === "-" ? "" : text;
  }

  function splitTokens(line) {
    return line.trim().split(/[\t ]+/g).filter(Boolean);
  }

  function extractUrl(cols) {
    return cols.find(value => /^https?:\/\//i.test(value)) || "";
  }

  function parseLines(text, mapper) {
    return text.split(/\r?\n/g).map(line => line.trim()).filter(Boolean).map(splitTokens).map(mapper).filter(Boolean);
  }

  function parseIsoRows(text) {
    return parseLines(text, function (cols) {
      if (cols.length < 4) return null;
      return {
        index: cols[0],
        iso: cols[1],
        rev: cols[2],
        date: cols[3],
        link: extractUrl(cols)
      };
    });
  }

  function parseBarcodeRows(text) {
    return parseLines(text, function (cols) {
      if (cols.length < 4) return null;
      return {
        index: cols[0],
        iso: cols[1],
        barcode: cols[2],
        location: cols[3],
        link: extractUrl(cols)
      };
    });
  }

  function parseRemainRows(text) {
    return parseLines(text, function (cols) {
      if (cols.length < 3) return null;
      return {
        index: cols[0],
        iso: cols[1],
        joint: cols[2],
        link: extractUrl(cols)
      };
    });
  }

  function parseWirRows(text) {
    return parseLines(text, function (cols) {
      if (cols.length < 5) return null;
      return {
        index: cols[0],
        iso: cols[1],
        joint: cols[2],
        wdNo: cols[3] === "-" ? "" : cols[3],
        date: cols[4] === "-" ? "" : cols[4],
        link: extractUrl(cols)
      };
    });
  }

  function parseSupportInfoRows(text) {
    return parseLines(text, function (cols) {
      if (cols.length < 4) return null;
      return {
        index: cols[0],
        iso: cols[1],
        tag: cols[2],
        type: cols.slice(3).join(" ")
      };
    });
  }

  function parseSupportPackageRows(text) {
    return parseLines(text, function (cols) {
      if (cols.length < 2) return null;
      return {
        iso: cols[0],
        support: cols[1],
        link: extractUrl(cols)
      };
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
