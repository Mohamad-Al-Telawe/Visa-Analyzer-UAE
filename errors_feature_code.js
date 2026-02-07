// ============================
// errors_feature_code.js (معدل)
// ============================

function loadErrors() {
   try { return JSON.parse(localStorage.getItem("visaErrors") || "[]"); } catch { return []; }
}
function saveErrors(list) {
   localStorage.setItem("visaErrors", JSON.stringify(list));
}

// عرض الأخطاء
function renderErrorsGrouped() {
   const container = document.getElementById("errors-container");
   container.innerHTML = "";

   const list = loadErrors();
   if (!list.length) {
      container.innerHTML = "<p style='text-align:center; padding:20px;'>لا توجد أخطاء مرحلة حالياً.</p>";
      return;
   }

   const grouped = {};
   list.forEach((err) => {
      const bName = err.branchName || "غير معروف";
      if (!grouped[bName]) grouped[bName] = [];
      grouped[bName].push(err);
   });

   Object.keys(grouped).forEach((branch) => {
      const groupBox = document.createElement("div");
      groupBox.className = "error-group";
      groupBox.style.cssText = "background:#fff; margin-bottom:20px; padding:15px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);";

      const title = document.createElement("h2");
      title.textContent = `فرع: ${branch}`;
      title.style.borderBottom = "2px solid #eee";
      groupBox.appendChild(title);

      // زر الواتساب
      const cards = grouped[branch].map((e) => e.cardNumber).filter(c => c && c !== "-");
      if(cards.length > 0){
          const msg = `فرع ${branch} بعتلي البطاقات التالية من مبيعات أمس:\n` + cards.map((c) => `• ${c}`).join("\n");
          const whatsappBtn = document.createElement("a");
          whatsappBtn.href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
          whatsappBtn.target = "_blank";
          whatsappBtn.textContent = "📲 إرسال أرقام البطاقات (WhatsApp)";
          whatsappBtn.style.cssText = "display:inline-block; margin:10px 0; background:#25D366; color:white; padding:8px 15px; text-decoration:none; border-radius:5px;";
          groupBox.appendChild(whatsappBtn);
      }

      const table = document.createElement("table");
      table.style.width = "100%";
      table.border = "1";
      table.style.borderCollapse = "collapse";
      table.style.marginTop = "10px";
      
      table.innerHTML = `
      <thead style="background:#f9f9f9;">
         <tr>
            <th>رقم الفاتورة</th>
            <th>رقم البطاقة</th>
            <th>بالفاتورة</th>
            <th>بالكشف</th>
            <th>نوع الخطأ (0-4)</th>
            <th>خيارات</th>
         </tr>
      </thead>
      `;

      const tbody = document.createElement("tbody");

      grouped[branch].forEach((err) => {
         // البحث عن الاندكس الأصلي في المصفوفة الكاملة للحذف والتعديل
         const globalIndex = list.indexOf(err);

         const tr = document.createElement("tr");
         tr.innerHTML = `
        <td style="padding:8px;">${err.invoiceId}</td>
        <td style="padding:8px;">${err.cardNumber}</td>
        <td style="padding:8px;">${err.invoiceValue}</td>
        <td style="padding:8px;">${err.reportValue}</td>
        <td style="padding:8px; text-align:center;">
          <input type="number" min="0" max="4" class="err-type-input" data-i="${globalIndex}" value="${err.errorType || 0}" style="width:50px; text-align:center;">
        </td>
        <td style="padding:8px; text-align:center;">
          <button class="voucher-btn" data-i="${globalIndex}" style="background:#3498db; color:white; border:none; padding:5px; margin:2px; cursor:pointer;">السند</button>
          <button class="edit-btn" data-i="${globalIndex}" style="background:#f1c40f; color:black; border:none; padding:5px; margin:2px; cursor:pointer;">تعديل</button>
          <button class="delete-btn" data-i="${globalIndex}" style="background:#e74c3c; color:white; border:none; padding:5px; margin:2px; cursor:pointer;">حذف</button>
        </td>
      `;
         tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      groupBox.appendChild(table);
      container.appendChild(groupBox);
   });
}

function deleteRecord(i) {
   const list = loadErrors();
   list.splice(i, 1);
   saveErrors(list);
   renderErrorsGrouped();
}

/* ======================
   دالة التعديل الشاملة (تعديل الـ 5 قيم)
   ====================== */
function editRecord(i) {
   const list = loadErrors();
   const obj = list[i];
   if (!obj) return;

   // 1. تعديل رقم الفاتورة
   let newInvId = prompt("1/5: تعديل رقم الفاتورة (Invoice ID):", obj.invoiceId);
   if (newInvId === null) return; // إذا ضغط Cancel نوقف العملية
   obj.invoiceId = newInvId;

   // 2. تعديل رقم البطاقة
   let newCard = prompt("2/5: تعديل رقم البطاقة (Card Number):", obj.cardNumber);
   if (newCard === null) return;
   obj.cardNumber = newCard;

   // 3. تعديل القيمة في الفاتورة
   let newInvVal = prompt("3/5: تعديل القيمة في الفاتورة (Invoice Value):", obj.invoiceValue);
   if (newInvVal === null) return;
   obj.invoiceValue = newInvVal;

   // 4. تعديل القيمة في الكشف
   let newRepVal = prompt("4/5: تعديل القيمة في الكشف (Report Value):", obj.reportValue);
   if (newRepVal === null) return;
   obj.reportValue = newRepVal;

   // 5. تعديل نوع الخطأ
   let newErrType = prompt("5/5: تعديل نوع الخطأ (من 0 إلى 4):", obj.errorType);
   if (newErrType === null) return;
   
   // التأكد من أن نوع الخطأ رقم
   let parsedType = parseInt(newErrType);
   if (isNaN(parsedType) || parsedType < 0 || parsedType > 4) {
       alert("قيمة نوع الخطأ غير صحيحة، تم الإبقاء على القيمة القديمة.");
   } else {
       obj.errorType = parsedType;
   }

   // حفظ التغييرات وإعادة الرسم
   list[i] = obj;
   saveErrors(list);
   renderErrorsGrouped();
   
   // تنبيه صغير للتأكيد
   // setTimeout(() => alert("تم تعديل السجل بنجاح"), 100);
}

function attachErrorsHandlers() {
    // استخدام change بدلاً من click للـ input
    document.addEventListener("change", (e) => {
        if (e.target.classList.contains("err-type-input")) {
            const list = loadErrors();
            const idx = parseInt(e.target.dataset.i);
            if (!isNaN(idx) && list[idx]) {
                list[idx].errorType = parseInt(e.target.value) || 0;
                saveErrors(list);
                // لا نعيد الرسم هنا لكي لا يفقد الـ focus، القيمة حفظت
            }
        }
    });

    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("delete-btn")) {
            deleteRecord(parseInt(e.target.dataset.i));
        }
        else if (e.target.classList.contains("edit-btn")) {
            editRecord(parseInt(e.target.dataset.i));
        }
        else if (e.target.classList.contains("voucher-btn")) {
            const list = loadErrors();
            const idx = parseInt(e.target.dataset.i);
            if(list[idx]) showVoucherModal(list[idx]);
        }
    });
}

// --- Voucher Logic ---
function generateVoucherHTML(err) {
    const diff = Math.abs((parseFloat(err.reportValue||0) - parseFloat(err.invoiceValue||0))).toFixed(3);
    const accId = err.branchAccountId || "غير محدد";
    const note = `الفرق بين الفاتورة ${err.invoiceId} والكشف (بطاقة ${err.cardNumber})`;

    if (err.errorType == 0) return `<h3>⚠ الرجاء تحديد نوع الخطأ أولاً (حالياً 0)</h3>`;
    
    // نموذج 1: نقص (مثال)
    if (err.errorType == 1) {
        return `
        <h3 style="text-align:center;">سند قيد (نقص بالكشف)</h3>
        <table border="1" style="width:100%; text-align:center; border-collapse:collapse;">
            <tr style="background:#eee;"><th>مدين</th><th>دائن</th><th>رقم الحساب</th><th>البيان</th></tr>
            <tr><td>${diff}</td><td>0</td><td>52121</td><td>${note}</td></tr>
            <tr><td>0</td><td>${diff}</td><td>${accId}</td><td>${note}</td></tr>
        </table>`;
    }
    
    // باقي النماذج يمكن إضافتها هنا
    return `<h3>نموذج رقم ${err.errorType} قيد الإنشاء...</h3><p>المبلغ: ${diff} | حساب الفرع: ${accId}</p>`;
}

function showVoucherModal(err) {
    const modal = document.getElementById("voucher-modal");
    if(!modal) return; // تأكد من وجود المودال في HTML
    
    const body = document.getElementById("voucher-body");
    body.innerHTML = generateVoucherHTML(err);
    modal.style.display = "flex";
    
    // إغلاق المودال
    const closeBtn = modal.querySelector(".close-modal");
    if(closeBtn) closeBtn.onclick = () => modal.style.display = "none";
    modal.onclick = (e) => { if(e.target === modal) modal.style.display = "none"; }
}