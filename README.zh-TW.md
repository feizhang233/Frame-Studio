<div align="center">

# Frame Studio / frame2d

**在瀏覽器裡直接畫剛架、跑分析、看 N / V / M 圖。**

React 工作臺 · FastAPI · Python 有限元素核心

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md)

### [🚀 線上體驗 Frame Studio →](https://frame-studio.feizhang233.com)

<br/>

<img src="photo/workbench-overview.png" alt="Frame Studio 工作臺總覽" width="920" />

<sub>開箱即用：畫布建模 · 材料 / 斷面庫 · 結果表與結構圖</sub>

</div>

---

## 快速開始

**必需環境：** Python `3.11+` · Node.js `20.19+` 或 `22.12+` · npm<br>
**選用環境：** Docker，用於透過 MySQL 提供帳號與使用者私有模型儲存

```bash
# 1. 克隆並進入專案
git clone https://github.com/feizhang233/2D-Frame-Project.git
cd 2D-Frame-Project

# 2. Python 環境 + 安裝求解器
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[test]"

# 3. 前端依賴
npm --prefix frontend ci

# 4. 選用：啟用註冊、登入和模型儲存
docker compose up -d mysql

# 5. 一條命令同時啟動前端 + API
npm run dev
```

瀏覽器開啟：

| 服務 | 位址 |
| --- | --- |
| **Frame Studio 工作臺** | http://127.0.0.1:5173 |
| Swagger API 文件 | http://127.0.0.1:8000/docs |
| 健康檢查 | http://127.0.0.1:8000/health |

終端機按 `Ctrl+C` 會同時停止前後端。MySQL 會繼續在 Docker 中執行，可用 `docker compose stop mysql` 停止。

> 建模和求解不依賴 Docker。MySQL 無法使用時，網站仍可用訪客模式正常使用，但註冊、登入和模型儲存無法使用；訪客模型不會寫入瀏覽器本機儲存空間。

> **第一次開啟會看到什麼？**  
> 內建範例 **Portal frame 01**（門式剛架 + 均佈荷載）。點右上角 **Run Analysis**，底部 Results 即可切換位移、反力、軸力、剪力、彎矩。

---

## 產品一覽

### 建模工作臺

左側工具列依工作流排列：節點 → 材料 → 斷面 → 構件 → 支承 → 荷載。  
屬性面板編輯參數，畫布上直接點選、拖曳、縮放。

<p align="center">
  <img src="photo/workbench-overview.png" alt="建模與材料庫" width="880" />
</p>

### 剪力 / 彎矩結果

分析完成後，Results 區可展開結構圖，並依元素查看端點值與包絡。

<p align="center">
  <img src="photo/shear-force-results.png" alt="剪力圖結果" width="880" />
</p>

<p align="center">
  <img src="photo/bending-moment-results.png" alt="彎矩圖結果" width="880" />
</p>

---

## 你能做什麼

| 能力 | 說明 |
| --- | --- |
| 視覺化建模 | SVG 畫布建立節點 / 構件；支援座標輸入、構件上插點拆分 |
| 材料與斷面庫 | 下拉管理、指派到單元；**More details** 在畫布上查看分配 |
| 支承與荷載 | 固定 / 鉸支 / 滾軸預設；節點力矩與分佈荷載 |
| 一鍵分析 | 線性靜力求解：位移、反力、`N / V / M` 場 |
| 結果檢查 | 結構圖 + 表格；校驗殘差與勁度對稱性 |
| IAM 與模型 | 註冊 / 登入、可撤銷 HttpOnly 工作階段、按使用者隔離的 MySQL 模型歷史、不可儲存的訪客模式 |
| 介面與腳本 | REST API、Swagger、可 import 的 `frame2d` 函式庫 |

---

## 典型操作路徑

1. **Node** — 點擊畫布或在屬性裡輸入 `X / Y` 放點  
2. **Material / Section** — 定義 `E`、`A`、`I`，Apply 到構件  
3. **Element** — 點兩個節點連梁柱；需要時可在構件上按比例 / 距離拆分  
4. **Support / Load** — 加支承與荷載  
5. **Run Analysis** — 查看位移、反力、剪力、彎矩  
6. **Save / Models** — 匯出 JSON，或從歷史 / 範例恢復  

新建構件預設未分配材料與斷面；儲存或分析前若有遺漏，工作臺會跳到對應構件並提示指派。

---

## 架構（簡圖）

```mermaid
flowchart LR
    UI["React 工作臺"]
    API["FastAPI"]
    FEM["frame2d 求解核心"]
    DB[("MySQL 模型庫")]

    UI --> API
    API --> FEM
    FEM --> API
    API --> UI
    API <--> DB
```

---

## 常用命令

```bash
docker compose up -d mysql   # 首次啟動 MySQL
npm run dev                 # 開發：前端 + API
FRAME2D_API_RELOAD=1 npm run dev   # 後端也熱更新

pytest                      # 數值 / API 測試
npm run typecheck           # 前端型別檢查
npm run build               # 前端正式建置
```

| 環境變數 | 預設 | 用途 |
| --- | --- | --- |
| `FRAME2D_HOST` | `127.0.0.1` | 監聽位址 |
| `FRAME2D_API_PORT` | `8000` | API 埠 |
| `FRAME2D_FRONTEND_PORT` | `5173` | 前端埠 |
| `FRAME2D_DATABASE_URL` | `mysql://frame2d:frame2d@127.0.0.1:3307/frame2d` | MySQL 模型庫 |
| `FRAME2D_COOKIE_SECURE` | 自動偵測 | HTTPS 反向代理後建議設為 `1` |
| `FRAME2D_API_RELOAD` | `0` | `1` = 後端熱重載 |

單獨啟動服務：

```bash
# 僅 API
uvicorn frame2d.api:app --host 0.0.0.0 --port 8000 --reload

# 僅前端
npm --prefix frontend run dev
```

---

## API 速查

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| `GET` | `/health` | 健康檢查 |
| `POST` | `/api/v1/solve` | 求解（可選嵌入 V/M 圖） |
| `POST` | `/api/v1/plots/shear-force` | 剪力圖 PNG |
| `POST` | `/api/v1/plots/bending-moment` | 彎矩圖 PNG |
| `GET/POST/DELETE` | `/api/v1/models` | 模型歷史 |
| `POST` | `/api/v1/auth/register` | 註冊並建立登入工作階段 |
| `POST` | `/api/v1/auth/login` | 登入 |
| `GET` | `/api/v1/auth/me` | 取得目前使用者 |
| `POST` | `/api/v1/auth/logout` | 登出並撤銷工作階段 |

模型介面必須登入後使用；求解和繪圖介面保持公開，訪客可直接使用。

範例請求（倉庫內建懸臂梁）：

```bash
curl -X POST http://127.0.0.1:8000/api/v1/solve \
  -H "Content-Type: application/json" \
  --data-binary @examples/cantilever_request.json \
  --output result.json
```

---

## 作為 Python 函式庫

```python
from frame2d import FrameElement, NodalLoad, Node, Support, solve_frame

result = solve_frame(
    nodes=[Node(1, 0.0, 0.0), Node(2, 2.0, 0.0)],
    elements=[FrameElement(1, 1, 2, E=210e9, A=3e-3, I=8e-6)],
    supports=[Support(1, u=True, v=True, phi=True)],
    nodal_loads=[NodalLoad(2, fy=-10_000.0)],
)

print(result.nodal_displacements)
print(result.elements[0].fields.bending_moment)
```

---

## 單位（SI 範例）

| 量 | 單位 | 量 | 單位 |
| --- | --- | --- | --- |
| 長度 / 位移 | `m` | 彈性模量 | `Pa` |
| 轉角 | `rad` | 面積 / 慣性矩 | `m²` / `m⁴` |
| 力 / 軸力 / 剪力 | `N` | 力矩 / 彎矩 | `N·m` |
| 分佈荷載 | `N/m` | | |

節點荷載沿全域 `+X / +Y`，正力矩逆時針；分佈荷載沿元素局部軸。軸力以受拉為正。  
完整推導見 [有限元素數學依據](Math%20Logic/2D_Frame_%E6%9C%89%E9%99%90%E5%85%83%E7%B4%A0%E6%95%B8%E5%AD%B8%E4%BE%9D%E6%93%9A.md)。

---

## 目錄結構

```text
photo/             介面截圖（README 用）
frontend/          React + TypeScript + Vite 工作臺
src/frame2d/       有限元素核心、API、繪圖
tests/             數值與 API 測試
examples/          JSON / Python 範例
Math Logic/        數學推導與參考
docker-compose.yml MySQL、API 服務與資料庫持久化卷
scripts/dev.mjs    前後端一鍵啟動
```

---

## 授權與貢獻

歡迎 Issue / PR。提交前建議：

```bash
pytest && npm run typecheck
```
