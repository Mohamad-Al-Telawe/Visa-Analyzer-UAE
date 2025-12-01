// ============================
// errors_feature_code.js (مصحح بالكامل)
// ============================

// ============================
// Load / Save
// ============================
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

// لإضافة خطأ من script.js
function addErrorRecord(obj) {
   const list = loadErrors();
   list.push(obj);
   saveErrors(list);
}

// ============================
// عرض الأخطاء grouped حسب الفرع
// ============================
function renderErrorsGrouped() {
   const container = document.getElementById("errors-container");
   container.innerHTML = "";

   const list = loadErrors();

   if (!list.length) {
      container.innerHTML = "<p>لا توجد أخطاء مسجلة.</p>";
      return;
   }

   // تجميع حسب اسم الفرع
   const grouped = {};
   list.forEach((err) => {
      if (!grouped[err.branchName]) grouped[err.branchName] = [];
      grouped[err.branchName].push(err);
   });

   // إنشاء مجموعة لكل فرع
   Object.keys(grouped).forEach((branch) => {
      const groupBox = document.createElement("div");
      groupBox.className = "error-group";

      const title = document.createElement("h2");
      title.textContent = `فرع: ${branch}`;
      groupBox.appendChild(title);

      // زر الواتساب (مرة واحدة لكل فرع)
      const cards = grouped[branch].map((e) => e.cardNumber).filter(Boolean);

      const msg =
         `بعتلي أرقام البطاقات الخاصة بفرع ${branch}:\n\n` +
         cards.map((c) => `• ${c}`).join("\n");

      const whatsappBtn = document.createElement("a");
      whatsappBtn.className = "whatsapp-btn";
      whatsappBtn.href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      whatsappBtn.target = "_blank";
      whatsappBtn.textContent = "📲 إرسال أرقام البطاقات عبر الواتساب";
      groupBox.appendChild(whatsappBtn);

      // جدول الأخطاء
      const table = document.createElement("table");
      table.innerHTML = `
      <thead>
         <tr>
            <th>رقم الفاتورة</th>
            <th>رقم البطاقة</th>
            <th>القيمة بالفاتورة</th>
            <th>القيمة بالتقرير</th>
            <th>نوع الخطأ</th>
            <th>السند</th>
            <th>تحكم</th>
         </tr>
      </thead>
    `;

      const tbody = document.createElement("tbody");

      grouped[branch].forEach((err) => {
         const globalIndex = list.indexOf(err);

         const tr = document.createElement("tr");
         tr.innerHTML = `
        <td>${err.invoiceId}</td>
        <td>${err.cardNumber}</td>
        <td>${err.invoiceValue}</td>
        <td>${err.reportValue}</td>
        <td>
          <input type="number" min="0" max="4" class="err-type-input" data-i="${globalIndex}" value="${
            err.errorType || 0
         }">
        </td>
        <td>
          <button class="voucher-btn" data-i="${globalIndex}">إظهار السند</button>
        </td>
        <td>
          <button class="edit-btn" data-i="${globalIndex}">تعديل</button>
          <button class="delete-btn" data-i="${globalIndex}">حذف</button>
        </td>
      `;

         tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      groupBox.appendChild(table);
      container.appendChild(groupBox);
   });
}

// ============================
// Edit / Delete
// ============================
function deleteRecord(i) {
   const list = loadErrors();
   if (i < 0 || i >= list.length) return;
   list.splice(i, 1);
   saveErrors(list);
   renderErrorsGrouped();
}

function editRecord(i) {
   const list = loadErrors();
   const obj = list[i];
   if (!obj) return;

   obj.invoiceValue =
      prompt("القيمة في الفاتورة", obj.invoiceValue) || obj.invoiceValue;
   obj.reportValue =
      prompt("القيمة في الكشف", obj.reportValue) || obj.reportValue;
   obj.invoiceId = prompt("رقم الفاتورة", obj.invoiceId) || obj.invoiceId;
   obj.cardNumber = prompt("رقم البطاقة", obj.cardNumber) || obj.cardNumber;
   obj.branchName = prompt("اسم الفرع", obj.branchName) || obj.branchName;
   obj.errorType =
      parseInt(prompt("نوع الخطأ (1-4)", obj.errorType) || obj.errorType) || 0;

   list[i] = obj;
   saveErrors(list);
   renderErrorsGrouped();
}

// ============================
// توليد مودال السند (تستخدم generateVoucherHTML)
// ============================
function generateVoucherHTML(err) {
   const diff = (
      parseFloat(err.reportValue || 0) - parseFloat(err.invoiceValue || 0)
   ).toFixed(3);

   let ContentError = "";

   switch (err.errorType) {
      case 0:
         ContentError = `
            <h3>السند (نوع 0) — لم يتم تحديد نوع الخطأ بعد</h3>
            <p style="color:#a00; font-weight:bold; text-align:center;">
               ⚠ الرجاء تحديد نوع الخطأ أولاً ليتم إنشاء السند بشكل صحيح
            </p>
         `;
         break;

      case 1:
         ContentError = `
            <h3>السند (نوع 1) نقص والسحب صحيح</h3>
            <table border="1" width="100%" style="text-align:center; margin-top:8px;">
               
            <tr>
               <td>
                  ${Math.abs(diff)}
               </td>
               <td>
                  0     
               </td>
               <td>
                  52121
               </td>
               <td>
                  نقص في قيمةالكشف رقم البطاقة ${err.cardNumber} السحب صحيح ورقم الفاتورة ${err.invoiceId}
               </td>
            </tr>
            <tr>
               <td>
               0     
               </td>
               <td>
               ${Math.abs(diff)}
               </td>
               <td>
                  ${err.branchAccountId || "-"}
               </td>
               <td>
                  نقص في قيمةالكشف رقم البطاقة ${err.cardNumber} السحب صحيح ورقم الفاتورة ${err.invoiceId}
               </td>
            </tr>
            </table>
         `;
         break;

      case 2:
         ContentError = `
            <h3>السند (نوع 2)</h3>
            <p>هنا نموذج نوع 2… (سنكمله لاحقاً حسب طلبك)</p>
         `;
         break;

      case 3:
         ContentError = `
            <h3>السند (نوع 3)</h3>
            <p>هنا نموذج نوع 3…</p>
         `;
         break;

      case 4:
         ContentError = `
            <h3>السند (نوع 4)</h3>
            <p>هنا نموذج نوع 4…</p>
         `;
         break;

      default:
         ContentError = `<h3>نوع غير معروف</h3>`;
         break;
   }

   return ContentError;
}

function ensureModalElements() {
   if (document.getElementById("voucher-modal")) return;
   const modal = document.createElement("div");
   modal.id = "voucher-modal";
   modal.style.cssText =
      "display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); justify-content:center; align-items:center; z-index:9999;";
   modal.innerHTML = `
    <div class="modal-box" style="background:#fff; padding:18px; border-radius:10px; max-width:700px; width:92%; box-shadow:0 6px 30px rgba(0,0,0,0.3);">
      <span class="close-modal" style="float:left; cursor:pointer; font-size:22px;">×</span>
      <div id="voucher-body"></div>
    </div>
  `;
   document.body.appendChild(modal);

   modal.querySelector(".close-modal").addEventListener("click", () => {
      modal.style.display = "none";
   });
   modal.addEventListener("click", (ev) => {
      if (ev.target === modal) modal.style.display = "none";
   });
}

function showVoucherModal(err) {
   const modal = document.getElementById("voucher-modal");
   const body = document.getElementById("voucher-body");

   body.innerHTML = generateVoucherHTML(err);

   modal.style.display = "flex";

   document.querySelector(".close-modal").onclick = () => {
      modal.style.display = "none";
   };

   modal.onclick = (ev) => {
      if (ev.target === modal) modal.style.display = "none";
   };
}

// ============================
// ربط الأزرار (تغيير النوع، السند، الحذف، التعديل)
// ============================
function attachErrorsHandlers() {
   document.addEventListener("click", (e) => {
      const target = e.target;

      // تغيير نوع الخطأ (input)
      if (target.classList.contains("err-type-input")) {
         const list = loadErrors();
         const idx = parseInt(target.dataset.i);
         if (!Number.isNaN(idx) && list[idx]) {
            list[idx].errorType = parseInt(target.value) || 0;
            saveErrors(list);
         }
         return;
      }

      // حذف
      if (target.classList.contains("delete-btn")) {
         const idx = parseInt(target.dataset.i);
         deleteRecord(idx);
         return;
      }

      // تعديل
      if (target.classList.contains("edit-btn")) {
         const idx = parseInt(target.dataset.i);
         editRecord(idx);
         return;
      }

      // إظهار السند (مودال)
      if (target.classList.contains("voucher-btn")) {
         const idx = parseInt(target.dataset.i);
         const list = loadErrors();
         if (!Number.isNaN(idx) && list[idx]) {
            showVoucherModal(list[idx]);
         }
         return;
      }
   });
}

// تأكد استدعاء attachHandlers بعد تحميل الصفحة
// attachErrorsHandlers(); // لا تستدعيها هنا إذا كنت تستدعيها من HTML كما تفعل الآن
