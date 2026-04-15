/* script.js — نسخة UAE مع تتبع تصحيحي مفصل (console logs) */

let merged = [];
let branchInfo = [];

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
      console.error("🔴 [FATAL] Uncaught error in Analyze handler:", err);
      alert("خطأ غير متوقع — راجع الكونسول");
   }
});

/* ======================
   دالة تحليل كشف الإمارات مع تتبُّع مفصّل
   ====================== */
function parseMerchantReportUAE(text) {
   console.log("🔵 [DEBUG] parseMerchantReportUAE START");
   
   // 👇 التعديل الأول: تعديل الـ Regex ليقص الكشف سواء كان MERCHANT أو IC++ DISABLED MERCHANT
   const merchantBlocks = text.split(/^.*?\bMERCHANT:/m).slice(1);
   console.log("🔵 [DEBUG] merchantBlocks found:", merchantBlocks.length);

   const terminals =[];
   const txRegex =
      /^(\d{12})\s+\d+\s+\d+\s+\d+\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+([A-Z0-9]+)\s+(\d{6}\*{6}\d{4}).*?(-?\d+\.\d+)\s+AED/;
   const altTxRegex = /^(\d{12}).*?(\d{6}\*{6}\d{4}).*?(-?\d+\.\d+)\s+AED/;
   const adjRegex = /^(\d{12})\s+\d+\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+([A-Z]+)\s+([A-Za-z]+).*?(-?\d+\.\d+)\s+AED/i;

   // 👇 متغير لمراقبة وجود سجلات DccPay
   let foundDccPay = false;

   merchantBlocks.forEach((block, idx) => {
      try {
         console.log(`\n🔶 [BLOCK ${idx}] length: ${block.length}`);
         const lines = block.replace(/\r/g, "").split("\n");
         console.log(
            `🔶 [BLOCK ${idx}] lines: ${lines.length} — preview:`,
            lines.slice(0, 3)
         );

         let terminalIdForBlock = null;
         const txs = [];
         let totalCandidates =[];

         for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];
            const line = rawLine
               .replace(/[\u200F\u200E\u202A-\u202E]/g, "")
               .trim();
            if (!line) continue;

            const m = line.match(txRegex);
            if (m) {
               const terminalFromLine = m[1];
               if (!terminalIdForBlock) terminalIdForBlock = terminalFromLine;

               const month = m[2],
                  day = m[3],
                  hour = m[4],
                  minute = m[5];
               const tranType = m[6],
                  cardMasked = m[7],
                  amount = parseFloat(m[8]);

               txs.push({
                  terminal: terminalFromLine,
                  month,
                  day,
                  hour,
                  minute,
                  type: tranType,
                  cardNumber: cardMasked.slice(-4),
                  amount,
                  rawLine: line,
               });
               continue;
            }

            const alt = line.match(altTxRegex);
            if (alt) {
               const terminalFromLine = alt[1];
               if (!terminalIdForBlock) terminalIdForBlock = terminalFromLine;
               const cardMasked = alt[2],
                  amount = parseFloat(alt[3]);
               txs.push({
                  terminal: terminalFromLine,
                  month: null,
                  day: null,
                  hour: null,
                  minute: null,
                  type: null,
                  cardNumber: cardMasked.slice(-4),
                  amount,
                  rawLine: line,
               });
               continue;
            }

            const adj = line.match(adjRegex);
            if (adj) {
               const terminalFromLine = adj[1];
               if (!terminalIdForBlock) terminalIdForBlock = terminalFromLine;

               const month = adj[2],
                  day = adj[3],
                  hour = adj[4],
                  minute = adj[5];
               const tranType = adj[6] + " " + adj[7]; 
               const amount = parseFloat(adj[8]);

               // تسجيل أنه تم العثور على حركة DccPay ليتم التنبيه بها لاحقاً
               foundDccPay = true;

               txs.push({
                  terminal: terminalFromLine,
                  month,
                  day,
                  hour,
                  minute,
                  type: tranType,
                  cardNumber: "DccPay", 
                  amount,
                  rawLine: line,
               });
               continue;
            }

            const nums = line.match(/-?\d+\.\d+/g);
            if (nums && /AED/i.test(line)) {
               totalCandidates.push({ lineIndex: i, line, nums });
            }
         } // نهاية حلقة الأسطر

         console.log(
            `🔶 [BLOCK ${idx}] txs found: ${txs.length}, totalCandidates: ${totalCandidates.length}, terminalIdForBlock: ${terminalIdForBlock}`
         );

         let gross = null,
            net = null;
         for (let j = lines.length - 1; j >= 0; j--) {
            const l = lines[j]
               .replace(/[\u200F\u200E\u202A-\u202E]/g, "")
               .trim();
            if (!l) continue;
            if (/\bTotal\b/i.test(l) && /AED/i.test(l)) {
               const nums = l.match(/-?\d+\.\d+/g);
               console.log(
                  `🔶 [BLOCK ${idx}] Found Total line at ${j}:`,
                  l,
                  "nums:",
                  nums
               );
               if (nums && nums.length >= 1) {
                  gross = parseFloat(nums[0]);
                  net = parseFloat(nums[4]);
                  break;
               }
            }
            const nums2 = l.match(/-?\d+\.\d+/g);
            if (nums2 && nums2.length >= 2 && /AED/i.test(l)) {
               console.log(
                  `🔶 [BLOCK ${idx}] Found AED-with-multi-nums at ${j}:`,
                  l,
                  "nums2:",
                  nums2
               );
               gross = parseFloat(nums2[0]);
               net = parseFloat(nums2[nums2.length - 1]);
               break;
            }
         }

         if (gross === null && net === null && totalCandidates.length > 0) {
            const cand = totalCandidates.find(
               (c) => c.nums && c.nums.length >= 2
            );
            if (cand) {
               console.log(
                  `🔶 [BLOCK ${idx}] Using candidate from line ${cand.lineIndex}`
               );
               gross = parseFloat(cand.nums[0]);
               net = parseFloat(cand.nums[cand.nums.length - 1]);
            }
         }

         if (!terminalIdForBlock && txs.length > 0) {
            terminalIdForBlock = txs[0].terminal;
            console.warn(
               `⚠️ [BLOCK ${idx}] No terminalId found in headers — taking from first tx: ${terminalIdForBlock}`
            );
         }

         if (!terminalIdForBlock && txs.length === 0) {
            console.warn(
               `⚠️ [BLOCK ${idx}] No terminal and no txs — skipping block`
            );
            return;
         }

         console.log(
            `🔶[BLOCK ${idx}] pushing terminal: ${terminalIdForBlock}, txs: ${txs.length}, gross:${gross}, net:${net}`
         );
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

   // 👇 التعديل الثاني: إظهار رسالة تنبيه إذا تم التقاط DccPay
   if (foundDccPay) {
      setTimeout(() => {
         alert("⚠️ تنبيه: يحتوي هذا الكشف على سجلات DccPay (مكافآت أو تسويات بدون رقم بطاقة). وقد تمت إضافتها للإجماليات بنجاح.");
      }, 500); // تأخير نصف ثانية لضمان ظهور التنبيه بعد بناء الجدول لتجربة مستخدم أفضل
   }

   console.log(
      "🔵 [DEBUG] parseMerchantReportUAE END — terminals:",
      terminals.length
   );
   return terminals;
}

/* ======================
   دمج التيرمينالات مع جمع الإجماليات (تصحيح الخطأ)
   ====================== */
function mergeTerminals(terminals) {
   console.log(
      "🔵 [DEBUG] mergeTerminals START with input length:",
      Array.isArray(terminals) ? terminals.length : typeof terminals
   );
   const map = {};

   if (!Array.isArray(terminals)) {
      console.error(
         "🔴 [ERROR] mergeTerminals expected array but got:",
         terminals
      );
      return [];
   }

   terminals.forEach((item, idx) => {
      try {
         if (!item || typeof item !== "object") {
            console.warn(`⚠️ [merge] skipping invalid item at ${idx}:`, item);
            return;
         }
         // تحديد مفتاح التجميع (رقم التيرمينال)
         const id = item.terminalId || item.terminal || "UNKNOWN";
         
         // تهيئة الكائن في الذاكرة إذا لم يكن موجوداً
         if (!map[id]) {
            map[id] = {
               terminalId: id,
               transactions: [],
               total: { gross: 0, net: 0 }, // نبدأ من الصفر لضمان الجمع الصحيح
            };
         }

         // دمج العمليات (Transactions)
         if (Array.isArray(item.transactions)) {
            map[id].transactions.push(...item.transactions);
         } else {
            console.warn(
               `⚠️ [merge] item.transactions not array for id ${id} at index ${idx}:`,
               item.transactions
            );
         }

         // دمج المجاميع (Totals) - هنا التعديل الجوهري للجمع
         if (item.total) {
            // جمع Gross
            if (typeof item.total.gross === "number") {
               // نتأكد أن القيمة الحالية رقم، إذا لم تكن كذلك نعتبرها صفر
               let currentGross = map[id].total.gross || 0;
               map[id].total.gross = currentGross + item.total.gross;
            }
            
            // جمع Net
            if (typeof item.total.net === "number") {
               let currentNet = map[id].total.net || 0;
               map[id].total.net = currentNet + item.total.net;
            }
         }
      } catch (mergeErr) {
         console.error(`🔴 [ERROR] while merging item ${idx}:`, mergeErr, item);
      }
   });

   const arr = Object.values(map);
   console.log("🟢 [DEBUG] mergeTerminals END — merged count:", arr.length);
   
   // طباعة عينة للتأكد من الجمع
   if (arr.length > 0) {
       console.log("🟢 [DEBUG] Sample Merged Total:", arr[0].terminalId, arr[0].total);
   }
   
   return arr;
}

/* ======================
   عرض جدول الإجماليات — مع حماية وتتبُّع
   ====================== */
function renderTotalsTable(data) {
   console.log(
      "🔵 [DEBUG] renderTotalsTable called with:",
      Array.isArray(data) ? data.length : typeof data
   );
   const tbody = document.getElementById("totals-body");
   if (!tbody) {
      console.error("🔴 [ERROR] totals-body element not found");
      return;
   }
   tbody.innerHTML = "";

   if (!Array.isArray(data)) {
      console.error(
         "🔴 [ERROR] renderTotalsTable expects array, got:",
         typeof data
      );
      return;
   }

   data.forEach((item, idx) => {
      try {
         const id = item.terminalId || "UNKNOWN";
         const gross =
            item.total && item.total.gross != null
               ? item.total.gross.toFixed(3)
               : "-";
         const net =
            item.total && item.total.net != null
               ? item.total.net.toFixed(3)
               : "-";
         const diff =
            item.total && item.total.gross != null && item.total.net != null
               ? (item.total.gross - item.total.net).toFixed(3)
               : "-";

         const branch = branchInfo.find(
            (b) => String(b["Terminal ID"]).slice(-4) === String(id).slice(-4)
         ) || {
            name: "غير معروف",
            "account id": "-",
            "bank account": "-",
         };

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
   populateTerminalSelect مع حماية
   ====================== */
function populateTerminalSelect(data) {
   console.log(
      "🔵 [DEBUG] populateTerminalSelect called with:",
      Array.isArray(data) ? data.length : typeof data
   );
   const select = document.getElementById("terminal-select");
   if (!select) {
      console.warn("⚠️ terminal-select not found, skipping population");
      return;
   }
   select.innerHTML = "";

   const allOpt = document.createElement("option");
   allOpt.value = "ALL";
   allOpt.textContent = "الكل — (جميع الفروع)";
   select.appendChild(allOpt);

   if (!Array.isArray(data)) return;

   data.forEach((item) => {
      const id = item.terminalId || "UNKNOWN";
      const branch =
         branchInfo.find(
            (b) => String(b["Terminal ID"]).slice(-4) === String(id).slice(-4)
         ) || {};
      const text = branch.name ? `${branch.name} — (${id})` : id;
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = text;
      select.appendChild(opt);
   });
}

/* ========== دوال الفواتير والمقارنة البسيطة (بدون تغيير كبير) ========== */

function parseInvoices(text) {
   const lines = (text || "")
      .replace(/\r/g, "")
      .split("\n")
      .map((l) => l.trim());
   const invoices = [];
   const singleLineRegex =
      /^(\d{6,})\s+(.+?)\s+([\d.]+)\s*(?:[^\d\n]*?(?:رقم البطاقة|Card Number)\s*[:：]?\s*(\d{3,4}))?/i;
   for (let i = 0; i < lines.length; i++) {
      let L = lines[i].replace(/[\u200F\u200E\u202A-\u202E]/g, "");
      let m = L.match(singleLineRegex);
      if (m) {
         const invId = m[1],
            branchName = m[2] ? m[2].trim() : null,
            amount = parseFloat(m[3]),
            card = m[4] ? m[4] : null;
         let cardSearching = card;
         if (!cardSearching) {
            for (let k = i + 1; k <= i + 3 && k < lines.length; k++) {
               const m2 = lines[k].match(
                  /(?:رقم البطاقة|Card Number)\s*[:：]?\s*(\d{3,4})/i
               );
               if (m2) {
                  cardSearching = m2[1];
                  break;
               }
            }
         }
         invoices.push({
            invoiceId: invId,
            branchName,
            amount,
            cardNumber: cardSearching,
         });
         continue;
      }
      const alt = L.match(/^(\d{6,})\s+([\d.]+)\s*$/);
      if (alt) {
         const invId = alt[1],
            amount = parseFloat(alt[2]);
         let cardFound = null;
         for (let k = i + 1; k <= i + 4 && k < lines.length; k++) {
            const m2 = lines[k].match(
               /(?:رقم البطاقة|Card Number)\s*[:：]?\s*(\d{3,4})/i
            );
            if (m2) {
               cardFound = m2[1];
               break;
            }
         }
         invoices.push({
            invoiceId: invId,
            branchName: null,
            amount,
            cardNumber: cardFound,
         });
      }
   }
   return invoices;
}

function compareInvoicesToRecords(invoices, records, options, branchAccountId) {
   const results = [];
   const usedInvoices = new Set();
   const usedRecords = new Set();
   if (options.showExact) {
      invoices.forEach((inv, i) => {
         const matchIdx = records.findIndex(
            (r, j) =>
               !usedRecords.has(j) &&
               r.cardNumber === inv.cardNumber &&
               Math.abs(r.amount - inv.amount) < 0.001
         );
         if (matchIdx !== -1) {
            results.push({
               type: "مطابقة تامة ✅",
               invoiceIndex: i,
               recordIndex: matchIdx,
               invoice: inv,
               record: records[matchIdx],
            });
            usedInvoices.add(i);
            usedRecords.add(matchIdx);
         }
      });
   }
   if (options.showCardOnly) {
      invoices.forEach((inv, i) => {
         if (usedInvoices.has(i)) return;
         const matchIdx = records.findIndex(
            (r, j) => !usedRecords.has(j) && r.cardNumber === inv.cardNumber
         );
         if (matchIdx !== -1) {
            results.push({
               type: "اختلاف في القيمة ⚠️",
               invoiceIndex: i,
               recordIndex: matchIdx,
               invoice: inv,
               record: records[matchIdx],
            });
            usedInvoices.add(i);
            usedRecords.add(matchIdx);
         }
      });
   }
   if (options.showAmountOnly) {
      invoices.forEach((inv, i) => {
         if (usedInvoices.has(i)) return;
         const matchIdx = records.findIndex(
            (r, j) =>
               !usedRecords.has(j) && Math.abs(r.amount - inv.amount) < 0.001
         );
         if (matchIdx !== -1) {
            results.push({
               type: "اختلاف في رقم البطاقة ⚠️",
               invoiceIndex: i,
               recordIndex: matchIdx,
               invoice: inv,
               record: records[matchIdx],
            });
            usedInvoices.add(i);
            usedRecords.add(matchIdx);
         }
      });
   }
   if (options.showInvoiceOnly)
      invoices.forEach((inv, i) => {
         if (usedInvoices.has(i)) return;
         results.push({
            type: "فاتورة دون كشف ❌",
            invoiceIndex: i,
            recordIndex: null,
            invoice: inv,
            record: null,
         });
      });
   if (options.showRecordOnly)
      records.forEach((r, j) => {
         if (usedRecords.has(j)) return;
         results.push({
            type: "كشف دون فاتورة ⚠️",
            invoiceIndex: null,
            recordIndex: j,
            invoice: null,
            record: r,
         });
      });
   results.sort((a, b) => {
      const rank = {
         "مطابقة تامة ✅": 0,
         "اختلاف في القيمة ⚠️": 1,
         "اختلاف في رقم البطاقة ⚠️": 2,
         "فاتورة دون كشف ❌": 3,
         "كشف دون فاتورة ⚠️": 4,
      };
      return (rank[a.type] || 9) - (rank[b.type] || 9);
   });
   return results;
}

/* أخيراً: وظائف حفظ الأخطاء (بسيطة) */
function loadErrors() {
   try {
      return JSON.parse(localStorage.getItem("visaErrors") || "[]");
   } catch {
      return [];
   }
}
function saveErrors(list) {
   localStorage.setItem("visaErrors", JSON.stringify(list));
}
function addErrorRecord(obj) {
   const list = loadErrors();
   list.push(obj);
   saveErrors(list);
   console.log("🟢 [DEBUG] Error record added:", obj);
}

console.log("🟢 [INIT] debug-enabled script loaded");

/* ========== زر المقارنة الأساسي ========== */
document.getElementById("compare-btn")?.addEventListener("click", () => {
   console.log("🔵 [COMPARE] Button clicked");

   try {
      const invoicesText = document.getElementById("invoice-input")?.value || "";
      const invoices = parseInvoices(invoicesText);

      console.log("🟢 [COMPARE] Invoices parsed:", invoices.length);

      const terminalId = document.getElementById("terminal-select")?.value;
      console.log("🟢 [COMPARE] Selected terminal:", terminalId);

      let records = [];

      if (terminalId === "ALL") {
         // جمع كل التيرمينالات
         merged.forEach((t) => records.push(...t.transactions));
         console.log(
            "🟢 [COMPARE] Using ALL terminals, records:",
            records.length
         );
      } else {
         const term = merged.find(
            (t) => String(t.terminalId) === String(terminalId)
         );
         if (!term) {
            console.error("🔴 [COMPARE] Terminal not found in merged!");
            alert("لا يوجد سجلات لهذا التيرمينال");
            return;
         }
         records = term.transactions;
         console.log("🟢 [COMPARE] Records for terminal:", records.length);
      }

const options = {
    showExact: document.getElementById("showExact")?.checked,
    showCardOnly: document.getElementById("showCardOnly")?.checked,
    showAmountOnly: document.getElementById("showAmountOnly")?.checked,
    showInvoiceOnly: document.getElementById("showInvoiceOnly")?.checked,
    showRecordOnly: document.getElementById("showRecordOnly")?.checked,
};


      console.log("🟢 [COMPARE] Options:", options);

      const results = compareInvoicesToRecords(
         invoices,
         records,
         options,
         null
      );

      console.log("🟢 [COMPARE] Results:", results.length);

      renderCompareResults(results);
   } catch (err) {
      console.error("🔴 [COMPARE] Fatal error:", err);
      alert("حدث خطأ غير متوقع أثناء عملية المقارنة");
   }
});

/* ======================
   وظائف إدارة الأخطاء (Local Storage) داخل الصفحة الرئيسية
   ====================== */
function loadErrors() {
    try { return JSON.parse(localStorage.getItem("visaErrors") || "[]"); } 
    catch { return []; }
}

function saveErrors(list) {
    localStorage.setItem("visaErrors", JSON.stringify(list));
}

function addErrorRecord(obj) {
    const list = loadErrors();
    // تجنب التكرار بناء على رقم الفاتورة والبطاقة
    const exists = list.find(e => e.invoiceId === obj.invoiceId && e.cardNumber === obj.cardNumber);
    if (exists) {
        alert("هذا الخطأ مسجل بالفعل!");
        return;
    }
    list.push(obj);
    saveErrors(list);
    alert("✅ تم ترحيل الخطأ إلى صفحة الأخطاء بنجاح");
}

/* ======================
   عرض نتائج المقارنة (مع زر ذكي يتحقق من الحالة)
   ====================== */
function renderCompareResults(results) {
   const container = document.getElementById("compare-results");
   if (!container) return;

   container.innerHTML = ""; 

   if (results.length === 0) {
      container.innerHTML = "<h3>لا توجد نتائج للمقارنة</h3>";
      return;
   }

   // تحميل الأخطاء الحالية لمعرفة ما تم ترحيله مسبقاً
   const currentErrors = loadErrors();

   // 1. تجميع النتائج
   const groups = {};
   const unknownKey = "UNMATCHED_INVOICES"; 

   results.forEach((r) => {
      let key = unknownKey;
      if (r.record && r.record.terminal) {
         key = r.record.terminal;
      } else if (r.invoice && r.invoice.branchName) {
         const foundBranch = branchInfo.find(b => 
            b.name && r.invoice.branchName && 
            b.name.trim() === r.invoice.branchName.trim()
         );
         if (foundBranch && foundBranch["Terminal ID"]) {
            key = foundBranch["Terminal ID"];
         }
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
   });

   // 2. إنشاء الجداول
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

                    // التحقق هل هذا العنصر تم ترحيله مسبقاً؟
                    const isAlreadySaved = currentErrors.some(e => e.invoiceId === invId && e.cardNumber === cardNum);

                    let btnHTML = "";
                    if (!r.type.includes("مطابقة")) {
                        if (isAlreadySaved) {
                             btnHTML = `<button disabled style="background:#95a5a6; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:not-allowed;">تم الترحيل ✅</button>`;
                        } else {
                             // لاحظ تمرير 'this' كأول باراميتر
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

// دالة الترحيل المعدلة لتستقبل الزر وتغير لونه
window.addErrorFromRow = function(btnElement, invId, cardNum, invAmt, recAmt, bName, bAcc) {
    // محاولة الحفظ
    const list = loadErrors();
    const exists = list.find(e => e.invoiceId === invId && e.cardNumber === cardNum);
    
    if (exists) {
        alert("هذا الخطأ مسجل بالفعل!");
        // إذا كان موجوداً مسبقاً (ربما من جلسة أخرى)، نحدث الزر فقط
        btnElement.innerText = "تم الترحيل ✅";
        btnElement.style.background = "#95a5a6";
        btnElement.style.cursor = "not-allowed";
        btnElement.disabled = true;
        return;
    }

    // إضافة الجديد
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

    // تحديث شكل الزر فوراً ليعرف المستخدم أنه ضغطه
    btnElement.innerText = "تم الترحيل ✅";
    btnElement.style.background = "#95a5a6";
    btnElement.style.cursor = "not-allowed";
    btnElement.disabled = true;
};
