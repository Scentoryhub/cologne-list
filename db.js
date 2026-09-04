// ==========================================
// db.js - 产品数据管理中心
// ==========================================

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRFWYImNbJ0ao5z0VDk_VZwhOP1pnY2UZdFuwxtYOvKaNfEX4sInJh7uk-MlRSH9kffdZ5TjzhudLao/pub?gid=1536830284&single=true&output=csv";

// 缓存时间 (1分钟)
const CACHE_DURATION = 1 * 60 * 1000;

window.perfumeDB = [];

document.addEventListener("DOMContentLoaded", () => {
  initProductData();
});

async function initProductData() {
  // Use a dedicated cache version for the warehouse-based catalog.
  const cacheKey = "perfumeDB_Warehouse_Data_V9";
  const timeKey = "perfumeDB_Warehouse_Time_V9";
  const fallbackKey = "perfumeDB_Last_Valid_Data";

  const now = new Date().getTime();
  const cachedTime = localStorage.getItem(timeKey);
  const cachedData = localStorage.getItem(cacheKey);

  function readValidCache(rawData) {
    if (!rawData) return null;
    try {
      const parsed = JSON.parse(rawData);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  const cachedProducts = readValidCache(cachedData);

  // 1. 尝试加载缓存
  if (cachedProducts && cachedTime && now - cachedTime < CACHE_DURATION) {
    console.log("🚀 加载缓存数据");
    window.perfumeDB = cachedProducts;
    runPageLogic();
    return;
  }

  // 2. 下载新数据
  console.log("🌐 下载最新数据...");
  try {
    const response = await fetch(`${SHEET_URL}&_=${now}`, { cache: "no-store" });
    if (!response.ok) throw new Error("网络响应错误");
    const data = await response.text();
    const products = parseCSV(data);
    if (products.length === 0) throw new Error("产品数据为空");
    window.perfumeDB = products;

    // 存入缓存
    localStorage.setItem(cacheKey, JSON.stringify(window.perfumeDB));
    localStorage.setItem(timeKey, now);
    localStorage.setItem(fallbackKey, JSON.stringify(window.perfumeDB));

    runPageLogic();
  } catch (error) {
    console.error("下载失败:", error);
    // 数据源异常时保留上一次成功加载的商品，避免页面突然变空。
    const fallbackProducts =
      cachedProducts ||
      readValidCache(localStorage.getItem(fallbackKey)) ||
      readValidCache(localStorage.getItem("perfumeDB_Warehouse_Data_V8")) ||
      readValidCache(localStorage.getItem("perfumeDB_Warehouse_Data_V7")) ||
      readValidCache(localStorage.getItem("perfumeDB_Warehouse_Data_V5")) ||
      readValidCache(localStorage.getItem("perfumeDB_Warehouse_Data_V4"));
    if (fallbackProducts) {
      window.perfumeDB = fallbackProducts;
      runPageLogic();
      alert("网络较慢，已加载离线数据");
    }
  }
}

function runPageLogic() {
  // 确保首页和购物车逻辑存在才执行
  if (typeof renderHome === "function") renderHome();
  if (typeof renderCart === "function") renderCart();
}

function getShippingCost(totalQuantity) {
  const quantity = Number(totalQuantity) || 0;
  if (quantity <= 0) return 0;
  if (quantity === 1) return 10;
  if (quantity === 2) return 15;
  return 0;
}

function buildWhatsAppOrderMessage(items, discountTiers) {
  const cart = (Array.isArray(items) ? items : []).filter(
    (item) => (Number(item.quantity) || 0) > 0,
  );
  let totalQty = 0;
  let lvCount = 0;
  let otherCount = 0;
  let subtotal = 0;
  const warehouseGroups = new Map();

  cart.forEach((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.price) || 0;
    const warehouseCode = String(item.warehouse || "")
      .trim()
      .toUpperCase()
      .replace(/\s+WAREHOUSE$/, "")
      .trim();
    const groupKey = warehouseCode || "UNASSIGNED";

    totalQty += quantity;
    subtotal += unitPrice * quantity;
    if (String(item.caption || "").toLowerCase().includes("louis vuitton")) {
      lvCount += quantity;
    } else {
      otherCount += quantity;
    }

    if (!warehouseGroups.has(groupKey)) {
      warehouseGroups.set(groupKey, {
        label: warehouseCode
          ? `${warehouseCode} Warehouse`
          : "Warehouse not selected",
        items: [],
      });
    }
    warehouseGroups.get(groupKey).items.push({
      caption: String(item.caption || item.name || "Product").trim(),
      quantity,
      unitPrice,
      lineSubtotal: unitPrice * quantity,
    });
  });

  const tiers = Array.isArray(discountTiers) ? discountTiers : [];
  const tier =
    tiers.find((item) => totalQty >= item.min && totalQty <= item.max) ||
    tiers[0] ||
    { percent: 0 };
  const discountPercent = Number(tier.percent) || 0;
  const discountAmount = subtotal * discountPercent;
  const shipping = getShippingCost(totalQty);
  const finalTotal = subtotal - discountAmount + shipping;

  let message = `*New Order Request* 📦\n`;
  message += `----------------------------\n`;
  warehouseGroups.forEach((group) => {
    message += `*${group.label}*\n`;
    group.items.forEach((item) => {
      message += `• ${item.caption}\n`;
      message += `  Unit $${item.unitPrice.toFixed(2)} × ${item.quantity} = Line subtotal *$${item.lineSubtotal.toFixed(2)}*\n`;
    });
    message += `\n`;
  });

  message += `----------------------------\n`;
  message += `LV Quantity: ${lvCount}\n`;
  message += `Other Quantity: ${otherCount}\n`;
  message += `*Total Quantity: ${totalQty} pcs*\n`;
  message += `----------------------------\n`;
  message += `Subtotal: $${subtotal.toFixed(2)}\n`;
  message += `Discount (${Math.round(discountPercent * 100)}%): -$${discountAmount.toFixed(2)}\n`;
  message += `Shipping: ${shipping === 0 ? "FREE" : "$" + shipping.toFixed(2)}\n`;
  message += `*Total Amount:* $${finalTotal.toFixed(2)}`;
  return message;
}

window.buildWhatsAppOrderMessage = buildWhatsAppOrderMessage;
window.getShippingCost = getShippingCost;

function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  // 🔹 注意：这里会将所有表头转为小写 (toLowerCase)
  // 所以表格里的 "Notes" -> "notes", "Inventory" -> "inventory"
  const headers = lines[0]
    .trim()
    .split(",")
    .map((h) => h.trim().toLowerCase());

  return lines
    .slice(1)
    .map((line) => {
      // 处理 CSV 中的逗号和引号
      const values = [];
      let current = "";
      let inQuote = false;
      for (let char of line) {
        if (char === '"') {
          inQuote = !inQuote;
        } else if (char === "," && !inQuote) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const obj = {};
      // 如果列数不匹配，跳过
      if (values.length < headers.length) return null;

      headers.forEach((header, index) => {
        let val = values[index] ? values[index].replace(/^"|"$/g, "") : "";

        // Keep empty numeric cells empty so pending prices and stock can be
        // distinguished from an intentional numeric zero.
        if (
          header === "price" ||
          header === "stock" ||
          header === "inventory" ||
          header === "hot_selling_weight" ||
          header === "new_arrival_weight"
        ) {
          val = val === "" ? "" : Number(val);
        }

        obj[header] = val;
      });

      // The new source uses image_url and target. Map them to the field names
      // expected by the existing storefront without changing the sheet schema.
      obj.img = obj.image_url || obj.img || "";
      obj.gender = obj.target || obj.gender || "";
      obj.inventory = obj.inventory === undefined ? obj.stock : obj.inventory;

      return obj;
    })
    .filter((item) => item !== null);
}
