const QUIZ_CHOICE_FRONT_CODE = String.raw`<div id="side-flag" data-side="front"></div>
<div id="raw-question" class="raw-data">{{正面}}</div>
<div id="raw-back" class="raw-data">{{反面}}</div>
<div id="quiz-card"></div>`
const QUIZ_CHOICE_BACK_CODE = String.raw`<div id="side-flag" data-side="back"></div>
<div id="raw-question" class="raw-data">{{正面}}</div>
<div id="raw-back" class="raw-data">{{反面}}</div>
<div id="quiz-card"></div>`
const QUIZ_CHOICE_CSS = String.raw`.card {
  background: #fff;
  color: #111;
  font-family: Arial, "Microsoft YaHei", "PingFang SC", sans-serif;
}

.raw-data {
  display: none;
}

.quiz-card {
  max-width: 1160px;
  margin: 0 auto;
  padding: 18px 38px 26px;
  box-sizing: border-box;
}

.top-area {
  text-align: center;
  margin-bottom: 54px;
}

.control-pill {
  display: inline-block;
  background: #46c96f;
  color: #fff;
  padding: 9px 22px;
  border-radius: 999px;
  font-weight: bold;
  font-size: 13px;
  box-shadow: 0 5px 12px rgba(70, 201, 111, 0.25);
}

.question {
  font-size: 16px;
  font-weight: bold;
  line-height: 1.8;
  margin-bottom: 54px;
}

.q-type {
  color: #0078ff;
  font-weight: bold;
  margin-right: 4px;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option {
  border: 1.4px solid #111;
  border-radius: 4px;
  padding: 10px 18px;
  font-size: 16px;
  line-height: 1.45;
  background: #fff;
  color: #111;
  cursor: pointer;
  transition: all 0.15s ease;
  box-sizing: border-box;
  user-select: none;
}

.option:hover {
  border-color: #0b8cff;
  box-shadow: 0 3px 10px rgba(11, 140, 255, 0.14);
}

.option-label {
  font-weight: bold;
  margin-right: 8px;
}

.option.selected,
.option.correct {
  background: #0b8cff;
  color: #fff;
  border-color: #006fd1;
  font-weight: bold;
}

.option.wrong {
  background: #ff4d4f;
  color: #fff;
  border-color: #d9363e;
  font-weight: bold;
}

.option.dim {
  opacity: 1;
}

.tag-row {
  margin-top: 10px;
}

.tag {
  display: inline-block;
  color: #0078ff;
  border: 1.4px solid #0078ff;
  border-radius: 5px;
  padding: 5px 10px;
  font-weight: bold;
  font-size: 15px;
  margin-right: 8px;
  margin-bottom: 6px;
}

.bottom-line {
  margin-top: 56px;
  border-top: 1px solid #eee;
  padding-top: 26px;
  text-align: center;
  color: #777;
  font-size: 14px;
}

.answer-box {
  margin-top: 22px;
  padding: 14px 16px;
  background: #f6faff;
  border-left: 4px solid #0b8cff;
  border-radius: 4px;
  font-size: 15px;
  line-height: 1.7;
}

.answer-title {
  color: #0b8cff;
  font-weight: bold;
  margin-bottom: 6px;
}

.analysis {
  color: #222;
}

.stats-row {
  margin-top: 42px;
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
  text-align: center;
}

.stat-item {
  min-width: 0;
}

.stat-value {
  font-size: 17px;
  font-weight: bold;
  color: #555;
  white-space: nowrap;
}

.stat-label {
  margin-top: 14px;
  font-size: 15px;
  font-weight: bold;
  color: #60656f;
}

.stat-blue {
  color: #0078ff;
}

.stat-orange {
  color: #ffb020;
}

.stat-red {
  color: #ff3333;
}

.control-pill {
  border: 0;
  cursor: pointer;
  font-family: inherit;
}

.options {
  display: flex !important;
  flex-direction: column !important;
  gap: 10px !important;
}

.option {
  display: block;
  width: 100%;
}

.analysis-toggle {
  margin: 12px 0;
  padding: 7px 14px;
  border: 1px solid #0b8cff;
  border-radius: 6px;
  background: #fff;
  color: #0b8cff;
  font-weight: bold;
  cursor: pointer;
}

.cc-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
}

.cc-overlay.show {
  display: flex;
}

.cc-panel {
  position: relative;
  width: min(560px, calc(100vw - 42px));
  padding: 28px 30px 24px;
  border-radius: 22px;
  background: rgba(245, 245, 245, 0.94);
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(14px);
}

.cc-close {
  position: absolute;
  right: 18px;
  top: 16px;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  background: #ddd;
  color: #ff3b30;
  font-size: 23px;
  font-weight: bold;
  cursor: pointer;
}

.cc-title {
  width: fit-content;
  margin: 0 auto 24px;
  padding: 10px 24px;
  border-radius: 999px;
  background: #46c96f;
  color: #fff;
  font-weight: bold;
  box-shadow: 0 5px 14px rgba(70, 201, 111, 0.3);
}

.cc-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px 22px;
}

.cc-btn {
  min-height: 92px;
  border: 0;
  border-radius: 18px;
  background: transparent;
  color: #333;
  cursor: pointer;
  font-family: inherit;
}

.cc-btn span {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  margin: 0 auto 8px;
  border-radius: 50%;
  background: #fff;
  font-size: 25px;
  box-shadow: 0 5px 14px rgba(0, 0, 0, 0.16);
}

.cc-btn b {
  display: block;
  font-size: 14px;
  margin-bottom: 3px;
}

.cc-btn em {
  display: inline-block;
  min-width: 24px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #ccc;
  color: #fff;
  font-style: normal;
  font-size: 12px;
}

.cc-btn.cc-active em {
  background: #46c96f;
}

.cc-btn.cc-danger span {
  background: #fff1f0;
}

.cc-tip {
  margin-top: 18px;
  text-align: center;
  color: #888;
  font-size: 12px;
}

.quiz-card.no-motion *,
.quiz-card.no-motion *::before,
.quiz-card.no-motion *::after {
  transition: none !important;
  animation: none !important;
}

.quiz-card.pure-mode .control-pill,
.quiz-card.pure-mode .option,
.quiz-card.pure-mode .tag,
.quiz-card.pure-mode .answer-box,
.quiz-card.pure-mode .cc-panel,
.quiz-card.pure-mode .cc-btn span {
  box-shadow: none !important;
}

@media (max-width: 900px) {
  .stats-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px 10px;
  }

  .stat-value {
    font-size: 15px;
  }

  .stat-label {
    font-size: 13px;
    margin-top: 8px;
  }

  .cc-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
`
const QUIZ_CHOICE_JS = String.raw`(function () {
  var RECORDS_KEY = "ANKI_QUIZ_RECORDS_CC_V1";
  var SETTINGS_KEY = "ANKI_QUIZ_SETTINGS_CC_V1";
  var MAX_RECORDS = 3000;

  var DEFAULT_SETTINGS = {
    animation: true,
    random: false,
    pure: false,
    showStats: true,
    showAnalysis: true
  };

  function getText(id) {
    var el = document.getElementById(id);
    if (!el) return "";
    return (el.innerText || el.textContent || "").trim();
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, function (m) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[m];
    });
  }

  function cleanText(s) {
    return String(s || "")
      .replace(/\r/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  function splitCombinedQuestion(rawQuestion, rawBack) {
    rawQuestion = String(rawQuestion || "");
    rawBack = String(rawBack || "");

    if (cleanText(rawBack)) {
      return {
        front: rawQuestion,
        back: rawBack
      };
    }

    var tabIndex = rawQuestion.indexOf("\t");

    if (tabIndex !== -1) {
      return {
        front: rawQuestion.slice(0, tabIndex),
        back: rawQuestion.slice(tabIndex + 1)
      };
    }

    var answerIndex = rawQuestion.search(/(?:答案|正确答案)\s*[:：]\s*[A-D]{1,4}/i);

    if (answerIndex !== -1) {
      return {
        front: rawQuestion.slice(0, answerIndex),
        back: rawQuestion.slice(answerIndex)
      };
    }

    return {
      front: rawQuestion,
      back: rawBack
    };
  }

  function normalizeAnswer(ans) {
    var s = String(ans || "").toUpperCase();
    var arr = [];

    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (/[A-D]/.test(ch) && arr.indexOf(ch) === -1) {
        arr.push(ch);
      }
    }

    arr.sort();
    return arr.join("");
  }

  function parseQuestion(raw) {
    raw = cleanText(raw);

    var data = {
      question: "",
      A: "",
      B: "",
      C: "",
      D: "",
      type: ""
    };

    var typeMatch = raw.match(/【\s*(单选|多选)\s*】|题型\s*[:：]\s*(单选|多选)/);
    if (typeMatch) {
      data.type = typeMatch[1] || typeMatch[2] || "";
    }

    raw = raw.replace(/【\s*(单选|多选)\s*】/g, "");
    raw = raw.replace(/题型\s*[:：]\s*(单选|多选)/g, "");
    raw = raw.replace(/^题干\s*[:：]\s*/i, "");

    var optionRegex = /([A-D])\s*[\.．、:：]\s*/gi;
    var matches = [];
    var m;

    while ((m = optionRegex.exec(raw)) !== null) {
      matches.push({
        key: m[1].toUpperCase(),
        index: m.index,
        end: optionRegex.lastIndex
      });
    }

    if (!matches.length) {
      data.question = raw;
      return data;
    }

    data.question = raw.slice(0, matches[0].index).trim();

    for (var i = 0; i < matches.length; i++) {
      var cur = matches[i];
      var next = matches[i + 1];
      var content = raw.slice(cur.end, next ? next.index : raw.length).trim();
      data[cur.key] = content;
    }

    return data;
  }

  function parseBack(raw) {
    raw = cleanText(raw);

    var data = {
      answer: "",
      tag: "",
      analysis: "",
      type: ""
    };

    var typeMatch = raw.match(/【\s*(单选|多选)\s*】|题型\s*[:：]\s*(单选|多选)/);
    if (typeMatch) {
      data.type = typeMatch[1] || typeMatch[2] || "";
    }

    var answerMatch = raw.match(/(?:答案|正确答案)\s*[:：]\s*([A-D]{1,4})/i);
    if (answerMatch) {
      data.answer = normalizeAnswer(answerMatch[1]);
    }

    var tagMatch = raw.match(/(?:标签|考点)\s*[:：]\s*([\s\S]*?)(?=(?:解析|分析|详解|说明)\s*[:：]|$)/);
    if (tagMatch) {
      data.tag = tagMatch[1].trim();
    }

    var analysisMatch = raw.match(/(?:解析|分析|详解|说明)\s*[:：]\s*([\s\S]*)/);
    if (analysisMatch) {
      data.analysis = analysisMatch[1].trim();
    }

    return data;
  }

  function hashText(s) {
    var hash = 0;
    s = String(s || "");

    for (var i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }

    return (hash >>> 0).toString(36);
  }

  function makeKey(q, b) {
    return "anki_quiz_" + hashText((q.question || "") + "|" + (b.answer || ""));
  }

  function readSettings() {
    try {
      var saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      var out = {};

      for (var k in DEFAULT_SETTINGS) {
        out[k] = saved.hasOwnProperty(k) ? saved[k] : DEFAULT_SETTINGS[k];
      }

      return out;
    } catch (e) {
      return {
        animation: true,
        random: false,
        pure: false,
        showStats: true,
        showAnalysis: true
      };
    }
  }

  function writeSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {}
  }

  function readRecords() {
    try {
      var arr = JSON.parse(localStorage.getItem(RECORDS_KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function writeRecords(records) {
    try {
      if (records.length > MAX_RECORDS) {
        records = records.slice(records.length - MAX_RECORDS);
      }
      localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    } catch (e) {}
  }

  function readAttempt(storeKey) {
    try {
      return JSON.parse(sessionStorage.getItem(storeKey + "_attempt") || "null");
    } catch (e) {
      return null;
    }
  }

  function saveAttempt(storeKey, state) {
    try {
      sessionStorage.setItem(storeKey + "_attempt", JSON.stringify(state));
    } catch (e) {}
  }

  function removeAttempt(storeKey) {
    try {
      sessionStorage.removeItem(storeKey + "_attempt");
    } catch (e) {}
  }

  function createAttempt(storeKey) {
    var state = {
      startedAt: Date.now(),
      selected: "",
      recorded: false,
      usedMs: 0,
      order: []
    };

    saveAttempt(storeKey, state);
    return state;
  }

  function shuffle(arr) {
    var a = arr.slice();

    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }

    return a;
  }

  function getOptionKeys(q, settings, state, storeKey, side) {
    var keys = ["A", "B", "C", "D"].filter(function (k) {
      return !!q[k];
    });

    if (!settings.random) return keys;

    if (state && state.order && state.order.length) {
      return state.order.filter(function (k) {
        return keys.indexOf(k) !== -1;
      });
    }

    if (side === "front" && state) {
      state.order = shuffle(keys);
      saveAttempt(storeKey, state);
      return state.order;
    }

    return keys;
  }

  function diffAnswer(answer, selected) {
    var ans = normalizeAnswer(answer).split("");
    var sel = normalizeAnswer(selected).split("");
    var missed = [];
    var extra = [];

    for (var i = 0; i < ans.length; i++) {
      if (sel.indexOf(ans[i]) === -1) missed.push(ans[i]);
    }

    for (var j = 0; j < sel.length; j++) {
      if (ans.indexOf(sel[j]) === -1) extra.push(sel[j]);
    }

    return {
      missed: missed.join(""),
      extra: extra.join("")
    };
  }

  function isCorrectAnswer(answer, selected) {
    return normalizeAnswer(answer) === normalizeAnswer(selected);
  }

  function formatTime(ms) {
    var sec = Math.max(0, Math.floor((ms || 0) / 1000));
    return Math.floor(sec / 60) + "分" + (sec % 60) + "秒";
  }

  function formatRate(correct, total) {
    if (!total) return "0.00% (0/0)";
    return ((correct / total) * 100).toFixed(2) + "% (" + correct + "/" + total + ")";
  }

  function getStats(records) {
    var stats = {
      total: 0,
      correct: 0,
      singleTotal: 0,
      singleCorrect: 0,
      multiTotal: 0,
      multiCorrect: 0,
      score: 0
    };

    for (var i = 0; i < records.length; i++) {
      var r = records[i];

      stats.total++;

      if (r.isRight) stats.correct++;

      stats.score += Number(r.score || 0);

      if (r.type === "多选") {
        stats.multiTotal++;
        if (r.isRight) stats.multiCorrect++;
      } else {
        stats.singleTotal++;
        if (r.isRight) stats.singleCorrect++;
      }
    }

    return stats;
  }

  function makeMistakeText(answer, selected, type) {
    answer = normalizeAnswer(answer);
    selected = normalizeAnswer(selected);

    if (!selected) return "未作答";
    if (isCorrectAnswer(answer, selected)) return "暂无";

    var d = diffAnswer(answer, selected);

    if (type === "多选") {
      var parts = [];

      if (d.missed) parts.push("漏选" + d.missed);
      if (d.extra) parts.push("多选" + d.extra);

      return parts.join(" / ") || "暂无";
    }

    return "易错：" + selected + "→" + answer;
  }

  function statItem(value, label, cls) {
    return ""
      + '<div class="stat-item">'
      + '<div class="stat-value ' + (cls || "") + '">' + escapeHtml(value) + '</div>'
      + '<div class="stat-label">' + escapeHtml(label) + '</div>'
      + '</div>';
  }

  function renderStatsRow(answer, selected, type, records, usedMs) {
    var stats = getStats(records);
    var mistakeText = makeMistakeText(answer, selected, type);

    var html = '<div class="stats-row">';

    html += statItem(answer || "未填写", "正确答案", "stat-blue");
    html += statItem(selected || "暂无", "你的选择", selected && !isCorrectAnswer(answer, selected) ? "stat-red" : "stat-orange");
    html += statItem(mistakeText, "易错易漏", mistakeText === "暂无" ? "" : "stat-red");
    html += statItem(formatRate(stats.correct, stats.total), "综合统计", "stat-red");
    html += statItem(formatRate(stats.singleCorrect, stats.singleTotal), "单选统计", "stat-red");
    html += statItem(formatRate(stats.multiCorrect, stats.multiTotal), "多选统计", "stat-red");
    html += statItem(String(stats.score), "答题总分", "");
    html += statItem(formatTime(usedMs), "答题用时", "");

    html += '</div>';

    return html;
  }

  function recordIfNeeded(storeKey, q, b, type, state) {
    var selected = normalizeAnswer(state && state.selected);
    var answer = normalizeAnswer(b.answer);

    if (!state) state = {};

    if (!selected || !answer || state.recorded) {
      return {
        records: readRecords(),
        usedMs: state.usedMs || 0,
        selected: selected
      };
    }

    var usedMs = Date.now() - Number(state.startedAt || Date.now());
    var d = diffAnswer(answer, selected);
    var right = isCorrectAnswer(answer, selected);
    var records = readRecords();

    records.push({
      cardKey: storeKey,
      question: q.question.slice(0, 80),
      type: type,
      answer: answer,
      selected: selected,
      isRight: right,
      missed: d.missed,
      extra: d.extra,
      usedMs: usedMs,
      score: right ? 1 : 0,
      ts: Date.now()
    });

    writeRecords(records);

    state.recorded = true;
    state.usedMs = usedMs;
    saveAttempt(storeKey, state);

    return {
      records: records,
      usedMs: usedMs,
      selected: selected
    };
  }

  function renderControlCenter(settings) {
    function activeClass(on) {
      return on ? " cc-active" : "";
    }

    function yesNo(on) {
      return on ? "开" : "关";
    }

    var html = "";

    html += '<div id="cc-overlay" class="cc-overlay">';
    html += '<div class="cc-panel">';
    html += '<button class="cc-close" data-cc-action="close">×</button>';
    html += '<div class="cc-title">Control Center</div>';
    html += '<div class="cc-grid">';

    html += '<button class="cc-btn' + activeClass(settings.animation) + '" data-cc-action="toggle-animation"><span>✨</span><b>动画</b><em>' + yesNo(settings.animation) + '</em></button>';
    html += '<button class="cc-btn' + activeClass(settings.random) + '" data-cc-action="toggle-random"><span>🔀</span><b>随机选项</b><em>' + yesNo(settings.random) + '</em></button>';
    html += '<button class="cc-btn' + activeClass(settings.pure) + '" data-cc-action="toggle-pure"><span>◻️</span><b>纯色模式</b><em>' + yesNo(settings.pure) + '</em></button>';
    html += '<button class="cc-btn' + activeClass(settings.showStats) + '" data-cc-action="toggle-stats"><span>📊</span><b>反面统计</b><em>' + yesNo(settings.showStats) + '</em></button>';
    html += '<button class="cc-btn' + activeClass(settings.showAnalysis) + '" data-cc-action="toggle-analysis"><span>📖</span><b>原书解析</b><em>' + yesNo(settings.showAnalysis) + '</em></button>';
    html += '<button class="cc-btn" data-cc-action="clear-current"><span>🧹</span><b>清空本题</b><em>重选</em></button>';
    html += '<button class="cc-btn cc-danger" data-cc-action="reset-stats"><span>↺</span><b>重置统计</b><em>清零</em></button>';

    html += '</div>';
    html += '<div class="cc-tip">统计仅保存在本机 Anki 模板内，不等于 Anki 官方统计。</div>';
    html += '</div>';
    html += '</div>';

    return html;
  }

  function render() {
    var target = document.getElementById("quiz-card");
    var sideEl = document.getElementById("side-flag");

    if (!target || !sideEl) return;

    var side = sideEl.getAttribute("data-side") || "front";
    var settings = readSettings();

    var rawQuestion = getText("raw-question");
    var rawBack = getText("raw-back");
    var combined = splitCombinedQuestion(rawQuestion, rawBack);

    var q = parseQuestion(combined.front);
    var b = parseBack(combined.back);

    var answer = normalizeAnswer(b.answer);
    b.answer = answer;

    var type = b.type || q.type || (answer.length > 1 ? "多选" : "单选");
    var storeKey = makeKey(q, b);

    var state;
    var selected = "";
    var usedMs = 0;
    var records = readRecords();

    if (side === "front") {
      state = readAttempt(storeKey);

      if (!state || state.recorded) {
        state = createAttempt(storeKey);
      }

      selected = normalizeAnswer(state.selected);
    }

    if (side === "back") {
      state = readAttempt(storeKey) || {};
      var result = recordIfNeeded(storeKey, q, b, type, state);
      records = result.records;
      usedMs = result.usedMs;
      selected = result.selected;
    }

    var optionKeys = getOptionKeys(q, settings, state, storeKey, side);
    var selectedArr = selected ? selected.split("") : [];
    var answerArr = answer ? answer.split("") : [];

    var cardCls = "quiz-card";

    if (!settings.animation) cardCls += " no-motion";
    if (settings.pure) cardCls += " pure-mode";

    var html = "";

    html += '<div class="' + cardCls + '">';

    html += '<div class="top-area">';
    html += '<button type="button" id="control-pill" class="control-pill">Control Center</button>';
    html += '</div>';

    html += '<div class="question">';
    html += '<span class="q-type">【' + escapeHtml(type) + '】</span>';
    html += escapeHtml(q.question);
    html += '</div>';

    html += '<div class="options">';

    optionKeys.forEach(function (key) {
      var cls = "option";

      if (side === "front" && selectedArr.indexOf(key) !== -1) {
        cls += " selected";
      }

      if (side === "back") {
        if (answerArr.indexOf(key) !== -1) {
          cls += " correct";
        } else if (selectedArr.indexOf(key) !== -1) {
          cls += " wrong";
        } else {
          cls += " dim";
        }
      }

      html += '<div class="' + cls + '" data-choice="' + key + '">';
      html += '<span class="option-label">' + key + '.</span>';
      html += '<span>' + escapeHtml(q[key]) + '</span>';
      html += '</div>';
    });

    html += '</div>';

    if (b.tag) {
      html += '<div class="tag-row">';

      b.tag.split(/[\/｜|]/).forEach(function (t) {
        t = t.trim();

        if (t) {
          html += '<span class="tag">' + escapeHtml(t) + '</span>';
        }
      });

      html += '</div>';
    }

    if (side === "front") {
      html += '<div class="bottom-line">👀 看答案</div>';
    }

    if (side === "back") {
      if (settings.showStats) {
        html += renderStatsRow(answer, selected, type, records, usedMs);
      }

      html += '<div class="answer-box">';
      html += '<div class="answer-title">答案：' + escapeHtml(answer || "未填写") + '</div>';
      html += '<div class="answer-title">你的选择：' + escapeHtml(selected || "暂无") + '</div>';

      if (b.analysis) {
        html += '<button type="button" class="analysis-toggle" id="analysis-toggle">' + (settings.showAnalysis ? "隐藏解析" : "显示解析") + '</button>';
        html += '<div id="analysis-content" class="analysis" style="display:' + (settings.showAnalysis ? "block" : "none") + ';">解析：' + escapeHtml(b.analysis) + '</div>';
      }

      html += '</div>';
    }

    html += renderControlCenter(settings);
    html += '</div>';

    target.innerHTML = html;

    bindControlCenter(storeKey);
    bindAnalysisToggle();

    if (side === "front") {
      bindOptionClick(storeKey, type);
    }
  }

  function bindOptionClick(storeKey, type) {
    var options = Array.prototype.slice.call(document.querySelectorAll(".option"));

    options.forEach(function (option) {
      option.addEventListener("click", function () {
        var state = readAttempt(storeKey) || createAttempt(storeKey);
        var choice = option.getAttribute("data-choice") || "";
        var selected = normalizeAnswer(state.selected || "");
        var arr = selected ? selected.split("") : [];

        if (type === "多选") {
          if (arr.indexOf(choice) !== -1) {
            arr.splice(arr.indexOf(choice), 1);
          } else {
            arr.push(choice);
          }

          arr.sort();
          selected = arr.join("");
        } else {
          selected = choice;
        }

        state.selected = selected;
        saveAttempt(storeKey, state);

        options.forEach(function (item) {
          var key = item.getAttribute("data-choice") || "";

          item.classList.remove("selected");

          if (selected.indexOf(key) !== -1) {
            item.classList.add("selected");
          }
        });
      });
    });
  }

  function bindAnalysisToggle() {
    var btn = document.getElementById("analysis-toggle");
    var box = document.getElementById("analysis-content");

    if (!btn || !box) return;

    btn.addEventListener("click", function () {
      var visible = box.style.display !== "none";
      box.style.display = visible ? "none" : "block";
      btn.innerText = visible ? "显示解析" : "隐藏解析";
    });
  }

  function bindControlCenter(storeKey) {
    var pill = document.getElementById("control-pill");
    var overlay = document.getElementById("cc-overlay");

    if (!pill || !overlay) return;

    function open() {
      overlay.classList.add("show");
    }

    function close() {
      overlay.classList.remove("show");
    }

    pill.addEventListener("click", open);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) {
        close();
      }
    });

    Array.prototype.slice.call(overlay.querySelectorAll("[data-cc-action]")).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var action = btn.getAttribute("data-cc-action");
        var settings = readSettings();

        if (action === "close") {
          close();
          return;
        }

        if (action === "toggle-animation") settings.animation = !settings.animation;
        if (action === "toggle-random") settings.random = !settings.random;
        if (action === "toggle-pure") settings.pure = !settings.pure;
        if (action === "toggle-stats") settings.showStats = !settings.showStats;
        if (action === "toggle-analysis") settings.showAnalysis = !settings.showAnalysis;

        if (action === "clear-current") {
          removeAttempt(storeKey);
          render();
          return;
        }

        if (action === "reset-stats") {
          try {
            localStorage.removeItem(RECORDS_KEY);
          } catch (e) {}

          render();
          return;
        }

        writeSettings(settings);
        render();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();`

const SYSTEM_CARD_TEMPLATES = [
  { id: 'qa', name: '问答题', description: '问题、答案。', mode: 'plain', builtIn: true },
  { id: 'cloze', name: '填空题', description: '可用 {{c1::内容}} 做填空。', mode: 'plain', builtIn: true },
  { id: 'note', name: '摘录题', description: '摘录、说明、补充。', mode: 'plain', builtIn: true },
  {
    id: 'html',
    name: 'HTML',
    description: '正面和背面直接作为 HTML 渲染。',
    mode: 'html',
    builtIn: true,
    frontCode: '{{Front}}',
    backCode: '{{Back}}',
    css: '',
    js: '',
  },
  {
    id: 'quiz-choice-control-center',
    name: '选择题（控制中心）',
    description: '单选/多选题模板：选项点击、正反面统计、解析开关和 Control Center。',
    mode: 'html',
    builtIn: true,
    frontCode: QUIZ_CHOICE_FRONT_CODE,
    backCode: QUIZ_CHOICE_BACK_CODE,
    css: QUIZ_CHOICE_CSS,
    js: QUIZ_CHOICE_JS,
  },
  {
    id: 'word-basic',
    name: '单词',
    description: '适合词条、释义、例句。',
    mode: 'html',
    builtIn: true,
    frontCode: '<section class="word-card-front">{{Front}}</section>',
    backCode: '<section class="word-card-back">{{Back}}</section>',
    css: '.word-card-front{font-size:32px;font-weight:800;line-height:1.35}.word-card-back{font-size:16px;line-height:1.75}.word-card-back b,.word-card-back strong{color:#059669}',
    js: '',
  },
]

function getStoredCardTemplates(data) {
  return Array.isArray(data?.profile?.cardTemplates) ? data.profile.cardTemplates : []
}

function normalizeCardTemplate(template = {}) {
  const id = String(template.id || `template-${Date.now()}`)
  return {
    id,
    name: String(template.name || '新模板').trim() || '新模板',
    description: String(template.description || '').trim(),
    mode: template.mode === 'plain' ? 'plain' : 'html',
    frontCode: String(template.frontCode ?? '{{Front}}'),
    backCode: String(template.backCode ?? '{{Back}}'),
    css: String(template.css ?? ''),
    js: String(template.js ?? ''),
    builtIn: Boolean(template.builtIn),
    createdAt: template.createdAt ?? Date.now(),
    updatedAt: template.updatedAt ?? Date.now(),
  }
}

function getCardTemplates(data) {
  const userTemplates = getStoredCardTemplates(data)
    .map(normalizeCardTemplate)
    .filter((template) => !SYSTEM_CARD_TEMPLATES.some((item) => item.id === template.id))
  return [...SYSTEM_CARD_TEMPLATES, ...userTemplates]
}

export { SYSTEM_CARD_TEMPLATES, getStoredCardTemplates, normalizeCardTemplate, getCardTemplates }
