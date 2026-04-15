/* script.js — نسخة UAE مع تتبع تصحيحي مفصل (console logs) */

let merged = [];
let branchInfo =[];

fetch("information.json")
   .then((r) => r.json())
   .then((data) => {
      branchInfo = data["ورقة1"] || [];
      console.log(
         "🟢 [DEBUG] information.json loaded, branches:",
         branchInfo.length
      );
   })
   .catch((e) => console.error("❌ خطأ في تحميل information.json:", e));

/* التحليل — UAE فقط */
document.getElementById("analyze-btn").addEventListener("click", () => {
   console.log("🔵 [DEBUG] Analyze Button Clicked");

   try {
      const textArea = document.getElementById("visa-text");
      if (!textArea) {
         console.error("🔴 [ERROR] visa-text textarea NOT FOUND!");
         alert("لم يتم إيجاد مربع نص التقرير!");
         return;
      }

      const text = textArea.value || "";
      console.log("🟢 [DEBUG] Loaded text length:", text.length);

      if (!text.trim()) {
         console.error("🔴 [ERROR] Text is empty!");
         alert("الرجاء إدخال محتوى التقرير");
         return;
      }

      console.log("🟡 [DEBUG] Running parseMerchantReportUAE (UAE only)");
      const raw = parseMerchantReportUAE(text);
      console.log("🟢 [DEBUG] RAW RESULT (terminals):", raw.length);

      console.log("🟡 [DEBUG] Running mergeTerminals");
      merged = mergeTerminals(raw);
      console.log("🟢 [DEBUG] Merged terminals count:", merged.length);
      if (merged.length > 0)
         console.log("🟢 [DEBUG] Sample merged[0]:", merged[0]);

      console.log("🟡 [DEBUG] Rendering totals table");
      renderTotalsTable(merged);
      console.log("🟢 [DEBUG] Table render completed");

      const select = document.getElementById("terminal-select");
      if (!select) {
         console.warn(
            "⚠️ terminal-select element not found (skipping populateTerminalSelect)"
         );
      } else {
         select.innerHTML = "";
         populateTerminalSelect(merged);
         console.log("🟢 [DEBUG] Terminal select populated");
      }
   } catch (err) {
      console.error("🔴[FATAL] Uncaught error in Analyze handler:", err);
      alert("خطأ غير متوقع — راجع الكونسول");
   }
});

/* ======================
   دالة تحليل كشف الإمارات مع تتبُّع مفصّل
   ====================== */
function parseMerchantReportUAE(text) {
   console.log("🔵 [DEBUG] parseMerchantReportUAE START");
   
   // التقاط الكشف سواء كان MERCHANT أو IC++ DISABLED MERCHANT
   const merchantBlocks = text.split(/^.*?\bMERCHANT:/m).slice(1);
   console.log("🔵 [DEBUG] merchantBlocks found:", merchantBlocks.length);

   const terminals =[];
   const txRegex = /^(\d{12})\s+\d+\s+\d+\s+\d+\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+([A-Z0-9]+)\s+(\d{6}\*{6}\d{4}).*?(-?\d+\.\d+)\s+AED/;
   const altTxRegex = /^(\d{12}).*?(\d{6}\*{6}\d{4}).*?(-?\d+\.\d+)\s+AED/;
   const adjRegex = /^(\d{12})\s+\d+\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+([A-Z]+)\s+([A-Za-z]+).*?(-?\d+\.\d+)\s+AED/i;

   // متغير لإظهار التنبيه بوجود DccPay
   let foundDccPay = false;

   merchantBlocks.forEach((block, idx) => {
      try {
         console.log(`\n🔶 [BLOCK ${idx}] length: ${block.length}`);
         const lines = block.replace(/\r/g, "").split("\n");
         
         let terminalIdForBlock = null;
         const txs = [];
         let totalCandidates =[];

         for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];
            const line = rawLine.replace(/[\u200F\u200E\u202A-\u202E]/g, "").trim();
            if (!line) continue;

            const m = line.match(txRegex);
            if (m) {
               const terminalFromLine = m[1];
               if (!terminalIdForBlock) terminalIdForBlock = terminalFromLine;

               txs.push({
                  terminal: terminalFromLine,
                  month: m[2],
                  day: m[3],
                  hour: m[4],
                  minute: m[5],
                  type: m[6],
                  cardNumber: m[7].slice(-4),
                  amount: parseFloat(m[8]),
                  rawLine: line,
               });
               continue;
            }

            const alt = line.match(altTxRegex);
            if (alt) {
               const terminalFromLine = alt[1];
               if (!terminalIdForBlock) terminalIdForBlock = terminalFromLine;
               
               txs.push({
                  terminal: terminalFromLine,
                  month: null, day: null, hour: null, minute: null, type: null,
                  cardNumber: alt[2].slice(-4),
                  amount: parseFloat(alt[3]),
                  rawLine: line,
               });
               continue;
            }

            // التقاط الحركات التسوية أو الحوافز مثل DccPay
            const adj = line.match(adjRegex);
            if (adj) {
               const terminalFromLine = adj[1];
               if (!terminalIdForBlock) terminalIdForBlock = terminalFromLine;

               foundDccPay = true; // تفعيل التنبيه

               txs.push({
                  terminal: terminalFromLine,
                  month: adj[2], day: adj[3], hour: adj[4], minute: adj[5],
                  type: adj[6] + " " + adj[7],
                  cardNumber: "DccPay", // نميزها بهذا الاسم
                  amount: parseFloat(adj[8]),
                  rawLine: line,
               });
               continue;
            }

            const nums = line.match(/-?\d+\.\d+/g);
            if (nums && /AED/i.test(line)) {
               totalCandidates.push({ lineIndex: i, line, nums });
            }
         }

         let gross = null, net = null;
         
         // استخراج إجماليات البلوك
         for (let j = lines.length - 1; j >= 0; j--) {
            const l = lines[j].replace(/[\u200F\u200E\u202A-\u202E]/g, "").trim();
            if (!l) continue;
            if (/\bTotal\b/i.test(l) && /AED/i.test(l)) {
               const nums = l.match(/-?\d+\.\d+/g);
               if (nums && nums.length >= 1) {
                  gross = parseFloat(nums[0]);
                  net = parseFloat(nums[4]);
                  break;
               }
            }
            const nums2 = l.match(/-?\d+\.\d+/g);
            if (nums2 && nums2.length >= 2 && /AED/i.test(l)) {
               gross = parseFloat(nums2[0]);
               net = parseFloat(nums2[nums2.length - 1]);
               break;
            }
         }

         if (gross === null && net === null && totalCandidates.length > 0) {
            const cand = totalCandidates.find((c) => c.nums && c.nums.length >= 2);
            if (cand) {
               gross = parseFloat(cand.nums[0]);
               net = parseFloat(cand.nums[cand.nums.length - 1]);
            }
         }

         // === [التعديل الجوهري المطلوب] ===
         // إذا كانت هذه الصفحة/البلوك تحتوي على DccPay، نجعل قيمة المبيعات (gross) صفراً
         // لكي تضاف قيمة الـ net للبنك وتُخصم من المصاريف، دون أن تمس المبيعات.
         const isDccPayBlock = txs.some(t => t.cardNumber === "DccPay");
         if (isDccPayBlock) {
             console.log(`🔶 [BLOCK ${idx}] DccPay detected. Overriding Gross from ${gross} to 0. Net is ${net}`);
             gross = 0; 
         }
         // ===============================

         if (!terminalIdForBlock && txs.length > 0) terminalIdForBlock = txs[0].terminal;
         if (!terminalIdForBlock && txs.length === 0) return;

         terminals.push({
            terminalId: terminalIdForBlock || "UNKNOWN",
            transactions: txs,
            total: { gross: gross, net: net },
            rawBlock: block.slice(0, 200),
         });
      } catch (blockErr) {
         console.error(`🔴 [ERROR] while processing block ${idx}:`, blockErr);
      }
   }); 

   // إظهار التنبيه للمستخدم إذا تم العثور على DccPay
   if (foundDccPay) {
      setTimeout(() => {
         alert("⚠️ تنبيه: تم العثور على حركات 'DccPay' في هذا الكشف. تمت إضافة قيمتها إلى صافي البنك وتخفيضها من المصاريف دون المساس بإجمالي المبيعات بنجاح.");
      }, 500);
   }

   console.log("🔵 [DEBUG] parseMerchantReportUAE END — terminals:", terminals.length);
   return terminals;
}

/* ======================
   دمج التيرمينالات مع جمع الإجماليات
   ====================== */
function mergeTerminals(terminals) {
   const map = {};

   if (!Array.isArray(terminals)) return[];

   terminals.forEach((item, idx) => {
      try {
         if (!item || typeof item !== "object") return;
         
         const id = item.terminalId || item.terminal || "UNKNOWN";
         
         if (!map[id]) {
            map[id] = {
               terminalId: id,
               transactions:[],
               total: { gross: 0, net: 0 }, 
            };
         }

         if (Array.isArray(item.transactions)) {
            map[id].transactions.push(...item.transactions);
         }

         if (item.total) {
            if (typeof item.total.gross === "number") {
               let currentGross = map[id].total.gross || 0;
               map[id].total.gross = currentGross + item.total.gross;
            }
            if (typeof item.total.net === "number") {
               let currentNet = map[id].total.net || 0;
               map[id].total.net = currentNet + item.total.net;
            }
         }
      } catch (mergeErr) {
         console.error(`🔴 [ERROR] while merging item ${idx}:`, mergeErr, item);
      }
   });

   return Object.values(map);
}

/* ======================
   عرض جدول الإجماليات
   ====================== */
function renderTotalsTable(data) {
   const tbody = document.getElementById("totals-body");
   if (!tbody) return;
   tbody.innerHTML = "";

   if (!Array.isArray(data)) return;

   data.forEach((item, idx) => {
      try {
         const id = item.terminalId || "UNKNOWN";
         const gross = item.total && item.total.gross != null ? item.total.gross.toFixed(3) : "-";
         const net = item.total && item.total.net != null ? item.total.net.toFixed(3) : "-";
         const diff = item.total && item.total.gross != null && item.total.net != null
               ? (item.total.gross - item.total.net).toFixed(3) : "-";

         const branch = branchInfo.find(
            (b) => String(b["Terminal ID"]).slice(-4) === String(id).slice(-4)
         ) || { name: "غير معروف", "account id": "-", "bank account": "-" };

         const trMain = document.createElement("tr");
         trMain.innerHTML = `
        <td>${branch.name}</td>
        <td>${id}</td>
        <td>${gross}</td>
        <td>${net}</td>
        <td><button class="toggle-btn">⬇️</button></td>`;

         const trDetails = document.createElement("tr");
         trDetails.classList.add("details-row");
         trDetails.style.display = "none";

         const detailsTable = `
        <table class="inner-table" border="1">
          <tr><th>Net</th><th>Fixed</th><th>Account</th></tr>
          <tr><td>${net}</td><td>0</td><td>${branch["bank account"]}</td></tr>
          <tr><td>${diff}</td><td>0</td><td>5210</td></tr>
          <tr><td>0</td><td>${gross}</td><td>${branch["account id"]}</td></tr>
        </table>`;

         const tdDetails = document.createElement("td");
         tdDetails.colSpan = 6;
         tdDetails.innerHTML = detailsTable;
         trDetails.appendChild(tdDetails);

         const btn = trMain.querySelector(".toggle-btn");
         btn.addEventListener("click", () => {
            const isOpen = trDetails.style.display === "table-row";
            trDetails.style.display = isOpen ? "none" : "table-row";
            btn.classList.toggle("rotate", !isOpen);
         });

         tbody.appendChild(trMain);
         tbody.appendChild(trDetails);
      } catch (renderErr) {
         console.error("🔴 [ERROR] while rendering row", idx, renderErr, item);
      }
   });
}

/* ======================
   populateTerminalSelect
   ====================== */
function populateTerminalSelect(data) {
   const select = document.getElementById("terminal-select");
   if (!select) return;
   select.innerHTML = "";

   const allOpt = document.createElement("option");
   allOpt.value = "ALL";
   allOpt.textContent = "الكل — (جميع الفروع)";
   select.appendChild(allOpt);

   if (!Array.isArray(data)) return;

   data.forEach((item) => {
      const id = item.terminalId || "UNKNOWN";
      const branch = branchInfo.find((b) => String(b["Terminal ID"]).slice(-4) === String(id).slice(-4)) || {};
      const text = branch.name ? `${branch.name} — (${id})` : id;
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = text;
      select.appendChild(opt);
   });
}

/* ========== دوال الفواتير والمقارنة ========== */
function parseInvoices(text) {
   const lines = (text || "").replace(/\r/g, "").split("\n").map((l) => l.trim());
   const invoices =[];
   const singleLineRegex = /^(\d{6,})\s+(.+?)\s+([\d.]+)\s*(?:[^\d\n]*?(?:رقم البطاقة|Card Number)\s*[:：]?\s*(\d{3,4}))?/i;
   for (let i = 0; i < lines.length; i++) {
      let L = lines[i].replace(/[\u200F\u200E\u202A-\u202E]/g, "");
      let m = L.match(singleLineRegex);
      if (m) {
         const invId = m[1], branchName = m[2] ? m[2].trim() : null, amount = parseFloat(m[3]);
         let cardSearching = m[4] ? m[4] : null;
         if (!cardSearching) {
            for (let k = i + 1; k <= i + 3 && k < lines.length; k++) {
               const m2 = lines[k].match(/(?:رقم البطاقة|Card Number)\s*[:：]?\s*(\d{3,4})/i);
               if (m2) { cardSearching = m2[1]; break; }
            }
         }
         invoices.push({ invoiceId: invId, branchName, amount, cardNumber: cardSearching });
         continue;
      }
      const alt = L.match(/^(\d{6,})\s+([\d.]+)\s*$/);
      if (alt) {
         const invId = alt[1], amount = parseFloat(alt[2]);
         let cardFound = null;
         for (let k = i + 1; k <= i + 4 && k < lines.length; k++) {
            const m2 = lines[k].match(/(?:رقم البطاقة|Card Number)\s*[:：]?\s*(\d{3,4})/i);
            if (m2) { cardFound = m2[1]; break; }
         }
         invoices.push({ invoiceId: invId, branchName: null, amount, cardNumber: cardFound });
      }
   }
   return invoices;
}

function compareInvoicesToRecords(invoices, records, options, branchAccountId) {
   const results =[];
   const usedInvoices = new Set();
   const usedRecords = new Set();
   if (options.showExact) {
      invoices.forEach((inv, i) => {
         const matchIdx = records.findIndex(
            (r, j) => !usedRecords.has(j) && r.cardNumber === inv.cardNumber && Math.abs(r.amount - inv.amount) < 0.001
         );
         if (matchIdx !== -1) {
            results.push({ type: "مطابقة تامة ✅", invoiceIndex: i, recordIndex: matchIdx, invoice: inv, record: records[matchIdx] });
            usedInvoices.add(i); usedRecords.add(matchIdx);
         }
      });
   }
   if (options.showCardOnly) {
      invoices.forEach((inv, i) => {
         if (usedInvoices.has(i)) return;
         const matchIdx = records.findIndex((r, j) => !usedRecords.has(j) && r.cardNumber === inv.cardNumber);
         if (matchIdx !== -1) {
            results.push({ type: "اختلاف في القيمة ⚠️", invoiceIndex: i, recordIndex: matchIdx, invoice: inv, record: records[matchIdx] });
            usedInvoices.add(i); usedRecords.add(matchIdx);
         }
      });
   }
   if (options.showAmountOnly) {
      invoices.forEach((inv, i) => {
         if (usedInvoices.has(i)) return;
         const matchIdx = records.findIndex((r, j) => !usedRecords.has(j) && Math.abs(r.amount - inv.amount) < 0.001);
         if (matchIdx !== -1) {
            results.push({ type: "اختلاف في رقم البطاقة ⚠️", invoiceIndex: i, recordIndex: matchIdx, invoice: inv, record: records[matchIdx] });
            usedInvoices.add(i); usedRecords.add(matchIdx);
         }
      });
   }
   if (options.showInvoiceOnly)
      invoices.forEach((inv, i) => {
         if (usedInvoices.has(i)) return;
         results.push({ type: "فاتورة دون كشف ❌", invoiceIndex: i, recordIndex: null, invoice: inv, record: null });
      });
   if (options.showRecordOnly)
      records.forEach((r, j) => {
         if (usedRecords.has(j)) return;
         results.push({ type: "كشف دون فاتورة ⚠️", invoiceIndex: null, recordIndex: j, invoice: null, record: r });
      });
   results.sort((a, b) => {
      const rank = { "مطابقة تامة ✅": 0, "اختلاف في القيمة ⚠️": 1, "اختلاف في رقم البطاقة ⚠️": 2, "فاتورة دون كشف ❌": 3, "كشف دون فاتورة ⚠️": 4 };
      return (rank[a.type] || 9) - (rank[b.type] || 9);
   });
   return results;
}

/* ========== زر المقارنة الأساسي ========== */
document.getElementById("compare-btn")?.addEventListener("click", () => {
   try {
      const invoicesText = document.getElementById("invoice-input")?.value || "";
      const invoices = parseInvoices(invoicesText);
      const terminalId = document.getElementById("terminal-select")?.value;
      let records =[];

      if (terminalId === "ALL") {
         merged.forEach((t) => records.push(...t.transactions));
      } else {
         const term = merged.find((t) => String(t.terminalId) === String(terminalId));
         if (!term) { alert("لا يوجد سجلات لهذا التيرمينال"); return; }
         records = term.transactions;
      }

      const options = {
         showExact: document.getElementById("showExact")?.checked,
         showCardOnly: document.getElementById("showCardOnly")?.checked,
         showAmountOnly: document.getElementById("showAmountOnly")?.checked,
         showInvoiceOnly: document.getElementById("showInvoiceOnly")?.checked,
         showRecordOnly: document.getElementById("showRecordOnly")?.checked,
      };

      const results = compareInvoicesToRecords(invoices, records, options, null);
      renderCompareResults(results);
   } catch (err) {
      console.error("🔴[COMPARE] Fatal error:", err);
      alert("حدث خطأ غير متوقع أثناء عملية المقارنة");
   }
});

/* ======================
   وظائف إدارة الأخطاء (Local Storage)
   ====================== */
function loadErrors() {
    try { return JSON.parse(localStorage.getItem("visaErrors") || "[]"); } 
    catch { return[]; }
}

function saveErrors(list) {
    localStorage.setItem("visaErrors", JSON.stringify(list));
}

function addErrorRecord(obj) {
    const list = loadErrors();
    const exists = list.find(e => e.invoiceId === obj.invoiceId && e.cardNumber === obj.cardNumber);
    if (exists) { alert("هذا الخطأ مسجل بالفعل!"); return; }
    list.push(obj);
    saveErrors(list);
    alert("✅ تم ترحيل الخطأ إلى صفحة الأخطاء بنجاح");
}

/* ======================
   عرض نتائج المقارنة
   ====================== */
function renderCompareResults(results) {
   const container = document.getElementById("compare-results");
   if (!container) return;
   container.innerHTML = ""; 

   if (results.length === 0) {
      container.innerHTML = "<h3>لا توجد نتائج للمقارنة</h3>";
      return;
   }

   const currentErrors = loadErrors();
   const groups = {};
   const unknownKey = "UNMATCHED_INVOICES"; 

   results.forEach((r) => {
      let key = unknownKey;
      if (r.record && r.record.terminal) {
         key = r.record.terminal;
      } else if (r.invoice && r.invoice.branchName) {
         const foundBranch = branchInfo.find(b => b.name && r.invoice.branchName && b.name.trim() === r.invoice.branchName.trim());
         if (foundBranch && foundBranch["Terminal ID"]) { key = foundBranch["Terminal ID"]; }
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
   });

   const keys = Object.keys(groups).sort((a, b) => {
       if (a === unknownKey) return 1;
       if (b === unknownKey) return -1;
       return a.localeCompare(b);
   });

   keys.forEach((termId) => {
      const groupResults = groups[termId];
      const branch = branchInfo.find(b => String(b["Terminal ID"]).slice(-4) === String(termId).slice(-4));
      const branchName = branch ? branch.name : (termId === unknownKey ? "غير معروف" : "فرع غير معروف");
      const accountId = branch ? branch["account id"] : "";

      let titleText = termId === unknownKey 
          ? `⚠️ فواتير أو سجلات مجهولة المصدر (${groupResults.length})` 
          : `🏢 ${branchName} - (Terminal: ${termId}) - العدد: ${groupResults.length}`;

      const section = document.createElement("div");
      section.className = "terminal-section";
      section.style.marginBottom = "30px";
      
      const header = document.createElement("h3");
      header.style.backgroundColor = termId === unknownKey ? "#e74c3c" : "#2c3e50";
      header.style.color = "#fff";
      header.style.padding = "10px";
      header.textContent = titleText;
      section.appendChild(header);

      const tableHTML = `
        <table class="results-table" style="width:100%; border-collapse: collapse;">
            <thead>
                <tr style="background-color: #f2f2f2;">
                    <th>النوع</th>
                    <th>رقم الفاتورة</th>
                    <th>رقم البطاقة</th>
                    <th>قيمة الفاتورة</th>
                    <th>قيمة السجل</th>
                    <th>إجراءات</th>
                </tr>
            </thead>
            <tbody>
                ${groupResults.map((r) => {
                    let rowColor = r.type.includes("مطابقة") ? "#e8f5e9" : (r.type.includes("غير موجودة") ? "#ffebee" : "#fff3e0");
                    const invId = r.invoice?.invoiceId || "-";
                    const cardNum = r.invoice?.cardNumber || r.record?.cardNumber || "-";
                    const invAmt = r.invoice?.amount || 0;
                    const recAmt = r.record?.amount || 0;
                    const bName = branchName; 
                    const bAcc = accountId;
                    const isAlreadySaved = currentErrors.some(e => e.invoiceId === invId && e.cardNumber === cardNum);

                    let btnHTML = "";
                    if (!r.type.includes("مطابقة")) {
                        if (isAlreadySaved) {
                             btnHTML = `<button disabled style="background:#95a5a6; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:not-allowed;">تم الترحيل ✅</button>`;
                        } else {
                             btnHTML = `
                                <button onclick='addErrorFromRow(this, "${invId}", "${cardNum}", ${invAmt}, ${recAmt}, "${bName}", "${bAcc}")' 
                                        style="background:#e67e22; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:3px;">
                                    ترحيل للأخطاء
                                </button>
                             `;
                        }
                    } else {
                        btnHTML = `<span style="color:green; font-weight:bold;">✅</span>`;
                    }

                    return `
                    <tr style="background-color: ${rowColor};">
                        <td>${r.type}</td>
                        <td>${invId}</td>
                        <td>${cardNum}</td>
                        <td>${invAmt}</td>
                        <td>${recAmt}</td>
                        <td style="text-align:center;">${btnHTML}</td>
                    </tr>
                    `;
                }).join("")}
            </tbody>
        </table>
      `;

      section.innerHTML += tableHTML;
      container.appendChild(section);
   });
}

window.addErrorFromRow = function(btnElement, invId, cardNum, invAmt, recAmt, bName, bAcc) {
    const list = loadErrors();
    const exists = list.find(e => e.invoiceId === invId && e.cardNumber === cardNum);
    
    if (exists) {
        alert("هذا الخطأ مسجل بالفعل!");
        btnElement.innerText = "تم الترحيل ✅";
        btnElement.style.background = "#95a5a6";
        btnElement.style.cursor = "not-allowed";
        btnElement.disabled = true;
        return;
    }

    list.push({
        invoiceId: invId,
        cardNumber: cardNum,
        invoiceValue: invAmt,
        reportValue: recAmt,
        branchName: bName,
        branchAccountId: bAcc,
        errorType: 0
    });
    saveErrors(list);

    btnElement.innerText = "تم الترحيل ✅";
    btnElement.style.background = "#95a5a6";
    btnElement.style.cursor = "not-allowed";
    btnElement.disabled = true;
};
